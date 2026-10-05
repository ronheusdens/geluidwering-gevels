-- app-gevelwering DDL 0.2.43 — 2026-08-31
-- Material opbouw (enkellaags vs samengesteld) on catalog rows for UI + API.

CREATE OR REPLACE FUNCTION app_gevelwering.fw_material_opbouw(m app_gevelwering.material)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN (
      SELECT c.material_kind
      FROM acoustic_catalog.material_concept c
      WHERE c.id = m.acoustic_concept_id
      LIMIT 1
    ) = 'composite_stack' THEN
      'composite_stack'
    WHEN coalesce(m.name, '') ~* '(samengesteld|meerlaags|sandwich|element\s+samengesteld)' THEN
      'composite_stack'
    WHEN m.glass_t1_mm IS NOT NULL
      AND m.glass_t2_mm IS NOT NULL
      AND m.glass_cavity_mm IS NOT NULL THEN
      'composite_stack'
    ELSE
      'homogeneous'
  END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_material_opbouw(app_gevelwering.material) IS
  'UI opbouw: homogeneous (enkellaags) | composite_stack (samengesteld). Concept link wins; else name/glass heuristics.';

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
