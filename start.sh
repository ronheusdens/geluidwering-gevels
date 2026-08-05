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

BPP_PORT="${BPP_PORT:-18080}"
UI_PORT="${GEVELWERING_UI_PORT:-4173}"
PG_DB="${BPP_PG_DB:-app_gevelwering}"
export BPP_PG_CONN="${BPP_PG_CONN:-/tmp:5432:${PG_DB}:$(whoami):}"
# BASIC INCLUDE paths resolve against this app root (fixtures/app-gevelwering/...)
export BASIC_CWD="$APP_ROOT"
export GEVELWERING_UI_PORT="$UI_PORT"
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
echo "Seeding GL.cat materials $SQL14_SEED..."
psql -d "$PG_DB" -f "$SQL14_SEED" >/dev/null
apply_sql "$SQL15"
echo "Applying DDL $SQL16 (catalogusGG rebuild) to database ${PG_DB}..."
psql -d "$PG_DB" -f "$SQL16" >/dev/null
echo "Seeding catalogusGG.pdf materials $SQL16_SEED..."
psql -d "$PG_DB" -f "$SQL16_SEED" >/dev/null
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
echo "Assigning material rubriek/subrubriek from GG taxonomy..."
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
