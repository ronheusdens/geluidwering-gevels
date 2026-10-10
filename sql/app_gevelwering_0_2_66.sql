-- Acoustics DDL 0.2.66 — gevelgroepen per oriëntatie (CL/Cg per groep)
-- Meerdere vlakken delen één groep; default = één «Standaard»-groep per ori.
-- GA rekent D2m per groep (alle groepen van de VR).

CREATE TABLE IF NOT EXISTS app_gevelwering.gevelgroep (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verblijfsruimte_id    uuid NOT NULL REFERENCES app_gevelwering.verblijfsruimte (id) ON DELETE CASCADE,
  building_id           uuid NOT NULL REFERENCES app_gevelwering.building (id) ON DELETE CASCADE,
  orientatie            text NOT NULL,
  label                 text NOT NULL DEFAULT 'Standaard',
  cl_db                 double precision NOT NULL DEFAULT 0,
  cg_db                 double precision NOT NULL DEFAULT 0,
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gevelgroep_ori_check CHECK (
    orientatie IN ('N','NO','O','ZO','Z','ZW','W','NW')
  ),
  CONSTRAINT gevelgroep_cl_check CHECK (cl_db >= 0 AND cl_db <= 100),
  CONSTRAINT gevelgroep_cg_check CHECK (cg_db >= -100 AND cg_db <= 100)
);

CREATE INDEX IF NOT EXISTS gevelgroep_vr_idx
  ON app_gevelwering.gevelgroep (verblijfsruimte_id);
CREATE INDEX IF NOT EXISTS gevelgroep_vr_ori_idx
  ON app_gevelwering.gevelgroep (verblijfsruimte_id, orientatie);

COMMENT ON TABLE app_gevelwering.gevelgroep IS
  'Gevelgroep binnen een VR·oriëntatie; CL/Cg gelden voor alle vlakken in de groep. GA: D2m per groep.';

ALTER TABLE app_gevelwering.vlak
  ADD COLUMN IF NOT EXISTS gevelgroep_id uuid
    REFERENCES app_gevelwering.gevelgroep (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vlak_gevelgroep_idx
  ON app_gevelwering.vlak (gevelgroep_id);

COMMENT ON COLUMN app_gevelwering.vlak.gevelgroep_id IS
  'Gevelgroep (zelfde ori); CL/Cg van de groep sturen D2m. NULL → tijdelijk tot backfill/ensure.';

-- Backfill: één groep per (VR, ori, cl, cg) uit bestaande vlakken — behoudt bestaande CL-overrides.
INSERT INTO app_gevelwering.gevelgroep (
  verblijfsruimte_id, building_id, orientatie, label, cl_db, cg_db, sort_order
)
SELECT
  x.verblijfsruimte_id,
  x.building_id,
  x.orientatie,
  CASE
    WHEN x.cnt > 1 THEN 'Groep CL=' || trim(to_char(x.cl_db, 'FM999990.9'))
    ELSE 'Standaard'
  END,
  x.cl_db,
  x.cg_db,
  x.rn - 1
FROM (
  SELECT
    d.verblijfsruimte_id,
    d.building_id,
    d.orientatie,
    d.cl_db,
    d.cg_db,
    COUNT(*) OVER (PARTITION BY d.verblijfsruimte_id, d.orientatie) AS cnt,
    ROW_NUMBER() OVER (
      PARTITION BY d.verblijfsruimte_id, d.orientatie
      ORDER BY d.cl_db, d.cg_db
    ) AS rn
  FROM (
    SELECT DISTINCT
      verblijfsruimte_id,
      building_id,
      UPPER(TRIM(orientatie)) AS orientatie,
      cl_db,
      cg_db
    FROM app_gevelwering.vlak
    WHERE orientatie IS NOT NULL
      AND TRIM(orientatie) <> ''
      AND UPPER(TRIM(orientatie)) IN ('N','NO','O','ZO','Z','ZW','W','NW')
  ) d
) x
WHERE NOT EXISTS (
  SELECT 1
  FROM app_gevelwering.gevelgroep g
  WHERE g.verblijfsruimte_id = x.verblijfsruimte_id
    AND g.orientatie = x.orientatie
    AND ABS(g.cl_db - x.cl_db) < 1e-9
    AND ABS(g.cg_db - x.cg_db) < 1e-9
);

UPDATE app_gevelwering.vlak vl
SET gevelgroep_id = g.id
FROM app_gevelwering.gevelgroep g
WHERE vl.gevelgroep_id IS NULL
  AND g.verblijfsruimte_id = vl.verblijfsruimte_id
  AND g.orientatie = UPPER(TRIM(vl.orientatie))
  AND ABS(g.cl_db - vl.cl_db) < 1e-9
  AND ABS(g.cg_db - vl.cg_db) < 1e-9;
