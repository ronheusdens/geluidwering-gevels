-- app-gevelwering DDL 0.2.46 — 2026-09-11
-- Hellend dak V2: tengels + panlatten met realistische h.o.h.; φ en m″eq als rekenwaarden in params.

INSERT INTO acoustic_catalog.wall_assembly (code, name, description, assembly_family)
VALUES (
  'ASM-DAK-HELLEND-V2',
  'Dakopbouw — hellend dak (pannen + regelwerk)',
  'Hellend dak buiten→binnen met expliciet regelwerk: pannen, panlatten, tengels, '
  'ventilerende spouw, onderdakfolie, dakbeschot, sporen+isolatie, damprem, binnenafwerking. '
  'Houtoppervlak/fractie: φ = b/a (h.o.h.); twee richtingen φ = φt+φp−φt·φp. '
  'Defaults: tengel 38×30 @ 600 mm (sporen), panlat 38×25 @ 320 mm (typische latmaat). '
  'φ en m″eq zijn rekenwaarden (read-only).',
  'dak'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  assembly_family = EXCLUDED.assembly_family,
  updated_at = now();

DELETE FROM acoustic_catalog.wall_assembly_layer l
USING acoustic_catalog.wall_assembly a
WHERE l.assembly_id = a.id AND a.code = 'ASM-DAK-HELLEND-V2';

INSERT INTO acoustic_catalog.wall_assembly_layer (
  assembly_id, layer_order, layer_kind, label, thickness_mm, density_kg_m3,
  cavity_depth_mm, stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params
)
SELECT a.id, v.layer_order, v.layer_kind, v.label, v.thickness_mm, v.density_kg_m3,
       v.cavity_depth_mm, v.stud_width_mm, v.stud_depth_mm, v.stud_spacing_mm,
       v.acoustic_role, v.params::jsonb
FROM acoustic_catalog.wall_assembly a
CROSS JOIN (VALUES
  -- 1 Pannen: volle plaat
  (1, 'cladding', 'Dakpannen / leien',
     15.0, 2000.0, NULL::float, NULL::float, NULL::float, NULL::float, 'structural',
     '{"note":"homogeen dakvlak"}'),
  -- 2 Panlatten: φ = 38/320 = 0.11875; m″eq = φ·450·0.025 ≈ 1.34 kg/m²
  (2, 'framing', 'Panlatten (hout, voor pannen)',
     25.0, 450.0, NULL, 38.0, 25.0, 320.0, 'structural',
     '{"grid":"panlat","species":"vuren","phi":0.1188,"m_eq_kg_m2":1.34,"phi_readonly":true,"note":"φ=b/a; a=320 mm typische latmaat betonnen pan"}'),
  -- 3 Tengels: φ = 38/600 ≈ 0.0633; m″eq = φ·450·0.030 ≈ 0.85 kg/m²; spouwdiepte = 30
  (3, 'framing', 'Tengels (hout, ventilerend)',
     30.0, 450.0, NULL, 38.0, 30.0, 600.0, 'structural',
     '{"grid":"tengel","species":"vuren","phi":0.0633,"m_eq_kg_m2":0.85,"phi_readonly":true,"note":"φ=b/a; a=600 mm sporenafstand (rekenwaarde)"}'),
  -- 4 Lucht in regelwerkzone (diepte = tengelhoogte)
  (4, 'cavity_ventilated', 'Luchtspouw (regelwerkzone)',
     NULL, NULL, 30.0, NULL, NULL, NULL, 'cavity',
     '{"note":"diepte ≈ tengelhoogte; houtfractie zie panlat+tengel (φ_comb≈0.17)"}'),
  (5, 'membrane', 'Damp-open onderdakfolie',
     0.5, 1200.0, NULL, NULL, NULL, NULL, 'negligible', '{}'),
  (6, 'sheathing', 'Dakbeschot (multiplex / OSB)',
     18.0, 650.0, NULL, NULL, NULL, NULL, 'structural', '{}'),
  (7, 'framing', 'Sporen / gordingen (hout)',
     160.0, 450.0, NULL, 45.0, 160.0, 600.0, 'structural',
     '{"grid":"spoor","species":"vuren","phi":0.075,"m_eq_kg_m2":5.4,"phi_readonly":true,"note":"φ=45/600; isolatie vult tussenruimte"}'),
  (8, 'insulation', 'Isolatie tussen sporen (MW / cellulose)',
     160.0, 30.0, NULL, NULL, NULL, NULL, 'absorptive',
     '{"note":"absorptief; geen R-spectrum van wol alleen"}'),
  (9, 'vapor_barrier', 'Dampremmende folie',
     0.2, 1200.0, NULL, NULL, NULL, NULL, 'negligible', '{}'),
  (10, 'lining', 'Binnenafwerking gips / multiplex',
     12.5, 900.0, NULL, NULL, NULL, NULL, 'structural', '{}')
) AS v(layer_order, layer_kind, label, thickness_mm, density_kg_m3, cavity_depth_mm,
       stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params)
WHERE a.code = 'ASM-DAK-HELLEND-V2';

COMMENT ON TABLE acoustic_catalog.wall_assembly IS
  'Samengestelde opbouwtemplates (buiten→binnen). Familie dak|buitengevel|overig. '
  'Regelwerk: stud_width/spacing → φ (read-only rekenwaarde); m″eq = φ·ρ·h.';
