-- Acoustics DDL 0.2.18 — VG/VR numbers on drawing_subsection (floormap room)
-- Relationship between rooms in the same verblijfsgebied is expressed by shared vg_nr.
-- vr_nr is unique per building when set. Idempotent.

ALTER TABLE app_gevelwering.drawing_subsection
  ADD COLUMN IF NOT EXISTS vg_nr integer;

ALTER TABLE app_gevelwering.drawing_subsection
  ADD COLUMN IF NOT EXISTS vr_nr integer;

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_vg_nr_positive;
ALTER TABLE app_gevelwering.drawing_subsection
  ADD CONSTRAINT drawing_subsection_vg_nr_positive
  CHECK (vg_nr IS NULL OR vg_nr > 0);

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_vr_nr_positive;
ALTER TABLE app_gevelwering.drawing_subsection
  ADD CONSTRAINT drawing_subsection_vr_nr_positive
  CHECK (vr_nr IS NULL OR vr_nr > 0);

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_vg_vr_pair;
ALTER TABLE app_gevelwering.drawing_subsection
  ADD CONSTRAINT drawing_subsection_vg_vr_pair
  CHECK (
    (vg_nr IS NULL AND vr_nr IS NULL)
    OR (vg_nr IS NOT NULL AND vr_nr IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS drawing_subsection_building_vr_nr_uidx
  ON app_gevelwering.drawing_subsection (building_id, vr_nr)
  WHERE vr_nr IS NOT NULL AND building_id IS NOT NULL;
