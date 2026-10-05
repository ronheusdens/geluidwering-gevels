# Ontwerpplan — kierdichting als kenmerk van het gevelcomponent

**Status:** A–D gedaan (contract + UI + GA length uit seal + SQL 0.2.35 migratie); E (legacy cleanup in client) nog open  
**Datum:** 2026-08-23  
**Context:** vervangt aparte `drawing_subsection`-rijen met `seal_for_subsection_id` door een optioneel kenmerk op het component zelf.

---

## 1. Doel

1. Eén rij per gevelcomponent in de lijst; volgorde = alleen die rijen (`sort_order`).
2. Kierdichting aan/uit als **optioneel kenmerk** (geen insert/delete van sibling).
3. Presentatie (lijst + oranje omtrek) **afgeleid** van DB-state na persist.
4. GA blijft length-bijdrage krijgen wanneer seal aan staat.

---

## 2. Domeinregel (compositie)

| Regel | Betekenis |
|-------|-----------|
| **Norm** | Kierdichting hoort bij het **composiet / ±-resultaat** (`boolean_op: compose` e.d.), niet bij elke broncontour. |
| **Afwijking toegestaan** | Seal-kenmerk mag ook op een enkelvoudig gesloten component (niet-composiet). Daarom: kenmerk, geen harde “alleen op compose”-constraint. |
| **UI-hint** | Op niet-composiet: vinkje mag, met subtiele hint *“meestal op samengesteld component”*. Geen blokkade. |

Bronnen van een compositie blijven in de lijst voor hergebruik; kier zit op het **resultaat** (default workflow).

---

## 3. Datamodel (`analysis` JSON)

Geen nieuwe DB-kolom verplicht — kenmerk in `drawing_subsection.analysis`:

```json
{
  "material_id": "…",
  "orientatie": "ZW",
  "boolean_op": "compose",
  "seal": {
    "enabled": true,
    "material_id": "…",
    "catalog_id": "D02408",
    "material_name": "…",
    "master_category": "…",
    "length_m": 12.34
  }
}
```

| Veld | Rol |
|------|-----|
| `seal.enabled` | Aan/uit |
| `seal.material_*` | Rubriek 9-profiel (los van vlakmateriaal) |
| `seal.length_m` | Cache; bij geometrie-opslag herberekend uit omtrek × schaal |

**Afwezig / `enabled: false`** = geen kier.  
**Niet** meer: aparte subsection + `seal_for_subsection_id` (na migratie).

Optioneel later (niet in v1): `seal.path_mode: "perimeter" | "custom"` voor afwijkende paden.

---

## 4. Persist & presentatie

```text
Toggle / Opslaan
    → UPDATE analysis.seal (+ length_m)
    → sort_order ongewijzigd
    → list + overlay herbouwen uit list-API
```

| Laag | Gedrag |
|------|--------|
| **Lijst** | Eén regel; badge `kier D02408` of vinkje; geen tweede “Kierdichting · …”-rij |
| **Volgorde** | Alleen component-ids in reorder; seals verdwijnen uit `mergeReorderIds`-tail |
| **Tekening** | Oranje omtrek als `seal.enabled` op **hetzelfde** points-ring (geen tweede polyline-id) |
| **Opslaan geometrie** | Als seal aan: `length_m` herberekenen uit omtrek |

Bron van waarheid = DB; geen optimistic sibling-insert / preserveOrder-hacks voor seals.

---

## 5. GA

Bij `fw_list_vr_facade_components` / client-mapping:

- Component met oppervlak → area-vlak (bestaand).
- Als `seal.enabled` → **extra length-bijdrage** afleiden (zelfde subsection-id of virtuele child in de pick-API), met `quantity_kind: length` en seal-materiaal/RA.

Voorkeur v1: API levert naast area-component een **afgeleide length-entry** (zelfde `id` + flag `from_seal: true`, of `id` + suffix alleen in UI). Belangrijk: Stot/area telt niet dubbel; length telt in GA-formule zoals nu.

Rapport / `report-api`: length uit `analysis.seal` wanneer enabled.

---

## 6. Migratie (bestaande data)

Eenmalig SQL (nieuwe DDL-patch, bv. `0_2_35`):

1. Voor elke subsection `S` met `analysis.seal_for_subsection_id = P`:
   - zet op parent `P.analysis.seal = { enabled: true, material_*, length_m van S }`
   - verwijder `S` (of markeer + delete in tweede stap)
2. Idempotent; dry-run count in start/smoke.
3. Client: lezen van legacy `seal_for_*` nog korte tijd als fallback (één release), daarna alleen `seal`.

---

## 7. UI-wijzigingen (floormap)

| Nu | Straks |
|----|--------|
| Apart vinkje + aparte lijstrij | Eén vinkje «Kierdichting (omtrek)» op het **actieve/geselecteerde** component |
| Selectie verplicht vóór create | Selectie of bewerken genoeg; toggle = save analysis |
| Oranje = sibling stroke | Oranje = draw van component als `seal.enabled` |
| Compositie + seal via aparte upsert | Na «Toepassen & opslaan» optioneel seal-vink op **resultaat**; default hint aan |

Losse handgetekende kier-paden (niet-omtrek): blijven in v1 als aparte length-component **of** uit scope tot `path_mode: custom`. Preferentie: v1 alleen omtrek-seal-kenmerk.

---

## 8. Implementatiefasen

| Fase | Scope | Klaar als |
|------|--------|-----------|
| **A — Contract** | Types + schrijven/lezen `analysis.seal`; toggle update zonder sibling | Opslaan/laden seal op één component; lijst badge |
| **B — Presentatie** | Geen seal-rijen in lijst; oranje uit kenmerk; reorder alleen componenten | ▲/▼ stabiel; oranje direct na toggle |
| **C — GA + rapport** | Length uit seal in VR-facade list / ga-calc path | Zelfde GA-getallen als voor migratie op testdata |
| **D — Migratie** | SQL 0.2.35 + start.sh; legacy delete | Geen `seal_for_subsection_id` meer in DB |
| **E — Opruimen** | Verwijder upsertPerimeterSeal-sibling pad, preserveOrder-seal-hacks | Minder code, smoke groen |

A→B kunnen in één PR; C/D strikt vóór E.

---

## 9. Acceptatiecriteria

1. Composiet: seal aan → één lijstregel, oranje omtrek, length in GA.  
2. Niet-composiet: seal aan blijft mogelijk (afwijking).  
3. Lijstvolgorde na seal-toggle ongewijzigd.  
4. Migratie: oude seal-siblings verdwijnen; parent heeft `seal.enabled`.  
5. Reorder-API: aantal ids = aantal componenten (geen seal-ghosts).

---

## 10. Bewuste non-goals (v1)

- Custom kier-polyline als kenmerk (`path_mode: custom`)
- Meerdere seals per component
- Seal op open pad / kier-only tekenen zonder omtrekvlak

---

## Volgende stap

Implementeren **fase A+B** op de client + save-path; daarna C/D.
