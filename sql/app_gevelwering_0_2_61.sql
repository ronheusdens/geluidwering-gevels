-- app-gevelwering DDL 0.2.61 — 2026-10-06
-- Kozijn aluminium jaren 80 (80 mm, geanodiseerd/gelakt) — indicatief spectrum [2].
-- Basis: D01793 / D01792 (hout gem. / K3 80 mm), penalty −2…−4 dB (thermisch ongebroken alu).
-- Geen labmeting voor los alu-kozijn jaren 80; zie source_ref.

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

  IF NOT EXISTS (
    SELECT 1 FROM app_gevelwering.material
    WHERE source = 'app' AND catalog_id = 'A00015'
  ) THEN
    INSERT INTO app_gevelwering.material (
      catalog_index, catalog_id, material_no,
      master_category, name, category,
      rubriek_nr, subrubriek_nr,
      thickness_mm, weight_kg_m2,
      r_63_hz, r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
      r_db, rw_db, c_db, ctr_db, ra_dba,
      spectrum_ok, source, source_ref, exposure
    ) VALUES (
      v_next_idx, 'A00015', v_next_no,
      'Lichte paneelconstr./borstweringen/deuren',
      'Kozijn aluminium (jaren 80, 80 mm, geanodiseerd/gelakt) [2]',
      'Kozijnen',
      4, 5,
      80.0, 10.0,
      26.0, 29.0, 31.5, 31.0, 36.0, 40.0, 45.0,
      ARRAY[26.0, 29.0, 31.5, 31.0, 36.0, 40.0]::double precision[],
      36, -1, -2, 33.3,
      true, 'app',
      'Indicatief [2]: afgeleid van D01793/D01792 (hout gem./K3 80 mm) met −2…−4 dB '
        || '(koude alu zonder thermische onderbreking, typische jaren-80 kier/lekkage). '
        || 'Geen lab-R voor los alu-kozijn jaren 80. Profiel + lat voor HR++ (~80 mm). '
        || 'Rw (C; Ctr) = 36 (−1; −2). Glas apart als vlak.',
      'EXTERIOR'
    );
  ELSE
    UPDATE app_gevelwering.material
    SET
      name = 'Kozijn aluminium (jaren 80, 80 mm, geanodiseerd/gelakt) [2]',
      master_category = 'Lichte paneelconstr./borstweringen/deuren',
      category = 'Kozijnen',
      rubriek_nr = 4,
      subrubriek_nr = 5,
      thickness_mm = 80.0,
      weight_kg_m2 = 10.0,
      r_63_hz = 26.0,
      r_125_hz = 29.0,
      r_250_hz = 31.5,
      r_500_hz = 31.0,
      r_1000_hz = 36.0,
      r_2000_hz = 40.0,
      r_4000_hz = 45.0,
      r_db = ARRAY[26.0, 29.0, 31.5, 31.0, 36.0, 40.0]::double precision[],
      rw_db = 36,
      c_db = -1,
      ctr_db = -2,
      ra_dba = 33.3,
      spectrum_ok = true,
      source_ref =
        'Indicatief [2]: afgeleid van D01793/D01792 (hout gem./K3 80 mm) met −2…−4 dB '
        || '(koude alu zonder thermische onderbreking, typische jaren-80 kier/lekkage). '
        || 'Geen lab-R voor los alu-kozijn jaren 80. Profiel + lat voor HR++ (~80 mm). '
        || 'Rw (C; Ctr) = 36 (−1; −2). Glas apart als vlak.',
      exposure = 'EXTERIOR',
      updated_at = now()
    WHERE source = 'app' AND catalog_id = 'A00015';
  END IF;
END $$;
