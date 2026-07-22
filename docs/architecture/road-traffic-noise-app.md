# App 1: Road traffic noise assessment (Laeq)

**Status:** Design driver — **distinct App 1** (road traffic Laeq); results feed App 2 via `NoiseLoad` handoff  
**Overview:** [acoustics-suite-overview.md](acoustics-suite-overview.md)  
**Downstream:** [facade-sound-insulation-app.md](facade-sound-insulation-app.md) (App 2 consumes `NoiseLoad[]`)  
**Related:** [server-runtime-rfc.md](../../../bppServer/docs/Architectural_aspects/09-bppserver/server-runtime-rfc.md) §2.5, sibling `c/bppServer`  
**Not in scope:** coding-agent / LLM tooling

---

## 1. Purpose

Calculate the **time-equivalent sound level (Laeq)** (and related metrics such as Lden where required) at a **new dwelling** as a result of **constant road traffic** on roads in the vicinity. Almost always for a **building permit** acoustical study.

App 1 writes structured **façade / receiver noise loads** (export / project store) for **App 2**. **Building data** (customer, drawings, site) is **shared** with App 2 — not part of the noise-load handoff. App 1 is complete on its own: traffic-noise assessment + report.

---

## 2. Actors

| Actor | Role |
|-------|------|
| **Customer** | Identity, dwelling address, drawings |
| **Consultant** | Selects roads, obtains/processes traffic data, sets study extent, runs model, assesses limits, reports |
| **System** | Session state, GIS extract, traffic tables, Laeq engine, report artifacts |
| **Front end** | Forms, map AOI/road pick, file upload, results, download |

---

## 3. Workflow → system steps

### Step 1 — Customer details (**shared building data**)

**Input:** name, address, postal code, city/town, address of the new dwelling.

**System:** `SetCustomer` / `SetProjectSite` — written to the shared building/project record (see overview §2).

---

### Step 2 — Customer provides drawings (**shared building data**)

**Input:** site layout, floor plan, construction drawings.

**System:** session cwd + `RegisterDocument` on the same building record App 2 will read.

---

### Step 3 — Consultant: which roads to include

**Work:** choose assessment roads (often a subset of OSM roads in/near the AOI).

**System:**

- Present roads from GIS extract (map + attribute list: `highway`, name, ref)
- `invoke SelectRoads(road_ids$…)` or toggle flags on extracted features
- Persist `SelectedRoad[]` on the project

**Data:** `SelectedRoad { osm_id$, name$, highway$, geom_ref$ }`

---

### Step 4 — Consultant: obtain traffic data

**Input:** traffic intensities, vehicle composition, daily distribution (day/evening/night or hourly).

**System (v1):**

- Manual entry / CSV import — `invoke SetTrafficData(road_id$, …)`
- Store `TrafficData` rows linked to `SelectedRoad`

**Later:** connectors to municipal traffic APIs.

**Data:** `TrafficData { road_id$, aadt_or_intensity#, light_frac#, heavy_frac#, distribution$… }`

---

### Step 5 — Consultant: study area / OSM extract extent

**Work:** define calculation / extract bbox (may match or expand the site AOI).

**System:**

- `invoke SetAOI(...)` / `SetStudyExtent(...)` if distinct from site pin
- `invoke ExtractOsm(...)` — roads, buildings; ground/elevations when available

**GIS:** vector OSM; spatial filter by extent (see overview / QGIS–PostGIS notes in prior design).

---

### Step 6 — Import buildings, ground, roads into calculation tool

**Work:** load model layers for the noise engine.

**System:**

- Bind GIS extract paths/GeoJSON into the calc workspace
- `invoke ImportGround(path$|manual…)` — v1 CSV/manual elevations / ground type; DEM later
- `invoke BuildTrafficModel()` — materialize calc-ready geometry + attributes

**Data:** `GroundProperty[]`, model layer refs under session cwd.

---

### Step 7 — Process traffic data for the calculation tool

**Work:** map raw traffic tables to method-specific input (speed, fleet mix, periods).

**System:**

- `invoke ProcessTrafficForMethod()` — validate completeness; emit engine input file/tables
- Fail fast with structured diagnostics if selected roads lack traffic rows

---

### Step 8 — Evaluate results vs standard limit

**Work:** run Laeq (and required metrics); compare to jurisdiction limits at receivers / façades.

**System:**

- `invoke RunTrafficNoise()` → writes **`NoiseLoad[]`** into the project (handoff contract)
- `invoke AssessTrafficLimits()` → pass/fail vs traffic-noise limit table
- Stream progress via `stdout.chunk` on long runs

**Outputs for App 2:** `NoiseLoad[]` export / project store (see [acoustics-suite-overview.md](acoustics-suite-overview.md) §4).

---

### Step 9 — Report

**Work:** assessment against applicable noise limits; appendices = calculation results + calculation model.

**System:**

- `invoke ReportTraffic()` → HTML/Markdown + JSON summary (PDF later)
- Appendices: results tables; model description / layer inventory / parameters
- Client download; `session.close` when App 1 work ends

---

## 4. End-to-end invoke sketch (App 1 portion)

```
' assume shared SetCustomer… ExtractOsm already done

invoke SelectRoads(...)
invoke SetTrafficData(...) × roads
invoke ImportGround(...)
invoke BuildTrafficModel()
invoke ProcessTrafficForMethod()
invoke RunTrafficNoise()          ' → NoiseLoad[] on project
invoke AssessTrafficLimits()
invoke ReportTraffic()
```

---

## 5. Capability map

| Workflow need | bppServer / Basic++ | GIS / data | Front end |
|---------------|---------------------|------------|-----------|
| Road selection | `SelectRoads` | OSM roads in extent | Map multi-select |
| Traffic data | Tables / CSV import | Municipal sources later | Forms / upload |
| Study extent | `SetAOI` / extract | PostGIS / qgis_process / GPKG | Bbox tool |
| Buildings / roads import | Model build | Vector OSM | Preview |
| Ground / elevations | ImportGround | CSV v1; DEM later | Upload |
| Laeq calc | `RunTrafficNoise` | Method engine | Progress |
| Limit check | `AssessTrafficLimits` | Jurisdiction table | Pass/fail UI |
| Report | `ReportTraffic` | Map figures optional | Download |
| Handoff | Persist `NoiseLoad[]` | — | App 2 reads project |

---

## 6. Domain objects (App 1–specific)

```text
SelectedRoad[]
TrafficData[]
GroundProperty[]
TrafficModelRef { path$, method$, built_at$ }
NoiseLoad[]          ' handoff artifact — written here, read by App 2
TrafficAssessment { limit_metric$, limit_value#, pass%, notes$ }
ReportArtifact[]     ' TRAFFIC_MAIN | TRAFFIC_RESULTS | TRAFFIC_MODEL
```

---

## 7. Phased delivery (App 1)

| Phase | Deliverable |
|-------|-------------|
| **P0** | Mock `RunTrafficNoise` → synthetic `NoiseLoad[]` + mock report |
| **P1** | Road select + manual/CSV traffic tables |
| **P2** | Real OSM roads/buildings extract for selected extent |
| **P3** | Real traffic-noise method + limit tables |
| **P4** | Full traffic report pack (results + model appendix) |
| **P5** | Durable store so loads survive for later App 2 sessions |

---

## 8. Non-goals (v1)

- Live OSM planet queries without a local/PostGIS extract  
- Automatic municipal traffic API (manual/CSV first)  
- Replacing consultant road-selection judgment  
- High concurrency (keep &lt; 3 sessions)  

---

## 9. Next step

After App 1 P0 stub exists, flesh road select/traffic CRUD, then real OSM extract for selected roads before wiring a real Laeq engine.
