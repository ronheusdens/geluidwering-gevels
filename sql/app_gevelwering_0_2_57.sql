-- app-gevelwering DDL 0.2.57 — 2026-10-04
-- Rubriek 11: Interieur (isolatie / overdracht tussen ruimten).

ALTER TABLE app_gevelwering.material_rubriek
  DROP CONSTRAINT IF EXISTS material_rubriek_nr_check;
ALTER TABLE app_gevelwering.material_rubriek
  ADD CONSTRAINT material_rubriek_nr_check CHECK (nr BETWEEN 1 AND 11);

COMMENT ON TABLE app_gevelwering.material_rubriek IS
  'DGMR GG rubrieken 1–9, app 10 (Losse materialen), app 11 (Interieur).';

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
  (11, 'Interieur')
ON CONFLICT (nr) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO app_gevelwering.material_subrubriek (rubriek_nr, nr, name) VALUES
  (11, 1, 'Scheidingswanden'),
  (11, 2, 'Binnenwanden'),
  (11, 3, 'Vloeren / plafonds'),
  (11, 4, 'Vloerafwerking (ΔL)'),
  (11, 5, 'Diversen')
ON CONFLICT (rubriek_nr, nr) DO UPDATE SET name = EXCLUDED.name;

-- Move known interior rows into rubriek 11 (keep EXTERIOR rows untouched).
UPDATE app_gevelwering.material m
SET
  master_category = 'Interieur',
  rubriek_nr = 11,
  category = CASE
    WHEN m.catalog_id IN ('A00007') OR m.name ILIKE '%scheidingswand%' THEN 'Scheidingswanden'
    WHEN m.catalog_id IN ('A00008', 'A00009')
      OR m.name ILIKE 'Metalstud%'
      OR m.name ILIKE 'Fermacell%'
      OR m.name ILIKE 'Faay%'
      OR m.name ILIKE '%binnenwand%'
      THEN 'Binnenwanden'
    WHEN m.name ILIKE '%vloerafwerking%' OR m.name ILIKE 'ΔL %' OR m.name ILIKE 'DeltaL %'
      THEN 'Vloerafwerking (ΔL)'
    ELSE COALESCE(NULLIF(m.category, ''), 'Diversen')
  END,
  subrubriek_nr = CASE
    WHEN m.catalog_id IN ('A00007') OR m.name ILIKE '%scheidingswand%' THEN 1
    WHEN m.catalog_id IN ('A00008', 'A00009')
      OR m.name ILIKE 'Metalstud%'
      OR m.name ILIKE 'Fermacell%'
      OR m.name ILIKE 'Faay%'
      OR m.name ILIKE '%binnenwand%'
      THEN 2
    WHEN m.name ILIKE '%vloerafwerking%' OR m.name ILIKE 'ΔL %' OR m.name ILIKE 'DeltaL %'
      THEN 4
    ELSE 5
  END,
  updated_at = now()
WHERE m.exposure = 'INTERIOR';

-- Seed ΔL vloerafwerkingen as INTERIOR materials (R-bands carry ΔL spectrum for picker).
DO $$
DECLARE
  v_next_no int;
  v_next_idx int;
  rec record;
BEGIN
  SELECT COALESCE(MAX(material_no), 0), COALESCE(MAX(catalog_index), -1)
  INTO v_next_no, v_next_idx
  FROM app_gevelwering.material
  WHERE source = 'app';

  FOR rec IN
    SELECT * FROM (VALUES
      ('A00010', 'ΔL groene ondervloerplaten', 'GREEN_UNDERLAY', 6::float8, 11::float8, 16::float8, 20::float8, 22::float8),
      ('A00011', 'ΔL granulaatrubber', 'GRANULAR_RUBBER', 11::float8, 16::float8, 20::float8, 22::float8, 23::float8),
      ('A00012', 'ΔL Fermacell 2E32/2E35', 'FERMACELL_2E32', 22::float8, 26::float8, 30::float8, 32::float8, 33::float8),
      ('A00013', 'ΔL 30 mm dekvloer', 'SCREED_30', 0::float8, 0::float8, 0::float8, 0::float8, 0::float8)
    ) AS v(catalog_id, name, finish_code, d125, d250, d500, d1k, d2k)
  LOOP
    IF EXISTS (
      SELECT 1 FROM app_gevelwering.material
      WHERE source = 'app' AND catalog_id = rec.catalog_id
    ) THEN
      UPDATE app_gevelwering.material
      SET exposure = 'INTERIOR',
          master_category = 'Interieur',
          rubriek_nr = 11,
          category = 'Vloerafwerking (ΔL)',
          subrubriek_nr = 4,
          name = rec.name,
          r_125_hz = rec.d125, r_250_hz = rec.d250, r_500_hz = rec.d500,
          r_1000_hz = rec.d1k, r_2000_hz = rec.d2k,
          r_db = ARRAY[rec.d125, rec.d250, rec.d500, rec.d1k, rec.d2k, NULL]::double precision[],
          source_ref = 'isolatie floor_finish_delta_l:' || rec.finish_code,
          updated_at = now()
      WHERE source = 'app' AND catalog_id = rec.catalog_id;
    ELSE
      v_next_no := v_next_no + 1;
      v_next_idx := v_next_idx + 1;
      INSERT INTO app_gevelwering.material (
        catalog_index, catalog_id, material_no,
        master_category, name, category,
        rubriek_nr, subrubriek_nr,
        r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz,
        r_db, spectrum_ok, source, source_ref, exposure
      ) VALUES (
        v_next_idx, rec.catalog_id, v_next_no,
        'Interieur', rec.name, 'Vloerafwerking (ΔL)',
        11, 4,
        rec.d125, rec.d250, rec.d500, rec.d1k, rec.d2k,
        ARRAY[rec.d125, rec.d250, rec.d500, rec.d1k, rec.d2k, NULL]::double precision[],
        true, 'app',
        'isolatie floor_finish_delta_l:' || rec.finish_code,
        'INTERIOR'
      );
    END IF;
  END LOOP;
END $$;

-- Allow rubriek 11 in create-material API
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
  v_exposure text := upper(nullif(btrim(coalesce(p_payload ->> 'exposure', '')), ''));
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

  IF v_exposure IN ('INTERIEUR', 'INTERIOR') THEN
    v_exposure := 'INTERIOR';
  ELSE
    v_exposure := 'EXTERIOR';
  END IF;
  IF v_rubriek = 11 THEN
    v_exposure := 'INTERIOR';
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
    rubriek_nr, subrubriek_nr, ra_dba, spectrum_ok, source, source_ref, exposure
  ) VALUES (
    v_catalog_index, v_catalog_id, v_material_no, v_master, v_name,
    nullif(v_category, ''),
    v_rubriek, v_subrubriek, v_ra, true, 'app', 'app catalogus', v_exposure
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
      'exposure', v_mat.exposure,
      'source', 'app'
    ),
    'subsection_id', CASE WHEN v_subsection_id IS NULL THEN NULL ELSE v_subsection_id::text END,
    'assigned', v_assigned
  );
END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_create_material(uuid, jsonb) IS
  'Create app material (A#####); rubriek_nr 1–11 (11 = Interieur → exposure INTERIOR).';
