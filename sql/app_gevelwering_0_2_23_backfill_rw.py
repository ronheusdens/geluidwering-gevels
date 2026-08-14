#!/usr/bin/env python3
"""Rw / C / Ctr from R octave bands (ISO 717-1) for app_gevelwering.material.

Uses psql CLI (no psycopg2), same pattern as app_gevelwering_0_2_21_assign_rubriek.py.

Modes:
  (default)   Fill rows where rw_db IS NULL (idempotent; used by start.sh).
  --verify    Recompute all rows with enough R-bands; report mismatches (dry-run).
  --force     Like --verify, but WRITE computed Rw/C/Ctr where they differ or are NULL.

Examples:
  python3 sql/app_gevelwering_0_2_23_backfill_rw.py --verify
  python3 sql/app_gevelwering_0_2_23_backfill_rw.py --verify --force
  python3 sql/app_gevelwering_0_2_23_backfill_rw.py --verify --limit 20
"""

from __future__ import annotations

import argparse
import csv
import io
import math
import os
import subprocess
import sys
import tempfile

# ISO 717-1:2013 Table 3 — octave-band reference curve for Rw
REF_OCTAVE = {
    125: 36.0,
    250: 45.0,
    500: 52.0,
    1000: 55.0,
    2000: 56.0,
    4000: 56.0,
}

# ISO 717-1 Annex — octave spectrum levels for C / Ctr (relative)
SPEC_C = {125: -21.0, 250: -14.0, 500: -8.0, 1000: -5.0, 2000: -4.0, 4000: -6.0}
SPEC_CTR = {125: -14.0, 250: -10.0, 500: -7.0, 1000: -4.0, 2000: -6.0, 4000: -11.0}

BANDS = (125, 250, 500, 1000, 2000, 4000)
MAX_UNFAV_OCTAVE = 10.0


def pg_db() -> str:
    return os.environ.get("BPP_PG_DB") or os.environ.get("PGDATABASE") or "app_gevelwering"


def _num(v) -> float | None:
    if v is None or v == "" or str(v).upper() == "NULL":
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def _r_band(v) -> float | None:
    """Octave R [dB]; treat ≤0 as missing (catalog placeholder / empty cell)."""
    x = _num(v)
    if x is None or x <= 0:
        return None
    return x


def _int_or_none(v) -> int | None:
    x = _num(v)
    if x is None:
        return None
    return int(round(x))


def compute_rw(r_by_hz: dict[int, float | None]) -> int | None:
    vals = {f: _r_band(r_by_hz.get(f)) for f in BANDS}
    if sum(1 for f in BANDS if vals[f] is not None) < 4:
        return None
    if vals[4000] is None and vals[2000] is not None:
        vals[4000] = vals[2000]

    best = None
    for shift in range(-60, 81):
        unfav = 0.0
        ok = True
        for f in BANDS:
            r = vals[f]
            if r is None:
                continue
            ref = REF_OCTAVE[f] + shift
            d = ref - r
            if d > 0:
                unfav += d
                if unfav > MAX_UNFAV_OCTAVE + 1e-9:
                    ok = False
                    break
        if ok:
            best = shift
    if best is None:
        return None
    # Rw = value of the shifted reference curve at 500 Hz
    return int(REF_OCTAVE[500] + best)


def _adapt(r_by_hz: dict[int, float | None], rw: int, spectrum: dict[int, float]) -> int | None:
    vals = {f: _r_band(r_by_hz.get(f)) for f in BANDS}
    if vals[4000] is None and vals[2000] is not None:
        vals[4000] = vals[2000]
    s = 0.0
    n = 0
    for f in BANDS:
        r = vals[f]
        if r is None:
            continue
        s += 10.0 ** ((spectrum[f] - r) / 10.0)
        n += 1
    if n < 4 or s <= 0:
        return None
    x = -10.0 * math.log10(s) - rw
    return int(round(x))


def compute_ratings(r125, r250, r500, r1000, r2000, r4000):
    r_by = {
        125: r125,
        250: r250,
        500: r500,
        1000: r1000,
        2000: r2000,
        4000: r4000,
    }
    rw = compute_rw(r_by)
    if rw is None:
        return None, None, None
    c = _adapt(r_by, rw, SPEC_C)
    ctr = _adapt(r_by, rw, SPEC_CTR)
    return rw, c, ctr


def sql_num(v: int | None) -> str:
    return "NULL" if v is None else str(int(v))


def fetch_materials(where_sql: str) -> list[dict[str, str]]:
    r = subprocess.run(
        [
            "psql",
            "-d",
            pg_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            f"""COPY (
          SELECT id::text AS id,
                 COALESCE(catalog_id, '') AS catalog_id,
                 COALESCE(name, '') AS name,
                 r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
                 rw_db, c_db, ctr_db
          FROM app_gevelwering.material
          WHERE {where_sql}
        ) TO STDOUT WITH (FORMAT csv, HEADER true)""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return list(csv.DictReader(io.StringIO(r.stdout)))


def apply_updates(updates: list[tuple[str, int | None, int | None, int | None]]) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as f:
        path = f.name
        f.write("BEGIN;\n")
        for mid, rw, c, ctr in updates:
            f.write(
                "UPDATE app_gevelwering.material SET "
                f"rw_db = {sql_num(rw)}, c_db = {sql_num(c)}, ctr_db = {sql_num(ctr)}, "
                f"updated_at = now() WHERE id = '{mid}'::uuid;\n"
            )
        f.write("COMMIT;\n")

    try:
        subprocess.run(
            ["psql", "-d", pg_db(), "-v", "ON_ERROR_STOP=1", "-f", path],
            check=True,
        )
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def fmt_rating(v: int | None) -> str:
    return "—" if v is None else str(v)


def run_backfill_nulls() -> int:
    """Default start.sh path: only rows still missing rw_db."""
    rows = fetch_materials(
        """rw_db IS NULL
            AND (
              r_125_hz IS NOT NULL OR r_250_hz IS NOT NULL OR r_500_hz IS NOT NULL
              OR r_1000_hz IS NOT NULL OR r_2000_hz IS NOT NULL
            )"""
    )
    updates: list[tuple[str, int | None, int | None, int | None]] = []
    skipped = 0
    for row in rows:
        rw, c, ctr = compute_ratings(
            row.get("r_125_hz"),
            row.get("r_250_hz"),
            row.get("r_500_hz"),
            row.get("r_1000_hz"),
            row.get("r_2000_hz"),
            row.get("r_4000_hz"),
        )
        if rw is None:
            skipped += 1
            continue
        updates.append((row["id"], rw, c, ctr))

    if not updates:
        print("ISO 717-1 backfill: nothing to update")
        if skipped:
            print(f"  ({skipped} row(s) had rw_db NULL but insufficient R-bands)")
        return 0

    apply_updates(updates)
    print(f"ISO 717-1 backfill: updated {len(updates)} materials with Rw (C, Ctr)")
    if skipped:
        print(f"  skipped {skipped} (insufficient R-bands)")
    return 0


def run_verify(*, force: bool, limit: int) -> int:
    """Recompute all materials with enough spectrum; report / optionally fix mismatches."""
    rows = fetch_materials(
        """r_125_hz IS NOT NULL OR r_250_hz IS NOT NULL OR r_500_hz IS NOT NULL
           OR r_1000_hz IS NOT NULL OR r_2000_hz IS NOT NULL OR r_4000_hz IS NOT NULL"""
    )

    ok = 0
    mismatch = 0
    no_compute = 0
    updates: list[tuple[str, int | None, int | None, int | None]] = []
    samples: list[str] = []

    for row in rows:
        calc_rw, calc_c, calc_ctr = compute_ratings(
            row.get("r_125_hz"),
            row.get("r_250_hz"),
            row.get("r_500_hz"),
            row.get("r_1000_hz"),
            row.get("r_2000_hz"),
            row.get("r_4000_hz"),
        )
        if calc_rw is None:
            no_compute += 1
            continue

        store_rw = _int_or_none(row.get("rw_db"))
        store_c = _int_or_none(row.get("c_db"))
        store_ctr = _int_or_none(row.get("ctr_db"))

        same = store_rw == calc_rw and store_c == calc_c and store_ctr == calc_ctr
        if same:
            ok += 1
            continue

        mismatch += 1
        updates.append((row["id"], calc_rw, calc_c, calc_ctr))
        if len(samples) < limit:
            label = (row.get("catalog_id") or "").strip() or row["id"][:8]
            name = (row.get("name") or "").strip()[:40]
            samples.append(
                f"  {label} {name}: "
                f"stored Rw={fmt_rating(store_rw)} C={fmt_rating(store_c)} Ctr={fmt_rating(store_ctr)} "
                f"→ calc Rw={fmt_rating(calc_rw)} C={fmt_rating(calc_c)} Ctr={fmt_rating(calc_ctr)}"
            )

    mode = "VERIFY+FORCE" if force else "VERIFY (dry-run)"
    print(f"ISO 717-1 {mode}")
    print(f"  rows with spectrum:     {len(rows)}")
    print(f"  match stored:           {ok}")
    print(f"  mismatch / missing:     {mismatch}")
    print(f"  cannot compute (<4 R):  {no_compute}")
    if samples:
        print(f"  sample mismatches (max {limit}):")
        for line in samples:
            print(line)
        if mismatch > limit:
            print(f"  … +{mismatch - limit} more")

    if force and updates:
        apply_updates(updates)
        print(f"  wrote {len(updates)} row(s)")
    elif force:
        print("  nothing to write")
    else:
        print("  (geen schrijfactie — gebruik --force om mismatches te overschrijven)")

    # Non-zero exit when verifying and mismatches remain (useful in CI).
    if not force and mismatch > 0:
        return 2
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Backfill / verify Rw (C, Ctr) from R octave bands (ISO 717-1)."
    )
    p.add_argument(
        "--verify",
        action="store_true",
        help="Recompute all materials with R-bands and compare to stored Rw/C/Ctr",
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="With --verify: write computed values where they differ or are NULL",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=25,
        metavar="N",
        help="Max sample mismatch lines to print (default: 25)",
    )
    args = p.parse_args(argv)
    if args.force and not args.verify:
        p.error("--force requires --verify")
    if args.limit < 0:
        p.error("--limit must be >= 0")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.verify:
        return run_verify(force=args.force, limit=args.limit)
    return run_backfill_nulls()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"ISO 717-1 backfill failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
