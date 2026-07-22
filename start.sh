#!/usr/bin/env bash
# Start Postgres DDL (idempotent), bppServer, and the Acoustics HTML/TS UI.
# This app is independent of bppServer development; it only consumes the binary.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")" && pwd)"
BPPSERVER_ROOT="${BPPSERVER_ROOT:-$(cd "$APP_ROOT/../bppServer" && pwd)}"
CLIENT="$APP_ROOT/client"
BIN="$BPPSERVER_ROOT/build/bin/bppServer"
SQL_DIR="$APP_ROOT/sql"

SQL="$SQL_DIR/acoustics_0_1_0.sql"
SQL2="$SQL_DIR/acoustics_0_2_0.sql"
SQL3="$SQL_DIR/acoustics_0_2_1.sql"
SQL4="$SQL_DIR/acoustics_0_2_2.sql"
SQL5="$SQL_DIR/acoustics_0_2_3.sql"
SQL6="$SQL_DIR/acoustics_0_2_4.sql"
SQL7="$SQL_DIR/acoustics_0_2_5.sql"
SQL8="$SQL_DIR/acoustics_0_2_6.sql"
SQL9="$SQL_DIR/acoustics_0_2_7.sql"
SQL10="$SQL_DIR/acoustics_0_2_8.sql"
SQL11="$SQL_DIR/acoustics_0_2_9.sql"
SQL12="$SQL_DIR/acoustics_0_2_10.sql"
SQL13="$SQL_DIR/acoustics_0_2_11.sql"
SQL14="$SQL_DIR/acoustics_0_2_12.sql"
SQL14_SEED="$SQL_DIR/acoustics_0_2_12_gl_material_seed.sql"
SQL15="$SQL_DIR/acoustics_0_2_13.sql"
SQL16="$SQL_DIR/acoustics_0_2_14.sql"
SQL16_SEED="$SQL_DIR/acoustics_0_2_14_catalogus_gg_seed.sql"
SQL17="$SQL_DIR/acoustics_0_2_15.sql"
SQL18="$SQL_DIR/acoustics_0_2_16.sql"

BPP_PORT="${BPP_PORT:-18080}"
UI_PORT="${ACOUSTICS_UI_PORT:-4173}"
PG_DB="${BPP_PG_DB:-acoustics}"
export BPP_PG_CONN="${BPP_PG_CONN:-/tmp:5432:${PG_DB}:$(whoami):}"
# BASIC INCLUDE paths resolve against this app root (fixtures/acoustics/...)
export BASIC_CWD="$APP_ROOT"
export ACOUSTICS_UI_PORT="$UI_PORT"

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
echo "  Form URL:  http://127.0.0.1:${UI_PORT}/"
echo "  bppServer: ws://127.0.0.1:${BPP_PORT}/ws"
echo "  PG conn:   $BPP_PG_CONN"
echo "  Login:     ronheusdens / demo  (or demo / demo)"
echo "  Admin:     admin / demo  -> /admin.html"
echo "  Materials: admin / demo  -> /materials.html"
echo "  Engineer:  engineer / demo -> /engineer.html"
echo "  Floormap:  engineer / demo -> /floormap.html"
echo "  GA-model:  engineer / demo -> /ga.html"
echo ""
echo "  Note: this is LOCAL http/ws only."
echo "  Public HTTPS/WSS: Apache + scripts/apache2/acoustics-https.conf"
echo "  See client/docs/secure-deployment.md"
echo "=============================================="
echo ""
wait
