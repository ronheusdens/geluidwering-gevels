-- app-gevelwering DDL version 0.2.7 — 2026-07-21
-- Engineer role, drawing review metadata, façade/section region crops
-- Requires 0.2.6 applied first. See app-gevelwering-postgres-schema.md

ALTER TABLE app_gevelwering.service_user
  ADD COLUMN IF NOT EXISTS is_engineer boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_gevelwering.drawing_review (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     uuid NOT NULL REFERENCES app_gevelwering.building (id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES app_gevelwering.service_user (id) ON DELETE RESTRICT,
  sufficient      boolean NOT NULL,
  legible         boolean NOT NULL,
  notes           text,
  reviewed_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drawing_review_building_unique UNIQUE (building_id)
);

CREATE INDEX IF NOT EXISTS drawing_review_building_idx ON app_gevelwering.drawing_review (building_id);
CREATE INDEX IF NOT EXISTS drawing_review_reviewer_idx ON app_gevelwering.drawing_review (reviewer_user_id);

CREATE TABLE IF NOT EXISTS app_gevelwering.drawing_region (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES app_gevelwering.document (id) ON DELETE CASCADE,
  page_index      integer NOT NULL DEFAULT 0,
  label           text NOT NULL,
  region_kind     text NOT NULL,
  x_min           double precision NOT NULL,
  y_min           double precision NOT NULL,
  x_max           double precision NOT NULL,
  y_max           double precision NOT NULL,
  created_by      uuid REFERENCES app_gevelwering.service_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drawing_region_kind_check CHECK (region_kind IN ('FACADE', 'SECTION', 'OTHER')),
  CONSTRAINT drawing_region_bounds_check CHECK (
    x_min >= 0 AND y_min >= 0 AND x_max <= 1 AND y_max <= 1 AND x_min < x_max AND y_min < y_max
  )
);

CREATE INDEX IF NOT EXISTS drawing_region_document_idx ON app_gevelwering.drawing_region (document_id);

-- P1 demo engineer account (username: engineer / password: demo)
INSERT INTO app_gevelwering.service_user (username, email, display_name, password_hash, must_change_password, is_engineer)
SELECT 'engineer', 'engineer@example.com', 'Engineer', crypt('demo', gen_salt('bf')), false, true
WHERE NOT EXISTS (
  SELECT 1 FROM app_gevelwering.service_user WHERE username = 'engineer'
);
