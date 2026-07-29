-- Acoustics DDL 0.2.23 — restore spectrum extras purged in 0.2.14 rebuild
-- Adds R@4000 Hz and ISO 717-1 single-number ratings Rw (C, Ctr).

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS r_4000_hz double precision;

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS rw_db double precision;

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS c_db double precision;

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS ctr_db double precision;

COMMENT ON COLUMN app_gevelwering.material.r_4000_hz IS
  'Octave-band sound reduction index R [dB] at 4000 Hz (restored; was in GL.cat / 0.2.12).';
COMMENT ON COLUMN app_gevelwering.material.rw_db IS
  'Weighted sound reduction index Rw [dB] per NEN-EN-ISO 717-1.';
COMMENT ON COLUMN app_gevelwering.material.c_db IS
  'Spectrum adaptation term C [dB] per NEN-EN-ISO 717-1.';
COMMENT ON COLUMN app_gevelwering.material.ctr_db IS
  'Spectrum adaptation term Ctr [dB] per NEN-EN-ISO 717-1.';
