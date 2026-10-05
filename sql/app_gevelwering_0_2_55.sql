-- app-gevelwering DDL 0.2.55 — 2026-10-04
-- Material exposure: EXTERIOR (gevelwering) | INTERIOR (isolatie / overdracht tussen ruimten).
-- All existing rows default to EXTERIOR.

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS exposure text NOT NULL DEFAULT 'EXTERIOR';

ALTER TABLE app_gevelwering.material
  DROP CONSTRAINT IF EXISTS material_exposure_check;

ALTER TABLE app_gevelwering.material
  ADD CONSTRAINT material_exposure_check
  CHECK (exposure IN ('EXTERIOR', 'INTERIOR'));

CREATE INDEX IF NOT EXISTS material_exposure_idx
  ON app_gevelwering.material (exposure);

COMMENT ON COLUMN app_gevelwering.material.exposure IS
  'Toepassing: EXTERIOR (gevelwering) | INTERIOR (isolatie/overdracht tussen ruimten).';

-- Keep concept catalog aligned for future interior composites (metal stud, etc.).
ALTER TABLE acoustic_catalog.material_concept
  ADD COLUMN IF NOT EXISTS exposure text NOT NULL DEFAULT 'EXTERIOR';

ALTER TABLE acoustic_catalog.material_concept
  DROP CONSTRAINT IF EXISTS material_concept_exposure_check;

ALTER TABLE acoustic_catalog.material_concept
  ADD CONSTRAINT material_concept_exposure_check
  CHECK (exposure IN ('EXTERIOR', 'INTERIOR'));

CREATE INDEX IF NOT EXISTS material_concept_exposure_idx
  ON acoustic_catalog.material_concept (exposure);

COMMENT ON COLUMN acoustic_catalog.material_concept.exposure IS
  'Toepassing: EXTERIOR | INTERIOR — mirrors app_gevelwering.material.exposure.';

-- Engineer material picker (gevel): default EXTERIOR only.
DROP FUNCTION IF EXISTS app_gevelwering.fw_list_materials(text, text, text, int);

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_materials(
  p_master_category text,
  p_category text,
  p_q text,
  p_limit int,
  p_exposure text DEFAULT 'EXTERIOR'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_master text := nullif(btrim(p_master_category), '');
  v_cat text := nullif(btrim(p_category), '');
  v_q text := nullif(left(btrim(coalesce(p_q, '')), 120), '');
  v_limit int := coalesce(p_limit, 800);
  v_exposure text := upper(nullif(btrim(coalesce(p_exposure, '')), ''));
  v_rub_nr int;
  v_rub_name text;
  v_sub_nr int;
  mats jsonb;
BEGIN
  IF v_limit < 1 THEN v_limit := 800; END IF;
  IF v_limit > 2000 THEN v_limit := 2000; END IF;
  IF v_master IS NULL AND v_q IS NULL THEN
    RAISE EXCEPTION 'master_category or q is required';
  END IF;

  -- Accept Dutch aliases from callers.
  IF v_exposure IN ('EXTERIEUR', 'EXTERIOR') THEN
    v_exposure := 'EXTERIOR';
  ELSIF v_exposure IN ('INTERIEUR', 'INTERIOR') THEN
    v_exposure := 'INTERIOR';
  ELSIF v_exposure IS NULL OR v_exposure = 'ALL' OR v_exposure = 'ALLE' THEN
    v_exposure := NULL; -- no filter
  ELSE
    v_exposure := 'EXTERIOR';
  END IF;

  IF v_master IS NOT NULL THEN
    SELECT nr, name INTO v_rub_nr, v_rub_name
    FROM app_gevelwering.material_rubriek
    WHERE lower(name) = lower(v_master)
       OR lower(name) LIKE lower(left(v_master, 24)) || '%'
    ORDER BY CASE WHEN lower(name) = lower(v_master) THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_cat IS NOT NULL AND v_rub_nr IS NOT NULL THEN
    SELECT nr INTO v_sub_nr
    FROM app_gevelwering.material_subrubriek
    WHERE rubriek_nr = v_rub_nr
      AND (name = v_cat OR nr::text = v_cat)
    LIMIT 1;
  END IF;

  SELECT coalesce(jsonb_agg(app_gevelwering.fw_material_row_json(m.*) ORDER BY m.subrubriek_nr ASC NULLS LAST, m.material_no ASC, m.name ASC), '[]'::jsonb)
  INTO mats
  FROM (
    SELECT *
    FROM app_gevelwering.material m
    WHERE (v_rub_nr IS NULL OR m.rubriek_nr = v_rub_nr)
      AND (v_rub_nr IS NOT NULL OR v_master IS NULL OR m.master_category = v_master)
      AND (v_sub_nr IS NULL OR m.subrubriek_nr = v_sub_nr)
      AND (v_sub_nr IS NOT NULL OR v_cat IS NULL OR m.category = v_cat)
      AND (v_exposure IS NULL OR m.exposure = v_exposure)
      AND (
        v_q IS NULL
        OR m.name ILIKE '%' || replace(replace(replace(v_q, '\', ''), '%', ''), '_', '') || '%'
        OR m.catalog_id ILIKE '%' || replace(replace(replace(v_q, '\', ''), '%', ''), '_', '') || '%'
      )
    ORDER BY m.subrubriek_nr ASC NULLS LAST, m.material_no ASC, m.name ASC
    LIMIT v_limit
  ) m;

  RETURN jsonb_build_object(
    'ok', true,
    'master_category', coalesce(v_rub_name, v_master),
    'rubriek_nr', v_rub_nr,
    'category', v_cat,
    'exposure', v_exposure,
    'materials', mats
  );
END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_list_materials(text, text, text, int, text) IS
  'List catalog materials; p_exposure defaults to EXTERIOR (gevel). Pass ALL for both, INTERIOR for isolatie.';

CREATE OR REPLACE FUNCTION app_gevelwering.fw_material_row_json(m app_gevelwering.material)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'material_id', m.id::text,
    'catalog_id', coalesce(m.catalog_id, ''),
    'material_no', m.material_no,
    'rubriek_nr', m.rubriek_nr,
    'subrubriek_nr', m.subrubriek_nr,
    'master_category', coalesce(m.master_category, ''),
    'name', coalesce(m.name, ''),
    'category', coalesce(m.category, ''),
    'source', coalesce(m.source, ''),
    'exposure', coalesce(m.exposure, 'EXTERIOR'),
    'material_kind', app_gevelwering.fw_material_opbouw(m),
    'thickness_mm', m.thickness_mm,
    'ra_dba', m.ra_dba,
    'r_125_hz', m.r_125_hz,
    'r_250_hz', m.r_250_hz,
    'r_500_hz', m.r_500_hz,
    'r_1000_hz', m.r_1000_hz,
    'r_2000_hz', m.r_2000_hz
  );
$$;
