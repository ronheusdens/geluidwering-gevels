-- app-gevelwering DDL 0.2.53 — 2026-10-03
-- Floormap rooms: uniqueness is VG+VR, not VR alone.
-- Same VR (e.g. 01) may exist in different VG's within one project.

DO $$
DECLARE
  def text;
  old_check text;
  new_check text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'app_gevelwering'
    AND p.proname = 'fw_save_drawing_subsection';

  IF def IS NULL THEN
    RAISE NOTICE 'fw_save_drawing_subsection not found — skip';
    RETURN;
  END IF;

  old_check := $old$
  IF v_sec.region_kind = 'FLOORMAP' AND v_vr_nr IS NOT NULL THEN
    SELECT s.id::text
    INTO v_dup_id
    FROM app_gevelwering.drawing_subsection s
    JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
    WHERE s.building_id = v_sec.building_id
      AND s.vr_nr IS NOT NULL
      AND lower(s.vr_nr) = lower(v_vr_nr)
      AND r.region_kind = 'FLOORMAP'
      AND (v_subsection_id IS NULL OR s.id <> v_subsection_id)
    LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'VR number already used on another room in this project'
        USING ERRCODE = '23505';
    END IF;
  END IF;
$old$;

  new_check := $new$
  -- Uniek is de combinatie VG+VR (zelfde VR in een andere VG mag).
  IF v_sec.region_kind = 'FLOORMAP' AND v_vg_nr IS NOT NULL AND v_vr_nr IS NOT NULL THEN
    SELECT s.id::text
    INTO v_dup_id
    FROM app_gevelwering.drawing_subsection s
    JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
    WHERE s.building_id = v_sec.building_id
      AND s.vg_nr IS NOT NULL
      AND s.vr_nr IS NOT NULL
      AND s.vg_nr = v_vg_nr
      AND lower(s.vr_nr) = lower(v_vr_nr)
      AND r.region_kind = 'FLOORMAP'
      AND (v_subsection_id IS NULL OR s.id <> v_subsection_id)
    LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'VG/VR combination already used on another room in this project'
        USING ERRCODE = '23505';
    END IF;
  END IF;
$new$;

  IF position(old_check in def) > 0 THEN
    def := replace(def, old_check, new_check);
  ELSIF position('VG/VR combination already used' in def) = 0 THEN
    RAISE NOTICE 'fw_save_drawing_subsection: expected VR-only duplicate check not found; leaving body as-is';
  END IF;

  def := replace(
    def,
    'RAISE EXCEPTION ''VR number already used on another room in this project''',
    'RAISE EXCEPTION ''VG/VR combination already used on another room in this project'''
  );

  EXECUTE def;
END $$;
