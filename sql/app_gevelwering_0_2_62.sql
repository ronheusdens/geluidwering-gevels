-- app-gevelwering DDL 0.2.62 — 2026-10-06
-- Opbouw-heuristiek: HSB / houtskelet zijn samengestelde elementen (niet enkellaags).
-- Catalogusrijen D03745–D03747 heten "HSB element, … Fermacell - glaswol - …" maar
-- vielen buiten de oude naamregex (alleen samengesteld|meerlaags|sandwich|…).

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
    WHEN coalesce(m.name, '') ~*
      '(samengesteld|meerlaags|sandwich|\yhsb\y|houtskelet|element\s+samengesteld)' THEN
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
  'UI opbouw: homogeneous (enkellaags) | composite_stack (samengesteld). '
  'Concept link wins; else name (HSB/houtskelet/sandwich/…) of glass heuristics.';
