-- app-gevelwering DDL version 0.2.3 — 2026-07-21
-- Additive: admin user + client-visible project status on building
-- Requires 0.2.2 applied first. See app-gevelwering-postgres-schema.md

DO $$ BEGIN
  CREATE TYPE app_gevelwering.project_status AS ENUM (
    'INITIAL_REQUEST',
    'PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED',
    'PROJECT_UNDERWAY',
    'PROJECT_NEAR_FINAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE app_gevelwering.building
  ADD COLUMN IF NOT EXISTS project_status app_gevelwering.project_status NOT NULL DEFAULT 'INITIAL_REQUEST';

CREATE INDEX IF NOT EXISTS building_project_status_idx ON app_gevelwering.building (project_status);

INSERT INTO app_gevelwering.service_user (username, email, display_name, password_hash, must_change_password)
SELECT 'admin', 'admin@example.com', 'Service admin', crypt('demo', gen_salt('bf')), false
WHERE NOT EXISTS (
  SELECT 1 FROM app_gevelwering.service_user WHERE username = 'admin'
);
