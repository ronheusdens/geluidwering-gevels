#!/usr/bin/env bash
# Start Postgres DDL (idempotent), bppServer, and the Gevelwering HTML/TS UI.
# This app is independent of bppServer development; it only consumes the binary.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")" && pwd)"
BPPSERVER_ROOT="${BPPSERVER_ROOT:-$(cd "$APP_ROOT/../bppServer" && pwd)}"
CLIENT="$APP_ROOT/client"
BIN="$BPPSERVER_ROOT/build/bin/bppServer"
SQL_DIR="$APP_ROOT/sql"

SQL="$SQL_DIR/app_gevelwering_0_1_0.sql"
SQL2="$SQL_DIR/app_gevelwering_0_2_0.sql"
SQL3="$SQL_DIR/app_gevelwering_0_2_1.sql"
SQL4="$SQL_DIR/app_gevelwering_0_2_2.sql"
SQL5="$SQL_DIR/app_gevelwering_0_2_3.sql"
SQL6="$SQL_DIR/app_gevelwering_0_2_4.sql"
SQL7="$SQL_DIR/app_gevelwering_0_2_5.sql"
SQL8="$SQL_DIR/app_gevelwering_0_2_6.sql"
SQL9="$SQL_DIR/app_gevelwering_0_2_7.sql"
SQL10="$SQL_DIR/app_gevelwering_0_2_8.sql"
SQL11="$SQL_DIR/app_gevelwering_0_2_9.sql"
SQL12="$SQL_DIR/app_gevelwering_0_2_10.sql"
SQL13="$SQL_DIR/app_gevelwering_0_2_11.sql"
SQL14="$SQL_DIR/app_gevelwering_0_2_12.sql"
SQL14_SEED="$SQL_DIR/app_gevelwering_0_2_12_gl_material_seed.sql"
SQL15="$SQL_DIR/app_gevelwering_0_2_13.sql"
SQL16="$SQL_DIR/app_gevelwering_0_2_14.sql"
SQL16_SEED="$SQL_DIR/app_gevelwering_0_2_14_catalogus_gg_seed.sql"
SQL17="$SQL_DIR/app_gevelwering_0_2_15.sql"
SQL18="$SQL_DIR/app_gevelwering_0_2_16.sql"
SQL19="$SQL_DIR/app_gevelwering_0_2_17.sql"
SQL20="$SQL_DIR/app_gevelwering_0_2_18.sql"
SQL21="$SQL_DIR/app_gevelwering_0_2_19.sql"
SQL22="$SQL_DIR/app_gevelwering_0_2_20.sql"
SQL23="$SQL_DIR/app_gevelwering_0_2_21.sql"
SQL23_ASSIGN="$SQL_DIR/app_gevelwering_0_2_21_assign_rubriek.py"
SQL24="$SQL_DIR/app_gevelwering_0_2_22.sql"
SQL25="$SQL_DIR/app_gevelwering_0_2_23.sql"
SQL25_BACKFILL="$SQL_DIR/app_gevelwering_0_2_23_backfill_rw.py"
SQL26="$SQL_DIR/app_gevelwering_0_2_24.sql"
SQL27="$SQL_DIR/app_gevelwering_0_2_25.sql"
SQL28="$SQL_DIR/app_gevelwering_0_2_26.sql"
SQL29="$SQL_DIR/app_gevelwering_0_2_27.sql"
SQL30="$SQL_DIR/app_gevelwering_0_2_28.sql"
SQL31="$SQL_DIR/app_gevelwering_0_2_29.sql"
SQL32="$SQL_DIR/app_gevelwering_0_2_30.sql"
SQL33="$SQL_DIR/app_gevelwering_0_2_31.sql"
SQL34="$SQL_DIR/app_gevelwering_0_2_32.sql"
SQL35="$SQL_DIR/app_gevelwering_0_2_33.sql"
SMOKE_SAVE_GEOM="$APP_ROOT/scripts/smoke-save-geometry.sh"

BPP_PORT="${BPP_PORT:-18080}"
UI_PORT="${GEVELWERING_UI_PORT:-4173}"
PG_DB="${BPP_PG_DB:-app_gevelwering}"
export BPP_PG_CONN="${BPP_PG_CONN:-/tmp:5432:${PG_DB}:$(whoami):}"
# BASIC INCLUDE paths resolve against this app root (fixtures/app-gevelwering/...)
export BASIC_CWD="$APP_ROOT"
export GEVELWERING_UI_PORT="$UI_PORT"
# Default: migrated floormap/drawing CRUD returns 410 (bpp WSS only). Set 0 for HTTP rollback.
export GEVELWERING_BPP_ONLY="${GEVELWERING_BPP_ONLY:-1}"
# Generated HTML reports: data/projecten/{slug}_{buildingId8}/rapporten/
export GEVELWERING_PROJECTS_ROOT="${GEVELWERING_PROJECTS_ROOT:-$APP_ROOT/data/projecten}"
mkdir -p "$GEVELWERING_PROJECTS_ROOT"

if [[ ! -x "$BIN" ]]; then
  echo "Missing $BIN — build bppServer first:" >&2
  echo "  (cd \"$BPPSERVER_ROOT\" && ./scripts/bootstrap-core.sh && make)" >&2
  exit 1
fi

apply_sql() {
  local f="$1"
  echo "Applying DDL $f to database ${PG_DB}..."
  psql -d "$PG_DB" -f "$f" >/dev/null
}

apply_sql "$SQL"
apply_sql "$SQL2"
apply_sql "$SQL3"
apply_sql "$SQL4"
apply_sql "$SQL5"
apply_sql "$SQL6"
apply_sql "$SQL7"
apply_sql "$SQL8"
apply_sql "$SQL9"
apply_sql "$SQL10"
apply_sql "$SQL11"
apply_sql "$SQL12"
apply_sql "$SQL13"
apply_sql "$SQL14"
apply_sql "$SQL15"

# Early app_meta so one-time seed flag works before full 0.2.28 DDL.
psql -d "$PG_DB" -c \
  "CREATE TABLE IF NOT EXISTS app_gevelwering.app_meta (
     key text PRIMARY KEY,
     value text NOT NULL DEFAULT '',
     updated_at timestamptz NOT NULL DEFAULT now()
   );" >/dev/null

# Material catalog: create catalogusGG shape once; never DROP when rows exist.
# Seed catalogusGG only when the table is empty (app-owned thereafter).
mat_has_catalog_id="$(
  psql -d "$PG_DB" -tAc \
    "SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'app_gevelwering'
       AND table_name = 'material'
       AND column_name = 'catalog_id'
     LIMIT 1" 2>/dev/null || true
)"
mat_count="$(
  psql -d "$PG_DB" -tAc "SELECT COUNT(*)::text FROM app_gevelwering.material" 2>/dev/null || echo 0
)"
mat_count="$(echo "$mat_count" | tr -d '[:space:]')"
[[ -z "$mat_count" ]] && mat_count=0

if [[ -z "$mat_has_catalog_id" ]]; then
  if [[ "$mat_count" != "0" ]]; then
    echo "ERROR: material table lacks catalog_id but has ${mat_count} rows — refuse DROP" >&2
    exit 1
  fi
  echo "Applying DDL $SQL16 (catalogusGG material shape, empty table) to database ${PG_DB}..."
  psql -d "$PG_DB" -f "$SQL16" >/dev/null
  mat_count=0
fi

seeded_flag="$(
  psql -d "$PG_DB" -tAc \
    "SELECT value FROM app_gevelwering.app_meta WHERE key = 'material_catalog_seeded' LIMIT 1" \
    2>/dev/null || true
)"
seeded_flag="$(echo "$seeded_flag" | tr -d '[:space:]')"

if [[ "$mat_count" == "0" && "$seeded_flag" != "1" ]]; then
  echo "One-time seed: catalogusGG.pdf materials → ${PG_DB}..."
  psql -d "$PG_DB" -f "$SQL16_SEED" >/dev/null
  psql -d "$PG_DB" -c \
    "INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
     VALUES ('material_catalog_seeded', '1', now())
     ON CONFLICT (key) DO UPDATE SET value = '1', updated_at = now();" \
    >/dev/null 2>&1 || true
else
  echo "Material catalog already present (${mat_count} rows) — skip re-seed (app-owned)."
fi

apply_sql "$SQL17"
echo "Applying DDL $SQL18 (GA model: variant/VG/VR/vlak) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL18" >/dev/null
echo "Applying DDL $SQL19 (default spectrum 2) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL19" >/dev/null
echo "Applying DDL $SQL20 (VG/VR numbers on rooms) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL20" >/dev/null
echo "Applying DDL $SQL21 (VR text id e.g. 3A) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL21" >/dev/null
echo "Applying DDL $SQL22 (VR unique only among floormap rooms via API) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL22" >/dev/null
echo "Applying DDL $SQL23 (material rubriek + subrubriek taxonomy) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL23" >/dev/null
echo "Assigning material rubriek/subrubriek from GG taxonomy (idempotent)..."
python3 "$SQL23_ASSIGN"
echo "Applying DDL $SQL24 (engineer display_name) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL24" >/dev/null
echo "Applying DDL $SQL25 (R@4000 + Rw/C/Ctr) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL25" >/dev/null
echo "Backfilling Rw (C, Ctr) from R spectra..."
python3 "$SQL25_BACKFILL" || echo "Warning: Rw backfill skipped or failed" >&2
echo "Applying DDL $SQL26 (scale_aspect_yx for non-square crops) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL26" >/dev/null
echo "Applying DDL $SQL27 (multi-variant: VR.variant_id + unique per variant) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL27" >/dev/null
echo "Applying DDL $SQL28 (customer report inbox) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL28" >/dev/null
apply_sql "$SQL29"
echo "Applying DDL $SQL30 (material favorites + presets, app_meta) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL30" >/dev/null
echo "Applying DDL $SQL31 (client_ref = kenmerk opdrachtgever) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL31" >/dev/null
# Portable geometry helpers + hypot shim BEFORE subsection CRUD (0.2.30).
echo "Applying DDL $SQL35 (portable euclid_len + hypot shim) to database ${PG_DB}..."
psql -d "$PG_DB" -v ON_ERROR_STOP=1 -f "$SQL35" >/dev/null
echo "Applying DDL $SQL32 (bpp phase 2: subsection CRUD functions) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL32" >/dev/null
echo "Applying DDL $SQL33 (bpp phase 3: VR façade components for GA) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL33" >/dev/null
echo "Applying DDL $SQL34 (bpp phase 4: materials + favorites) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL34" >/dev/null
# Re-assert portable normalize_ring after 0.2.30 replace (idempotent).
echo "Re-applying DDL $SQL35 (re-assert fw_normalize_ring portability) to database ${PG_DB}..."
psql -d "$PG_DB" -v ON_ERROR_STOP=1 -f "$SQL35" >/dev/null

echo "Smoke: save-geometry path (hypot / normalize_ring)..."
chmod +x "$SMOKE_SAVE_GEOM"
"$SMOKE_SAVE_GEOM"

# Ensure seeded flag after first successful catalog load
psql -d "$PG_DB" -c \
  "INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
   SELECT 'material_catalog_seeded', '1', now()
   WHERE EXISTS (SELECT 1 FROM app_gevelwering.material LIMIT 1)
   ON CONFLICT (key) DO NOTHING;" >/dev/null

# Free port so a previous bppServer cannot keep a stale Postgres session.
if command -v lsof >/dev/null 2>&1; then
  old_bpp="$(lsof -tiTCP:"$BPP_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$old_bpp" ]]; then
    echo "Stopping previous listener(s) on :$BPP_PORT ($old_bpp)..."
    # shellcheck disable=SC2086
    kill $old_bpp 2>/dev/null || true
    sleep 0.3
  fi
fi

echo "Starting bppServer on :$BPP_PORT (BASIC_CWD=$BASIC_CWD, bin=$BIN)..."
"$BIN" --server --port "$BPP_PORT" &
BPP_PID=$!

cleanup() {
  kill "$BPP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 0.4

echo "Building + serving UI..."
cd "$CLIENT"
if [[ ! -d node_modules ]]; then
  npm install
fi
npm run build
if [[ "${GEVELWERING_BPP_ONLY}" == "1" ]]; then
  echo "Node UI: GEVELWERING_BPP_ONLY=1 (migrated /api/floormap/* → 410 Gone)"
else
  echo "Node UI: GEVELWERING_BPP_ONLY=${GEVELWERING_BPP_ONLY} (HTTP CRUD fallback ON)"
fi
node serve.mjs &
UI_PID=$!

cleanup2() {
  kill "$UI_PID" 2>/dev/null || true
  cleanup
}
trap cleanup2 EXIT INT TERM

echo ""
echo "=============================================="
echo "  Landing:   http://127.0.0.1:${UI_PORT}/"
echo "  Opdrachtgever: http://127.0.0.1:${UI_PORT}/opdrachtgever.html"
echo "  bppServer: ws://127.0.0.1:${BPP_PORT}/ws"
echo "  PG conn:   $BPP_PG_CONN"
echo "  Login:     demo / demo"
echo "  Admin:     admin / demo  -> /admin.html"
echo "  Materials: admin / demo  -> /materials.html"
echo "  Engineer:  engineer / demo -> /engineer.html"
echo "  Floormap:  engineer / demo -> /floormap.html"
echo "  GA-model:  engineer / demo -> /ga.html"
echo "  Handleiding:               -> /handleiding.html"
echo "  Rapporten: $GEVELWERING_PROJECTS_ROOT"
echo ""
echo "  Note: this is LOCAL http/ws only."
echo "  Public HTTPS/WSS: Apache + scripts/apache2/app-gevelwering-https.conf"
echo "  See client/docs/secure-deployment.md"
echo "=============================================="
echo ""
wait
