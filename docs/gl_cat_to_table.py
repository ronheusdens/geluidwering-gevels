#!/usr/bin/env python3
"""Convert DGMR GL.cat (Geluidwering Gevels) binary catalog to tabular CSV/JSON.

Record layout (GLMATR01, fixed 2256 bytes):
  0..7    magic "GLMATR01"
  8..11   u32 payload size (typically 2243)
  12..15  packed index (u16 at offset 13 = 1-based material number)
  17      Delphi ShortString length
  18..    name bytes (length-prefixed; buffer continues until spectrum)
  126..   6 × IEEE-754 float64 little-endian: R @ 125,250,500,1000,2000,4000 Hz
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import struct
from pathlib import Path

RECORD_MAGIC = b"GLMATR01"
RECORD_SIZE = 2256
NAME_LEN_OFF = 17
NAME_OFF = 18
SPECTRUM_OFF = 126
BANDS_HZ = (125, 250, 500, 1000, 2000, 4000)

# Glas 4-6-4 / Glas 4-12-4/1/4 pvb...
GLASS_RE = re.compile(
    r"(?i)\bGlas\s+(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)"
)
CAT_RE = re.compile(r"\(([A-Z]{2,4})\)\s*$")


def find_records(data: bytes) -> list[int]:
    pos: list[int] = []
    start = 0
    while True:
        i = data.find(RECORD_MAGIC, start)
        if i < 0:
            break
        pos.append(i)
        start = i + 1
    return pos


def parse_name(rec: bytes) -> str:
    n = rec[NAME_LEN_OFF]
    if not (1 <= n <= 200):
        return ""
    raw = rec[NAME_OFF : NAME_OFF + n]
    # Stop at embedded NUL if present
    if b"\x00" in raw:
        raw = raw[: raw.index(b"\x00")]
    return raw.decode("latin-1", errors="replace").strip()


def parse_spectrum(rec: bytes) -> list[float | None]:
    out: list[float | None] = []
    for k in range(6):
        (v,) = struct.unpack_from("<d", rec, SPECTRUM_OFF + 8 * k)
        if v != v or abs(v) > 1e6:  # NaN / garbage
            out.append(None)
        else:
            # Keep one decimal when needed; integers stay clean in JSON via round
            out.append(round(v, 4))
    return out


def glass_layers(name: str) -> tuple[float | None, float | None, float | None]:
    m = GLASS_RE.search(name)
    if not m:
        return None, None, None
    return float(m.group(1)), float(m.group(2)), float(m.group(3))


def category_code(name: str) -> str | None:
    m = CAT_RE.search(name)
    return m.group(1) if m else None


def material_number(rec: bytes) -> int:
    return struct.unpack_from("<H", rec, 13)[0]


def spectrum_ok(spec: list[float | None]) -> bool:
    vals = [v for v in spec if v is not None]
    if len(vals) < 6:
        return False
    if not all(-40.0 <= v <= 120.0 for v in vals):
        return False
    return sum(1 for v in vals if abs(v) > 0.01) >= 1 or all(v == 0 for v in vals)


def parse_catalog(path: Path) -> dict:
    data = path.read_bytes()
    positions = find_records(data)
    materials = []
    for i, p in enumerate(positions):
        rec = data[p : p + RECORD_SIZE]
        if len(rec) < SPECTRUM_OFF + 48:
            continue
        name = parse_name(rec)
        spec = parse_spectrum(rec)
        t1, cav, t2 = glass_layers(name)
        row = {
            "index": i,
            "material_no": material_number(rec),
            "name": name,
            "category": category_code(name),
            "glass_t1_mm": t1,
            "glass_cavity_mm": cav,
            "glass_t2_mm": t2,
            "spectrum_ok": spectrum_ok(spec),
            "R_dB": {str(hz): spec[j] for j, hz in enumerate(BANDS_HZ)},
        }
        for j, hz in enumerate(BANDS_HZ):
            row[f"R_{hz}_Hz"] = spec[j]
        materials.append(row)

    header = data[:14]
    return {
        "source": str(path.name),
        "format": "GLCT0100 / GLMATR01 (DGMR Geluidwering Gevels)",
        "file_header_hex": header.hex(),
        "record_count": len(positions),
        "record_size_bytes": RECORD_SIZE,
        "spectrum_bands_Hz": list(BANDS_HZ),
        "spectrum_note": (
            "Sound reduction index R (dB) as six octave-band values at fixed "
            f"record offset {SPECTRUM_OFF}. Bands are the classic GG set "
            "125–4000 Hz. ~103 catalog entries store an all-zero spectrum."
        ),
        "materials": materials,
    }


def write_csv(catalog: dict, path: Path) -> None:
    fields = [
        "index",
        "material_no",
        "name",
        "category",
        "glass_t1_mm",
        "glass_cavity_mm",
        "glass_t2_mm",
        "spectrum_ok",
        *[f"R_{hz}_Hz" for hz in BANDS_HZ],
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for m in catalog["materials"]:
            w.writerow(m)


def _sql_num(v: float | None) -> str:
    if v is None:
        return "NULL"
    # Avoid scientific notation; keep enough precision for catalog floats
    return repr(float(v))


def _sql_text(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def _sql_bool(v: bool) -> str:
    return "TRUE" if v else "FALSE"


def write_pg_seed(catalog: dict, path: Path, source: str = "GL.cat") -> None:
    """Idempotent upsert seed for acoustics.material (DDL 0.2.12)."""
    lines: list[str] = [
        "-- Auto-generated by gl_cat_to_table.py — do not edit by hand.",
        "-- acoustics DDL 0.2.12 seed: DGMR GL.cat → acoustics.material",
        "-- Idempotent: ON CONFLICT (source, catalog_index) DO UPDATE",
        "",
        "BEGIN;",
        "",
    ]
    batch: list[str] = []
    for m in catalog["materials"]:
        r = [m[f"R_{hz}_Hz"] for hz in BANDS_HZ]
        r_arr = (
            "ARRAY[" + ", ".join(_sql_num(x) for x in r) + "]::double precision[]"
            if all(x is not None for x in r)
            else "NULL"
        )
        batch.append(
            "("
            + ", ".join(
                [
                    str(int(m["index"])),
                    str(int(m["material_no"])),
                    _sql_text(m["name"]),
                    _sql_text(m["category"]),
                    _sql_num(m["glass_t1_mm"]),
                    _sql_num(m["glass_cavity_mm"]),
                    _sql_num(m["glass_t2_mm"]),
                    _sql_bool(bool(m["spectrum_ok"])),
                    _sql_num(m["R_125_Hz"]),
                    _sql_num(m["R_250_Hz"]),
                    _sql_num(m["R_500_Hz"]),
                    _sql_num(m["R_1000_Hz"]),
                    _sql_num(m["R_2000_Hz"]),
                    _sql_num(m["R_4000_Hz"]),
                    r_arr,
                    _sql_text(source),
                ]
            )
            + ")"
        )
        if len(batch) >= 100:
            lines.append(_insert_batch(batch))
            batch = []
    if batch:
        lines.append(_insert_batch(batch))
    lines.extend(["", "COMMIT;", ""])
    path.write_text("\n".join(lines), encoding="utf-8")


def _insert_batch(values: list[str]) -> str:
    return (
        "INSERT INTO acoustics.material (\n"
        "  catalog_index, material_no, name, category,\n"
        "  glass_t1_mm, glass_cavity_mm, glass_t2_mm, spectrum_ok,\n"
        "  r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,\n"
        "  r_db, source\n"
        ") VALUES\n  "
        + ",\n  ".join(values)
        + "\nON CONFLICT (source, catalog_index) DO UPDATE SET\n"
        "  material_no = EXCLUDED.material_no,\n"
        "  name = EXCLUDED.name,\n"
        "  category = EXCLUDED.category,\n"
        "  glass_t1_mm = EXCLUDED.glass_t1_mm,\n"
        "  glass_cavity_mm = EXCLUDED.glass_cavity_mm,\n"
        "  glass_t2_mm = EXCLUDED.glass_t2_mm,\n"
        "  spectrum_ok = EXCLUDED.spectrum_ok,\n"
        "  r_125_hz = EXCLUDED.r_125_hz,\n"
        "  r_250_hz = EXCLUDED.r_250_hz,\n"
        "  r_500_hz = EXCLUDED.r_500_hz,\n"
        "  r_1000_hz = EXCLUDED.r_1000_hz,\n"
        "  r_2000_hz = EXCLUDED.r_2000_hz,\n"
        "  r_4000_hz = EXCLUDED.r_4000_hz,\n"
        "  r_db = EXCLUDED.r_db,\n"
        "  updated_at = now();\n"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "input",
        nargs="?",
        default="GL.cat",
        type=Path,
        help="Path to GL.cat (default: ./GL.cat)",
    )
    ap.add_argument(
        "--csv",
        type=Path,
        default=Path("GL_materials_spectra.csv"),
        help="Output CSV path",
    )
    ap.add_argument(
        "--json",
        type=Path,
        default=Path("GL_materials_spectra.json"),
        help="Output JSON path",
    )
    ap.add_argument(
        "--sql",
        type=Path,
        default=None,
        help="Output PostgreSQL seed SQL (acoustics.material upserts)",
    )
    args = ap.parse_args()

    catalog = parse_catalog(args.input)
    write_csv(catalog, args.csv)
    # JSON without flattened R_* keys duplication under materials
    json_doc = {
        k: v
        for k, v in catalog.items()
        if k != "materials"
    }
    json_doc["materials"] = [
        {
            "index": m["index"],
            "material_no": m["material_no"],
            "name": m["name"],
            "category": m["category"],
            "glass_t1_mm": m["glass_t1_mm"],
            "glass_cavity_mm": m["glass_cavity_mm"],
            "glass_t2_mm": m["glass_t2_mm"],
            "spectrum_ok": m["spectrum_ok"],
            "R_dB": m["R_dB"],
        }
        for m in catalog["materials"]
    ]
    args.json.write_text(
        json.dumps(json_doc, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    outputs = [str(args.csv), str(args.json)]
    if args.sql is not None:
        write_pg_seed(catalog, args.sql)
        outputs.append(str(args.sql))

    ok = sum(1 for m in catalog["materials"] if m["spectrum_ok"])
    nonzero = sum(
        1
        for m in catalog["materials"]
        if m["spectrum_ok"]
        and any(abs(m[f"R_{hz}_Hz"] or 0) > 0.01 for hz in BANDS_HZ)
    )
    print(f"Wrote {len(catalog['materials'])} materials → {', '.join(outputs)}")
    print(f"spectrum_ok={ok}, non-zero spectra={nonzero}")


if __name__ == "__main__":
    main()
