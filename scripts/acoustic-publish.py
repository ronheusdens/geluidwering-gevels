#!/usr/bin/env python3
"""Publish latest approved acoustic_catalog spectra → app_gevelwering.material.

Engineer/floormap/GA read only app_gevelwering.material; run this after approving
new spectrum_version rows in Materials Studio.

  python3 scripts/acoustic-publish.py
  python3 scripts/acoustic-publish.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys


def pg_db() -> str:
    return os.environ.get("BPP_PG_DB") or os.environ.get("PGDATABASE") or "app_gevelwering"


def psql_scalar(sql: str) -> str:
    r = subprocess.run(
        ["psql", "-d", pg_db(), "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
        check=True,
        capture_output=True,
        text=True,
    )
    return r.stdout.strip()


def psql_exec(sql: str, dry_run: bool) -> None:
    if dry_run:
        print(sql)
        return
    subprocess.run(
        ["psql", "-d", pg_db(), "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True,
    )


LINK_SQL = """
UPDATE acoustic_catalog.material_concept c
SET published_material_id = m.id,
    updated_at = now()
FROM app_gevelwering.material m
WHERE c.published_material_id IS NULL
  AND c.catalog_id IS NOT NULL
  AND m.catalog_id = c.catalog_id
  AND COALESCE(m.source, 'catalogusGG.pdf') = c.catalog_source;
"""

PUBLISH_SQL = """
WITH latest AS (
  SELECT DISTINCT ON (c.id)
    c.id AS concept_id,
    c.published_material_id,
    sv.id AS spectrum_version_id,
    sv.source_attribution,
    sv.r_63_hz, sv.r_125_hz, sv.r_250_hz, sv.r_500_hz,
    sv.r_1000_hz, sv.r_2000_hz, sv.r_4000_hz,
    sv.ra_dba, sv.rw_db, sv.c_db, sv.ctr_db
  FROM acoustic_catalog.material_concept c
  JOIN acoustic_catalog.spectrum_version sv ON sv.concept_id = c.id
  WHERE sv.is_latest_approved AND sv.status = 'approved'
  ORDER BY c.id, sv.version_no DESC
)
UPDATE app_gevelwering.material m SET
  r_63_hz = l.r_63_hz,
  r_125_hz = l.r_125_hz,
  r_250_hz = l.r_250_hz,
  r_500_hz = l.r_500_hz,
  r_1000_hz = l.r_1000_hz,
  r_2000_hz = l.r_2000_hz,
  r_4000_hz = l.r_4000_hz,
  ra_dba = l.ra_dba,
  rw_db = l.rw_db,
  c_db = l.c_db,
  ctr_db = l.ctr_db,
  source_attribution = l.source_attribution,
  acoustic_concept_id = l.concept_id,
  acoustic_spectrum_version_id = l.spectrum_version_id,
  updated_at = now()
FROM latest l
WHERE m.id = l.published_material_id
  AND l.published_material_id IS NOT NULL;
"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Publish approved spectra to material table")
    ap.add_argument("--dry-run", action="store_true", help="Print SQL only")
    args = ap.parse_args()

    approved = psql_scalar(
        "SELECT COUNT(*) FROM acoustic_catalog.spectrum_version "
        "WHERE is_latest_approved AND status = 'approved'"
    )
    print(f"Latest approved spectrum versions: {approved}")

    psql_exec(LINK_SQL, args.dry_run)
    if not args.dry_run:
        linked = psql_scalar(
            "SELECT COUNT(*) FROM acoustic_catalog.material_concept WHERE published_material_id IS NOT NULL"
        )
        print(f"Concepts linked to material rows: {linked}")

    psql_exec(PUBLISH_SQL, args.dry_run)
    if not args.dry_run:
        traced = psql_scalar(
            "SELECT COUNT(*) FROM app_gevelwering.material WHERE acoustic_spectrum_version_id IS NOT NULL"
        )
        print(f"Material rows with published spectrum trace: {traced}")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
