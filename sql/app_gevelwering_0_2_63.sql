-- app-gevelwering DDL 0.2.63 — 2026-10-07
-- Fix view_rotate 90/270: SQL used CCW for "90" and CW for "270" (y-down),
-- while pdf.js getViewport({rotation}) applies clockwise degrees. Result: after
-- engineer rotate, section boxes + crop-local rooms no longer match the bitmap.
--
-- 1) One-shot repair: docs with view_rotate ∈ {90,270} are 180° off → rotate
--    geometry by 180 (formula identical before/after the swap), keep view_rotate.
-- 2) Swap 90/270 in fw_rotate_norm_point to match pdf.js CW.
-- 3) Sync subsection.metres_per_norm_unit when region mpu changes on rotate.

-- ---------------------------------------------------------------------------
-- Repair existing mis-aligned geometry (before swapping formulas).
-- ONE-SHOT: guarded by app_meta — re-running start.sh must not +180 again.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  d RECORD;
  r RECORD;
  box double precision[];
  n integer;
  docs integer := 0;
  regions integer := 0;
  subs integer := 0;
  already text;
BEGIN
  SELECT value INTO already
  FROM app_gevelwering.app_meta
  WHERE key = 'ddl_0_2_63_geometry_repair';

  IF already IS NOT NULL THEN
    RAISE NOTICE '0.2.63 repair: skipped (already applied, app_meta=% )', already;
    RETURN;
  END IF;

  -- Formula already swapped to CW (from a prior start.sh) → do NOT +180 again.
  -- Geometry was repaired in that earlier run; re-applying breaks crop alignment.
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'fw_rotate_norm_point'
      AND pg_get_functiondef(oid) LIKE '%1.0 - y, x%'
  ) THEN
    INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
    VALUES ('ddl_0_2_63_geometry_repair', 'formula_already_cw_skip_repair', now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
    RAISE NOTICE '0.2.63 repair: skipped (CW formula already present — set app_meta only)';
    RETURN;
  END IF;

  FOR d IN
    SELECT id
    FROM app_gevelwering.document
    WHERE view_rotate IN (90, 270)
  LOOP
    docs := docs + 1;
    FOR r IN
      SELECT id, x_min, y_min, x_max, y_max, metres_per_norm_unit
      FROM app_gevelwering.drawing_region
      WHERE document_id = d.id
    LOOP
      box := app_gevelwering.fw_rotate_norm_box(r.x_min, r.y_min, r.x_max, r.y_max, 180);
      UPDATE app_gevelwering.drawing_region
      SET
        x_min = box[1],
        y_min = box[2],
        x_max = box[3],
        y_max = box[4],
        width_norm = box[3] - box[1],
        height_norm = box[4] - box[2],
        area_norm = (box[3] - box[1]) * (box[4] - box[2]),
        perimeter_norm = 2.0 * ((box[3] - box[1]) + (box[4] - box[2])),
        updated_at = now()
      WHERE id = r.id;
      regions := regions + 1;

      UPDATE app_gevelwering.drawing_subsection s
      SET
        points = app_gevelwering.fw_rotate_norm_points(s.points, 180),
        analysis = CASE
          WHEN s.analysis IS NULL OR s.analysis -> 'holes' IS NULL THEN s.analysis
          ELSE s.analysis || jsonb_build_object(
            'holes', (
              SELECT COALESCE(jsonb_agg(app_gevelwering.fw_rotate_norm_points(h, 180)), '[]'::jsonb)
              FROM jsonb_array_elements(s.analysis -> 'holes') AS h
            )
          )
        END,
        -- Align room scale with section (was left stale on prior rotates).
        metres_per_norm_unit = COALESCE(r.metres_per_norm_unit, s.metres_per_norm_unit),
        updated_at = now()
      WHERE s.section_id = r.id;
      GET DIAGNOSTICS n = ROW_COUNT;
      subs := subs + n;
    END LOOP;
  END LOOP;

  INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
  VALUES (
    'ddl_0_2_63_geometry_repair',
    format('docs=%s regions=%s subs=%s', docs, regions, subs),
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

  RAISE NOTICE '0.2.63 repair: % docs, % regions, % subsections (+180° geometry)',
    docs, regions, subs;
END;
$$;

-- ---------------------------------------------------------------------------
-- Correct CW mapping for y-down normalized space (pdf.js viewport rotation).
-- CW 90:  (x,y) → (1-y, x)
-- CW 270: (x,y) → (y, 1-x)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_gevelwering.fw_rotate_norm_point(
  p_x double precision,
  p_y double precision,
  p_delta integer
) RETURNS double precision[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  x double precision := COALESCE(p_x, 0);
  y double precision := COALESCE(p_y, 0);
  d integer := ((COALESCE(p_delta, 0) % 360) + 360) % 360;
BEGIN
  IF d = 0 THEN
    RETURN ARRAY[x, y];
  ELSIF d = 90 THEN
    -- CW 90 (y-down): top-center → right-center
    RETURN ARRAY[1.0 - y, x];
  ELSIF d = 180 THEN
    RETURN ARRAY[1.0 - x, 1.0 - y];
  ELSIF d = 270 THEN
    -- CW 270 (y-down): top-center → left-center
    RETURN ARRAY[y, 1.0 - x];
  END IF;
  RETURN ARRAY[x, y];
END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_rotate_norm_point(double precision, double precision, integer) IS
  'Rotate norm point CW by delta (0/90/180/270) in y-down space — matches pdf.js viewport rotation.';

-- Keep fw_set_document_view_rotate, but sync subsection mpu on ±90°.
CREATE OR REPLACE FUNCTION app_gevelwering.fw_set_document_view_rotate(
  p_document_id uuid,
  p_view_rotate integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_old integer;
  v_new integer;
  v_delta integer;
  r RECORD;
  box double precision[];
  old_mpu double precision;
  old_aspect double precision;
  new_mpu double precision;
  new_aspect double precision;
  n integer;
  region_count integer := 0;
  sub_count integer := 0;
BEGIN
  v_new := ((COALESCE(p_view_rotate, 0) % 360) + 360) % 360;
  IF v_new NOT IN (0, 90, 180, 270) THEN
    RAISE EXCEPTION 'view_rotate must be 0, 90, 180 or 270';
  END IF;

  SELECT view_rotate INTO v_old
  FROM app_gevelwering.document
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'document not found';
  END IF;

  v_delta := ((v_new - v_old) % 360 + 360) % 360;
  IF v_delta = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'document_id', p_document_id,
      'view_rotate', v_new,
      'delta', 0,
      'regions', 0,
      'subsections', 0
    );
  END IF;

  FOR r IN
    SELECT id, x_min, y_min, x_max, y_max, metres_per_norm_unit, scale_aspect_yx
    FROM app_gevelwering.drawing_region
    WHERE document_id = p_document_id
  LOOP
    box := app_gevelwering.fw_rotate_norm_box(r.x_min, r.y_min, r.x_max, r.y_max, v_delta);
    old_mpu := r.metres_per_norm_unit;
    old_aspect := COALESCE(NULLIF(r.scale_aspect_yx, 0), 1);
    IF v_delta IN (90, 270) AND old_mpu IS NOT NULL AND old_mpu > 0 THEN
      new_mpu := old_mpu * old_aspect;
      new_aspect := 1.0 / old_aspect;
    ELSE
      new_mpu := old_mpu;
      new_aspect := r.scale_aspect_yx;
    END IF;

    UPDATE app_gevelwering.drawing_region
    SET
      x_min = box[1],
      y_min = box[2],
      x_max = box[3],
      y_max = box[4],
      width_norm = box[3] - box[1],
      height_norm = box[4] - box[2],
      area_norm = (box[3] - box[1]) * (box[4] - box[2]),
      perimeter_norm = 2.0 * ((box[3] - box[1]) + (box[4] - box[2])),
      metres_per_norm_unit = new_mpu,
      scale_aspect_yx = new_aspect,
      updated_at = now()
    WHERE id = r.id;
    region_count := region_count + 1;

    UPDATE app_gevelwering.drawing_subsection s
    SET
      points = app_gevelwering.fw_rotate_norm_points(s.points, v_delta),
      metres_per_norm_unit = COALESCE(new_mpu, s.metres_per_norm_unit),
      analysis = CASE
        WHEN s.analysis IS NULL OR s.analysis -> 'holes' IS NULL THEN s.analysis
        ELSE s.analysis || jsonb_build_object(
          'holes', (
            SELECT COALESCE(jsonb_agg(app_gevelwering.fw_rotate_norm_points(h, v_delta)), '[]'::jsonb)
            FROM jsonb_array_elements(s.analysis -> 'holes') AS h
          )
        )
      END,
      updated_at = now()
    WHERE s.section_id = r.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    sub_count := sub_count + n;
  END LOOP;

  UPDATE app_gevelwering.document
  SET view_rotate = v_new, updated_at = now()
  WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'view_rotate', v_new,
    'delta', v_delta,
    'regions', region_count,
    'subsections', sub_count
  );
END;
$$;
