-- app-gevelwering DDL version 0.2.9 — 2026-07-21
-- Promote identified drawing sections to first-class analysis objects
-- Requires 0.2.8 applied first. See app-gevelwering-postgres-schema.md
--
-- Each row in drawing_region is a section object used for later geometry
-- analysis (normalized area / perimeter now; real-world scale + subsections later).

ALTER TABLE app_gevelwering.drawing_region
  ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES app_gevelwering.building (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS review_id uuid REFERENCES app_gevelwering.drawing_review (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS width_norm double precision,
  ADD COLUMN IF NOT EXISTS height_norm double precision,
  ADD COLUMN IF NOT EXISTS area_norm double precision,
  ADD COLUMN IF NOT EXISTS perimeter_norm double precision,
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS committed_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE app_gevelwering.drawing_region
  DROP CONSTRAINT IF EXISTS drawing_region_analysis_status_check;

ALTER TABLE app_gevelwering.drawing_region
  ADD CONSTRAINT drawing_region_analysis_status_check
  CHECK (analysis_status IN ('DRAFT', 'COMMITTED', 'READY_FOR_ANALYSIS', 'ANALYZED'));

-- Backfill building_id from parent document
UPDATE app_gevelwering.drawing_region r
SET building_id = d.building_id
FROM app_gevelwering.document d
WHERE r.document_id = d.id
  AND r.building_id IS NULL;

-- Backfill normalized geometry for existing rows
UPDATE app_gevelwering.drawing_region
SET width_norm = x_max - x_min,
    height_norm = y_max - y_min,
    area_norm = (x_max - x_min) * (y_max - y_min),
    perimeter_norm = 2.0 * ((x_max - x_min) + (y_max - y_min)),
    updated_at = now()
WHERE width_norm IS NULL
   OR height_norm IS NULL
   OR area_norm IS NULL
   OR perimeter_norm IS NULL;

CREATE INDEX IF NOT EXISTS drawing_region_building_idx ON app_gevelwering.drawing_region (building_id);
CREATE INDEX IF NOT EXISTS drawing_region_review_idx ON app_gevelwering.drawing_region (review_id);
CREATE INDEX IF NOT EXISTS drawing_region_analysis_status_idx ON app_gevelwering.drawing_region (analysis_status);

-- Stable analysis-facing name: section objects for circumference/area work
CREATE OR REPLACE VIEW app_gevelwering.drawing_section AS
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
  r.analysis_status,
  r.analysis,
  r.created_by,
  r.created_at,
  r.committed_at,
  r.updated_at
FROM app_gevelwering.drawing_region r;

COMMENT ON VIEW app_gevelwering.drawing_section IS
  'First-class drawing section objects for gevelwering analysis (area, perimeter, future subsections).';

COMMENT ON COLUMN app_gevelwering.drawing_region.area_norm IS
  'Normalized page area (0–1)^2; scale to real units after calibration.';
COMMENT ON COLUMN app_gevelwering.drawing_region.perimeter_norm IS
  'Normalized page perimeter (circumference of axis-aligned box) in page units.';
COMMENT ON COLUMN app_gevelwering.drawing_region.analysis IS
  'Extensible JSON for subsection geometry and calculation results.';
