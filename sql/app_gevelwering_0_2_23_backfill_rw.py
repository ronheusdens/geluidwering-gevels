#!/usr/bin/env python3
"""Backfill app_gevelwering.material.rw_db / c_db / ctr_db from R octave bands (ISO 717-1).

Uses psql CLI (no psycopg2), same pattern as app_gevelwering_0_2_21_assign_rubriek.py.
"""

from __future__ import annotations

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


def compute_rw(r_by_hz: dict[int, float | None]) -> int | None:
    vals = {f: _num(r_by_hz.get(f)) for f in BANDS}
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
    vals = {f: _num(r_by_hz.get(f)) for f in BANDS}
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


def main() -> int:
    r = subprocess.run(
        [
            "psql",
            "-d",
            pg_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            """COPY (
          SELECT id::text AS id,
                 r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz
          FROM app_gevelwering.material
          WHERE rw_db IS NULL
            AND (
              r_125_hz IS NOT NULL OR r_250_hz IS NOT NULL OR r_500_hz IS NOT NULL
              OR r_1000_hz IS NOT NULL OR r_2000_hz IS NOT NULL
            )
        ) TO STDOUT WITH (FORMAT csv, HEADER true)""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    rows = list(csv.DictReader(io.StringIO(r.stdout)))

    updates: list[tuple[str, int | None, int | None, int | None]] = []
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
            continue
        updates.append((row["id"], rw, c, ctr))

    if not updates:
        print("ISO 717-1 backfill: nothing to update")
        return 0

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

    subprocess.run(
        ["psql", "-d", pg_db(), "-v", "ON_ERROR_STOP=1", "-f", path],
        check=True,
    )
    try:
        os.unlink(path)
    except OSError:
        pass

    print(f"ISO 717-1 backfill: updated {len(updates)} materials with Rw (C, Ctr)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"ISO 717-1 backfill failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
