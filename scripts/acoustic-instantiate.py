#!/usr/bin/env python3
"""Preview / propose spectra from patterns or wall assemblies.

Examples:
  # Kalkzandsteen 214 mm from pattern
  python3 scripts/acoustic-instantiate.py --pattern SP-R1-S2-KALKZANDSTEEN --thickness 214

  # HSB buitenwand stack (MSM preview)
  python3 scripts/acoustic-instantiate.py --assembly ASM-HSB-BUITENWAND-V1

Proposals are printed as JSON; use Materials Studio to approve → publish to material.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import subprocess
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPT_DIR / "lib"))
from acoustic_physics import (  # noqa: E402
    MANDATORY_HZ,
    StackLayer,
    approximate_ra_from_r,
    scale_r_by_thickness_mass_law,
    stack_spectrum_db,
)


def pg_db() -> str:
    return os.environ.get("BPP_PG_DB") or os.environ.get("PGDATABASE") or "app_gevelwering"


def fetch_pattern(code: str) -> dict | None:
    r = subprocess.run(
        [
            "psql",
            "-d",
            pg_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            f"""COPY (
          SELECT code, name, thickness_mm_ref, density_kg_m3_ref,
                 r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz,
                 scaling::text
          FROM acoustic_catalog.spectrum_pattern WHERE code = '{code.replace("'", "''")}'
        ) TO STDOUT WITH (FORMAT csv, HEADER true)""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    rows = list(csv.DictReader(io.StringIO(r.stdout)))
    return rows[0] if rows else None


def fetch_assembly_layers(code: str) -> list[dict[str, str]]:
    r = subprocess.run(
        [
            "psql",
            "-d",
            pg_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            f"""COPY (
          SELECT l.layer_order, l.layer_kind, l.label,
                 l.thickness_mm::text, l.density_kg_m3::text,
                 l.surface_mass_kg_m2::text, l.cavity_depth_mm::text,
                 l.acoustic_role
          FROM acoustic_catalog.wall_assembly_layer l
          JOIN acoustic_catalog.wall_assembly a ON a.id = l.assembly_id
          WHERE a.code = '{code.replace("'", "''")}'
          ORDER BY l.layer_order
        ) TO STDOUT WITH (FORMAT csv, HEADER true)""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return list(csv.DictReader(io.StringIO(r.stdout)))


def _f(v: str | None) -> float | None:
    if v is None or v.strip() == "":
        return None
    return float(v)


def instantiate_pattern(pattern: dict, thickness_mm: float) -> dict:
    ref = {
        125: float(pattern["r_125_hz"]),
        250: float(pattern["r_250_hz"]),
        500: float(pattern["r_500_hz"]),
        1000: float(pattern["r_1000_hz"]),
        2000: float(pattern["r_2000_hz"]),
    }
    ref_t = float(pattern["thickness_mm_ref"] or 100.0)
    scaled = scale_r_by_thickness_mass_law(ref, thickness_mm, ref_t, db_per_double=6.0)
    ra = approximate_ra_from_r(scaled)
    code = pattern["code"]
    return {
        "kind": "pattern_instance",
        "pattern_code": code,
        "name": f"{pattern['name']} · {thickness_mm:.0f} mm",
        "thickness_mm": thickness_mm,
        "source_attribution": f"afgeleid (spectrum patroon {code})",
        "status": "proposed",
        "spectrum": {str(hz): scaled[hz] for hz in MANDATORY_HZ},
        "ra_dba_approx": ra,
    }


def instantiate_assembly(code: str, layers_raw: list[dict[str, str]]) -> dict:
    layers = [
        StackLayer(
            label=row["label"],
            layer_kind=row["layer_kind"],
            thickness_mm=_f(row.get("thickness_mm")),
            density_kg_m3=_f(row.get("density_kg_m3")),
            surface_mass_kg_m2=_f(row.get("surface_mass_kg_m2")),
            cavity_depth_mm=_f(row.get("cavity_depth_mm")),
            acoustic_role=row.get("acoustic_role") or "structural",
        )
        for row in layers_raw
    ]
    spec = stack_spectrum_db(layers)
    ra = approximate_ra_from_r(spec)
    return {
        "kind": "composite_stack",
        "assembly_code": code,
        "name": f"Samengesteld: {code}",
        "source_attribution": f"afgeleid (spectrum patroon stack {code})",
        "status": "proposed",
        "layers": [
            {
                "order": int(row["layer_order"]),
                "kind": row["layer_kind"],
                "label": row["label"],
                "thickness_mm": _f(row.get("thickness_mm")),
                "density_kg_m3": _f(row.get("density_kg_m3")),
            }
            for row in layers_raw
        ],
        "spectrum": {str(hz): spec[hz] for hz in MANDATORY_HZ},
        "ra_dba_approx": ra,
        "note": "MSM-preview — goedkeuren na vergelijking met metingen of catalogus-clusters.",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Propose spectrum from pattern or assembly")
    ap.add_argument("--pattern", help="spectrum_pattern.code e.g. SP-R1-S2-KALKZANDSTEEN")
    ap.add_argument("--thickness", type=float, help="thickness mm for pattern scaling")
    ap.add_argument("--assembly", help="wall_assembly.code e.g. ASM-HSB-BUITENWAND-V1")
    args = ap.parse_args()

    if args.pattern:
        if args.thickness is None or args.thickness <= 0:
            print("error: --thickness required with --pattern", file=sys.stderr)
            return 1
        pat = fetch_pattern(args.pattern)
        if not pat:
            print(f"error: pattern not found: {args.pattern}", file=sys.stderr)
            return 1
        out = instantiate_pattern(pat, args.thickness)
    elif args.assembly:
        layers = fetch_assembly_layers(args.assembly)
        if not layers:
            print(f"error: assembly not found: {args.assembly}", file=sys.stderr)
            return 1
        out = instantiate_assembly(args.assembly, layers)
    else:
        ap.print_help()
        return 1

    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
