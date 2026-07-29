#!/usr/bin/env python3
"""Parse DGMR catalogusGG.pdf → tabular CSV/JSON + PostgreSQL seed for app_gevelwering.material.

PDF text is column-clipped (literal '...'); we recover fields via word X positions.
Master category is the page section title (Elementen, Glas, Ventilatievoorzieningen, …).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

import fitz

ID_RE = re.compile(r"^D\d{5}$")
NUM_RE = re.compile(r"^-?\d+(?:[.,]\d+)?$")

# Column X midpoints / bands by section layout
ELEMENTEN_BANDS = [
    ("catalog_id", 0, 90),
    ("name", 90, 165),
    ("thickness_mm", 165, 193),
    ("weight_kg_m2", 193, 238),
    ("ra_dba", 238, 255),
    ("source_ref", 255, 325),
    ("r_63_hz", 325, 345),
    ("r_125_hz", 345, 365),
    ("r_250_hz", 365, 385),
    ("r_500_hz", 385, 405),
    ("r_1000_hz", 405, 425),
    ("r_2000_hz", 425, 445),
    ("supplier", 445, 512),
    ("phone", 512, 999),
]

GLAS_BANDS = [
    ("catalog_id", 0, 90),
    ("name", 90, 165),
    ("thickness_mm", 165, 193),
    ("weight_kg_m2", 193, 238),
    ("ra_dba", 238, 255),
    ("source_ref", 255, 325),
    ("r_63_hz", 325, 345),
    ("r_125_hz", 345, 365),
    ("r_250_hz", 365, 385),
    ("r_500_hz", 385, 405),
    ("r_1000_hz", 405, 425),
    ("r_2000_hz", 425, 445),
    ("buildup", 445, 478),
    ("cavity_fill", 478, 512),
    ("laminate", 512, 999),
]

VENT_BANDS = [
    ("catalog_id", 0, 90),
    ("name", 90, 170),
    ("rqa_dba", 170, 195),
    ("c_dm3_s", 195, 230),
    ("dna_dba", 230, 250),
    ("source_ref", 250, 315),
    ("r_63_hz", 315, 335),
    ("r_125_hz", 335, 355),
    ("r_250_hz", 355, 375),
    ("r_500_hz", 375, 395),
    ("r_1000_hz", 395, 412),
    ("r_2000_hz", 412, 434),
    ("height_mm", 434, 458),
    ("depth_mm", 458, 470),
    ("length_mm", 470, 999),
]

VENT_OUD_BANDS = [
    ("catalog_id", 0, 90),
    ("name", 90, 175),
    ("sh_mm", 175, 195),
    ("doorlaat_m2_m", 195, 235),
    ("ra_dba", 235, 250),
    ("source_ref", 250, 315),
    ("r_63_hz", 315, 335),
    ("r_125_hz", 335, 355),
    ("r_250_hz", 355, 375),
    ("r_500_hz", 375, 395),
    ("r_1000_hz", 395, 412),
    ("r_2000_hz", 412, 434),
    ("height_mm", 434, 458),
    ("depth_mm", 458, 470),
    ("length_mm", 470, 520),
    ("supplier", 520, 999),
]


def parse_num(s: str | None) -> float | None:
    if s is None:
        return None
    t = s.strip().replace(",", ".")
    if not t or t in {".", "-", "..."}:
        return None
    # strip trailing ellipsis glued to number
    t = t.rstrip(".")
    if t.endswith("..."):
        t = t[:-3]
    if not NUM_RE.match(t):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def clean_text(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    # keep ellipsis marker as-is (PDF truncation)
    return s


def bands_for_master(master: str):
    m = master.lower()
    if m == "glas":
        return GLAS_BANDS
    if m == "ventilatievoorzieningen":
        return VENT_BANDS
    if "ventilatie" in m and "oud" in m:
        return VENT_OUD_BANDS
    return ELEMENTEN_BANDS


def detect_master(page) -> str:
    words = page.get_text("words")
    # Section title sits above the column header (~y 46–60).
    titles = []
    for w in words:
        x0, y0, x1, y1, word, *_ = w
        if y0 < 68 and x0 < 220 and not word.startswith("Id"):
            titles.append((x0, y0, word))
    titles.sort(key=lambda t: (t[1], t[0]))
    if not titles:
        return "Onbekend"
    # Keep words on the first title line only
    y0 = titles[0][1]
    line = [w for x, y, w in titles if abs(y - y0) < 4]
    return clean_text(" ".join(line))


def group_rows(page) -> list[list[tuple[float, str]]]:
    words = page.get_text("words")
    buckets: dict[int, list[tuple[float, str]]] = defaultdict(list)
    for w in words:
        x0, y0, x1, y1, word, *_ = w
        if y0 < 70:  # skip title + header
            continue
        # bin by ~3.3 pt (half line)
        ykey = int(round(y0 / 3.3))
        buckets[ykey].append((x0, word))
    rows = []
    for ykey in sorted(buckets):
        items = sorted(buckets[ykey], key=lambda t: t[0])
        if not items:
            continue
        # unit subtitle lines
        joined = " ".join(w for _, w in items)
        if joined.startswith("[") or joined.startswith("Id "):
            continue
        rows.append(items)
    return rows


def assign_fields(items: list[tuple[float, str]], bands) -> dict[str, str]:
    bags: dict[str, list[str]] = {name: [] for name, _, _ in bands}
    for x, word in items:
        for name, x0, x1 in bands:
            if x0 <= x < x1:
                bags[name].append(word)
                break
    return {k: clean_text(" ".join(v)) for k, v in bags.items() if v}


def enrich_row(raw: dict, master: str, index: int) -> dict | None:
    cid = raw.get("catalog_id", "").split()[0] if raw.get("catalog_id") else ""
    if not ID_RE.match(cid):
        return None
    name = raw.get("name") or ""
    if not name:
        return None

    material_no = int(cid[1:])
    # Subcategory 'glas' only for real Glas section products — not name matches
    # (foamglas, GlasMax, glasdeur, etc. are not glass pane catalog entries).
    category = "glas" if master == "Glas" else None

    r63 = parse_num(raw.get("r_63_hz"))
    r125 = parse_num(raw.get("r_125_hz"))
    r250 = parse_num(raw.get("r_250_hz"))
    r500 = parse_num(raw.get("r_500_hz"))
    r1000 = parse_num(raw.get("r_1000_hz"))
    r2000 = parse_num(raw.get("r_2000_hz"))
    spectrum = [r63, r125, r250, r500, r1000, r2000]
    spectrum_ok = any(v is not None for v in spectrum)

    # Parse simple glass buildup "4 12 9" → t1/cavity/t2 when present in buildup field
    glass_t1 = glass_cav = glass_t2 = None
    buildup = raw.get("buildup") or ""
    nums = [parse_num(p) for p in buildup.replace(",", " ").split()]
    nums = [n for n in nums if n is not None]
    if len(nums) >= 3:
        glass_t1, glass_cav, glass_t2 = nums[0], nums[1], nums[2]
    elif master.lower() == "glas":
        # try from name like 4-12-4
        m = re.search(r"(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)", name)
        if m:
            glass_t1, glass_cav, glass_t2 = float(m.group(1)), float(m.group(2)), float(m.group(3))

    row = {
        "catalog_index": index,
        "catalog_id": cid,
        "material_no": material_no,
        "master_category": master,
        "name": name,
        "category": category,
        "thickness_mm": parse_num(raw.get("thickness_mm")),
        "weight_kg_m2": parse_num(raw.get("weight_kg_m2")),
        "ra_dba": parse_num(raw.get("ra_dba")),
        "source_ref": raw.get("source_ref") or None,
        "r_63_hz": r63,
        "r_125_hz": r125,
        "r_250_hz": r250,
        "r_500_hz": r500,
        "r_1000_hz": r1000,
        "r_2000_hz": r2000,
        "spectrum_ok": spectrum_ok,
        "supplier": raw.get("supplier") or None,
        "phone": raw.get("phone") or None,
        "buildup": buildup or None,
        "cavity_fill": raw.get("cavity_fill") or None,
        "laminate": raw.get("laminate") or None,
        "glass_t1_mm": glass_t1,
        "glass_cavity_mm": glass_cav,
        "glass_t2_mm": glass_t2,
        "rqa_dba": parse_num(raw.get("rqa_dba")),
        "c_dm3_s": parse_num(raw.get("c_dm3_s")),
        "dna_dba": parse_num(raw.get("dna_dba")),
        "height_mm": parse_num(raw.get("height_mm")),
        "depth_mm": parse_num(raw.get("depth_mm")),
        "length_mm": parse_num(raw.get("length_mm")),
        "sh_mm": parse_num(raw.get("sh_mm")),
        "doorlaat_m2_m": parse_num(raw.get("doorlaat_m2_m")),
        "source": "catalogusGG.pdf",
        "r_db": spectrum if spectrum_ok else None,
    }
    return row


def parse_pdf(path: Path) -> list[dict]:
    doc = fitz.open(path)
    out: list[dict] = []
    seen: set[str] = set()
    for page in doc:
        master = detect_master(page)
        bands = bands_for_master(master)
        for items in group_rows(page):
            raw = assign_fields(items, bands)
            row = enrich_row(raw, master, len(out))
            if not row:
                continue
            if row["catalog_id"] in seen:
                continue
            seen.add(row["catalog_id"])
            out.append(row)
    return out


def _sql_num(v: float | None) -> str:
    return "NULL" if v is None else repr(float(v))


def _sql_text(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def _sql_bool(v: bool) -> str:
    return "TRUE" if v else "FALSE"


def _sql_array(vals: list[float | None] | None) -> str:
    if not vals or any(v is None for v in vals):
        # still store partial as NULL overall; or pack with NULLs — PG arrays can't mix easily for CHECK len=6
        if not vals:
            return "NULL"
        parts = ["NULL" if v is None else repr(float(v)) for v in vals]
        if any(p == "NULL" for p in parts):
            return "NULL"
        return "ARRAY[" + ", ".join(parts) + "]::double precision[]"
    return "ARRAY[" + ", ".join(repr(float(v)) for v in vals) + "]::double precision[]"


COLS = [
    "catalog_index",
    "catalog_id",
    "material_no",
    "master_category",
    "name",
    "category",
    "thickness_mm",
    "weight_kg_m2",
    "ra_dba",
    "source_ref",
    "r_63_hz",
    "r_125_hz",
    "r_250_hz",
    "r_500_hz",
    "r_1000_hz",
    "r_2000_hz",
    "spectrum_ok",
    "supplier",
    "phone",
    "buildup",
    "cavity_fill",
    "laminate",
    "glass_t1_mm",
    "glass_cavity_mm",
    "glass_t2_mm",
    "rqa_dba",
    "c_dm3_s",
    "dna_dba",
    "height_mm",
    "depth_mm",
    "length_mm",
    "sh_mm",
    "doorlaat_m2_m",
    "r_db",
    "source",
]


def write_csv(rows: list[dict], path: Path) -> None:
    fields = [c for c in COLS if c != "r_db"]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) for k in fields})


def write_json(rows: list[dict], path: Path) -> None:
    masters: dict[str, int] = defaultdict(int)
    for r in rows:
        masters[r["master_category"]] += 1
    doc = {
        "source": "catalogusGG.pdf",
        "material_count": len(rows),
        "master_categories": dict(masters),
        "spectrum_bands_Hz": [63, 125, 250, 500, 1000, 2000],
        "spectrum_note": (
            "R (dB) at 63–2000 Hz from catalogusGG.pdf. "
            "Description/source text may be truncated with '...' in the PDF text layer."
        ),
        "materials": rows,
    }
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_pg_seed(rows: list[dict], path: Path) -> None:
    lines = [
        "-- Auto-generated by catalogus_gg_to_table.py — do not edit by hand.",
        "-- acoustics DDL 0.2.14 seed: catalogusGG.pdf → app_gevelwering.material",
        "",
        "BEGIN;",
        "DELETE FROM app_gevelwering.material;",
        "",
    ]
    batch: list[str] = []

    def flush() -> None:
        nonlocal batch
        if not batch:
            return
        col_list = ", ".join(COLS)
        lines.append(f"INSERT INTO app_gevelwering.material ({col_list}) VALUES")
        lines.append("  " + ",\n  ".join(batch) + ";")
        lines.append("")
        batch = []

    for r in rows:
        vals = []
        for c in COLS:
            if c == "r_db":
                vals.append(_sql_array(r.get("r_db")))
            elif c == "spectrum_ok":
                vals.append(_sql_bool(bool(r.get("spectrum_ok"))))
            elif c in {
                "catalog_index",
                "material_no",
            }:
                vals.append(str(int(r[c])))
            elif c in {
                "thickness_mm",
                "weight_kg_m2",
                "ra_dba",
                "r_63_hz",
                "r_125_hz",
                "r_250_hz",
                "r_500_hz",
                "r_1000_hz",
                "r_2000_hz",
                "glass_t1_mm",
                "glass_cavity_mm",
                "glass_t2_mm",
                "rqa_dba",
                "c_dm3_s",
                "dna_dba",
                "height_mm",
                "depth_mm",
                "length_mm",
                "sh_mm",
                "doorlaat_m2_m",
            }:
                vals.append(_sql_num(r.get(c)))
            else:
                vals.append(_sql_text(r.get(c)))
        batch.append("(" + ", ".join(vals) + ")")
        if len(batch) >= 80:
            flush()
    flush()
    lines.extend(["COMMIT;", ""])
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", nargs="?", default="catalogusGG.pdf", type=Path)
    ap.add_argument("--csv", type=Path, default=Path("catalogusGG_materials.csv"))
    ap.add_argument("--json", type=Path, default=Path("catalogusGG_materials.json"))
    ap.add_argument("--sql", type=Path, default=None)
    args = ap.parse_args()

    rows = parse_pdf(args.input)
    # reindex after dedupe
    for i, r in enumerate(rows):
        r["catalog_index"] = i

    write_csv(rows, args.csv)
    write_json(rows, args.json)
    outputs = [str(args.csv), str(args.json)]
    if args.sql:
        write_pg_seed(rows, args.sql)
        outputs.append(str(args.sql))

    masters: dict[str, int] = defaultdict(int)
    for r in rows:
        masters[r["master_category"]] += 1
    print(f"Parsed {len(rows)} materials → {', '.join(outputs)}")
    for k, v in sorted(masters.items(), key=lambda kv: -kv[1]):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
