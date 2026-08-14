-- app-gevelwering DDL 0.2.29 — 2026-08-13
-- Opdrachtgever-kenmerk (client_ref) los van engineer-werknummer (external_ref).

ALTER TABLE app_gevelwering.building
  ADD COLUMN IF NOT EXISTS client_ref text;

COMMENT ON COLUMN app_gevelwering.building.client_ref IS
  'Kenmerk van de opdrachtgever (los van label en van engineer werknummer/external_ref).';

COMMENT ON COLUMN app_gevelwering.building.external_ref IS
  'Werknummer / projectnummer van de engineer (niet het kenmerk van de opdrachtgever).';

-- Migreer oude "Uw referentie" die in external_ref stond, alleen voor projecten
-- die nog niet in uitvoering zijn (dan blijft external_ref beschikbaar als werknummer).
UPDATE app_gevelwering.building
SET client_ref = external_ref
WHERE coalesce(trim(client_ref), '') = ''
  AND coalesce(trim(external_ref), '') <> ''
  AND project_status = 'INITIAL_REQUEST'::app_gevelwering.project_status;

UPDATE app_gevelwering.building
SET external_ref = NULL
WHERE project_status = 'INITIAL_REQUEST'::app_gevelwering.project_status
  AND coalesce(trim(client_ref), '') <> ''
  AND coalesce(trim(external_ref), '') <> ''
  AND trim(client_ref) = trim(external_ref);
