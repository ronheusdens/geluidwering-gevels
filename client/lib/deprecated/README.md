# Deprecated Node HTTP CRUD (bppServer migration phase 4b)

These modules are the **HTTP fallback** for endpoints migrated to bppServer WSS
(`client/src/bpp-api.ts` + `fixtures/app-gevelwering/shared_building_api.basicpp`).

| File | Replaced by |
|------|-------------|
| `floormap-api.mjs` | `API_List/Save/DeleteDrawingSubsection`, sections, scale, materials, VR components, … |
| `material-favorites-api.mjs` | `API_List/Add/RemoveMaterialFavorite`, preset actions |

**Loading:** `serve.mjs` dynamic-imports these only when `GEVELWERING_BPP_ONLY` is unset/`0`.
With `GEVELWERING_BPP_ONLY=1` (default in `start.sh`), migrated paths return **410 Gone** and
these files are never loaded.

**Client rollback:** `localStorage.setItem('GEVELWERING_BPP_HTTP','1')` plus
`GEVELWERING_BPP_ONLY=0` on Node.
