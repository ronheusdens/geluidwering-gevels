-- acoustics DDL version 0.2.5 — 2026-07-21
-- One customer profile per service user; project (= building row) delete guards
-- Requires 0.2.4 applied first. See acoustics-postgres-schema.md

-- Consolidate duplicate customer rows per owner (legacy saves created one per project).
DO $$
DECLARE
  r RECORD;
  canonical_id uuid;
BEGIN
  FOR r IN
    SELECT owner_user_id
    FROM acoustics.customer
    WHERE owner_user_id IS NOT NULL
    GROUP BY owner_user_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO canonical_id
    FROM acoustics.customer
    WHERE owner_user_id = r.owner_user_id
    ORDER BY created_at ASC
    LIMIT 1;

    UPDATE acoustics.building
    SET customer_id = canonical_id
    WHERE customer_id IN (
      SELECT id FROM acoustics.customer
      WHERE owner_user_id = r.owner_user_id AND id <> canonical_id
    );

    UPDATE acoustics.address
    SET customer_id = canonical_id
    WHERE customer_id IN (
      SELECT id FROM acoustics.customer
      WHERE owner_user_id = r.owner_user_id AND id <> canonical_id
    );

    DELETE FROM acoustics.customer
    WHERE owner_user_id = r.owner_user_id AND id <> canonical_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS customer_owner_user_id_unique
  ON acoustics.customer (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION acoustics.guard_building_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.project_status <> 'INITIAL_REQUEST'::acoustics.project_status THEN
    RAISE EXCEPTION 'project can only be deleted while status is INITIAL_REQUEST';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS building_delete_guard ON acoustics.building;
CREATE TRIGGER building_delete_guard
  BEFORE DELETE ON acoustics.building
  FOR EACH ROW
  EXECUTE FUNCTION acoustics.guard_building_delete();

CREATE OR REPLACE FUNCTION acoustics.cleanup_dwelling_after_building_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM acoustics.address
  WHERE id = OLD.dwelling_address_id
    AND kind = 'DWELLING'::acoustics.address_kind;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS building_delete_cleanup_dwelling ON acoustics.building;
CREATE TRIGGER building_delete_cleanup_dwelling
  AFTER DELETE ON acoustics.building
  FOR EACH ROW
  EXECUTE FUNCTION acoustics.cleanup_dwelling_after_building_delete();
