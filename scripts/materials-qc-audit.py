#!/usr/bin/env python3
"""Phase 0 QC audit for app_gevelwering.material (read-only).

Learns from the existing catalog (~1856 rows) without modifying material.
Outputs JSON + Markdown under data/materials-audit/.

Usage (from app-gevelwering root):
  python3 scripts/materials-qc-audit.py
  python3 scripts/materials-qc-audit.py --out data/materials-audit

Exit codes: 0 OK, 1 script error
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import statistics
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from importlib.util import module_from_spec, spec_from_file_location

_SCRIPT_DIR = Path(__file__).resolve().parent
_BACKFILL_PATH = _SCRIPT_DIR.parent / "sql" / "app_gevelwering_0_2_23_backfill_rw.py"
_spec = spec_from_file_location("backfill_rw", _BACKFILL_PATH)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"Cannot load {_BACKFILL_PATH}")
_backfill = module_from_spec(_spec)
_spec.loader.exec_module(_backfill)
compute_ratings = _backfill.compute_ratings
_r_band = _backfill._r_band
_num = _backfill._num

MANDATORY_BANDS = (125, 250, 500, 1000, 2000)
OPTIONAL_BAND = 63
ALL_BANDS = (63,) + MANDATORY_BANDS

# Approximate A-weighting correction [dB] at octave centres (for RA sanity check).
A_WEIGHT = {63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2, 1000: 0.0, 2000: 1.2, 4000: 1.0}


def pg_db() -> str:
    return os.environ.get("BPP_PG_DB") or os.environ.get("PGDATABASE") or "app_gevelwering"


def fetch_all_materials() -> list[dict[str, str]]:
    r = subprocess.run(
        [
            "psql",
            "-d",
            pg_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            """COPY (
          SELECT id::text,
                 catalog_id,
                 material_no::text,
                 name,
                 master_category,
                 category,
                 rubriek_nr::text,
                 subrubriek_nr::text,
                 thickness_mm::text,
                 weight_kg_m2::text,
                 ra_dba::text,
                 source,
                 source_ref,
                 r_63_hz::text,
                 r_125_hz::text,
                 r_250_hz::text,
                 r_500_hz::text,
                 r_1000_hz::text,
                 r_2000_hz::text,
                 r_4000_hz::text,
                 rw_db::text,
                 c_db::text,
                 ctr_db::text,
                 spectrum_ok::text,
                 buildup,
                 cavity_fill,
                 laminate,
                 glass_t1_mm::text,
                 glass_cavity_mm::text,
                 glass_t2_mm::text
          FROM app_gevelwering.material
          ORDER BY rubriek_nr NULLS LAST, subrubriek_nr NULLS LAST, catalog_id
        ) TO STDOUT WITH (FORMAT csv, HEADER true)""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return list(csv.DictReader(io.StringIO(r.stdout)))


def band_val(row: dict[str, str], hz: int) -> float | None:
    key = f"r_{hz}_hz"
    return _r_band(row.get(key))


def approx_ra_from_spectrum(row: dict[str, str]) -> float | None:
    """Rough A-weighted level from available R bands (QC hint, not normative)."""
    vals: list[tuple[float, float]] = []
    for hz in ALL_BANDS + (4000,):
        r = band_val(row, hz)
        if r is None:
            continue
        w = A_WEIGHT.get(hz, 0.0)
        vals.append((r + w, w))
    if len(vals) < 4:
        return None
    # Energy-style average of band levels (simplified).
    lin = sum(10 ** (v[0] / 10.0) for v in vals) / len(vals)
    return 10.0 * math.log10(lin) if lin > 0 else None


def density_kg_m3(row: dict[str, str]) -> float | None:
    t = _num(row.get("thickness_mm"))
    w = _num(row.get("weight_kg_m2"))
    if t is None or w is None or t <= 0 or w <= 0:
        return None
    return w / (t / 1000.0)


def thickness_bucket_mm(t: float | None) -> str | None:
    if t is None or t <= 0:
        return None
    # 5 mm buckets for pattern grouping
    b = int(round(t / 5.0)) * 5
    return f"{b}mm"


def density_bucket(rho: float | None) -> str | None:
    if rho is None or rho <= 0:
        return None
    # 50 kg/m³ buckets
    b = int(round(rho / 50.0)) * 50
    return f"{b}"


def combo_key(row: dict[str, str]) -> str:
    rub = row.get("rubriek_nr") or "?"
    sub = row.get("subrubriek_nr") or "?"
    t = _num(row.get("thickness_mm"))
    rho = density_kg_m3(row)
    tb = thickness_bucket_mm(t) or "no_t"
    rb = density_bucket(rho) or "no_rho"
    return f"R{rub}/S{sub}|d={tb}|rho={rb}"


def is_monotone_increasing(row: dict[str, str]) -> bool | None:
    prev: float | None = None
    for hz in MANDATORY_BANDS:
        r = band_val(row, hz)
        if r is None:
            return None
        if prev is not None and r < prev - 3.0:  # allow 3 dB tolerance
            return False
        prev = r
    return True


def audit_rows(rows: list[dict[str, str]]) -> dict:
    n = len(rows)
    issues: dict[str, list[dict]] = defaultdict(list)
    clusters: dict[str, list[dict]] = defaultdict(list)

    stats = {
        "total": n,
        "has_ra": 0,
        "mandatory_spectrum_complete": 0,
        "has_r63": 0,
        "has_thickness": 0,
        "has_weight": 0,
        "has_density_derived": 0,
        "has_rubriek": 0,
        "rw_match": 0,
        "rw_mismatch": 0,
        "rw_cannot_compute": 0,
        "ra_spectrum_ok": 0,
        "ra_spectrum_warn": 0,
        "mass_thickness_consistent": 0,
        "mass_thickness_mismatch": 0,
        "monotone_spectrum": 0,
        "non_monotone_spectrum": 0,
        "multilayer_tagged": 0,
    }

    for row in rows:
        rid = row["id"]
        cat = row.get("catalog_id") or ""
        label = f"{cat} {row.get('name', '')[:50]}"

        if _num(row.get("ra_dba")) is not None:
            stats["has_ra"] += 1

        rub = _num(row.get("rubriek_nr"))
        if rub is not None and 1 <= rub <= 9:
            stats["has_rubriek"] += 1

        t = _num(row.get("thickness_mm"))
        w = _num(row.get("weight_kg_m2"))
        if t is not None and t > 0:
            stats["has_thickness"] += 1
        if w is not None and w > 0:
            stats["has_weight"] += 1

        rho = density_kg_m3(row)
        if rho is not None:
            stats["has_density_derived"] += 1

        bands_ok = all(band_val(row, hz) is not None for hz in MANDATORY_BANDS)
        if bands_ok:
            stats["mandatory_spectrum_complete"] += 1
        else:
            missing = [hz for hz in MANDATORY_BANDS if band_val(row, hz) is None]
            issues["missing_mandatory_bands"].append(
                {"id": rid, "catalog_id": cat, "name": row.get("name"), "missing_hz": missing}
            )

        if band_val(row, OPTIONAL_BAND) is not None:
            stats["has_r63"] += 1

        # Rw verify
        calc_rw, calc_c, calc_ctr = compute_ratings(
            row.get("r_125_hz"),
            row.get("r_250_hz"),
            row.get("r_500_hz"),
            row.get("r_1000_hz"),
            row.get("r_2000_hz"),
            row.get("r_4000_hz"),
        )
        store_rw = _num(row.get("rw_db"))
        if calc_rw is None:
            stats["rw_cannot_compute"] += 1
        elif store_rw is not None and int(round(store_rw)) == calc_rw:
            stats["rw_match"] += 1
        elif store_rw is not None:
            stats["rw_mismatch"] += 1
            issues["rw_mismatch"].append(
                {
                    "id": rid,
                    "catalog_id": cat,
                    "name": row.get("name"),
                    "stored_rw": int(round(store_rw)),
                    "calc_rw": calc_rw,
                }
            )

        # RA vs spectrum (soft)
        ra = _num(row.get("ra_dba"))
        approx = approx_ra_from_spectrum(row)
        if ra is not None and approx is not None:
            delta = abs(ra - approx)
            if delta <= 5.0:
                stats["ra_spectrum_ok"] += 1
            else:
                stats["ra_spectrum_warn"] += 1
                issues["ra_spectrum_delta"].append(
                    {
                        "id": rid,
                        "catalog_id": cat,
                        "name": row.get("name"),
                        "ra_dba": round(ra, 1),
                        "approx_from_bands": round(approx, 1),
                        "delta_db": round(delta, 1),
                    }
                )

        # mass = rho * d consistency
        if t and w and rho:
            implied_m = rho * (t / 1000.0)
            rel = abs(implied_m - w) / w if w > 0 else 0
            if rel <= 0.05:
                stats["mass_thickness_consistent"] += 1
            else:
                stats["mass_thickness_mismatch"] += 1
                issues["mass_thickness_mismatch"].append(
                    {
                        "id": rid,
                        "catalog_id": cat,
                        "thickness_mm": t,
                        "weight_kg_m2": w,
                        "rho_derived": round(rho, 1),
                        "rel_error": round(rel, 3),
                    }
                )

        mono = is_monotone_increasing(row)
        if mono is True:
            stats["monotone_spectrum"] += 1
        elif mono is False:
            stats["non_monotone_spectrum"] += 1
            issues["non_monotone_spectrum"].append(
                {"id": rid, "catalog_id": cat, "name": row.get("name")}
            )

        buildup = (row.get("buildup") or "").strip()
        laminate = (row.get("laminate") or "").strip()
        cavity = (row.get("cavity_fill") or "").strip()
        name_l = (row.get("name") or "").lower()
        if buildup or laminate or cavity or "spouw" in name_l or "isolatie" in name_l or "laminaat" in name_l:
            stats["multilayer_tagged"] += 1

        if bands_ok and rub is not None:
            clusters[combo_key(row)].append(
                {
                    "id": rid,
                    "catalog_id": cat,
                    "r500": band_val(row, 500),
                    "rho": rho,
                    "thickness_mm": t,
                }
            )

    # Cluster analysis → pattern candidates
    pattern_candidates: list[dict] = []
    weak_clusters: list[dict] = []
    for key, members in sorted(clusters.items(), key=lambda x: -len(x[1])):
        if len(members) < 3:
            continue
        r500_vals = [m["r500"] for m in members if m["r500"] is not None]
        if len(r500_vals) < 3:
            continue
        med = statistics.median(r500_vals)
        if med <= 0:
            continue
        stdev = statistics.pstdev(r500_vals) if len(r500_vals) > 1 else 0.0
        cv = stdev / med
        entry = {
            "combo_key": key,
            "count": len(members),
            "r500_median": round(med, 1),
            "r500_stdev": round(stdev, 2),
            "r500_cv": round(cv, 3),
            "sample_catalog_ids": [m["catalog_id"] for m in members[:5]],
        }
        if len(members) >= 5 and cv <= 0.12:
            pattern_candidates.append({**entry, "confidence": "high"})
        elif len(members) >= 5 and cv <= 0.20:
            pattern_candidates.append({**entry, "confidence": "medium"})
        elif cv > 0.25:
            weak_clusters.append(entry)

    by_rubriek: dict[str, dict] = defaultdict(lambda: {"count": 0, "complete_spectrum": 0})
    for row in rows:
        rub = row.get("rubriek_nr") or "null"
        by_rubriek[rub]["count"] += 1
        if all(band_val(row, hz) is not None for hz in MANDATORY_BANDS):
            by_rubriek[rub]["complete_spectrum"] += 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "database": pg_db(),
        "stats": stats,
        "by_rubriek": dict(by_rubriek),
        "issue_counts": {k: len(v) for k, v in issues.items()},
        "issues": {k: v[:100] for k, v in issues.items()},  # cap per category
        "pattern_candidates": pattern_candidates[:80],
        "weak_clusters": weak_clusters[:40],
        "publish_policy": "latest_approved",
    }


def write_markdown(report: dict, path: Path) -> None:
    s = report["stats"]
    lines = [
        "# Materials catalog — Phase 0 QC audit",
        "",
        f"Generated: {report['generated_at']}  ",
        f"Database: `{report['database']}`  ",
        f"Publish policy: **{report['publish_policy']}** (target for gevelwering sync)",
        "",
        "## Summary",
        "",
        f"| Metric | Count |",
        f"|--------|------:|",
        f"| Total materials | {s['total']} |",
        f"| Rubriek 1–9 assigned | {s['has_rubriek']} |",
        f"| RA present | {s['has_ra']} |",
        f"| Mandatory spectrum 125–2000 Hz complete | {s['mandatory_spectrum_complete']} |",
        f"| Optional R@63 Hz | {s['has_r63']} |",
        f"| Thickness mm | {s['has_thickness']} |",
        f"| Weight kg/m² | {s['has_weight']} |",
        f"| Density derivable (ρ=w/t) | {s['has_density_derived']} |",
        f"| Rw matches ISO recompute | {s['rw_match']} |",
        f"| Rw mismatch | {s['rw_mismatch']} |",
        f"| Rw cannot compute | {s['rw_cannot_compute']} |",
        f"| RA ≈ spectrum (±5 dB) | {s['ra_spectrum_ok']} |",
        f"| RA spectrum warning | {s['ra_spectrum_warn']} |",
        f"| ρ·d consistent with weight | {s['mass_thickness_consistent']} |",
        f"| Mass/thickness mismatch | {s['mass_thickness_mismatch']} |",
        f"| Monotone R(125→2000) | {s['monotone_spectrum']} |",
        f"| Non-monotone (possible vent/glass dip) | {s['non_monotone_spectrum']} |",
        f"| Multilayer-tagged (buildup/name) | {s['multilayer_tagged']} |",
        "",
        "## By rubriek",
        "",
        "| Rubriek | Rows | Complete 125–2000 |",
        "|---------|-----:|------------------:|",
    ]
    for rub in sorted(report["by_rubriek"].keys(), key=lambda x: (x == "null", x)):
        b = report["by_rubriek"][rub]
        lines.append(f"| {rub} | {b['count']} | {b['complete_spectrum']} |")

    lines.extend(
        [
            "",
            "## Issue categories",
            "",
        ]
    )
    for k, v in sorted(report["issue_counts"].items(), key=lambda x: -x[1]):
        lines.append(f"- **{k}**: {v}")

    lines.extend(["", "## Pattern candidates (attribuutcombo ρ+d bucket)", ""])
    if report["pattern_candidates"]:
        lines.append("| Confidence | Combo | n | R500 med | CV |")
        lines.append("|------------|-------|--:|---------:|---:|")
        for p in report["pattern_candidates"][:25]:
            lines.append(
                f"| {p['confidence']} | `{p['combo_key']}` | {p['count']} | "
                f"{p['r500_median']} | {p['r500_cv']} |"
            )
    else:
        lines.append("_No high-confidence patterns yet — widen buckets or enrich ρ/d._")

    lines.extend(
        [
            "",
            "## Next steps (Materials Studio)",
            "",
            "1. Archive `original` spectrum versions (immutable).",
            "2. Review top pattern candidates → `spectrum_pattern` drafts.",
            "3. Flag multilayer rows for MSM/stack models (not single-layer scaling).",
            "4. Publish **latest approved** instances to `app_gevelwering.material` (unchanged API).",
            "",
            "See `report.json` for full issue samples.",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description="Phase 0 materials QC audit (read-only)")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("data/materials-audit"),
        help="Output directory (default: data/materials-audit)",
    )
    args = ap.parse_args()
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Materials QC audit — database {pg_db()}")
    rows = fetch_all_materials()
    print(f"  loaded {len(rows)} rows")

    report = audit_rows(rows)
    json_path = out_dir / "report.json"
    md_path = out_dir / "report.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_markdown(report, md_path)

    s = report["stats"]
    print(f"  mandatory spectrum complete: {s['mandatory_spectrum_complete']}/{s['total']}")
    print(f"  density derivable: {s['has_density_derived']}/{s['total']}")
    print(f"  pattern candidates: {len(report['pattern_candidates'])}")
    print(f"  wrote {json_path}")
    print(f"  wrote {md_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"materials-qc-audit failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
