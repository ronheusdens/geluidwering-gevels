#!/usr/bin/env bash
# Smoke: drawing-subsection save path must not depend on missing Postgres hypot().
# Fails hard so start.sh does not bring up bpp/UI on a broken geometry stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_DB="${BPP_PG_DB:-app_gevelwering}"

echo "== SQL: portable geometry helpers =="
psql -d "$PG_DB" -v ON_ERROR_STOP=1 -tAc "
SELECT
  (SELECT COUNT(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_gevelwering' AND p.proname = 'fw_euclid_len')
  + (SELECT COUNT(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'hypot')
  + (SELECT COUNT(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_gevelwering' AND p.proname = 'fw_normalize_ring');
" | grep -q '^3$'
echo "OK: fw_euclid_len + public.hypot + fw_normalize_ring"

echo "== SQL: fw_normalize_ring body is portable =="
psql -d "$PG_DB" -v ON_ERROR_STOP=1 -tAc "
SELECT CASE
  WHEN prosrc ~* '(^|[^.\w])hypot\s*\(' THEN 'BAD'
  ELSE 'OK'
END
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'app_gevelwering' AND proname = 'fw_normalize_ring'
LIMIT 1;
" | grep -q OK
echo "OK: no bare hypot() in fw_normalize_ring"

echo "== SQL: normalize closed triangle =="
norm="$(
  psql -d "$PG_DB" -v ON_ERROR_STOP=1 -tAc "
    SELECT jsonb_array_length(
      app_gevelwering.fw_normalize_ring(
        '[{\"x\":0.1,\"y\":0.1},{\"x\":0.4,\"y\":0.1},{\"x\":0.25,\"y\":0.4}]'::jsonb
      )
    )::text;
  "
)"
norm="$(echo "$norm" | tr -d '[:space:]')"
if [[ "$norm" != "4" ]]; then
  echo "FAIL: expected closed ring length 4, got '${norm}'" >&2
  exit 1
fi
echo "OK: fw_normalize_ring closes ring (${norm} verts)"

echo "== SQL: public.hypot shim =="
psql -d "$PG_DB" -v ON_ERROR_STOP=1 -tAc "SELECT public.hypot(3::float8, 4::float8)::int" | grep -q '^5$'
echo "OK: public.hypot(3,4)=5"

echo "== SQL: fw_save_drawing_subsection reachable =="
psql -d "$PG_DB" -v ON_ERROR_STOP=1 -tAc "
SELECT 1 FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'app_gevelwering' AND proname = 'fw_save_drawing_subsection'
LIMIT 1;
" | grep -q 1
echo "OK: fw_save_drawing_subsection present"

echo "All save-geometry smoke checks passed."
