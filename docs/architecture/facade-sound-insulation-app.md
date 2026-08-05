# App 2: Online façade sound insulation calculation

**Status:** Design driver — **app-gevelwering** (façade insulation); consumes `NoiseLoad[]` from app-berekening-wegverkeer (or import)  
**Overview:** [app-gevelwering-overview.md](app-gevelwering-overview.md)  
**Upstream:** [road-traffic-noise-app.md](../../../app-berekening-wegverkeer/docs/architecture/road-traffic-noise-app.md) (`NoiseLoad[]`)  
**Related:** [server-runtime-rfc.md](../../../bppServer/docs/Architectural_aspects/09-bppserver/server-runtime-rfc.md) §2.5, sibling repo `c/bppServer`  
**Not in scope:** coding-agent / LLM tooling (`09-agent-integration`)

---

## 1. Purpose

Assess **sound insulation of the new façade** against **road-traffic noise loads** for a building-permit acoustical study.

App 2 is a **separate application** from App 1. It reads the **same shared building data** (customer, drawings, site) and **uses App 1 results** (structured `NoiseLoad[]`) when available; it does not embed the traffic-noise engine.

| Capability | Used by App 2 |
|------------|---------------|
| **Shared building data** | Customer, dwelling address, drawings, review gate (same record as App 1) |
| AOI / OSM vicinity | Shared site context maps; App 1 owns traffic model |
| **Noise loads from App 1** (or import) | Calc input — structured `NoiseLoad[]`, not PDF re-key |
| Dimensional / sectional model | Façade sections per façade, per level, including roof (**App 2–owned**) |
| Material specifications | Per façade section (**App 2–owned**) |
| Engineering calculation | Façade sound insulation vs loads |
| Report + appendices | Assessment, site layout, noise loads, calculation results |

Shared building data + handoff: [app-gevelwering-overview.md](app-gevelwering-overview.md). **Current engineer workflow (materials + compose):** [overview §5](app-gevelwering-overview.md#5-workflow-huidige-implementatie). This document remains the broader design driver; the RFC remains the **protocol/runtime** contract.

---

## 2. Actors and online façade

| Actor | Role |
|-------|------|
| **Customer** | Supplies identity, dwelling address, drawings (shared) |
| **Consultant** | Reviews completeness, measures façades, enters materials, runs insulation calc, issues report |
| **System (bppServer + Basic++ app)** | Holds project session state, files, GIS context, App 1 loads, calc engine, report artifacts |
| **Front end (remote client)** | Forms, map context, file upload, review UI, report download |

“Online” means: remote client ↔ bppServer JSON session; heavy work stays on the server child process.

---

## 3. Workflow → system steps

### Steps 1–2 — Customer details and drawings (**shared building data**)

Same building record as app-berekening-wegverkeer — see [app-gevelwering-overview.md](app-gevelwering-overview.md) §2. This app does not re-own that data; it binds the project/building and reads it.

**System:** `SetCustomer` / `SetProjectSite` / `RegisterDocument` (write once; both apps read).

---

### Step 3 — Consultant: sufficiency of drawings

**Decision:** dimensions and material specs present enough to proceed?

**System:**

- Checklist UI on client; server stores review outcome
- `invoke ReviewDrawings(sufficient%, notes$)`
- If insufficient → status `NEEDS_INFO`; block dimension entry / calc
- If sufficient → status `READY_FOR_DIMENSIONS`

**No automatic PDF/CAD understanding required in v1** — consultant judgment; system records the gate.

---

### Step 4 — Consultant: floor plan + façade geometry (implemented)

**Work:** VG/VR rooms on the floor plan; closed façade components on elevation drawings, with calibrated scale.

**Current UI / storage:**

| Surface | UI | Persistence |
|---------|-----|-------------|
| Floor plan rooms | `/floormap.html` (`FLOORMAP`) | `drawing_subsection` + VG/VR on room |
| Façade components | `/floormap.html` (elevation region) | `drawing_subsection` + `analysis` JSON (material, compose, holes) |
| GA rooms / vlakken | `/ga.html` | `verblijfsruimte`, `vlak`, link `facade_subsection_id` |
| Multi-variant | `/ga.html` | `API_CloneVariant` / `API_CompareVariants`; see [overview §5.4](app-gevelwering-overview.md#54-varianten-multi-scenario) |

**Compose (+/−)** replaces early ∩/∪/− set-ops for net façade area: largest closed ring = outer; others must be fully contained; per-part +/−; apply with **Toepassen & opslaan**. See [overview §5.2](app-gevelwering-overview.md#52-compositie--op-de-gevel).

HTTP: `/api/floormap/sections`, `/api/floormap/subsection` (save), `/api/floormap/scale`, …

---

### Step 5 — Consultant: material assignment (implemented)

**Catalog:** `app_gevelwering.material` — primarily `catalogusGG.pdf` seed (`source = catalogusGG.pdf`), plus engineer **eigen** rows (`source = eigen`, ids `E#####`).

| Action | Path |
|--------|------|
| Admin CRUD + filter «Eigen materialen» | `/materials.html` → `API_AdminListMaterials(…, source_filter$)` |
| Create eigen from façade component | `/floormap.html` → `POST /api/floormap/materials` `{ name, ra_dba, rubriek_nr, subsection_id? }` |
| Pick list on façade | `GET /api/floormap/materials?master_category=&category=&q=&source=eigen` |
| Bind to one contour | **Component opslaan** (active subsection `analysis.material_id`) |
| Bind to compose result | Choose material → **Toepassen & opslaan** |
| GA vlak step | Read-only material from façade component; no catalog/create UI |

Do **not** invent a separate “custom” rubriek: place eigen materials in the existing GG rubriek/subrubriek (or Diversen). Seed on `./start.sh` deletes only non-`eigen` catalog rows.

Deep-link from façade: `/materials.html?material_id=…&return=…` (**Materiaalcatalogus…** on floormap).

---

### Step 6 — Noise loads (from App 1) + report

**Noise loads (preferred path):**

- `invoke UseProjectNoiseLoads()` — bind `NoiseLoad[]` written by App 1 (`RunTrafficNoise`)
- If App 1 was run separately: `invoke ImportNoiseLoads(json_path$)` or legacy `SetNoiseLoads(...)` for demos

**Calc engine (Basic++):**

- Façade sound insulation from sections + materials (aggregate by façade/level)
- Assessment against regulatory **insulation / limit values** (jurisdiction table)
- Do **not** recompute road Laeq here — that is App 1

**Outputs:**

| Artifact | Content |
|----------|---------|
| Main report | Project/customer, method, results, pass/fail vs insulation limits |
| Appendix A | Site layout (uploaded drawing and/or map figure) |
| Appendix B | Noise loads (tables from App 1 + optional map of roads/AOI) |
| Appendix C | Calculation results (per section / façade / level) |

**System:**

- `invoke ComputeInsulation()` / `AssessFacadeLimits()`
- `invoke ReportFacade()` → paths to HTML/Markdown + structured JSON summary (PDF later)
- Client downloads artifacts; `session.close` → child exits, frees resources

Streaming: long GIS extract or report build → `stdout.chunk` progress.

---

## 4. End-to-end session sketch (App 2 portion)

```
' assume shared SetCustomer… ExtractOsm and App 1 RunTrafficNoise already done

invoke ReviewDrawings(sufficient:=1, ...)   ' if not already

invoke UpsertLevel / UpsertFaçade / UpsertSection  × many
invoke SetSectionMaterial(...)                    × many
invoke UseProjectNoiseLoads()                     ' or ImportNoiseLoads / SetNoiseLoads

invoke ComputeInsulation()
invoke AssessFacadeLimits()
invoke ReportFacade()           // returns paths + summary JSON
```

Distinct-app sketches: [app-gevelwering-overview.md](app-gevelwering-overview.md) §2. Concurrent sessions: **&lt; 3** (RFC §5.0).

---

## 5. Capability integration map

| Workflow need | bppServer / Basic++ | GIS / QGIS / DB | Front end |
|---------------|---------------------|-----------------|-----------|
| Customer & site data | App 2 invokes | Geocode optional | Forms |
| Drawing upload | Session cwd + register | — | Multipart / file picker |
| Completeness gate | Status machine | — | Review checklist |
| Façade dimensions | Section TYPE/records or tables | OSM footprint assist only | Tables / canvas |
| Materials | Catalog + section link | — | Dropdowns |
| Noise loads | **Project `NoiseLoad[]` from App 1** | Roads modelled in App 1 | Read-only load tables |
| Buildings vicinity | Context / appendix | Shared OSM extract | Map |
| Insulation calc | Basic++ procedures | — | Results views |
| Report + appendices | Generate files in cwd | Map figures from GeoJSON | Download |

---

## 6. Domain objects (minimal)

```text
' Optional shared project context (see overview)
Project
Customer
SiteAddress
Document[]
ReviewGate { sufficient, notes, reviewer }
AOI { bbox, crs }
GisExtract { roads_geojson, buildings_geojson, params }

' App 2–specific
Level[]
Façade[]
Section[] { dims, material_ref, façade_ref, level_ref }
MaterialSpec

' From App 1 (consumed via handoff)
NoiseLoad[] { façade_ref / receiver_id, metric, value, … }

CalcResult[]
Assessment { limits, pass_fail, notes }   ' insulation limits
ReportArtifact[] { kind, path }           ' FACADE_MAIN | SITE | LOADS | RESULTS
```

Prefer Basic++ `TYPE` records / tables for v1; CLASS wrappers optional.

---

## 7. Phased delivery (App 2)

| Phase | Deliverable |
|-------|-------------|
| **P0** | Mock Compute/Report importing mock `NoiseLoad[]` from App 1 stub |
| **P1** | Section/material CRUD invokes |
| **P2** | Optional OSM extract for appendices (calc still mock or simple) |
| **P3** | Real façade insulation formulas + limit tables |
| **P4** | Report pack with three appendices |
| **P5** | Durable project store so App 1 loads survive for later App 2 sessions |

Cross-app phasing: [app-gevelwering-overview.md](app-gevelwering-overview.md) §6 · [wegverkeer overview](../../../app-berekening-wegverkeer/docs/architecture/app-berekening-wegverkeer-overview.md) §5.

---

## 8. Explicit non-goals (v1)

- Automatic reading of construction PDFs/CAD for dimensions or materials  
- Replacing consultant judgment on drawing sufficiency  
- Recomputing road-traffic Laeq inside App 2 (use App 1 / import)  
- Multi-tenant high concurrency (keep &lt; 3 sessions)  
- Coding-agent / LLM repair loops in this product path  

---

## 9. Product decisions (defaults)

Defaults: prefer project `NoiseLoad[]` from wegverkeer; import allowed for demos. App-specific:

1. **Noise loads source:** App 1 export/project loads preferred; manual/import allowed for demos and external App 1 runs.  
2. **Report format:** HTML/Markdown + JSON first; PDF later.  
3. **Roof sections:** same `Section` type with `kind=ROOF` vs separate entity — open; default `kind=ROOF` on `Section`.  

---

## 10. Next working step

Implement **P0** procedures `UseProjectNoiseLoads` / `ImportNoiseLoads` / `ComputeInsulation` / `AssessFacadeLimits` / `ReportFacade` consuming mock loads — see [app-gevelwering-overview.md](app-gevelwering-overview.md) §7.
