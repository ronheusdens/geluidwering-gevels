-- app-gevelwering DDL version 0.2.6 — 2026-07-21
-- Project drawings stored as bytea blobs (pdf, dwg)
-- Requires 0.2.5 applied first. See app-gevelwering-postgres-schema.md

CREATE TABLE IF NOT EXISTS app_gevelwering.document (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     uuid NOT NULL REFERENCES app_gevelwering.building (id) ON DELETE CASCADE,
  filename        text NOT NULL,
  file_ext        text NOT NULL,
  content_type    text NOT NULL,
  content         bytea NOT NULL,
  byte_size       bigint NOT NULL DEFAULT 0,
  owner_user_id   uuid REFERENCES app_gevelwering.service_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_file_ext_check CHECK (lower(file_ext) IN ('pdf', 'dwg'))
);

CREATE INDEX IF NOT EXISTS document_building_idx ON app_gevelwering.document (building_id);
CREATE INDEX IF NOT EXISTS document_owner_idx ON app_gevelwering.document (owner_user_id);
