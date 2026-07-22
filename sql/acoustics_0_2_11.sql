-- acoustics DDL version 0.2.11 — 2026-07-21
-- Persist metres_per_norm_unit on each floormap room so edits work without recalibration
-- Requires 0.2.10 applied first.

ALTER TABLE acoustics.drawing_subsection
  ADD COLUMN IF NOT EXISTS metres_per_norm_unit double precision;

COMMENT ON COLUMN acoustics.drawing_subsection.metres_per_norm_unit IS
  'Scale snapshot (metres per section-local unit) applied when the room was saved or last scaled.';

-- Backfill from parent floormap section when available
UPDATE acoustics.drawing_subsection s
SET metres_per_norm_unit = r.metres_per_norm_unit,
    updated_at = now()
FROM acoustics.drawing_region r
WHERE s.section_id = r.id
  AND s.metres_per_norm_unit IS NULL
  AND r.metres_per_norm_unit IS NOT NULL
  AND r.metres_per_norm_unit > 0;
