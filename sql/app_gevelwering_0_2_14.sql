-- app-gevelwering DDL version 0.2.14 — 2026-07-22
-- Rebuild app_gevelwering.material from catalogusGG.pdf (master_category + missing columns)
-- Requires 0.2.13 applied first. Seed: app_gevelwering_0_2_14_catalogus_gg_seed.sql

DROP TABLE IF EXISTS app_gevelwering.material CASCADE;

CREATE TABLE app_gevelwering.material (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_index      integer NOT NULL,
  catalog_id         text NOT NULL,
  material_no        integer NOT NULL,
  master_category    text NOT NULL,
  name               text NOT NULL,
  category           text,
  thickness_mm       double precision,
  weight_kg_m2       double precision,
  ra_dba             double precision,
  source_ref         text,
  r_63_hz            double precision,
  r_125_hz           double precision,
  r_250_hz           double precision,
  r_500_hz           double precision,
  r_1000_hz          double precision,
  r_2000_hz          double precision,
  r_db               double precision[6],
  spectrum_ok        boolean NOT NULL DEFAULT true,
  supplier           text,
  phone              text,
  buildup            text,
  cavity_fill        text,
  laminate           text,
  glass_t1_mm        double precision,
  glass_cavity_mm    double precision,
  glass_t2_mm        double precision,
  rqa_dba            double precision,
  c_dm3_s            double precision,
  dna_dba            double precision,
  height_mm          double precision,
  depth_mm           double precision,
  length_mm          double precision,
  sh_mm              double precision,
  doorlaat_m2_m      double precision,
  source             text NOT NULL DEFAULT 'catalogusGG.pdf',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_catalog_index_unique UNIQUE (source, catalog_index),
  CONSTRAINT material_catalog_id_unique UNIQUE (source, catalog_id),
  CONSTRAINT material_material_no_unique UNIQUE (source, material_no),
  CONSTRAINT material_r_db_len_check CHECK (
    r_db IS NULL OR array_length(r_db, 1) = 6
  )
);

CREATE INDEX material_name_idx ON app_gevelwering.material (name);
CREATE INDEX material_master_category_idx ON app_gevelwering.material (master_category);
CREATE INDEX material_category_idx ON app_gevelwering.material (category) WHERE category IS NOT NULL;
CREATE INDEX material_spectrum_ok_idx ON app_gevelwering.material (spectrum_ok);

COMMENT ON TABLE app_gevelwering.material IS
  'DGMR Geluidwering Gevels catalog (catalogusGG.pdf). '
  'master_category = section title (Elementen / Glas / Ventilatie…). '
  'R bands are 63–2000 Hz; PDF text layer truncates some labels with …';
COMMENT ON COLUMN app_gevelwering.material.master_category IS
  'Catalog section from page header (e.g. Elementen, Glas, Ventilatievoorzieningen).';
COMMENT ON COLUMN app_gevelwering.material.catalog_id IS
  'Catalog id such as D00118.';
COMMENT ON COLUMN app_gevelwering.material.ra_dba IS
  'Single-number rating RA [dB(A)] when present (Elementen/Glas).';
COMMENT ON COLUMN app_gevelwering.material.r_db IS
  'R (dB) array ordered as 63,125,250,500,1000,2000 Hz.';
COMMENT ON COLUMN app_gevelwering.material.source_ref IS
  'Bron / reference string from the catalog.';
