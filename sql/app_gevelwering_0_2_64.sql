-- app-gevelwering DDL 0.2.64 — 2026-10-07
-- Gate + optional undo of an extra +180° from re-running unguarded 0.2.63.
--
-- When start.sh re-applied 0.2.63, docs with view_rotate ∈ {90,270} got another
-- +180° and crops no longer matched the PDF. Undo once, then lock both metas
-- so further starts never touch geometry again.
--
-- Trigger: only undo when 0.2.63 just recorded "formula_already_cw_skip_repair"
-- (CW formula was already live → prior unguarded repair(s) already happened)
-- AND undo-meta is absent. After the first gated start following a double
-- unguarded run, geometry is 180° off → this undo restores alignment.
-- Fresh installs that ran repair exactly once under the old script and never
-- re-started are also "formula already cw"; undoing would break them.
-- Mitigation: only undo docs whose regions were updated in the last 6 hours
-- (typical signature of a just-re-run start.sh repair).

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
  repair_meta text;
  do_undo boolean := false;
  recent_hit integer := 0;
BEGIN
  SELECT value INTO already
  FROM app_gevelwering.app_meta
  WHERE key = 'ddl_0_2_64_undo_extra_180';

  IF already IS NOT NULL THEN
    RAISE NOTICE '0.2.64: skipped (already applied, app_meta=%)', already;
    RETURN;
  END IF;

  SELECT value INTO repair_meta
  FROM app_gevelwering.app_meta
  WHERE key = 'ddl_0_2_63_geometry_repair';

  SELECT COUNT(*)::integer INTO recent_hit
  FROM app_gevelwering.document d
  JOIN app_gevelwering.drawing_region reg ON reg.document_id = d.id
  WHERE d.view_rotate IN (90, 270)
    AND reg.updated_at > now() - interval '6 hours';

  IF repair_meta = 'formula_already_cw_skip_repair' AND recent_hit > 0 THEN
    do_undo := true;
  END IF;

  IF do_undo THEN
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
  END IF;

  INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
  VALUES (
    'ddl_0_2_63_geometry_repair',
    COALESCE(repair_meta, 'backfilled_by_0_2_64'),
    now()
  )
  ON CONFLICT (key) DO NOTHING;

  INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
  VALUES (
    'ddl_0_2_64_undo_extra_180',
    CASE
      WHEN do_undo THEN format('undid docs=%s regions=%s subs=%s', docs, regions, subs)
      ELSE 'no_undo_needed'
    END,
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

  IF do_undo THEN
    RAISE NOTICE '0.2.64 undo: % docs, % regions, % subsections', docs, regions, subs;
  ELSE
    RAISE NOTICE '0.2.64: no geometry undo (gate metas set)';
  END IF;
END;
$$;
