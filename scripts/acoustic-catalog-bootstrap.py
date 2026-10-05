#!/usr/bin/env python3
"""Bootstrap acoustic_catalog from app_gevelwering.material (idempotent).

Creates material_concept + spectrum_version (original, approved, latest) per catalog row.
Does not modify R values on material — only optional trace columns when missing.

  python3 scripts/acoustic-catalog-bootstrap.py
  python3 scripts/acoustic-catalog-bootstrap.py --dry-run
  python3 scripts/acoustic-catalog-bootstrap.py --batch 200
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import subprocess
import sys
import tempfile
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
from importlib.util import module_from_spec, spec_from_file_location

_spec = spec_from_file_location("backfill_rw", _SCRIPT_DIR.parent / "sql" / "app_gevelwering_0_2_23_backfill_rw.py")
assert _spec and _spec.loader
_backfill = module_from_spec(_spec)
_spec.loader.exec_module(_backfill)
compute_ratings = _backfill.compute_ratings


def pg_db() -> str:
    return os.environ.get("BPP_PG_DB") or os.environ.get("PGDATABASE") or "app_gevelwering"


def psql_file(path: str) -> None:
    subprocess.run(
        ["psql", "-d", pg_db(), "-v", "ON_ERROR_STOP=1", "-f", path],
        check=True,
    )


def psql_scalar(sql: str) -> str:
    r = subprocess.run(
        ["psql", "-d", pg_db(), "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
        check=True,
        capture_output=True,
        text=True,
    )
    return r.stdout.strip()


def fetch_materials() -> list[dict[str, str]]:
    r = subprocess.run(
        [
            "psql",
            "-d",
            pg_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            """COPY (
          SELECT id::text, catalog_id, source, name, source_ref,
                 rubriek_nr::text, subrubriek_nr::text,
                 thickness_mm::text, weight_kg_m2::text,
                 ra_dba::text, r_63_hz::text, r_125_hz::text, r_250_hz::text,
                 r_500_hz::text, r_1000_hz::text, r_2000_hz::text, r_4000_hz::text,
                 rw_db::text, c_db::text, ctr_db::text
          FROM app_gevelwering.material
          ORDER BY catalog_id
        ) TO STDOUT WITH (FORMAT csv, HEADER true)""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return list(csv.DictReader(io.StringIO(r.stdout)))


def sql_str(s: str | None) -> str:
    if s is None or s.strip() == "":
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def sql_num(s: str | None) -> str:
    if s is None or s.strip() in ("", "NULL"):
        return "NULL"
    return s.strip()


def attribution(row: dict[str, str]) -> str:
    src = (row.get("source") or "catalogusGG.pdf").strip()
    ref = (row.get("source_ref") or "").strip()
    if ref:
        return f"bron: {src} / {ref}"
    return f"bron: {src}"


def fetch_existing_catalog_keys() -> set[tuple[str, str]]:
    r = subprocess.run(
        [
            "psql",
            "-d",
            pg_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            """COPY (
          SELECT catalog_source, catalog_id
          FROM acoustic_catalog.material_concept
          WHERE catalog_id IS NOT NULL
        ) TO STDOUT WITH (FORMAT csv, HEADER true)""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    out: set[tuple[str, str]] = set()
    for row in csv.DictReader(io.StringIO(r.stdout)):
        out.add((row["catalog_source"], row["catalog_id"]))
    return out


def stmt_for_row(row: dict[str, str], existing: set[tuple[str, str]]) -> str | None:
    cat = (row.get("catalog_id") or "").strip()
    src = (row.get("source") or "catalogusGG.pdf").strip()
    if not cat:
        return None
    if (src, cat) in existing:
        return None

    r125 = sql_num(row.get("r_125_hz"))
    if r125 == "NULL":
        return None

    mid = row["id"]
    t = sql_num(row.get("thickness_mm"))
    w = sql_num(row.get("weight_kg_m2"))
    rho = "NULL"
    if t != "NULL" and w != "NULL":
        rho = f"({w}) / NULLIF(({t}) / 1000.0, 0)"

    attr = attribution(row)
    rw, c, ctr = compute_ratings(
        row.get("r_125_hz"),
        row.get("r_250_hz"),
        row.get("r_500_hz"),
        row.get("r_1000_hz"),
        row.get("r_2000_hz"),
        row.get("r_4000_hz"),
    )

    return f"""
INSERT INTO acoustic_catalog.material_concept (
  catalog_source, catalog_id, material_kind, name,
  rubriek_nr, subrubriek_nr, thickness_mm, density_kg_m3, weight_kg_m2,
  source_ref, published_material_id
) VALUES (
  {sql_str(src)}, {sql_str(cat)}, 'homogeneous', {sql_str(row.get('name'))},
  {sql_num(row.get('rubriek_nr'))}::smallint, {sql_num(row.get('subrubriek_nr'))}::smallint,
  {t}::float8, {rho}::float8, {w}::float8,
  {sql_str(row.get('source_ref'))}, '{mid}'::uuid
)
ON CONFLICT DO NOTHING;

INSERT INTO acoustic_catalog.spectrum_version (
  concept_id, version_kind, version_no, status, is_latest_approved,
  source_attribution,
  r_63_hz, r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
  ra_dba, rw_db, c_db, ctr_db, approved_at, approved_by
)
SELECT c.id, 'original', 0, 'approved', true,
  {sql_str(attr)},
  {sql_num(row.get('r_63_hz'))}::float8, {r125}::float8,
  {sql_num(row.get('r_250_hz'))}::float8, {sql_num(row.get('r_500_hz'))}::float8,
  {sql_num(row.get('r_1000_hz'))}::float8, {sql_num(row.get('r_2000_hz'))}::float8,
  {sql_num(row.get('r_4000_hz'))}::float8,
  {sql_num(row.get('ra_dba'))}::float8,
  {sql_num(str(rw) if rw is not None else None)}::float8,
  {sql_num(str(c) if c is not None else None)}::float8,
  {sql_num(str(ctr) if ctr is not None else None)}::float8,
  now(), 'bootstrap'
FROM acoustic_catalog.material_concept c
WHERE c.catalog_source = {sql_str(src)} AND c.catalog_id = {sql_str(cat)}
  AND NOT EXISTS (
    SELECT 1 FROM acoustic_catalog.spectrum_version sv
    WHERE sv.concept_id = c.id AND sv.version_no = 0
  );

UPDATE app_gevelwering.material m SET
  source_attribution = COALESCE(m.source_attribution, {sql_str(attr)}),
  acoustic_concept_id = c.id,
  acoustic_spectrum_version_id = sv.id
FROM acoustic_catalog.material_concept c
JOIN acoustic_catalog.spectrum_version sv ON sv.concept_id = c.id AND sv.version_no = 0
WHERE m.id = '{mid}'::uuid
  AND c.catalog_source = {sql_str(src)} AND c.catalog_id = {sql_str(cat)};
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--batch", type=int, default=150, help="Rows per SQL file")
    args = ap.parse_args()

    rows = fetch_materials()
    existing = fetch_existing_catalog_keys()
    print(f"Bootstrap acoustic_catalog from {len(rows)} material rows ({len(existing)} already imported)")

    pending: list[str] = []
    inserts = 0
    skipped = 0

    for row in rows:
        st = stmt_for_row(row, existing)
        if st is None:
            skipped += 1
            continue
        pending.append(st)
        inserts += 1
        cat = (row.get("catalog_id") or "").strip()
        src = (row.get("source") or "catalogusGG.pdf").strip()
        existing.add((src, cat))

    if args.dry_run:
        print(f"  would insert {inserts} concepts (skip {skipped})")
        return 0

    if not pending:
        print(f"  nothing to insert (skip {skipped})")
        return 0

    batch = max(1, args.batch)
    for i in range(0, len(pending), batch):
        chunk = pending[i : i + batch]
        with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as f:
            path = f.name
            f.write("BEGIN;\n")
            f.write("\n".join(chunk))
            f.write("\nCOMMIT;\n")
        try:
            psql_file(path)
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass
        print(f"  batch {i // batch + 1}: {len(chunk)} rows")

    print(f"  inserted {inserts} concepts + original spectra (skip {skipped})")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"bootstrap failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
