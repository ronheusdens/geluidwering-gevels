-- acoustics DDL version 0.2.16 — 2026-07-22
-- Fase A: nieuwbouw geluidwering-model
--   variant → verblijfsgebied (VG) → verblijfsruimte (VR) → vlak → vlak_element
-- Invariants (enforced in API + DB where possible):
--   · elke VR hoort bij precies één VG
--   · elk VG heeft ≥1 VR (API: create VG+VR atomair; delete laatste VR verboden)
--   · elke VR is gekoppeld aan een floormap drawing_subsection (UNIQUE)
-- GA/Lbi/GA;k-resultaatkolommen op VR zijn placeholders voor fase C (Basic++ rekenkern).
-- Requires 0.2.15 applied first. See acoustics-postgres-schema.md

-- ---------------------------------------------------------------------------
-- variant (per building / project)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustics.variant (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id           uuid NOT NULL REFERENCES acoustics.building (id) ON DELETE CASCADE,
  omschrijving          text NOT NULL,
  gebruiksfunctie       text NOT NULL DEFAULT 'Woonfunctie',
  geluidsbelasting_dba  double precision NOT NULL DEFAULT 0,
  spectrum_kind         text NOT NULL DEFAULT 'SPECTRUM_1',
  spectrum_db           jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order            integer NOT NULL DEFAULT 0,
  analysis              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variant_gebruiksfunctie_check CHECK (
    gebruiksfunctie IN (
      'Woonfunctie',
      'Bijeenkomst voor kinderopvang',
      'Gezondheidszorgfunctie',
      'Onderwijsfunctie',
      'Wgh, gezondheidszorg geluidgevoelig',
      'Wgh, onderwijsfunctie geluidgevoelig',
      'Overig'
    )
  ),
  CONSTRAINT variant_spectrum_kind_check CHECK (
    spectrum_kind IN ('SPECTRUM_1', 'SPECTRUM_2', 'CUSTOM')
  ),
  CONSTRAINT variant_geluidsbelasting_check CHECK (
    geluidsbelasting_dba >= 0 AND geluidsbelasting_dba <= 140
  ),
  CONSTRAINT variant_spectrum_db_array_check CHECK (jsonb_typeof(spectrum_db) = 'array')
);

CREATE INDEX IF NOT EXISTS variant_building_idx ON acoustics.variant (building_id);

COMMENT ON TABLE acoustics.variant IS
  'Berekeningsvariant binnen een project (nieuwbouw P0); geluidsbelasting + spectrum.';

-- ---------------------------------------------------------------------------
-- verblijfsgebied (VG) — altijd ≥1 VR via API
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustics.verblijfsgebied (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id            uuid NOT NULL REFERENCES acoustics.variant (id) ON DELETE CASCADE,
  building_id           uuid NOT NULL REFERENCES acoustics.building (id) ON DELETE CASCADE,
  omschrijving          text NOT NULL,
  sort_order            integer NOT NULL DEFAULT 0,
  analysis              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verblijfsgebied_variant_idx ON acoustics.verblijfsgebied (variant_id);
CREATE INDEX IF NOT EXISTS verblijfsgebied_building_idx ON acoustics.verblijfsgebied (building_id);

COMMENT ON TABLE acoustics.verblijfsgebied IS
  'Verblijfsgebied (nieuwbouw). Bevat altijd minstens één verblijfsruimte (API-invariant).';

-- ---------------------------------------------------------------------------
-- verblijfsruimte (VR) — verplicht gekoppeld aan floormap subsection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustics.verblijfsruimte (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verblijfsgebied_id    uuid NOT NULL REFERENCES acoustics.verblijfsgebied (id) ON DELETE CASCADE,
  building_id           uuid NOT NULL REFERENCES acoustics.building (id) ON DELETE CASCADE,
  subsection_id         uuid NOT NULL REFERENCES acoustics.drawing_subsection (id) ON DELETE RESTRICT,
  omschrijving          text NOT NULL,
  vloer_m2              double precision NOT NULL DEFAULT 0,
  hoogte_m              double precision NOT NULL DEFAULT 0,
  volume_m3             double precision NOT NULL DEFAULT 0,
  t0_s                  double precision NOT NULL DEFAULT 0.5,
  sort_order            integer NOT NULL DEFAULT 0,
  -- Resultaatplaceholders (fase C rekenkern)
  ga_dba                double precision,
  lbi_dba               double precision,
  gak_dba               double precision,
  analysis              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verblijfsruimte_vloer_check CHECK (vloer_m2 >= 0 AND vloer_m2 <= 10000),
  CONSTRAINT verblijfsruimte_hoogte_check CHECK (hoogte_m >= 0 AND hoogte_m <= 10000),
  CONSTRAINT verblijfsruimte_volume_check CHECK (volume_m3 >= 0 AND volume_m3 <= 10000),
  CONSTRAINT verblijfsruimte_t0_check CHECK (t0_s >= 0 AND t0_s <= 10),
  CONSTRAINT verblijfsruimte_subsection_unique UNIQUE (subsection_id)
);

CREATE INDEX IF NOT EXISTS verblijfsruimte_vg_idx ON acoustics.verblijfsruimte (verblijfsgebied_id);
CREATE INDEX IF NOT EXISTS verblijfsruimte_building_idx ON acoustics.verblijfsruimte (building_id);
CREATE INDEX IF NOT EXISTS verblijfsruimte_subsection_idx ON acoustics.verblijfsruimte (subsection_id);

COMMENT ON TABLE acoustics.verblijfsruimte IS
  'Verblijfsruimte gekoppeld aan floormap drawing_subsection. GA/Lbi/GA;k op dit niveau.';
COMMENT ON COLUMN acoustics.verblijfsruimte.subsection_id IS
  'Verplichte koppeling naar floormap-room (drawing_subsection).';
COMMENT ON COLUMN acoustics.verblijfsruimte.gak_dba IS
  'Karakteristieke geluidwering GA;k [dB(A)] — berekend op VR-niveau (fase C).';

-- ---------------------------------------------------------------------------
-- vlak (gevelvlak van een VR)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustics.vlak (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verblijfsruimte_id    uuid NOT NULL REFERENCES acoustics.verblijfsruimte (id) ON DELETE CASCADE,
  building_id           uuid NOT NULL REFERENCES acoustics.building (id) ON DELETE CASCADE,
  facade_subsection_id  uuid REFERENCES acoustics.drawing_subsection (id) ON DELETE SET NULL,
  omschrijving          text NOT NULL,
  area_m2               double precision NOT NULL DEFAULT 0,
  cl_db                 double precision NOT NULL DEFAULT 0,
  cg_db                 double precision NOT NULL DEFAULT 0,
  meenemen_gak          boolean NOT NULL DEFAULT true,
  sort_order            integer NOT NULL DEFAULT 0,
  analysis              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vlak_area_check CHECK (area_m2 >= 0 AND area_m2 <= 10000),
  CONSTRAINT vlak_cl_check CHECK (cl_db >= 0 AND cl_db <= 100),
  CONSTRAINT vlak_cg_check CHECK (cg_db >= -100 AND cg_db <= 100)
);

CREATE INDEX IF NOT EXISTS vlak_vr_idx ON acoustics.vlak (verblijfsruimte_id);
CREATE INDEX IF NOT EXISTS vlak_building_idx ON acoustics.vlak (building_id);

COMMENT ON TABLE acoustics.vlak IS
  'Geluidbelast gevelvlak van een verblijfsruimte; meenemen_gak stuurt Stot in GA;k.';

-- ---------------------------------------------------------------------------
-- vlak_element (catalogusmateriaal / ventilatie / kier op een vlak)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acoustics.vlak_element (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vlak_id               uuid NOT NULL REFERENCES acoustics.vlak (id) ON DELETE CASCADE,
  building_id           uuid NOT NULL REFERENCES acoustics.building (id) ON DELETE CASCADE,
  material_id           uuid REFERENCES acoustics.material (id) ON DELETE RESTRICT,
  omschrijving          text NOT NULL DEFAULT '',
  area_m2               double precision NOT NULL DEFAULT 0,
  length_m              double precision NOT NULL DEFAULT 0,
  qvent                 double precision NOT NULL DEFAULT 0,
  sort_order            integer NOT NULL DEFAULT 0,
  analysis              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vlak_element_area_check CHECK (area_m2 >= 0 AND area_m2 <= 1000),
  CONSTRAINT vlak_element_length_check CHECK (length_m >= 0 AND length_m <= 100),
  CONSTRAINT vlak_element_qvent_check CHECK (qvent >= 0 AND qvent <= 1000)
);

CREATE INDEX IF NOT EXISTS vlak_element_vlak_idx ON acoustics.vlak_element (vlak_id);
CREATE INDEX IF NOT EXISTS vlak_element_material_idx ON acoustics.vlak_element (material_id);
CREATE INDEX IF NOT EXISTS vlak_element_building_idx ON acoustics.vlak_element (building_id);

COMMENT ON TABLE acoustics.vlak_element IS
  'Element op een vlak (materiaal/glas/ventilatie uit acoustics.material of handmatig).';
