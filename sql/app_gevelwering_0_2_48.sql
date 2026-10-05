-- app-gevelwering DDL 0.2.48 — 2026-09-11
-- Opdrachtgever-rapportage: geen spectrum_ok-status in bronteksten.
-- Interne kolom spectrum_ok blijft; alleen zichtbare/zoekbare tekst opschonen.

UPDATE app_gevelwering.material
SET source_ref = trim(both ' ;.' FROM regexp_replace(
  coalesce(source_ref, ''),
  '\s*[;.]?\s*spectrum_ok\s*=\s*(true|false)\s*',
  '',
  'gi'
))
WHERE source_ref ~* 'spectrum_ok\s*=';
