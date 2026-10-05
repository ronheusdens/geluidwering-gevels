-- app-gevelwering DDL 0.2.41 — 2026-08-28
-- acoustic_catalog: versioned spectra, patterns (attribuutcombo), composite wall assemblies.
-- app_gevelwering.material stays the runtime/publish target (unchanged API for GA/floormap).
-- Publish policy: latest approved per concept → synced to material.

CREATE SCHEMA IF NOT EXISTS acoustic_catalog;

COMMENT ON SCHEMA acoustic_catalog IS
  'Tool-agnostic acoustic material catalog: originals, approved instances, patterns, wall stacks. '
  'Gevelwering reads published rows via app_gevelwering.material.';

-- ---------------------------------------------------------------------------
-- Spectrum patterns (fingerprint on attribute combination: rubriek/sub + ρ + d)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustic_catalog.spectrum_pattern (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  rubriek_nr      smallint CHECK (rubriek_nr IS NULL OR rubriek_nr BETWEEN 1 AND 9),
  subrubriek_nr   smallint CHECK (subrubriek_nr IS NULL OR subrubriek_nr >= 1),
  material_class  text,
  thickness_mm_ref    double precision,
  density_kg_m3_ref   double precision,
  r_63_hz         double precision,
  r_125_hz        double precision NOT NULL,
  r_250_hz        double precision NOT NULL,
  r_500_hz        double precision NOT NULL,
  r_1000_hz       double precision NOT NULL,
  r_2000_hz       double precision NOT NULL,
  model_kind      text NOT NULL DEFAULT 'single_layer'
    CHECK (model_kind IN ('single_layer', 'msm_double', 'stack_transfer')),
  scaling         jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence      text CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE acoustic_catalog.spectrum_pattern IS
  'Reference spectrum shape for an attribute combination; scaling JSON drives thickness/density instantiation.';

-- ---------------------------------------------------------------------------
-- Material concept (homogeneous row OR composite assembly instance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustic_catalog.material_concept (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_source      text NOT NULL DEFAULT 'catalogusGG.pdf',
  catalog_id          text,
  material_kind       text NOT NULL DEFAULT 'homogeneous'
    CHECK (material_kind IN ('homogeneous', 'composite_stack')),
  name                text NOT NULL,
  rubriek_nr          smallint,
  subrubriek_nr       smallint,
  thickness_mm        double precision,
  density_kg_m3       double precision,
  weight_kg_m2        double precision,
  source_ref          text,
  published_material_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS material_concept_catalog_uidx
  ON acoustic_catalog.material_concept (catalog_source, catalog_id)
  WHERE catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_concept_rubriek_idx
  ON acoustic_catalog.material_concept (rubriek_nr, subrubriek_nr);
CREATE INDEX IF NOT EXISTS material_concept_kind_idx
  ON acoustic_catalog.material_concept (material_kind);

COMMENT ON TABLE acoustic_catalog.material_concept IS
  'Stable identity for a catalog item or a composite (e.g. HSB buitenwand). Links to published material row when synced.';

-- ---------------------------------------------------------------------------
-- Versioned spectra (original immutable + approved instances)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustic_catalog.spectrum_version (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id          uuid NOT NULL REFERENCES acoustic_catalog.material_concept (id) ON DELETE CASCADE,
  version_kind        text NOT NULL CHECK (version_kind IN ('original', 'instance')),
  version_no          integer NOT NULL CHECK (version_no >= 0),
  status              text NOT NULL DEFAULT 'archived'
    CHECK (status IN ('archived', 'proposed', 'approved', 'rejected')),
  is_latest_approved  boolean NOT NULL DEFAULT false,
  source_attribution  text NOT NULL,
  pattern_id          uuid REFERENCES acoustic_catalog.spectrum_pattern (id) ON DELETE SET NULL,
  r_63_hz             double precision,
  r_125_hz            double precision NOT NULL,
  r_250_hz            double precision NOT NULL,
  r_500_hz            double precision NOT NULL,
  r_1000_hz           double precision NOT NULL,
  r_2000_hz           double precision NOT NULL,
  r_4000_hz           double precision,
  ra_dba              double precision,
  rw_db               double precision,
  c_db                double precision,
  ctr_db              double precision,
  approved_at         timestamptz,
  approved_by         text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spectrum_version_concept_no_uidx UNIQUE (concept_id, version_no)
);

CREATE INDEX IF NOT EXISTS spectrum_version_concept_idx
  ON acoustic_catalog.spectrum_version (concept_id);
CREATE INDEX IF NOT EXISTS spectrum_version_latest_idx
  ON acoustic_catalog.spectrum_version (concept_id)
  WHERE is_latest_approved AND status = 'approved';

COMMENT ON COLUMN acoustic_catalog.spectrum_version.source_attribution IS
  'Bron: catalogus/IL-HR/… of afgeleid (spectrum patroon SP-…).';

-- ---------------------------------------------------------------------------
-- Wall assemblies (composite stacks — e.g. HSB buitenwand)
-- Layer order 1 = buiten (outside-in convention).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustic_catalog.wall_assembly (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  layer_order_convention text NOT NULL DEFAULT 'outside_in',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acoustic_catalog.wall_assembly_layer (
  assembly_id         uuid NOT NULL REFERENCES acoustic_catalog.wall_assembly (id) ON DELETE CASCADE,
  layer_order         integer NOT NULL CHECK (layer_order >= 1),
  layer_kind          text NOT NULL CHECK (layer_kind IN (
    'cladding', 'cavity_ventilated', 'membrane', 'sheathing', 'framing',
    'insulation', 'vapor_barrier', 'lining', 'structure', 'other'
  )),
  label               text NOT NULL,
  thickness_mm        double precision,
  density_kg_m3       double precision,
  surface_mass_kg_m2  double precision,
  cavity_depth_mm     double precision,
  stud_width_mm       double precision,
  stud_depth_mm       double precision,
  stud_spacing_mm     double precision,
  pattern_id          uuid REFERENCES acoustic_catalog.spectrum_pattern (id) ON DELETE SET NULL,
  concept_id          uuid REFERENCES acoustic_catalog.material_concept (id) ON DELETE SET NULL,
  acoustic_role       text NOT NULL DEFAULT 'structural'
    CHECK (acoustic_role IN ('structural', 'absorptive', 'negligible', 'cavity')),
  params              jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (assembly_id, layer_order)
);

CREATE TABLE IF NOT EXISTS acoustic_catalog.concept_assembly (
  concept_id   uuid PRIMARY KEY REFERENCES acoustic_catalog.material_concept (id) ON DELETE CASCADE,
  assembly_id  uuid NOT NULL REFERENCES acoustic_catalog.wall_assembly (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- Optional trace columns on runtime material (nullable — existing apps unchanged)
-- ---------------------------------------------------------------------------
ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS source_attribution text,
  ADD COLUMN IF NOT EXISTS acoustic_concept_id uuid,
  ADD COLUMN IF NOT EXISTS acoustic_spectrum_version_id uuid;

COMMENT ON COLUMN app_gevelwering.material.source_attribution IS
  'Provenance for published spectrum (catalog bron or afgeleid (spectrum patroon …)).';
COMMENT ON COLUMN app_gevelwering.material.acoustic_concept_id IS
  'Link to acoustic_catalog.material_concept when published from Materials Studio.';
COMMENT ON COLUMN app_gevelwering.material.acoustic_spectrum_version_id IS
  'Latest approved acoustic_catalog.spectrum_version used for this row.';

-- ---------------------------------------------------------------------------
-- Seed: HSB buitenwand template (acoustic stack — buiten naar binnen)
-- ---------------------------------------------------------------------------
INSERT INTO acoustic_catalog.wall_assembly (code, name, description)
VALUES (
  'ASM-HSB-BUITENWAND-V1',
  'HSB buitenwand (standaard energiezuinig)',
  'Lichte houtskeletbouw gevel: gevelbekleding/spouw, winddichte folie, buitenbeplating, '
  'houten skelet met isolatie, damprem, binnenafwerking. Laagvolgorde 1=buiten.'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
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
  (1, 'cladding',           'Gevelbekleding / metselwerk (buiten)',     20.0,  800.0,  40.0, NULL::float, NULL::float, NULL::float, 'structural', '{"note":"ventilated cavity behind"}'),
  (2, 'cavity_ventilated',  'Ventilerende spouw',                     NULL,  NULL,   40.0, NULL, NULL, NULL, 'cavity', '{}'),
  (3, 'membrane',           'Winddichte folie (damp-open)',            0.5,   1200.0, NULL, NULL, NULL, NULL, 'negligible', '{}'),
  (4, 'sheathing',          'Buitenbeplating OSB / vezelcement',      12.0,  650.0,  NULL, NULL, NULL, NULL, 'structural', '{}'),
  (5, 'framing',            'Houten skelet (vuren C24)',              145.0,  450.0,  NULL, 45.0, 145.0, 600.0, 'structural', '{"species":"vuren"}'),
  (6, 'insulation',         'Minerale wol (glas/steenwol) in spouw',  145.0,  30.0,   NULL, NULL, NULL, NULL, 'absorptive', '{"lambda_w_mk":0.035}'),
  (7, 'vapor_barrier',      'Dampremmende folie',                      0.2,   1200.0, NULL, NULL, NULL, NULL, 'negligible', '{}'),
  (8, 'lining',             'Binnenafwerking gips / multiplex',       12.5,  900.0,  NULL, NULL, NULL, NULL, 'structural', '{}')
) AS v(layer_order, layer_kind, label, thickness_mm, density_kg_m3, cavity_depth_mm,
       stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params)
WHERE a.code = 'ASM-HSB-BUITENWAND-V1'
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

-- Kalkzandsteen pattern placeholder (filled/refined from QC + bootstrap)
INSERT INTO acoustic_catalog.spectrum_pattern (
  code, name, rubriek_nr, subrubriek_nr, material_class,
  thickness_mm_ref, density_kg_m3_ref,
  r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz,
  model_kind, scaling, confidence, notes
)
VALUES (
  'SP-R1-S2-KALKZANDSTEEN',
  'Kalkzandsteen (massief) — referentiecurve',
  1, 2, 'kalkzandsteen',
  100.0, 1800.0,
  38.0, 44.0, 50.0, 56.0, 60.0,
  'single_layer',
  '{"thickness_mm":{"model":"mass_law_offset","ref_mm":100,"db_per_double_thickness":6},"density_kg_m3":{"model":"none"}}'::jsonb,
  'medium',
  'Placeholder ref curve — refine from catalog cluster R1/S2 after QC. Instantiate e.g. d=214 mm.'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  scaling = EXCLUDED.scaling,
  notes = EXCLUDED.notes,
  updated_at = now();
