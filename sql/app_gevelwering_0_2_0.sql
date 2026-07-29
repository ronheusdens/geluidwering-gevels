-- app-gevelwering DDL version 0.2.0 — 2026-07-20
-- Additive: service login accounts + login sessions; link buildings to owner user
-- Requires 0.1.0 applied first. See app-gevelwering-postgres-schema.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_gevelwering.service_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username        text NOT NULL,
  password_hash   text NOT NULL,          -- pgcrypto crypt() bf hash
  display_name    text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_user_username_unique UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS app_gevelwering.login_session (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES app_gevelwering.service_user (id) ON DELETE CASCADE,
  token           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  CONSTRAINT login_session_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS login_session_user_idx ON app_gevelwering.login_session (user_id);
CREATE INDEX IF NOT EXISTS login_session_token_idx ON app_gevelwering.login_session (token);

-- Link shared building records to the logged-in service user (nullable for pre-0.2 rows)
ALTER TABLE app_gevelwering.customer
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES app_gevelwering.service_user (id) ON DELETE SET NULL;

ALTER TABLE app_gevelwering.building
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES app_gevelwering.service_user (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customer_owner_user_idx ON app_gevelwering.customer (owner_user_id);
CREATE INDEX IF NOT EXISTS building_owner_user_idx ON app_gevelwering.building (owner_user_id);

-- P0 demo account (username: demo / password: demo) — replace in production
INSERT INTO app_gevelwering.service_user (username, password_hash, display_name)
SELECT 'demo', crypt('demo', gen_salt('bf')), 'Demo consultant'
WHERE NOT EXISTS (
  SELECT 1 FROM app_gevelwering.service_user WHERE username = 'demo'
);
