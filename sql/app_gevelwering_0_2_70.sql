-- app-gevelwering DDL 0.2.70 — 2026-10-10
-- Restore geometry wrongly undid by 0.2.64.
--
-- 0.2.63 skipped repair when CW formula was already live
-- (app_meta = formula_already_cw_skip_repair). 0.2.64 then applied an
-- extra +180° "undo" to view_rotate ∈ {90,270} docs — that broke correctly
-- aligned crops (e.g. Heeswijk 51: boxes on wrong drawings).
--
-- This one-shot re-applies +180° to those docs (regions + section-local
-- points that 0.2.64 flipped). Guarded by app_meta.

DO $$
DECLARE
  doc_rec RECORD;
  reg_rec RECORD;
  box double precision[];
  n integer;
  docs integer := 0;
  regions integer := 0;
  subs integer := 0;
  already text;
  undo_meta text;
  repair_meta text;
BEGIN
  SELECT value INTO already
  FROM app_gevelwering.app_meta
  WHERE key = 'ddl_0_2_70_restore_false_undo';

  IF already IS NOT NULL THEN
    RAISE NOTICE '0.2.70: skipped (already applied, app_meta=%)', already;
    RETURN;
  END IF;

  SELECT value INTO undo_meta
  FROM app_gevelwering.app_meta
  WHERE key = 'ddl_0_2_64_undo_extra_180';

  SELECT value INTO repair_meta
  FROM app_gevelwering.app_meta
  WHERE key = 'ddl_0_2_63_geometry_repair';

  -- Only reverse a false undo: 0.2.63 skipped because formula was already CW,
  -- and 0.2.64 recorded an actual undo (undid docs=…).
  IF repair_meta IS DISTINCT FROM 'formula_already_cw_skip_repair'
     OR undo_meta IS NULL
     OR undo_meta NOT LIKE 'undid%'
  THEN
    INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
    VALUES (
      'ddl_0_2_70_restore_false_undo',
      format('no_restore_needed repair=%s undo=%s', COALESCE(repair_meta, ''), COALESCE(undo_meta, '')),
      now()
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
    RAISE NOTICE '0.2.70: no restore (repair_meta=%, undo_meta=%)', repair_meta, undo_meta;
    RETURN;
  END IF;

  FOR doc_rec IN
    SELECT id
    FROM app_gevelwering.document
    WHERE view_rotate IN (90, 270)
  LOOP
    docs := docs + 1;
    FOR reg_rec IN
      SELECT id, x_min, y_min, x_max, y_max, metres_per_norm_unit
      FROM app_gevelwering.drawing_region
      WHERE document_id = doc_rec.id
    LOOP
      box := app_gevelwering.fw_rotate_norm_box(
        reg_rec.x_min, reg_rec.y_min, reg_rec.x_max, reg_rec.y_max, 180
      );
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
      WHERE id = reg_rec.id;
      regions := regions + 1;

      -- 0.2.64 also flipped points; reverse that (even though points are section-local).
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
        metres_per_norm_unit = COALESCE(reg_rec.metres_per_norm_unit, s.metres_per_norm_unit),
        updated_at = now()
      WHERE s.section_id = reg_rec.id;
      GET DIAGNOSTICS n = ROW_COUNT;
      subs := subs + n;
    END LOOP;
  END LOOP;

  INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
  VALUES (
    'ddl_0_2_70_restore_false_undo',
    format('restored docs=%s regions=%s subs=%s', docs, regions, subs),
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

  RAISE NOTICE '0.2.70 restore: % docs, % regions, % subsections', docs, regions, subs;
END;
$$;
