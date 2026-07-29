#!/usr/bin/env python3
"""Assign rubriek_nr / subrubriek_nr (+ mirror text columns) for app_gevelwering.material.

Uses psql CLI (no psycopg2). Maps legacy PDF masters onto the 9 GG rubrieken.
"""
from __future__ import annotations

import csv
import io
import os
import re
import subprocess
import sys
import tempfile

RUBRIEK = {
    1: "Steenachtigen/beton/blokken",
    2: "Glas",
    3: "Dak-, vloer-, plafondconstructies",
    4: "Lichte paneelconstr./borstweringen/deuren",
    5: "Enkelvoudige plaatmaterialen/panelen",
    6: "Ventilatievoorzieningen",
    7: "Ventilatievoorzieningen oud (voor 1-1-2012)",
    8: "Lichte scheidingsconstructies",
    9: "Kier- en naaddichtingsprofielen",
}

DIVERSEN = {1: 10, 2: 9, 3: 9, 4: 6, 5: 8, 6: 6, 7: 4, 8: 7}

SUB_NAMES = {
    (1, 1): "Baksteen licht/zwaar",
    (1, 2): "Kalkzandsteen",
    (1, 3): "Grindbeton/natuursteen",
    (1, 4): "Lichtbeton/cellenbeton",
    (1, 5): "(hout-)vezelbeton",
    (1, 6): "Lichte blokken/gipsblokken",
    (1, 7): "Voorzetwanden",
    (1, 8): "Enkelsteensmuur, rekenmethode",
    (1, 9): "Spouwmuur, rekenmethode",
    (1, 10): "Diversen",
    (2, 1): "Enkel glas",
    (2, 2): "Dubbel glas",
    (2, 3): "Enkel glas gelamineerd",
    (2, 4): "Dubbel glas 1-zijdig gelamineerd",
    (2, 5): "Dubbel glas 2-zijdig gelamineerd",
    (2, 6): "Schuiframen",
    (2, 7): "Enkel glas, rekenmethode T",
    (2, 8): "Dubbel glas, rekenmethode T",
    (2, 9): "Diversen",
    (2, 10): "Drievoudig glas",
    (3, 1): "Plat dak houtachtig",
    (3, 2): "Plat dak (gas)beton",
    (3, 3): "Plat dak metaalplaat",
    (3, 4): "Hellend dak houtachtig",
    (3, 5): "Hellend dak gas(beton)",
    (3, 6): "Dakramen",
    (3, 7): "Dakkapellen",
    (3, 8): "Vloeren",
    (3, 9): "Diversen",
    (4, 1): "Sandwich panelen",
    (4, 2): "Samengestelde panelen",
    (4, 3): "Deuren",
    (4, 4): "Samengestelde vloeren",
    (4, 5): "Kozijnen",
    (4, 6): "Diversen",
    (5, 1): "Spaanplaat/board",
    (5, 2): "Triplex/multiplex/meubelplaat",
    (5, 3): "Hout/vloerdelen",
    (5, 4): "Gipsplaat/asbestcement",
    (5, 5): "Mineraalvezels/mineraalwol",
    (5, 6): "Kunststof (massief)",
    (5, 7): "Metaalplaat",
    (5, 8): "Diversen",
    (6, 1): "Openingen/roosters",
    (6, 2): "Suskasten",
    (6, 3): "Muurdempers",
    (6, 4): "Dakdempers",
    (6, 5): "Mechanische ventilatie unit",
    (6, 6): "Diversen",
    (6, 7): "Ventilatie rekenmethode RM",
    (7, 1): "Openingen/roosters",
    (7, 2): "Suskasten",
    (7, 3): "Muurdempers",
    (7, 4): "Diversen",
    (8, 1): "Gipskarton wanden. U-profielen",
    (8, 2): "Gipskarton wanden. Stijlen",
    (8, 3): "Spaanplaatachtige wanden",
    (8, 4): "Metalen wanden",
    (8, 5): "Houtwolcement wanden",
    (8, 6): "Schuifbare wanden",
    (8, 7): "Diversen",
    (9, 1): "Kierdichtingsprofielen",
    (9, 2): "Naaddichtingsprofielen",
    (9, 3): "Beglazingsranden",
}


def norm(s: str | None) -> str:
    return (s or "").strip().lower()


def sql_quote(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def assign_rubriek(master: str, name: str) -> int:
    m = norm(master)
    n = norm(name)
    # Strong name stems first: prior mis-assign rewrote master_category to a
    # taxonomy label (e.g. plaatmaterialen), which would otherwise lock the row.
    # PDF names are often truncated ("naaddic…", "kier- en naad…").
    if re.search(
        r"kier-?\s*en\s*naad|naaddich|dichtingsprofi|beglazingsrand|"
        r"kierdicht|kierend|"
        r"^(geen|enkele|dubbele|speciale)\s+kier",
        n,
    ):
        return 9
    if m == "glas" or m.startswith("glas"):
        return 2
    if m.startswith("ventilatievoorzieningen oud") or ("ventilatie" in m and "oud" in m):
        return 7
    if m.startswith("ventilatievoorzieningen"):
        return 6
    for nr, label in RUBRIEK.items():
        if m == label.lower() or m.startswith(label.lower()[:20]):
            return nr
    if re.search(
        r"baksteen|kalkzand|metselwerk|grindbeton|gasbeton|cellenbeton|gipsblok|"
        r"voorzetwand|spouwmuur|vezelbeton|natuursteen|lichtbeton|poroton|siporex|"
        r"dubbele st\.?\s*gevel|^ms\s",
        n,
    ):
        return 1
    if re.search(
        r"pannendak|\bdak:|plat dak|hellend dak|dakraam|dakkapel|"
        r"\bvloeren\b|\bvloer\b|plafond",
        n,
    ):
        return 3
    if re.search(
        r"sandwich|^me\s|borstwering|\bdeur\b|kozijn|samengesteld|"
        r"trespa|montapl|eflex|glasal|morgomat|resoplan|monta\.|"
        r"\bbp\d|sandw|spouwkonstr|spwkonstr|lichte spw",
        n,
    ):
        return 4
    if re.search(
        r"triplex|multiplex|spaanplaat|meubelplaat|gipsplaat|staalplaat|"
        r"aluminium|kunststof|mineraal|board|asbest|houtwol",
        n,
    ):
        return 5
    if re.search(r"ventil|suskast|rooster|demper|doorlaat", n):
        return 6
    if re.search(
        r"gipskarton|metalstud|faay|scheidings|schuifbare wand|houtwolcement|"
        r"spaanplaatachtig|metalen wand",
        n,
    ):
        return 8
    if re.search(r"foamglas|steenw|/pur|/ps-|kurk/|staal\s*#", n) or (
        re.search(r"^\.?\d", n) and "/" in n
    ):
        return 4
    return 5


def assign_sub(rubriek: int, name: str) -> int:
    n = norm(name)
    d = DIVERSEN.get(rubriek, 9)

    if rubriek == 1:
        if "kalkzand" in n:
            return 2
        if "baksteen" in n or "metsel" in n:
            return 1
        if "grindbeton" in n or "natuursteen" in n:
            return 3
        if "gasbeton" in n or "cellenbeton" in n or "lichtbeton" in n or "siporex" in n:
            return 4
        if "vezelbeton" in n:
            return 5
        if "gipsblok" in n or "lichte blok" in n:
            return 6
        if "voorzet" in n:
            return 7
        if "enkelsteen" in n:
            return 8
        if "spouwmuur" in n:
            return 9
        return d

    if rubriek == 2:
        if "drievoud" in n or "triple" in n or "trisolide" in n or "climatop" in n:
            return 10
        if "schuif" in n:
            return 6
        if "rekenmethode" in n or re.search(r"\breken\b", n):
            return 8 if "dubbel" in n else 7
        # Truncated PDF names rarely contain "dubbel"/"1-zijdig"; use build-up codes:
        #   4/1/4-12-4/1/4  → both lites laminated (2-zijdig)
        #   4-12-4/1/4 pvb  → one laminated lite (1-zijdig)
        if re.search(r"\d+\s*/\s*\d+\s*/\s*\d+\s*-\s*\d+", n) and re.search(
            r"-\s*\d+\s*/\s*\d+\s*/\s*\d+", n
        ):
            return 5
        if (
            re.search(r"\d+\s*-\s*\d+\s*-\s*\d+\s*/\s*\d+\s*/\s*\d+", n)
            or "pvb" in n
            or ("1-zijdig" in n or "1 zijdig" in n or "eenzijdig" in n)
        ):
            return 4
        if "2-zijdig" in n or "2 zijdig" in n or "tweezijdig" in n:
            return 5
        if (
            "gelami" in n
            or re.search(r"\b\d+\s*-\s*1\s*-\s*\d+", n)
            or "stratobel" in n
            or "stratophone" in n
            or ("stadip" in n and "climalit" not in n and "thermobel" not in n)
        ):
            return 3
        if (
            "dubbel" in n
            or "(gdl)" in n
            or "(gdg)" in n
            or "(gdr)" in n
            or "climalit" in n
            or "climaplus" in n
            or "phonibel" in n
            or re.search(r"glas\s+\d+\s*-\s*\d+\s*-\s*\d+", n)
            or re.search(r"thermobel(?:\s+tg)?\s+\d+\s*-\s*\d+\s*-\s*\d+", n)
            or re.search(r"\bhr\+*\s*glas\b", n)
            or re.search(r"\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)", n)
        ):
            return 2
        if "enkel" in n or "(ge)" in n or "planibel" in n:
            return 1
        return d

    if rubriek == 3:
        if "dakraam" in n:
            return 6
        if "dakkapel" in n:
            return 7
        if "vloer" in n:
            return 8
        if "pannendak" in n or "hellend" in n:
            return 4 if "hout" in n or "panne" in n else 5
        if "plat" in n or n.startswith("dak:"):
            if "metaal" in n or "staal" in n:
                return 3
            if "beton" in n or "gas" in n:
                return 2
            return 1
        return d

    if rubriek == 4:
        if "deur" in n:
            return 3
        if "kozijn" in n:
            return 5
        if "vloer" in n:
            return 4
        if "sandwich" in n or "sandw" in n or n.startswith("me ") or n.startswith("bp2"):
            return 1
        if "samengesteld" in n or "trespa" in n or "montapl" in n or "eflex" in n:
            return 2
        return d

    if rubriek == 5:
        if "spaanplaat" in n or "board" in n:
            return 1
        if "triplex" in n or "multiplex" in n or "meubelplaat" in n:
            return 2
        if "vloerdeel" in n or re.search(r"\bhout\b", n):
            return 3
        if "gipsplaat" in n or "asbest" in n:
            return 4
        if "mineraal" in n or "steenwol" in n or "glaswol" in n:
            return 5
        if "kunststof" in n or "pvc" in n:
            return 6
        if "staalplaat" in n or "aluminium" in n or "metaalplaat" in n:
            return 7
        return d

    if rubriek in (6, 7):
        if "suskast" in n:
            return 2
        if "muurdemper" in n or ("demper" in n and "dak" not in n):
            return 3
        if rubriek == 6 and "dakdemper" in n:
            return 4
        if rubriek == 6 and ("mechanisch" in n or "unit" in n):
            return 5
        if rubriek == 6 and ("rekenmethode" in n or " rm" in n):
            return 7
        if "rooster" in n or "opening" in n or "doorlaat" in n:
            return 1
        return d

    if rubriek == 8:
        if "u-profiel" in n or "u profiel" in n:
            return 1
        if "stijl" in n or "gipskarton" in n:
            return 2
        if "spaanplaat" in n:
            return 3
        if "metaal" in n or "metalstud" in n:
            return 4
        if "houtwolcement" in n:
            return 5
        if "schuif" in n:
            return 6
        return d

    if rubriek == 9:
        if "beglazingsrand" in n:
            return 3
        if "naad" in n:
            return 2
        if "kier" in n:
            return 1
        return 1

    return d


def psql_db() -> str:
    return os.environ.get("BPP_PG_DB") or os.environ.get("PGDATABASE") or "app_gevelwering"


def run_psql(sql: str, *, tuples_only: bool = False) -> str:
    cmd = ["psql", "-d", psql_db(), "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        cmd += ["-t", "-A", "-F", "\t"]
    cmd += ["-c", sql]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or "psql failed")
    return proc.stdout


def main() -> int:
    proc = subprocess.run(
        [
            "psql",
            "-d",
            psql_db(),
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            "COPY ("
            "SELECT id::text, COALESCE(master_category,''), COALESCE(name,''), "
            "COALESCE(category,''), COALESCE(rubriek_nr::text,''), "
            "COALESCE(subrubriek_nr::text,'') FROM app_gevelwering.material"
            ") TO STDOUT WITH (FORMAT csv)",
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stderr, file=sys.stderr)
        return 1

    reader = csv.reader(io.StringIO(proc.stdout))
    updates: list[str] = []
    counts: dict[int, int] = {i: 0 for i in range(1, 10)}
    for row in reader:
        if len(row) < 6:
            continue
        mid, master, name, category, rub_s, sub_s = row[:6]
        rub = assign_rubriek(master, name)
        sub = assign_sub(rub, name)
        if (rub, sub) not in SUB_NAMES:
            sub = DIVERSEN.get(rub, 9)
        master_new = RUBRIEK[rub]
        cat_new = SUB_NAMES[(rub, sub)]
        counts[rub] = counts.get(rub, 0) + 1
        if (
            rub_s == str(rub)
            and sub_s == str(sub)
            and master == master_new
            and category == cat_new
        ):
            continue
        updates.append(
            "UPDATE app_gevelwering.material SET "
            f"rubriek_nr = {rub}, subrubriek_nr = {sub}, "
            f"master_category = {sql_quote(master_new)}, "
            f"category = {sql_quote(cat_new)}, updated_at = now() "
            f"WHERE id = {sql_quote(mid)}::uuid;"
        )

    if updates:
        with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as fh:
            fh.write("BEGIN;\n")
            fh.write("\n".join(updates))
            fh.write("\nCOMMIT;\n")
            path = fh.name
        apply = subprocess.run(
            ["psql", "-d", psql_db(), "-v", "ON_ERROR_STOP=1", "-f", path],
            capture_output=True,
            text=True,
        )
        os.unlink(path)
        if apply.returncode != 0:
            print(apply.stderr, file=sys.stderr)
            return 1

    print(f"material rubriek assign: updated={len(updates)}")
    for nr in range(1, 10):
        print(f"  rubriek {nr}: {counts.get(nr, 0)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
