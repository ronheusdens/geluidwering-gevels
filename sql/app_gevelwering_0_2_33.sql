-- app-gevelwering DDL 0.2.33 — 2026-08-16
-- Structural fix: portable geometry length + hypot shim.
--
-- Context: PostgreSQL has no built-in hypot(). A prior fw_normalize_ring body
-- called hypot(), so every drawing-subsection save failed (VG/VR looked “ignored”).
-- bppServer only forwards SQL; the fix belongs in app SQL + start/smoke gates.

-- ---------------------------------------------------------------------------
-- Portable Euclidean length (prefer this over hypot / ad-hoc sqrt in new code)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_gevelwering.fw_euclid_len(
  dx double precision,
  dy double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT sqrt(dx * dx + dy * dy)
$$;

COMMENT ON FUNCTION app_gevelwering.fw_euclid_len(double precision, double precision) IS
  'Portable Euclidean length; use instead of hypot() (not built into PostgreSQL).';

-- ---------------------------------------------------------------------------
-- Shim: any stale PL/pgSQL still calling hypot() keeps working
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hypot(a double precision, b double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT app_gevelwering.fw_euclid_len(a, b)
$$;

COMMENT ON FUNCTION public.hypot(double precision, double precision) IS
  'Shim for non-portable hypot() calls; delegates to app_gevelwering.fw_euclid_len.';

-- List must be VOLATILE: a STABLE planner cache can serve a pre-save snapshot on the
-- same bpp session right after save, so the UI rolls back until hard refresh.
ALTER FUNCTION app_gevelwering.fw_list_drawing_subsections(uuid) VOLATILE;

-- ---------------------------------------------------------------------------
-- Re-assert fw_normalize_ring with portable length (overrides any stale body)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_gevelwering.fw_normalize_ring(p_points jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  i int;
  pt jsonb;
  x double precision;
  y double precision;
  out jsonb := '[]'::jsonb;
  first_x double precision;
  first_y double precision;
  last_x double precision;
  last_y double precision;
BEGIN
  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) < 3 THEN
    RETURN NULL;
  END IF;
  n := jsonb_array_length(p_points);
  FOR i IN 0..(n - 1) LOOP
    pt := p_points -> i;
    x := (pt ->> 'x')::double precision;
    y := (pt ->> 'y')::double precision;
    IF x IS NULL OR y IS NULL OR NOT (x >= -0.05 AND x <= 1.05 AND y >= -0.05 AND y <= 1.05) THEN
      RETURN NULL;
    END IF;
    out := out || jsonb_build_array(jsonb_build_object(
      'x', greatest(0.0, least(1.0, x)),
      'y', greatest(0.0, least(1.0, y))
    ));
  END LOOP;
  first_x := (out -> 0 ->> 'x')::double precision;
  first_y := (out -> 0 ->> 'y')::double precision;
  last_x := (out -> (jsonb_array_length(out) - 1) ->> 'x')::double precision;
  last_y := (out -> (jsonb_array_length(out) - 1) ->> 'y')::double precision;
  IF app_gevelwering.fw_euclid_len(first_x - last_x, first_y - last_y) > 1e-6 THEN
    out := out || jsonb_build_array(jsonb_build_object('x', first_x, 'y', first_y));
  END IF;
  RETURN out;
END;
$$;

-- Guard: refuse deploy if normalize_ring still references bare hypot(
DO $$
DECLARE
  src text;
BEGIN
  SELECT p.prosrc INTO src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'app_gevelwering'
    AND p.proname = 'fw_normalize_ring'
  LIMIT 1;
  IF src IS NULL THEN
    RAISE EXCEPTION 'fw_normalize_ring missing after 0.2.33';
  END IF;
  IF src ~* '(^|[^.\w])hypot\s*\(' THEN
    RAISE EXCEPTION 'fw_normalize_ring still calls hypot() — not portable on PostgreSQL';
  END IF;
END;
$$;
