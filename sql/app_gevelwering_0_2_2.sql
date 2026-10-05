-- app-gevelwering DDL version 0.2.2 — 2026-07-21
-- Additive: registration email, must_change_password, access_request audit
-- Requires 0.2.1 applied first. See app-gevelwering-postgres-schema.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Skipped once service_user is the Stilte identity view (columns and email uniqueness live in database stilte).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app_gevelwering' AND c.relname = 'service_user' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE app_gevelwering.service_user
      ADD COLUMN IF NOT EXISTS email text,
      ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
    CREATE UNIQUE INDEX IF NOT EXISTS service_user_email_unique
      ON app_gevelwering.service_user (lower(email))
      WHERE email IS NOT NULL AND email <> '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_gevelwering.access_request (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username        text NOT NULL,
  email           text NOT NULL,
  display_name    text,
  user_id         uuid REFERENCES app_gevelwering.service_user (id) ON DELETE SET NULL,
  mail_status     text NOT NULL DEFAULT 'PENDING',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_request_email_idx ON app_gevelwering.access_request (lower(email));
CREATE INDEX IF NOT EXISTS access_request_username_idx ON app_gevelwering.access_request (username);
