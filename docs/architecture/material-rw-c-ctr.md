# Material ratings: Rw, C, Ctr (ISO 717-1)

**Script:** [`sql/app_gevelwering_0_2_23_backfill_rw.py`](../../sql/app_gevelwering_0_2_23_backfill_rw.py)  
**Table:** `app_gevelwering.material` (`rw_db`, `c_db`, `ctr_db` from R octaafbanden)

## Wat is wat

| Veld | Betekenis |
|------|-----------|
| `r_125_hz` … `r_4000_hz` | Octaafband-geluidisolatie R [dB] |
| `ra_dba` | A-gewogen RA — **niet** gebruikt voor Rw/C/Ctr; wel voor de GA-rekenkern |
| `rw_db` | Gewogen geluidisolatie-index **Rw** (NEN-EN-ISO 717-1) |
| `c_db` | Spectrumaanpassingsterm **C** |
| `ctr_db` | Spectrumaanpassingsterm **Ctr** (verkeer) |

Rw/C/Ctr zijn **materiaaleigenschappen** (constructie), afgeleid uit het R-spectrum. Typische publicatievorm: `Rw (C; Ctr)`, bijv. `41 (−2; −5)`.

## Wat is nodig om te rekenen

Per rij minimaal **4** geldige octaafbanden uit {125, 250, 500, 1000, 2000, 4000} Hz.

- Waarden **≤ 0** tellen als ontbrekend (catalogus-placeholder, o.a. `r_4000_hz = 0`).
- Ontbreekt **4000 Hz**, dan wordt **R(2000)** overgenomen.
- **RA is niet nodig** voor deze berekening.

Algoritme (samenvatting):

1. Verschuif de ISO 717-1-referentiecurve tot de som van ongunstige afwijkingen ≤ 10 dB → **Rw** (= referentie @ 500 Hz).
2. **C** / **Ctr** = `−10·log₁₀(Σ 10^((Lᵢ − Rᵢ)/10)) − Rw` met vaste octaafspectra uit ISO 717-1 Annex.

## Automatisch bij start

`./start.sh` draait het script **zonder flags**: vult alleen rijen waar `rw_db IS NULL` (idempotent backfill).

## Handmatig verifiëren / corrigeren

Vanaf de app-root (`c/app-gevelwering`):

```bash
# Dry-run: herberekende waarden vergelijken met opgeslagen Rw/C/Ctr
python3 sql/app_gevelwering_0_2_23_backfill_rw.py --verify

# Zelfde check, maximaal N sample-mismatches tonen (default 25)
python3 sql/app_gevelwering_0_2_23_backfill_rw.py --verify --limit 20

# Mismatches / ontbrekende ratings overschrijven met berekende waarden
python3 sql/app_gevelwering_0_2_23_backfill_rw.py --verify --force
```

| Flag | Effect |
|------|--------|
| (geen) | Alleen `rw_db IS NULL` vullen |
| `--verify` | Alle rijen met R-spectrum herberekenen en vergelijken; **geen** schrijven |
| `--force` | Alleen i.c.m. `--verify`: schrijf berekende Rw/C/Ctr waar ze afwijken of NULL zijn |
| `--limit N` | Max. sampleregels bij mismatches |

**Exitcodes**

| Code | Betekenis |
|------|-----------|
| `0` | OK (of force geslaagd) |
| `2` | `--verify` dry-run met ≥1 mismatch (handig voor CI) |
| `1` | Scriptfout (psql / exception) |

Database: `BPP_PG_DB` / `PGDATABASE`, default `app_gevelwering` (lokaal via `psql`).

## Interpretatie van verify-output

Voorbeeld:

```text
ISO 717-1 VERIFY (dry-run)
  rows with spectrum:     1856
  match stored:           1813
  mismatch / missing:     2
  cannot compute (<4 R):  41
```

- **match stored** — opgeslagen Rw/C/Ctr gelijk aan herberekend (na afronding op gehele dB).
- **mismatch / missing** — cataloguswaarde wijkt af, of veld was NULL terwijl spectrum voldoende is.
- **cannot compute** — te weinig geldige R-banden; handmatig spectrum aanvullen in `/materials.html`.

Kleine verschillen (1 dB) t.o.v. de DGMR-catalogus komen voor (afronding / ontbrekende R@4000). `--force` zet de ISO-uitkomst van dit script als bron van waarheid.

## Relatie tot GA

De live GA-berekening gebruikt **RA** (`ra_dba`). Rw/C/Ctr staan in de catalogus en op het PDF-rapport; spectrale weging via C/Ctr zit nog niet in de A-gewogen GA-kernel (`client/src/ga-calc.ts`).

## Zie ook

- DDL-commentaren: `sql/app_gevelwering_0_2_23.sql`
- Schema: [app-gevelwering-postgres-schema.md](app-gevelwering-postgres-schema.md) (§ material catalog)
- UI: `/materials.html` (kolommen RA / Rw / C / Ctr + R-spectrum)
