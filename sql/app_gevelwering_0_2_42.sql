-- app-gevelwering DDL 0.2.42 — 2026-08-30
-- Assembly families (dak / buitengevel) + opbouwtemplates buiten→binnen.
-- Homogeneous vs composite_stack already on material_concept.material_kind.

-- ---------------------------------------------------------------------------
-- Family on wall_assembly templates
-- ---------------------------------------------------------------------------
ALTER TABLE acoustic_catalog.wall_assembly
  ADD COLUMN IF NOT EXISTS assembly_family text;

UPDATE acoustic_catalog.wall_assembly
SET assembly_family = COALESCE(assembly_family, 'overig')
WHERE assembly_family IS NULL;

ALTER TABLE acoustic_catalog.wall_assembly
  DROP CONSTRAINT IF EXISTS wall_assembly_family_check;

ALTER TABLE acoustic_catalog.wall_assembly
  ADD CONSTRAINT wall_assembly_family_check
  CHECK (assembly_family IN ('dak', 'buitengevel', 'overig'));

COMMENT ON COLUMN acoustic_catalog.wall_assembly.assembly_family IS
  'Hoofdtype samengesteld: dak | buitengevel | overig. Lagen altijd buiten→binnen (layer_order 1 = buiten).';

UPDATE acoustic_catalog.wall_assembly
SET assembly_family = 'buitengevel', updated_at = now()
WHERE code = 'ASM-HSB-BUITENWAND-V1';

-- ---------------------------------------------------------------------------
-- Buitengevel: traditionele spouwmuur (buiten → binnen)
-- ---------------------------------------------------------------------------
INSERT INTO acoustic_catalog.wall_assembly (code, name, description, assembly_family)
VALUES (
  'ASM-BUITENGEVEL-SPOUWMUUR-V1',
  'Buitengevel — spouwmuur (metselwerk)',
  'Klassieke spouwmuur: buitenblad, ventilerende spouw, isolatie, binnenblad, binnenafwerking. '
  'Laagvolgorde 1=buiten. Homogene lagen (metselwerk, isolatie, …) vormen dit samengestelde concept.',
  'buitengevel'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  assembly_family = EXCLUDED.assembly_family,
  updated_at = now();

INSERT INTO acoustic_catalog.wall_assembly_layer (
  assembly_id, layer_order, layer_kind, label, thickness_mm, density_kg_m3,
  cavity_depth_mm, stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params
)
SELECT a.id, v.layer_order, v.layer_kind, v.label, v.thickness_mm, v.density_kg_m3,
       v.cavity_depth_mm, v.stud_width_mm, v.stud_depth_mm, v.stud_spacing_mm,
       v.acoustic_role, v.params::jsonb
FROM acoustic_catalog.wall_assembly a
CROSS JOIN (VALUES
  (1, 'cladding',          'Buitenblad metselwerk / baksteen',          100.0, 1800.0, NULL::float, NULL::float, NULL::float, NULL::float, 'structural', '{"note":"homogeen buitenblad"}'),
  (2, 'cavity_ventilated', 'Ventilerende spouw',                        NULL,  NULL,   40.0, NULL, NULL, NULL, 'cavity', '{}'),
  (3, 'insulation',        'Spouwvulling minerale wol / PIR',           100.0,  35.0,  NULL, NULL, NULL, NULL, 'absorptive', '{"lambda_w_mk":0.035}'),
  (4, 'structure',         'Binnenblad kalkzandsteen / beton',          100.0, 1800.0, NULL, NULL, NULL, NULL, 'structural', '{"note":"homogeen binnenblad"}'),
  (5, 'lining',            'Binnenafwerking gips / stuc',               12.5,  900.0,  NULL, NULL, NULL, NULL, 'structural', '{}')
) AS v(layer_order, layer_kind, label, thickness_mm, density_kg_m3, cavity_depth_mm,
       stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params)
WHERE a.code = 'ASM-BUITENGEVEL-SPOUWMUUR-V1'
ON CONFLICT (assembly_id, layer_order) DO UPDATE SET
  layer_kind = EXCLUDED.layer_kind,
  label = EXCLUDED.label,
  thickness_mm = EXCLUDED.thickness_mm,
  density_kg_m3 = EXCLUDED.density_kg_m3,
  cavity_depth_mm = EXCLUDED.cavity_depth_mm,
  acoustic_role = EXCLUDED.acoustic_role,
  params = EXCLUDED.params;

-- ---------------------------------------------------------------------------
-- Dak: plat dak (buiten / bovenzijde → binnen / plafond)
-- ---------------------------------------------------------------------------
INSERT INTO acoustic_catalog.wall_assembly (code, name, description, assembly_family)
VALUES (
  'ASM-DAK-PLAT-V1',
  'Dakopbouw — plat dak',
  'Plat dak van buiten naar binnen: dakbedekking, isolatie, damprem, dakvloer, '
  'plafondafwerking. Laagvolgorde 1=buiten (weerzijde).',
  'dak'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  assembly_family = EXCLUDED.assembly_family,
  updated_at = now();

INSERT INTO acoustic_catalog.wall_assembly_layer (
  assembly_id, layer_order, layer_kind, label, thickness_mm, density_kg_m3,
  cavity_depth_mm, stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params
)
SELECT a.id, v.layer_order, v.layer_kind, v.label, v.thickness_mm, v.density_kg_m3,
       v.cavity_depth_mm, v.stud_width_mm, v.stud_depth_mm, v.stud_spacing_mm,
       v.acoustic_role, v.params::jsonb
FROM acoustic_catalog.wall_assembly a
CROSS JOIN (VALUES
  (1, 'cladding',      'Dakbedekking (bitumen / EPDM / PVC)',           5.0,  1100.0, NULL::float, NULL::float, NULL::float, NULL::float, 'structural', '{"note":"weerlaag"}'),
  (2, 'insulation',    'Dakisolatie (EPS / PIR / MW)',                160.0,   30.0,  NULL, NULL, NULL, NULL, 'absorptive', '{"lambda_w_mk":0.035}'),
  (3, 'vapor_barrier', 'Dampremmende laag',                             0.2,  1200.0, NULL, NULL, NULL, NULL, 'negligible', '{}'),
  (4, 'structure',     'Dakvloer / betonnen dakplaat',                200.0, 2400.0, NULL, NULL, NULL, NULL, 'structural', '{"note":"homogeen dragend"}'),
  (5, 'lining',        'Plafondafwerking (gips / systeemplafond)',     12.5,   900.0, NULL, NULL, NULL, NULL, 'structural', '{}')
) AS v(layer_order, layer_kind, label, thickness_mm, density_kg_m3, cavity_depth_mm,
       stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params)
WHERE a.code = 'ASM-DAK-PLAT-V1'
ON CONFLICT (assembly_id, layer_order) DO UPDATE SET
  layer_kind = EXCLUDED.layer_kind,
  label = EXCLUDED.label,
  thickness_mm = EXCLUDED.thickness_mm,
  density_kg_m3 = EXCLUDED.density_kg_m3,
  acoustic_role = EXCLUDED.acoustic_role,
  params = EXCLUDED.params;

-- ---------------------------------------------------------------------------
-- Dak: hellend dak (buiten → binnen)
-- ---------------------------------------------------------------------------
INSERT INTO acoustic_catalog.wall_assembly (code, name, description, assembly_family)
VALUES (
  'ASM-DAK-HELLEND-V1',
  'Dakopbouw — hellend dak (pannen)',
  'Hellend dak van buiten naar binnen: pannen, tengels/panlatten, damp-open folie, '
  'dakbeschot, isolatie tussen sporen, damprem, binnenafwerking. Laagvolgorde 1=buiten.',
  'dak'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  assembly_family = EXCLUDED.assembly_family,
  updated_at = now();

INSERT INTO acoustic_catalog.wall_assembly_layer (
  assembly_id, layer_order, layer_kind, label, thickness_mm, density_kg_m3,
  cavity_depth_mm, stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params
)
SELECT a.id, v.layer_order, v.layer_kind, v.label, v.thickness_mm, v.density_kg_m3,
       v.cavity_depth_mm, v.stud_width_mm, v.stud_depth_mm, v.stud_spacing_mm,
       v.acoustic_role, v.params::jsonb
FROM acoustic_catalog.wall_assembly a
CROSS JOIN (VALUES
  (1, 'cladding',          'Dakpannen / leien',                          15.0, 2000.0, NULL::float, NULL::float, NULL::float, NULL::float, 'structural', '{}'),
  (2, 'cavity_ventilated', 'Luchtspouw (tengels / panlatten)',           NULL,  NULL,   30.0, NULL, NULL, NULL, 'cavity', '{}'),
  (3, 'membrane',          'Damp-open onderdakfolie',                     0.5, 1200.0, NULL, NULL, NULL, NULL, 'negligible', '{}'),
  (4, 'sheathing',         'Dakbeschot (multiplex / OSB)',               18.0,  650.0, NULL, NULL, NULL, NULL, 'structural', '{}'),
  (5, 'framing',           'Sporen / gordingen (hout)',                 160.0,  450.0, NULL, 45.0, 160.0, 600.0, 'structural', '{"species":"vuren"}'),
  (6, 'insulation',        'Isolatie tussen sporen (MW / cellulose)',   160.0,   30.0, NULL, NULL, NULL, NULL, 'absorptive', '{}'),
  (7, 'vapor_barrier',     'Dampremmende folie',                          0.2, 1200.0, NULL, NULL, NULL, NULL, 'negligible', '{}'),
  (8, 'lining',            'Binnenafwerking gips / multiplex',          12.5,  900.0, NULL, NULL, NULL, NULL, 'structural', '{}')
) AS v(layer_order, layer_kind, label, thickness_mm, density_kg_m3, cavity_depth_mm,
       stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params)
WHERE a.code = 'ASM-DAK-HELLEND-V1'
ON CONFLICT (assembly_id, layer_order) DO UPDATE SET
  layer_kind = EXCLUDED.layer_kind,
  label = EXCLUDED.label,
  thickness_mm = EXCLUDED.thickness_mm,
  density_kg_m3 = EXCLUDED.density_kg_m3,
  cavity_depth_mm = EXCLUDED.cavity_depth_mm,
  stud_width_mm = EXCLUDED.stud_width_mm,
  stud_depth_mm = EXCLUDED.stud_depth_mm,
  stud_spacing_mm = EXCLUDED.stud_spacing_mm,
  acoustic_role = EXCLUDED.acoustic_role,
  params = EXCLUDED.params;

-- Refresh HSB description to stress outside-in + homogeneous layers
UPDATE acoustic_catalog.wall_assembly
SET description =
  'Lichte HSB-gevel (buiten→binnen): gevelbekleding/spouw, winddichte folie, buitenbeplating, '
  'houten skelet met isolatie, damprem, binnenafwerking. Samengesteld uit homogene lagen. '
  'Laagvolgorde 1=buiten.',
  updated_at = now()
WHERE code = 'ASM-HSB-BUITENWAND-V1';
