-- app-gevelwering DDL version 0.2.5 — 2026-07-21
-- One customer profile per service user; project (= building row) delete guards
-- Requires 0.2.4 applied first. See app-gevelwering-postgres-schema.md

-- Consolidate duplicate customer rows per owner (legacy saves created one per project).
DO $$
DECLARE
  r RECORD;
  canonical_id uuid;
BEGIN
  FOR r IN
    SELECT owner_user_id
    FROM app_gevelwering.customer
    WHERE owner_user_id IS NOT NULL
    GROUP BY owner_user_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO canonical_id
    FROM app_gevelwering.customer
    WHERE owner_user_id = r.owner_user_id
    ORDER BY created_at ASC
    LIMIT 1;

    UPDATE app_gevelwering.building
    SET customer_id = canonical_id
    WHERE customer_id IN (
      SELECT id FROM app_gevelwering.customer
      WHERE owner_user_id = r.owner_user_id AND id <> canonical_id
    );

    UPDATE app_gevelwering.address
    SET customer_id = canonical_id
    WHERE customer_id IN (
      SELECT id FROM app_gevelwering.customer
      WHERE owner_user_id = r.owner_user_id AND id <> canonical_id
    );

    DELETE FROM app_gevelwering.customer
    WHERE owner_user_id = r.owner_user_id AND id <> canonical_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS customer_owner_user_id_unique
  ON app_gevelwering.customer (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app_gevelwering.guard_building_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.project_status <> 'INITIAL_REQUEST'::app_gevelwering.project_status THEN
    RAISE EXCEPTION 'project can only be deleted while status is INITIAL_REQUEST';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS building_delete_guard ON app_gevelwering.building;
CREATE TRIGGER building_delete_guard
  BEFORE DELETE ON app_gevelwering.building
  FOR EACH ROW
  EXECUTE FUNCTION app_gevelwering.guard_building_delete();

CREATE OR REPLACE FUNCTION app_gevelwering.cleanup_dwelling_after_building_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM app_gevelwering.address
  WHERE id = OLD.dwelling_address_id
    AND kind = 'DWELLING'::app_gevelwering.address_kind;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS building_delete_cleanup_dwelling ON app_gevelwering.building;
CREATE TRIGGER building_delete_cleanup_dwelling
  AFTER DELETE ON app_gevelwering.building
  FOR EACH ROW
  EXECUTE FUNCTION app_gevelwering.cleanup_dwelling_after_building_delete();
