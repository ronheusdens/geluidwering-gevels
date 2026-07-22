-- acoustics DDL version 0.1.0 — 2026-07-20
-- Shared customer + building data (both acoustics apps)
-- See: basic++/docs/Architectural_aspects/10-server-implementation/acoustics-postgres-schema.md

CREATE SCHEMA IF NOT EXISTS acoustics;

DO $$ BEGIN
  CREATE TYPE acoustics.address_kind AS ENUM (
    'CUSTOMER',
    'DWELLING'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE acoustics.building_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS acoustics.customer (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text,
  phone           text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acoustics.address (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES acoustics.customer (id) ON DELETE CASCADE,
  kind            acoustics.address_kind NOT NULL,
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

CREATE INDEX IF NOT EXISTS address_customer_idx ON acoustics.address (customer_id);
CREATE INDEX IF NOT EXISTS address_postal_city_idx ON acoustics.address (postal_code, city);

CREATE TABLE IF NOT EXISTS acoustics.building (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES acoustics.customer (id) ON DELETE RESTRICT,
  dwelling_address_id   uuid NOT NULL REFERENCES acoustics.address (id) ON DELETE RESTRICT,
  label                 text,
  status                acoustics.building_status NOT NULL DEFAULT 'DRAFT',
  external_ref          text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT building_dwelling_address_unique UNIQUE (dwelling_address_id)
);

CREATE INDEX IF NOT EXISTS building_customer_idx ON acoustics.building (customer_id);
CREATE INDEX IF NOT EXISTS building_status_idx ON acoustics.building (status);
