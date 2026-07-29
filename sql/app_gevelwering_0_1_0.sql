-- app-gevelwering DDL version 0.1.0 — 2026-07-20
-- Shared customer + building data (both gevelwering apps)
-- See: basic++/docs/Architectural_aspects/10-server-implementation/app-gevelwering-postgres-schema.md

CREATE SCHEMA IF NOT EXISTS app_gevelwering;

DO $$ BEGIN
  CREATE TYPE app_gevelwering.address_kind AS ENUM (
    'CUSTOMER',
    'DWELLING'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_gevelwering.building_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_gevelwering.customer (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text,
  phone           text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_gevelwering.address (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES app_gevelwering.customer (id) ON DELETE CASCADE,
  kind            app_gevelwering.address_kind NOT NULL,
  street_line     text NOT NULL,
  postal_code     text NOT NULL,
  city            text NOT NULL,
  municipality    text,
  country_code    char(2) NOT NULL DEFAULT 'NL',
  latitude        double precision,
  longitude       double precision,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS address_customer_idx ON app_gevelwering.address (customer_id);
CREATE INDEX IF NOT EXISTS address_postal_city_idx ON app_gevelwering.address (postal_code, city);

CREATE TABLE IF NOT EXISTS app_gevelwering.building (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES app_gevelwering.customer (id) ON DELETE RESTRICT,
  dwelling_address_id   uuid NOT NULL REFERENCES app_gevelwering.address (id) ON DELETE RESTRICT,
  label                 text,
  status                app_gevelwering.building_status NOT NULL DEFAULT 'DRAFT',
  external_ref          text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT building_dwelling_address_unique UNIQUE (dwelling_address_id)
);

CREATE INDEX IF NOT EXISTS building_customer_idx ON app_gevelwering.building (customer_id);
CREATE INDEX IF NOT EXISTS building_status_idx ON app_gevelwering.building (status);
