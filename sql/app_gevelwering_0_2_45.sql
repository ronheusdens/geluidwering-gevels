-- app-gevelwering DDL 0.2.45 — 2026-09-11
-- Rubriek 10: Losse materialen (bouwstenen voor samengestelde materialen / templates).

-- Allow rubriek nr 10 (+ 11 Interieur) on taxonomy tables.
-- Idempotent upper bound is 11 so re-runs after 0.2.57 do not fail.
ALTER TABLE app_gevelwering.material_rubriek
  DROP CONSTRAINT IF EXISTS material_rubriek_nr_check;
ALTER TABLE app_gevelwering.material_rubriek
  ADD CONSTRAINT material_rubriek_nr_check CHECK (nr BETWEEN 1 AND 11);

COMMENT ON TABLE app_gevelwering.material_rubriek IS
  'DGMR GG rubrieken 1–9 plus app 10 (Losse materialen) and 11 (Interieur).';

DO $$
BEGIN
  IF to_regclass('acoustic_catalog.spectrum_pattern') IS NOT NULL THEN
    ALTER TABLE acoustic_catalog.spectrum_pattern
      DROP CONSTRAINT IF EXISTS spectrum_pattern_rubriek_nr_check;
    ALTER TABLE acoustic_catalog.spectrum_pattern
      ADD CONSTRAINT spectrum_pattern_rubriek_nr_check
      CHECK (rubriek_nr IS NULL OR rubriek_nr BETWEEN 1 AND 11);
  END IF;
END $$;

INSERT INTO app_gevelwering.material_rubriek (nr, name) VALUES
  (10, 'Losse materialen')
ON CONFLICT (nr) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO app_gevelwering.material_subrubriek (rubriek_nr, nr, name) VALUES
  (10, 1, 'Bekleding / buitenblad'),
  (10, 2, 'Ventilerende spouw'),
  (10, 3, 'Folie / membraan'),
  (10, 4, 'Beplating'),
  (10, 5, 'Skelet / stijlen'),
  (10, 6, 'Isolatie'),
  (10, 7, 'Damprem'),
  (10, 8, 'Binnenafwerking'),
  (10, 9, 'Constructie'),
  (10, 10, 'Overig')
ON CONFLICT (rubriek_nr, nr) DO UPDATE SET name = EXCLUDED.name;

-- Floormap/API create path: allow rubriek 1–11 (11 = Interieur; refined again in 0.2.57).
CREATE OR REPLACE FUNCTION app_gevelwering.fw_create_material(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text := left(btrim(coalesce(p_payload ->> 'name', '')), 200);
  v_ra double precision := nullif(p_payload ->> 'ra_dba', '')::double precision;
  v_rubriek int := nullif(p_payload ->> 'rubriek_nr', '')::int;
  v_subrubriek int := nullif(p_payload ->> 'subrubriek_nr', '')::int;
  v_category text := left(btrim(coalesce(p_payload ->> 'category', '')), 120);
  v_subsection_id uuid;
  v_master text;
  v_sub_name text;
  v_material_no int;
  v_catalog_index int;
  v_catalog_id text;
  v_mat app_gevelwering.material%ROWTYPE;
  v_analysis jsonb;
  v_prev jsonb;
  v_assigned boolean := false;
BEGIN
  IF nullif(btrim(p_payload ->> 'subsection_id'), '') IS NOT NULL THEN
    v_subsection_id := (p_payload ->> 'subsection_id')::uuid;
  END IF;

  IF v_name = '' THEN RAISE EXCEPTION 'name is required'; END IF;
  IF v_ra IS NULL OR v_ra < 0 OR v_ra > 100 THEN
    RAISE EXCEPTION 'ra_dba must be between 0 and 100';
  END IF;
  IF v_rubriek IS NULL OR v_rubriek < 1 OR v_rubriek > 11 THEN
    RAISE EXCEPTION 'rubriek_nr must be 1–11';
  END IF;

  SELECT name INTO v_master FROM app_gevelwering.material_rubriek WHERE nr = v_rubriek;
  IF v_master IS NULL THEN
    v_master := 'Rubriek ' || v_rubriek::text;
  END IF;

  IF v_subrubriek IS NOT NULL THEN
    SELECT name INTO v_sub_name
    FROM app_gevelwering.material_subrubriek
    WHERE rubriek_nr = v_rubriek AND nr = v_subrubriek;
    IF v_sub_name IS NOT NULL THEN
      v_category := v_sub_name;
    ELSE
      v_subrubriek := NULL;
    END IF;
  ELSIF v_category <> '' THEN
    SELECT nr INTO v_subrubriek
    FROM app_gevelwering.material_subrubriek
    WHERE rubriek_nr = v_rubriek AND name = v_category
    LIMIT 1;
  END IF;

  SELECT
    COALESCE(MAX(material_no), 0) + 1,
    COALESCE(MAX(catalog_index), -1) + 1
  INTO v_material_no, v_catalog_index
  FROM app_gevelwering.material
  WHERE source = 'app';

  v_catalog_id := 'A' || lpad(v_material_no::text, 5, '0');

  INSERT INTO app_gevelwering.material (
    catalog_index, catalog_id, material_no, master_category, name, category,
    rubriek_nr, subrubriek_nr, ra_dba, spectrum_ok, source, source_ref
  ) VALUES (
    v_catalog_index, v_catalog_id, v_material_no, v_master, v_name,
    nullif(v_category, ''),
    v_rubriek, v_subrubriek, v_ra, true, 'app', 'app catalogus'
  )
  RETURNING * INTO v_mat;

  IF v_subsection_id IS NOT NULL THEN
    SELECT analysis INTO v_prev
    FROM app_gevelwering.drawing_subsection
    WHERE id = v_subsection_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'subsection not found';
    END IF;
    v_analysis := coalesce(v_prev, '{}'::jsonb) || jsonb_build_object(
      'material_id', v_mat.id::text,
      'material_name', v_mat.name,
      'catalog_id', v_mat.catalog_id,
      'master_category', v_mat.master_category,
      'rubriek_nr', v_rubriek
    );
    IF v_rubriek = 9 THEN
      v_analysis := v_analysis || jsonb_build_object('quantity_kind', 'length');
    END IF;
    UPDATE app_gevelwering.drawing_subsection
    SET analysis = v_analysis, updated_at = now()
    WHERE id = v_subsection_id;
    v_assigned := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'material', jsonb_build_object(
      'material_id', v_mat.id::text,
      'catalog_id', v_mat.catalog_id,
      'name', v_mat.name,
      'master_category', v_mat.master_category,
      'category', coalesce(v_mat.category, ''),
      'rubriek_nr', v_mat.rubriek_nr,
      'subrubriek_nr', v_mat.subrubriek_nr,
      'ra_dba', v_mat.ra_dba,
      'source', 'app'
    ),
    'subsection_id', CASE WHEN v_subsection_id IS NULL THEN NULL ELSE v_subsection_id::text END,
    'assigned', v_assigned
  );
END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_create_material(uuid, jsonb) IS
  'Create app material (A#####); rubriek_nr 1–11 (10 = Losse materialen, 11 = Interieur).';
