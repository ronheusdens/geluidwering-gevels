-- app-gevelwering DDL version 0.2.8 — 2026-07-21
-- Extend drawing_region kinds: FLOORMAP, CROSS_SECTION
-- Requires 0.2.7 applied first.

ALTER TABLE app_gevelwering.drawing_region
  DROP CONSTRAINT IF EXISTS drawing_region_kind_check;

ALTER TABLE app_gevelwering.drawing_region
  ADD CONSTRAINT drawing_region_kind_check
  CHECK (region_kind IN ('FACADE', 'SECTION', 'FLOORMAP', 'CROSS_SECTION', 'OTHER'));
