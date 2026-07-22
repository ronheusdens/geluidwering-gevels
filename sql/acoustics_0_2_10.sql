-- acoustics DDL version 0.2.10 — 2026-07-21
-- Floormap room subsections (closed polylines) + parent section scale
-- Requires 0.2.9 applied first. See acoustics-postgres-schema.md

ALTER TABLE acoustics.drawing_region
  ADD COLUMN IF NOT EXISTS scale_ratio double precision,
  ADD COLUMN IF NOT EXISTS metres_per_norm_unit double precision,
  ADD COLUMN IF NOT EXISTS scale_source text NOT NULL DEFAULT 'NONE';

ALTER TABLE acoustics.drawing_region
  DROP CONSTRAINT IF EXISTS drawing_region_scale_source_check;

ALTER TABLE acoustics.drawing_region
  ADD CONSTRAINT drawing_region_scale_source_check
  CHECK (scale_source IN ('NONE', 'PDF_TEXT', 'CALIBRATED'));

CREATE TABLE IF NOT EXISTS acoustics.drawing_subsection (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id        uuid NOT NULL REFERENCES acoustics.drawing_region (id) ON DELETE CASCADE,
  building_id       uuid REFERENCES acoustics.building (id) ON DELETE CASCADE,
  document_id       uuid REFERENCES acoustics.document (id) ON DELETE CASCADE,
  page_index        integer NOT NULL DEFAULT 0,
  label             text NOT NULL,
  level_hint        text NOT NULL DEFAULT 'OTHER',
  geom_kind         text NOT NULL DEFAULT 'POLYLINE',
  points            jsonb NOT NULL,
  area_norm         double precision,
  perimeter_norm    double precision,
  area_m2           double precision,
  perimeter_m       double precision,
  analysis_status   text NOT NULL DEFAULT 'DRAFT',
  sort_order        integer NOT NULL DEFAULT 0,
  analysis          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid REFERENCES acoustics.service_user (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drawing_subsection_geom_kind_check CHECK (geom_kind IN ('POLYLINE')),
  CONSTRAINT drawing_subsection_level_hint_check CHECK (
    level_hint IN ('GROUND', 'FIRST', 'SECOND', 'THIRD', 'ROOF', 'OTHER')
  ),
  CONSTRAINT drawing_subsection_analysis_status_check CHECK (
    analysis_status IN ('DRAFT', 'READY_FOR_ANALYSIS', 'ANALYZED')
  ),
  CONSTRAINT drawing_subsection_points_array_check CHECK (jsonb_typeof(points) = 'array')
);

CREATE INDEX IF NOT EXISTS drawing_subsection_section_idx ON acoustics.drawing_subsection (section_id);
CREATE INDEX IF NOT EXISTS drawing_subsection_building_idx ON acoustics.drawing_subsection (building_id);
CREATE INDEX IF NOT EXISTS drawing_subsection_document_idx ON acoustics.drawing_subsection (document_id);

COMMENT ON TABLE acoustics.drawing_subsection IS
  'Room / subsection objects on a floormap section; closed polylines in section-local 0–1 coords.';
COMMENT ON COLUMN acoustics.drawing_subsection.points IS
  'Closed ring [{x,y},…] relative to parent floormap bbox (0–1).';
COMMENT ON COLUMN acoustics.drawing_region.metres_per_norm_unit IS
  'Metres per unit of section-local normalized length (after scale calibration or 1:N).';

CREATE OR REPLACE VIEW acoustics.drawing_section AS
SELECT
  r.id,
  r.building_id,
  r.document_id,
  r.review_id,
  r.page_index,
  r.label,
  r.region_kind AS section_type,
  r.sort_order,
  r.x_min,
  r.y_min,
  r.x_max,
  r.y_max,
  r.width_norm,
  r.height_norm,
  r.area_norm,
  r.perimeter_norm,
  r.scale_ratio,
  r.metres_per_norm_unit,
  r.scale_source,
  r.analysis_status,
  r.analysis,
  r.created_by,
  r.created_at,
  r.committed_at,
  r.updated_at
FROM acoustics.drawing_region r;
