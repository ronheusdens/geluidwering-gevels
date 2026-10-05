-- app-gevelwering DDL 0.2.47 — 2026-09-11
-- Los materiaal: gebakken dakpannen + koppeling ASM-DAK-HELLEND-V2 laag 1.

WITH next AS (
  SELECT
    COALESCE(MAX(material_no), 0) + 1 AS material_no,
    COALESCE(MAX(catalog_index), -1) + 1 AS catalog_index
  FROM app_gevelwering.material
  WHERE source = 'app'
),
ins AS (
  INSERT INTO app_gevelwering.material (
    catalog_index, catalog_id, material_no, master_category, name, category,
    rubriek_nr, subrubriek_nr,
    thickness_mm, weight_kg_m2,
    r_63_hz, r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
    r_db, rw_db, c_db, ctr_db, ra_dba,
    spectrum_ok, source, source_ref
  )
  SELECT
    n.catalog_index,
    'A' || lpad(n.material_no::text, 5, '0'),
    n.material_no,
    'Losse materialen',
    'Gebakken dakpannen (keramisch)',
    'Bekleding / buitenblad',
    10, 1,
    22.0, 45.0,
    22.1, 28.0, 34.0, 40.0, 46.1, 52.1, 58.1,
    ARRAY[22.1, 28.0, 34.0, 40.0, 46.1, 52.1]::double precision[],
    45, -2, -6, NULL,
    false,
    'app',
    'Indicatie: keramische dakpan m″≈45 kg/m² (40–50 typisch). R-banden = massawet op gesloten plaat (optimistisch t.o.v. overlappende panlaag met naden). Geen lab-R voor pan alleen.'
  FROM next n
  WHERE NOT EXISTS (
    SELECT 1 FROM app_gevelwering.material
    WHERE source = 'app' AND name = 'Gebakken dakpannen (keramisch)'
  )
  RETURNING id, catalog_id
)
SELECT * FROM ins;

UPDATE acoustic_catalog.wall_assembly_layer l
SET
  thickness_mm = 22.0,
  density_kg_m3 = 2045.0,
  surface_mass_kg_m2 = 45.0,
  label = 'Dakpannen / gebakken klei',
  params = jsonb_build_object(
    'catalog_id', m.catalog_id,
    'material_id', m.id::text,
    'note', 'Gebakken/keramische dakpannen; m″=45 kg/m²; R indicatief massawet',
    'rho_kg_m3', 2045,
    'm_kg_m2', 45
  )
FROM acoustic_catalog.wall_assembly a,
     app_gevelwering.material m
WHERE l.assembly_id = a.id
  AND a.code = 'ASM-DAK-HELLEND-V2'
  AND l.layer_order = 1
  AND m.source = 'app'
  AND m.name = 'Gebakken dakpannen (keramisch)';

-- A00004 betonnen dakpannen (variant; dichter, iets zwaarder m″)
INSERT INTO app_gevelwering.material (
  catalog_index, catalog_id, material_no, master_category, name, category,
  rubriek_nr, subrubriek_nr,
  thickness_mm, weight_kg_m2,
  r_63_hz, r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
  r_db, rw_db, c_db, ctr_db, ra_dba,
  spectrum_ok, source, source_ref
)
SELECT
  COALESCE((SELECT MAX(catalog_index) FROM app_gevelwering.material WHERE source = 'app'), -1) + 1,
  'A00004',
  4,
  'Losse materialen',
  'Betonnen dakpannen',
  'Bekleding / buitenblad',
  10, 1,
  22.0, 50.0,
  23.0, 28.9, 34.9, 41.0, 47.0, 53.0, 59.0,
  ARRAY[23.0, 28.9, 34.9, 41.0, 47.0, 53.0]::double precision[],
  46, -2, -6, NULL,
  false,
  'app',
  'Betondakpan m″≈50 kg/m² (typ. 44–51). ρ beton ≈2300 kg/m³ (klei ≈2000). R = massawet gesloten plaat (indicatief).'
WHERE NOT EXISTS (
  SELECT 1 FROM app_gevelwering.material WHERE source = 'app' AND catalog_id = 'A00004'
);