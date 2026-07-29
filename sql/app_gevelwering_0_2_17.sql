-- Acoustics DDL 0.2.17 — default spectrum_kind = SPECTRUM_2
-- Idempotent.

ALTER TABLE app_gevelwering.variant
  ALTER COLUMN spectrum_kind SET DEFAULT 'SPECTRUM_2';
