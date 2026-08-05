-- Acoustics DDL 0.2.25 — multi-variant: same floormap room once per variant
-- Allows deep-clone of VG/VR/vlak trees across variants sharing subsection_id.
-- Requires 0.2.16+ (verblijfsruimte table).

ALTER TABLE app_gevelwering.verblijfsruimte
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES app_gevelwering.variant (id) ON DELETE CASCADE;

-- Backfill from parent VG
UPDATE app_gevelwering.verblijfsruimte r
SET variant_id = g.variant_id
FROM app_gevelwering.verblijfsgebied g
WHERE r.verblijfsgebied_id = g.id
  AND (r.variant_id IS NULL OR r.variant_id IS DISTINCT FROM g.variant_id);

-- Drop orphan VRs that cannot be linked to a variant (should not happen)
DELETE FROM app_gevelwering.verblijfsruimte WHERE variant_id IS NULL;

ALTER TABLE app_gevelwering.verblijfsruimte
  ALTER COLUMN variant_id SET NOT NULL;

ALTER TABLE app_gevelwering.verblijfsruimte
  DROP CONSTRAINT IF EXISTS verblijfsruimte_subsection_unique;

DROP INDEX IF EXISTS app_gevelwering.verblijfsruimte_variant_subsection_uidx;
CREATE UNIQUE INDEX verblijfsruimte_variant_subsection_uidx
  ON app_gevelwering.verblijfsruimte (variant_id, subsection_id);

CREATE INDEX IF NOT EXISTS verblijfsruimte_variant_idx
  ON app_gevelwering.verblijfsruimte (variant_id);

COMMENT ON COLUMN app_gevelwering.verblijfsruimte.variant_id IS
  'Denormalized from verblijfsgebied.variant_id; UNIQUE with subsection_id so one room per variant.';
