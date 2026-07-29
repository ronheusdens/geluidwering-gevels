-- Acoustics DDL 0.2.19 — VR identifier as text (e.g. 3A), not only integers
-- Idempotent. Existing integer vr_nr values are cast to text.

DROP INDEX IF EXISTS app_gevelwering.drawing_subsection_building_vr_nr_uidx;

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_vr_nr_positive;

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_vg_vr_pair;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_gevelwering'
      AND table_name = 'drawing_subsection'
      AND column_name = 'vr_nr'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE app_gevelwering.drawing_subsection
      ALTER COLUMN vr_nr TYPE text
      USING CASE WHEN vr_nr IS NULL THEN NULL ELSE trim(vr_nr::text) END;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_gevelwering'
      AND table_name = 'drawing_subsection'
      AND column_name = 'vr_nr'
  ) THEN
    ALTER TABLE app_gevelwering.drawing_subsection
      ADD COLUMN vr_nr text;
  END IF;
END $$;

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_vr_id_format;
ALTER TABLE app_gevelwering.drawing_subsection
  ADD CONSTRAINT drawing_subsection_vr_id_format
  CHECK (
    vr_nr IS NULL
    OR vr_nr ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$'
  );

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_vg_vr_pair;
ALTER TABLE app_gevelwering.drawing_subsection
  ADD CONSTRAINT drawing_subsection_vg_vr_pair
  CHECK (
    (vg_nr IS NULL AND vr_nr IS NULL)
    OR (vg_nr IS NOT NULL AND vr_nr IS NOT NULL AND length(trim(vr_nr)) > 0)
  );

CREATE UNIQUE INDEX IF NOT EXISTS drawing_subsection_building_vr_nr_uidx
  ON app_gevelwering.drawing_subsection (building_id, lower(vr_nr))
  WHERE vr_nr IS NOT NULL AND building_id IS NOT NULL;
