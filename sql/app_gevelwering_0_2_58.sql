-- app-gevelwering DDL 0.2.58 — 2026-10-04
-- Interior materials: praktijkwaarde DnT,A,k (instead of RA / C / Ctr façade corrections).

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS dnt_a_k_db double precision;

COMMENT ON COLUMN app_gevelwering.material.dnt_a_k_db IS
  'Praktijkwaarde DnT,A,k [dB] for INTERIOR materials (lab/sheet or calculated). '
  'Not used for EXTERIOR façade materials (those use ra_dba / c_db / ctr_db).';
