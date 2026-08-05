# Rapportage geluidwering gevels (PDF)

**Status:** Voorstel (layout + inhoud)  
**Inspiratie:** Stilte-export «Geluidwering gevels» (bijv. *De Stuw / Stuwdijk 1a*-resultatenrapport)  
**Doel:** tussentijds én bij afronding een PDF kunnen genereren vanuit het GA-model  
**Voorbeeldproject in app:** *Nieuwbouw woning* (`PROJECT_NEAR_FINAL`, variant Lb 61 dB, Spectrum 2)

---

## 1. Wanneer genereren

| Moment | Status in PDF | Wie |
|--------|---------------|-----|
| Tussentijds (engineer) | **Concept** / **Tussentijds** | Engineer vanaf `/ga.html` (of projectdetail) |
| Bij afronding | **Definitief** | Engineer wanneer berekening + review klaar zijn; opdrachtgever downloadt via voortgang |

Versie in bestandsnaam: `YYYY.WWWW-gevelwering-<adres-kort>-vN.pdf`  
(voorgesteld werknummer = project `external_ref` of gegenereerd `JJJJ.NNNN`).

---

## 2. Paginalayout (zoals voorbeeld)

```
┌──────────────────────────────────────────────────────────────┐
│ Titel project / adres                    [Stilte-logo]      │  ← logo rechtsboven
│ Werknummer (links of onder titel)                            │
├──────────────────────────────────────────────────────────────┤
│ Projectmetadata (2 kolommen: label | waarde)                 │
├──────────────────────────────────────────────────────────────┤
│ ▓▓▓ VARIANT: <omschrijving> ▓▓▓                              │  ← grijze balk
│ Geluidbelasting (spectrumtabel + Lb-totaal)                  │
│ Verblijfsgebieden (samenvatting)                             │
│ Resultaten GA,k (per VR)                                     │
│ Per VR: kengetallen + per vlak elementtabel                  │
├──────────────────────────────────────────────────────────────┤
│ Geluidwering gevels V….          <datum/tijd generatie>      │  ← footer
└──────────────────────────────────────────────────────────────┘
```

**Typografie / look:** dicht, zakelijk, sans-serif; zwarte tekst; lichtgrijze sectiebalken; tabellen met dunne lijnen — geen marketinglayout.  
**Print:** A4 portret, marges ≥ 12 mm; logo vaste breedte ~28–32 mm rechtsboven op elke pagina (of alleen titelpagina + herhaalde header).

---

## 3. Inhoudsopbouw

### A. Kop + metadata
| Veld | Bron in app |
|------|-------------|
| Omschrijving | `building.label` + adres |
| Werknummer | `building.external_ref` of auto |
| Rekenmethode | vast: NPR 5272 / NEN 5077 |
| Status | Nieuwbouw / bestaande bouw (projectveld of default Nieuwbouw) |
| Categorie | Weg- of spoorweglawaai (of uit NoiseLoad later) |
| Gebruiksfunctie | `variant.gebruiksfunctie` |
| Rapportstatus | Concept / Tussentijds / Definitief |
| Aangemaakt / gewijzigd | timestamps + engineer-gebruiker |
| Variant | `variant.omschrijving` |

### B. Geluidbelasting
- Rij: spectrum (Spectrum 1 / 2 / custom) met octaafbanden 63…2000 Hz **wanneer beschikbaar**
- Kolom **Totaal** = `geluidsbelasting_dba` (Lb)
- *Huidige demobeperking:* alleen Lb-totaal verplicht; octaafbanden leeg of vaste Spectrum-2-index tot spectraal model er is

### C. Verblijfsgebieden (samenvatting)
Kolommen: Omschrijving · Stot [m²] · Vtot [m³] · GA;k [dB] · Voldoet  
(VG-totaal: aggregatie over VR’s — bijv. maatgevende / gewogen volgens zelfde regel als DGMR-export)

### D. Resultaten GA;k per VR
Kolommen: Verblijfsruimte · Vloer [m²] · GA · Lbi · GA;k · Voldoet  
Daarna **per VR** detailblok:

| Links | Rechts |
|-------|--------|
| Vloeroppervlak, hoogte, volume, T₀ | Max. geluidsbelasting (Lb), GA, Lbi, GA;k, Voldoet |

### E. Per vlak (detail)
- Vlaknaam, **oriëntatie** (N/NO/O/…), gekoppeld **catalogusmateriaal**, S [m²], RA, CL, Cg, meenemen in GA;k  

### E2. Toegepaste materialen — catalogusspectra
Unieke materialen uit de gevelvlakken van de variant, met waarden uit `app_gevelwering.material`:
Cat.id · naam · RA · Rw · R(63…4000 Hz) · C · Ctr (bron catalogusGG / eigen).

### F. Optionele bijlagen (fase 2)
- Plattegrond-/geveltekening (crop)  
- Variantvergelijking (als ≥2 varianten)  
- NoiseLoad-kaart (na handoff wegverkeer-app)

---

## 4. Voorbeeld met huidig project *Nieuwbouw woning*

*(Illustratief — uit de huidige database; VR1 had bij opname nog geen opgeslagen GA.)*

**Kop:** Gevelwering nieuwbouw woning — werknummer (nog in te vullen)  
**Variant:** bijv. «Variant» · Lb **61,0 dB** · Spectrum 2 · Woonfunctie · grens Lbi;k **33 dB**

| VR | Vloer | Volume | GA | Lbi | GA;k | Voldoet* |
|----|------:|-------:|---:|----:|-----:|----------|
| VR 1 · Woonkamer/keuken | 48,4 m² | 125,8 m³ | — | — | — | (herberekenen) |
| VR 2 · Slaapkamer 1 | 12,1 m² | 31,4 m³ | 34,4 | 26,6 | 29,7 | Ja |

\* Voldoet op Lbi;k = Lb − GA;k ≤ 33 (woonfunctie).

**Vlakken (actief model):** o.a. Porotherm-element ~2,50 m² · Glas 4-16-4 ~2,0 m² · Kozijn hout ~0,86 m² (RA van floormap-materiaal).

Printbare mock: [`/rapport-voorbeeld.html`](../../client/public/rapport-voorbeeld.html) (browser → Afdrukken → PDF).

---

## 5. Generatie (huidige implementatie)

1. **HTML-bron** via `POST /api/reports/generate` (UI-server): rendert concept-HTML uit live PG-data (variant + VR + vlakken).  
2. **PDF** wordt meteen meegeschreven via Chrome/`puppeteer-core` (`client/lib/html-to-pdf.mjs`). Override browserpad: `CHROME_PATH`.  
3. **Opslag op schijf** onder logische projectmap:
   - Root: `GEVELWERING_PROJECTS_ROOT` of default `<app>/data/projecten`
   - Pad: `{werknummer-of-label}_{buildingId8}/rapporten/{stamp}_gevelwering_{variant}_{status}.html` + zelfde basename `.pdf`
   - Sidecar `.sha256` op **canonieke** HTML-inhoud (tijdstempel geneutraliseerd). Bij gelijke hash: **geen schrijf**, response `identical: true` + waarschuwing; ontbrekende PDF wordt wel bijgewerkt; `force=true` overschrijft dat gedrag.  
4. Knop **Rapport opslaan** op `/ga.html`; **Naar inbox opdrachtgever** publiceert de **PDF**-bestandsnaam in `customer_report_inbox` (DDL 0.2.26).  
5. Opdrachtgever (`/opdrachtgever.html`): inbox → download is **application/pdf** (attachment). Oude HTML-inboxitems worden bij download naar PDF omgezet. E-mailaanvraag blijft stub. Publiceren zet status: concept → `PROJECT_NEAR_FINAL`, definitief → `PROJECT_FINISHED`.

Printbare mock (layout-referentie): [`/rapport-voorbeeld.html`](../../client/public/rapport-voorbeeld.html).

---

## 6. Bewuste verschillen t.o.v. oud DGMR-exportbestand

| Oud (voorbeeld-PDF) | App (voorstel) |
|---------------------|----------------|
| Logo / versie «Geluidwering gevels V2023.1» | **Stilte-logo rechtsboven** + app-versie in footer |
| Volledige octaafband-tabellen | Fase 1: A-gewogen + Lb; octaafbanden zodra spectrum rekent |
| Lokaal bestandspad in metadata | Projectmap + UUID / label |
| Alleen eindresultaat | Expliciete **Concept / Tussentijds / Definitief** |

---

## 7. Acceptatiecriteria

- [x] HTML-rapport vanuit gekozen variant naar projectfolder  
- [x] Waarschuwing + skip bij identieke inhoud (force optioneel)  
- [x] Stilte-logo rechtsboven op (minstens) de eerste pagina  
- [x] Secties gevuld uit live projectdata (basis)  
- [x] Catalogusspectra (R 63–4000 Hz, RA/Rw/C/Ctr) van toegepaste materialen in PDF  
- [x] Voldoet-kolom consistent met gebruiksfunctie-grens (woon 33 / onderwijs 28)  
- [x] Opdrachtgever kan rapport downloaden wanneer status het toelaat  
- [x] Native PDF (puppeteer-core + systeem-Chrome) — opdrachtgever haalt `.pdf` op  
