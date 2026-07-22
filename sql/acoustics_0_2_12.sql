-- acoustics DDL version 0.2.12 — 2026-07-22
-- DGMR Geluidwering Gevels (GL.cat) material catalog + R spectra (125–4000 Hz)
-- Requires 0.2.11 applied first. Seed: acoustics_0_2_12_gl_material_seed.sql

CREATE TABLE IF NOT EXISTS acoustics.material (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_index      integer NOT NULL,
  material_no        integer NOT NULL,
  name               text NOT NULL,
  category           text,
  glass_t1_mm        double precision,
  glass_cavity_mm    double precision,
  glass_t2_mm        double precision,
  spectrum_ok        boolean NOT NULL DEFAULT true,
  r_125_hz           double precision,
  r_250_hz           double precision,
  r_500_hz           double precision,
  r_1000_hz          double precision,
  r_2000_hz          double precision,
  r_4000_hz          double precision,
  -- Packed octave-band R [125,250,500,1000,2000,4000] for App 2 transmission math
  r_db               double precision[6],
  source             text NOT NULL DEFAULT 'GL.cat',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_catalog_index_unique UNIQUE (source, catalog_index),
  CONSTRAINT material_material_no_unique UNIQUE (source, material_no),
  CONSTRAINT material_r_db_len_check CHECK (
    r_db IS NULL OR array_length(r_db, 1) = 6
  )
);

CREATE INDEX IF NOT EXISTS material_name_idx
  ON acoustics.material (name);

CREATE INDEX IF NOT EXISTS material_category_idx
  ON acoustics.material (category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_spectrum_ok_idx
  ON acoustics.material (spectrum_ok);

COMMENT ON TABLE acoustics.material IS
  'Shared façade / construction material catalog (seeded from DGMR GL.cat). '
  'Octave-band sound reduction index R (dB) at 125–4000 Hz for App 2 transmission.';
COMMENT ON COLUMN acoustics.material.catalog_index IS
  '0-based record order in GL.cat.';
COMMENT ON COLUMN acoustics.material.material_no IS
  '1-based material number from GLMATR01 header.';
COMMENT ON COLUMN acoustics.material.category IS
  'Optional GG category code parsed from name (GDG, GDL, GDR, GE).';
COMMENT ON COLUMN acoustics.material.r_db IS
  'R (dB) array ordered as 125,250,500,1000,2000,4000 Hz.';
COMMENT ON COLUMN acoustics.material.source IS
  'Catalog provenance; default GL.cat. Unique with catalog_index / material_no.';
