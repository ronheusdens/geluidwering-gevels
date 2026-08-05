# app-gevelwering — overzicht

**Status:** Productontwerp + implementatie (GA / plattegrond / materialen)  
**Repo:** `c/app-gevelwering`  
**Zusterapp:** [app-berekening-wegverkeer](../../../app-berekening-wegverkeer/docs/architecture/app-berekening-wegverkeer-overview.md) (verkeerslawaai → `NoiseLoad[]`)  
**Detailontwerp:** [facade-sound-insulation-app.md](facade-sound-insulation-app.md)  
**PostgreSQL DDL:** [app-gevelwering-postgres-schema.md](app-gevelwering-postgres-schema.md)  
**Runtime:** [bppServer server-runtime-rfc](../../../bppServer/docs/Architectural_aspects/09-bppserver/server-runtime-rfc.md)  
**Deploy:** [`client/docs/secure-deployment.md`](../../client/docs/secure-deployment.md)

---

## 1. Doel

**app-gevelwering** berekent de **geluidwering van de gevel** (GA / Lbi / GA;k e.d.) voor een nieuw of bestaand verblijf, als aparte consultant-app op bppServer.

| Uitkomst | Beschrijving |
|----------|--------------|
| Gevelwering | Per verblijfsruimte (VR) / verblijfsgebied (VG), op basis van plattegrond, gevelvlakken en materialen |
| Beoordeling | Toetsing vs. toepasselijke grenswaarden (jurisdictietabel) |
| Rapport | Berekening + bijlagen (later PDF) |

Dit is **niet** de verkeerslawaai-app. Verkeersbelastingen komen bij voorkeur als **`NoiseLoad[]`** van **app-berekening-wegverkeer**, of via import/handmatige invoer voor demo’s.

---

## 2. Relatie met de zusterapp

```mermaid
flowchart LR
  subgraph shared [Gedeelde_gebouwdata]
    Cust[Klant_adres_gebouw]
    Docs[Tekeningen_review]
  end
  Weg[app-berekening-wegverkeer]
  Gevel[app-gevelwering]
  Cust --> Weg
  Cust --> Gevel
  Docs --> Weg
  Docs --> Gevel
  Weg -->|NoiseLoad_handoff| Gevel
  Weg --> R1[Rapport_wegverkeer]
  Gevel --> R2[Rapport_gevelwering]
```

| Soort data | Eigenaar |
|------------|----------|
| Klant, adres, gebouw, tekeningen, review | Gedeeld (Postgres `app_gevelwering` schema / building record) |
| Wegen, verkeer, Laeq-model, verkeersrapport | **app-berekening-wegverkeer** |
| `NoiseLoad[]` | Handoff-artefact (wegverkeer → gevelwering) |
| Plattegrond VG/VR, gevelcomponenten, materialen, GA-resultaten | **app-gevelwering** |

---

## 3. Productgrenzen (deze app)

**In scope**

- Engineer/admin UI: tekeningen, plattegrond, gevels, materialencatalogus, GA-model  
- VG / VR / vlakken, schaal + oppervlakten, **compositie (+/−)** van gevelcomponenten  
- Materialen: DGMR-catalogus (`catalogusGG.pdf`) + **eigen materialen** (`source = eigen`)  
- Berekening gevelwering (NPR/NEN-route zoals geïmplementeerd); toets Lbi;k ≤ grens per gebruiksfunctie (Woonfunctie 33 dB)  
- Meerdere **berekeningsvarianten** per project (deep clone + vergelijking op `/ga.html`)  
- Consumeren van `NoiseLoad[]` (of import)

**Niet in scope**

- Wegselectie, verkeersintensiteiten, Laeq-motor (→ zusterapp)  
- Automatisch “lezen” van PDF/CAD voor afmetingen (v1: consultant + tekeningtools)  
- Coding-agent / LLM-tooling  
- Aparte taxonomie-rubriek “custom” — eigen materialen horen in de bestaande GG-rubriek/subrubriek

---

## 4. Huidige stack

| Onderdeel | Locatie |
|-----------|---------|
| Map / start | `c/app-gevelwering/./start.sh` |
| UI | `client/` — o.a. `/ga.html`, `/floormap.html`, `/materials.html`, `/admin.html`, `/engineer.html` |
| Postgres | Database + schema **`app_gevelwering`** |
| Fixtures | `fixtures/app-gevelwering/*.basicpp` |

---

## 5. Workflow (huidige implementatie)

Procesdiagram: [`docs/workflow gevelweringgevels-app.drawio`](../workflow%20gevelweringgevels-app.drawio) (open in diagrams.net / draw.io).

1. Gebouw/project openen via **Bestand**-menu (Openen / Recent) of queue — gedeelde building data in Postgres.  
2. Tekeningen registreren / engineer-review (`/engineer.html`).  
3. Plattegrond (`FLOORMAP`): VG/VR-ruimten tekenen, schaal, opslaan; volgorde in de lijst met ▲/▼.  
4. Geveltekening: **Detailgebied** (sleep rechthoek → 2×/3×/4×; rechterlijst blijft zichtbaar) voor kleine componenten; tekenen (materiaal optioneel; oranje/groene led) → **materiaal toekennen** → eventueel **Kopie/Dupliceer** → eventueel **compositie (+/−)** → GA (alleen complete componenten in vlakdelenkiezer; ▲/▼).  
5. `NoiseLoad[]` van wegverkeer-app (of import / handmatig) → Lb (en later spectrum) op de **variant**.  
6. GA-berekening per VR (`/ga.html`); per vlak **orientatie** (N/NO/…; basis voor later Lb→CL); toets Lbi;k; resultaten naar Postgres (`ga_dba` / `lbi_dba` / `gak_dba`). **Bestand → Project opslaan** checkpoint alle VR’s van de actieve variant. **Rapport opslaan** schrijft HTML+PDF naar `data/projecten/{project}/rapporten/` (waarschuwing bij identieke inhoud). **Naar inbox opdrachtgever** publiceert de PDF (concept/definitief) naar de klant-inbox; opdrachtgever haalt `.pdf` op.  
7. Optioneel: variant **kopiëren**, Lb/CL/constructie per scenario wijzigen, **varianten vergelijken**.

### Sessie-overleving

| Laag | Overleeft herstart? |
|------|---------------------|
| Plattegrond, gevel, materialen, varianten, VG/VR/vlakken | Ja — Postgres |
| GA / Lbi / GA;k | Ja — zodra opgeslagen (auto na berekening, of **Project opslaan**); UI toont opgeslagen waarden na herladen |
| Login-token | Nee na tab/browser-sluiten (`sessionStorage`); opnieuw inloggen |
| Live CL/Cg-preview zonder opslaan | Nee |

**Bestand**-menu (gedeeld op `/engineer.html`, `/floormap.html`, `/ga.html`): Openen…, Recent, Project opslaan, Hernoemen…, Verwijderen… (engineer/admin; verwijdert ook rapportmap onder `data/projecten/`).

Rapport-API (UI-server): `POST /api/reports/generate|publish|cleanup-project-folder`, `GET /api/reports/list|download|inbox`, `POST /api/reports/inbox/read|email-request`. Root override: `GEVELWERING_PROJECTS_ROOT`. Spec: [rapport-gevelwering-pdf.md](rapport-gevelwering-pdf.md).

Detailontwerp (historisch + invokes): [facade-sound-insulation-app.md](facade-sound-insulation-app.md).  
Schema / multi-variant: [app-gevelwering-postgres-schema.md](app-gevelwering-postgres-schema.md) (DDL **0.2.27+**).

### 5.1 Materiaaltoekenning (gevel)

| Stap | Waar | Wat |
|------|------|-----|
| Catalogus beheren | `/materials.html` (admin) of via **Materiaalcatalogus…** op de gevel | CRUD op `app_gevelwering.material`; filter **Bron → Eigen materialen** |
| Eigen materiaal | `/floormap.html` (gevel) → **Eigen materiaal…** | `POST /api/floormap/materials` → `source = eigen`, catalog-id `E#####`; selectie in de materiaalkiezer |
| Toekennen op component | `/floormap.html` (gevel) | Rubriek → subrubriek → materiaal; filter «Alleen eigen materialen» optioneel |
| Opslaan enkele contour | **Component opslaan** | Geometrie (+ optioneel materiaal). Zonder materiaal: oranje led; met materiaal: groen. Incomplete componenten niet kiesbaar bij GA-vlakdelen |
| GA vlakkentoekenning | `/ga.html` | Alleen **complete** gevelcomponenten (met materiaal); materiaal alleen lezen, geen catalogus hier |

**Belangrijk:** materiaal hoort bij de **componentdefinitie**, niet bij de GA-vlakstap. De materiaalkiezer is gedeeld op de geveltekening. **Component opslaan** koppelt materiaal aan het contour dat je bewerkt — niet automatisch aan de compositie. Voor een compositieresultaat: materiaal kiezen → **Toepassen & opslaan** (zie §5.2).

Catalogusrijen hebben `source = catalogusGG.pdf` (of legacy `GL.cat`). Eigen rijen: `source = eigen` (ook bij handmatige ids zoals `P00002`). Bij `./start.sh` wist de catalogus-seed **alleen** `catalogusGG.pdf` / `GL.cat`; rubriek-assign slaat eigen rijen over.

### 5.2 Compositie (+/−) op de gevel

Doel: meerdere gesloten contouren combineren tot één netto oppervlak met één materiaal (bijv. omhulling minus kozijnen = metselwerk).

1. Teken en sla de broncomponenten op (bijv. slaapkamer-omhulling, kozijn L, kozijn R) — materiaal op bronnen is optioneel.  
2. Selecteer ≥2 gesloten componenten in de lijst.  
3. **Grootste oppervlak = buitencontour (+)**; overige moeten **volledig binnen** die ring liggen.  
4. Zet per deel **+** (meenemen) of **−** (aftrekken).  
5. Kies het materiaal voor het **resultaat** in de materiaalkiezer.  
6. Klik **Toepassen & opslaan** (niet «Component opslaan»).  
7. Selectie blijft staan → volgende compositie met ander materiaal kan op dezelfde buitencontour.

Resultaat: `boolean_op: "compose"`, `outer_subsection_id`, `constituent_signs`, `source_subsection_ids`, eventuele holes. Netto = ∪(+) − ∪(−). Bronnen met hetzelfde materiaal (of zonder) worden bij herschrijven vervangen; andere materialen blijven beschikbaar voor een volgende compositie.

Feedback (succes/fout) staat onder de compositieknoppen (`fm-compose-feedback`).

### 5.3 Van gevel naar GA

- Gevelcomponenten met VR + materiaal voeden vlakken / Stot in de GA-UI.  
- Composities tellen als één geveldeel; broncontouren van die compositie niet dubbel meenemen.  
- Na verse berekening: Lbi;k = Lb − GA;k; **Voldoet** als Lbi;k ≤ grens(gebruiksfunctie).  
- Standaard Woonfunctie: 33 dB; onderwijs / kinderopvang: 28 dB (zie `client/src/ga-calc.ts`).  
- **Spectrum** op de variant is metadata (weergave/export); de A-gewogen rekenkern past nog geen spectraal R′ toe.

### 5.4 Varianten (multi-scenario)

| Begrip | Rol |
|--------|-----|
| **VG / VR** | Bouwbesluit-geometrie (plattegrondruimten); VG groepeert VR’s |
| **Variant** | Berekeningsscenario: Lb, spectrum, gebruiksfunctie + eigen kopie van de VG/VR/vlak-boom |

**Model:** deep clone per variant (niet shared geometry). Zelfde floormap-ruimte mag in meerdere varianten voorkomen; binnen één variant blijft `(variant_id, subsection_id)` uniek (DDL 0.2.25).

| Actie | Waar |
|-------|------|
| Nieuwe lege variant | `/ga.html` → **Nieuwe variant** + opslaan |
| Kopie vanuit huidige | **Kopieer variant** → `API_CloneVariant` (VG/VR/vlak/element + resultaten) |
| Bewerken | Wissel variant in de lijst; wijzig Lb/functie/CL onafhankelijk |
| Vergelijken | Multi-select ≥2 varianten → **Vergelijk**; rijen gematcht op `subsection_id` |

Na clone divergeren scenarios: geometrie-/CL-wijzigingen in A raken B niet. Vrije plattegrondruimten in GA zijn scoped op de **actieve** variant.

---

## 6. Fasering (deze app)

| Fase | Focus |
|------|--------|
| **P0–P1** | Building + docs; UI; mock loads |
| **P2–P3** | Plattegrond/gevel tooling; echte isolatieformules |
| **P4** | Rapportpakket gevelwering |
| **P5** | Duurzame handoff van `NoiseLoad[]` over sessies |

Zusterapp-fasering: zie [app-berekening-wegverkeer-overview.md](../../../app-berekening-wegverkeer/docs/architecture/app-berekening-wegverkeer-overview.md).

---

## 7. Volgende stap

Doorgaan met productrijping in deze repo (GA, plattegrond, materialen) en de handoff-API met **app-berekening-wegverkeer** vastleggen zodra die app een eigen repo/startpad heeft.

**Engineer-handleiding (online):** na `./start.sh` → [http://127.0.0.1:4173/handleiding.html](http://127.0.0.1:4173/handleiding.html) (inhoudsopgave + zoeken).

Schema / APIs: [app-gevelwering-postgres-schema.md](app-gevelwering-postgres-schema.md).
