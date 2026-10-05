-- app-gevelwering DDL 0.2.56 — 2026-10-04
-- Interior partition materials (isolatie / overdracht tussen ruimten).
-- Reclassify existing light partitions + Fermacell wall systems as INTERIOR,
-- and seed sheet-default scheidingswand / binnenwand rows (source=app).

-- Rubriek 8 = lichte scheidingsconstructies (metal stud, Faay, …)
UPDATE app_gevelwering.material
SET exposure = 'INTERIOR', updated_at = now()
WHERE rubriek_nr = 8
  AND exposure IS DISTINCT FROM 'INTERIOR';

-- Fermacell wandopbouwen in catalogus (plaat/panelen) → interieur
UPDATE app_gevelwering.material
SET exposure = 'INTERIOR', updated_at = now()
WHERE name ILIKE 'Fermacell%'
  AND exposure IS DISTINCT FROM 'INTERIOR';

-- Idempotent seed of isolatie sheet defaults (A##### under source=app)
DO $$
DECLARE
  v_next_no int;
  v_next_idx int;
BEGIN
  SELECT COALESCE(MAX(material_no), 0) + 1,
         COALESCE(MAX(catalog_index), -1) + 1
  INTO v_next_no, v_next_idx
  FROM app_gevelwering.material
  WHERE source = 'app';

  -- Scheidingswand beton 230 mm — INSUL / DnTAk sheet Rs
  IF NOT EXISTS (
    SELECT 1 FROM app_gevelwering.material
    WHERE source = 'app' AND catalog_id = 'A00007'
  ) THEN
    INSERT INTO app_gevelwering.material (
      catalog_index, catalog_id, material_no,
      master_category, name, category,
      rubriek_nr, subrubriek_nr,
      thickness_mm,
      r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
      r_db, ra_dba, spectrum_ok, source, source_ref, exposure
    ) VALUES (
      v_next_idx, 'A00007', v_next_no,
      'Steenachtigen/beton/blokken',
      'Scheidingswand beton 230 mm (INSUL / sheet)',
      'Grindbeton/natuursteen',
      1, 3,
      230,
      53, 56, 59, 67, 73, NULL,
      ARRAY[53, 56, 59, 67, 73, NULL]::double precision[],
      62, true, 'app',
      'DnTAk sheet Inputs B24 / INSUL',
      'INTERIOR'
    );
    v_next_no := v_next_no + 1;
    v_next_idx := v_next_idx + 1;
  ELSE
    UPDATE app_gevelwering.material
    SET exposure = 'INTERIOR',
        name = 'Scheidingswand beton 230 mm (INSUL / sheet)',
        r_125_hz = 53, r_250_hz = 56, r_500_hz = 59, r_1000_hz = 67, r_2000_hz = 73,
        r_db = ARRAY[53, 56, 59, 67, 73, NULL]::double precision[],
        source_ref = 'DnTAk sheet Inputs B24 / INSUL',
        updated_at = now()
    WHERE source = 'app' AND catalog_id = 'A00007';
  END IF;

  -- Binnenwand cellenbeton 70 mm — sheet / building_element_type
  IF NOT EXISTS (
    SELECT 1 FROM app_gevelwering.material
    WHERE source = 'app' AND catalog_id = 'A00008'
  ) THEN
    INSERT INTO app_gevelwering.material (
      catalog_index, catalog_id, material_no,
      master_category, name, category,
      rubriek_nr, subrubriek_nr,
      thickness_mm,
      r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
      r_db, ra_dba, spectrum_ok, source, source_ref, exposure
    ) VALUES (
      v_next_idx, 'A00008', v_next_no,
      'Steenachtigen/beton/blokken',
      'Binnenwand cellenbeton 70 mm',
      'Lichtbeton/cellenbeton',
      1, 4,
      70,
      29, 29, 26, 32, 41, NULL,
      ARRAY[29, 29, 26, 32, 41, NULL]::double precision[],
      32, true, 'app',
      'DnTAk sheet Inputs B28',
      'INTERIOR'
    );
    v_next_no := v_next_no + 1;
    v_next_idx := v_next_idx + 1;
  ELSE
    UPDATE app_gevelwering.material
    SET exposure = 'INTERIOR', updated_at = now()
    WHERE source = 'app' AND catalog_id = 'A00008';
  END IF;

  -- Metal stud referentie (app-rij; catalogus D00380 blijft ook INTERIOR via rubriek 8)
  IF NOT EXISTS (
    SELECT 1 FROM app_gevelwering.material
    WHERE source = 'app' AND catalog_id = 'A00009'
  ) THEN
    INSERT INTO app_gevelwering.material (
      catalog_index, catalog_id, material_no,
      master_category, name, category,
      rubriek_nr, subrubriek_nr,
      thickness_mm,
      r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
      r_db, ra_dba, spectrum_ok, source, source_ref, exposure
    ) VALUES (
      v_next_idx, 'A00009', v_next_no,
      'Lichte scheidingsconstructies',
      'Metalstud MS 100 (1× gipsplaat / zijde)',
      'Metalen wanden',
      8, 4,
      100,
      33.4, 43.4, 51, 57.5, 47.2, NULL,
      ARRAY[33.4, 43.4, 51, 57.5, 47.2, NULL]::double precision[],
      41, true, 'app',
      'Catalogus D00380 → interieur seed',
      'INTERIOR'
    );
  ELSE
    UPDATE app_gevelwering.material
    SET exposure = 'INTERIOR', updated_at = now()
    WHERE source = 'app' AND catalog_id = 'A00009';
  END IF;
END $$;

-- Keep concepts aligned when present
UPDATE acoustic_catalog.material_concept c
SET exposure = 'INTERIOR', updated_at = now()
WHERE c.published_material_id IN (
  SELECT m.id FROM app_gevelwering.material m WHERE m.exposure = 'INTERIOR'
)
AND c.exposure IS DISTINCT FROM 'INTERIOR';
