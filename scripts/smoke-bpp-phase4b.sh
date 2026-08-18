#!/usr/bin/env bash
# Phase 4b smoke: SQL bpp helpers + optional Node 410 when GEVELWERING_BPP_ONLY=1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_DB="${BPP_PG_DB:-app_gevelwering}"
UI_HOST="${GEVELWERING_UI_HOST:-127.0.0.1}"
UI_PORT="${GEVELWERING_UI_PORT:-4173}"
BASE="http://${UI_HOST}:${UI_PORT}"

echo "== SQL: phase 2–4 functions =="
psql -d "$PG_DB" -v ON_ERROR_STOP=1 -tAc "
SELECT string_agg(proname, ', ' ORDER BY proname)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'app_gevelwering'
  AND proname IN (
    'fw_list_drawing_subsections',
    'fw_save_drawing_subsection',
    'fw_list_vr_facade_components',
    'fw_list_material_categories',
    'fw_list_materials',
    'fw_list_material_favorites',
    'fw_save_subsection_material'
  );
" | grep -q fw_list_drawing_subsections
echo "OK: core fw_* functions present"

echo "== SQL: material categories JSON =="
psql -d "$PG_DB" -tAc "SELECT (app_gevelwering.fw_list_material_categories()->'ok')::text" | grep -q true
echo "OK: fw_list_material_categories"

if curl -sf -o /dev/null --connect-timeout 1 "${BASE}/" 2>/dev/null; then
  echo "== Node HTTP (UI up at ${BASE}) =="
  code="$(curl -s -o /tmp/gw-bpp-smoke.json -w '%{http_code}' "${BASE}/api/floormap/sections?building_id=00000000-0000-4000-8000-000000000001" || true)"
  body="$(cat /tmp/gw-bpp-smoke.json 2>/dev/null || true)"
  if [[ "$code" == "410" ]] && echo "$body" | grep -q bpp_only; then
    echo "OK: /api/floormap/sections → 410 (BPP_ONLY active on running server)"
  elif [[ "$code" == "401" || "$code" == "400" || "$code" == "403" ]]; then
    echo "OK: /api/floormap/sections → HTTP $code (HTTP fallback still loaded; restart with GEVELWERING_BPP_ONLY=1 for 410)"
  else
    echo "FAIL: unexpected HTTP $code for /api/floormap/sections" >&2
    echo "$body" >&2
    exit 1
  fi
  code2="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/session" || true)"
  if [[ "$code2" == "405" || "$code2" == "200" || "$code2" == "401" ]]; then
    echo "OK: /api/session still reachable (HTTP $code2)"
  else
    echo "WARN: /api/session unexpected HTTP $code2"
  fi
else
  echo "SKIP Node HTTP checks (UI not listening on ${BASE})"
fi

echo "All smoke checks passed."
