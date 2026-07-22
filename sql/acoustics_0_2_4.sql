-- acoustics DDL version 0.2.4 — 2026-07-21
-- Additive: PROJECT_FINISHED to project_status enum
-- Requires 0.2.3 applied first. See acoustics-postgres-schema.md

DO $$ BEGIN
  ALTER TYPE acoustics.project_status ADD VALUE 'PROJECT_FINISHED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
