-- app-gevelwering DDL 0.2.49 — 2026-09-11
-- Hellend dak: zelfdragend sandwichpaneel (Unidek Aero-achtig).
-- Vervangt dakbeschot + sporen + isolatie + damprem + aparte binnenafwerking
-- door één cataloguskoppelbaar paneel met fabrieks-R.

INSERT INTO acoustic_catalog.wall_assembly (code, name, description, assembly_family)
VALUES (
  'ASM-DAK-HELLEND-SANDWICH-V1',
  'Dakopbouw — hellend dak (sandwichpaneel)',
  'Hellend dak buiten→binnen voor zelfdragende isolatiepanelen incl. binnenafwerking '
  '(bijv. Unidek Aero e.d.): pannen, panlatten, tengels, ventilerende spouw, '
  'optioneel damp-open folie, daarna één sandwichpaneel. '
  'Geen aparte sporen-isolatie, damprem of lining — die zitten in het paneel. '
  'Koppel een catalogusmateriaal met leveranciersspectrum (niet massawet op wol). '
  'Regelwerk defaults gelijk aan hellend dak V2 (panlat 38×25 @ 320, tengel 38×30 @ 600).',
  'dak'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  assembly_family = EXCLUDED.assembly_family,
  updated_at = now();

DELETE FROM acoustic_catalog.wall_assembly_layer l
USING acoustic_catalog.wall_assembly a
WHERE l.assembly_id = a.id AND a.code = 'ASM-DAK-HELLEND-SANDWICH-V1';

INSERT INTO acoustic_catalog.wall_assembly_layer (
  assembly_id, layer_order, layer_kind, label, thickness_mm, density_kg_m3,
  cavity_depth_mm, stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params
)
SELECT a.id, v.layer_order, v.layer_kind, v.label, v.thickness_mm, v.density_kg_m3,
       v.cavity_depth_mm, v.stud_width_mm, v.stud_depth_mm, v.stud_spacing_mm,
       v.acoustic_role, v.params::jsonb
FROM acoustic_catalog.wall_assembly a
CROSS JOIN (VALUES
  (1, 'cladding', 'Dakpannen / leien',
     15.0, 2000.0, NULL::float, NULL::float, NULL::float, NULL::float, 'structural',
     '{"note":"homogeen dakvlak; koppel catalogus dakpan indien beschikbaar"}'),
  (2, 'framing', 'Panlatten (hout, voor pannen)',
     25.0, 450.0, NULL, 38.0, 25.0, 320.0, 'structural',
     '{"grid":"panlat","species":"vuren","phi":0.1188,"m_eq_kg_m2":1.34,"phi_readonly":true,"note":"φ=b/a; a=320 mm"}'),
  (3, 'framing', 'Tengels (hout, ventilerend)',
     30.0, 450.0, NULL, 38.0, 30.0, 600.0, 'structural',
     '{"grid":"tengel","species":"vuren","phi":0.0633,"m_eq_kg_m2":0.85,"phi_readonly":true,"note":"φ=b/a; a=600 mm"}'),
  (4, 'cavity_ventilated', 'Luchtspouw (regelwerkzone)',
     NULL, NULL, 30.0, NULL, NULL, NULL, 'cavity',
     '{"note":"diepte ≈ tengelhoogte"}'),
  (5, 'membrane', 'Damp-open onderdakfolie (indien los)',
     0.5, 1200.0, NULL, NULL, NULL, NULL, 'negligible',
     '{"note":"soms geïntegreerd in paneel — dan weglaten of dikte 0"}'),
  -- Eén productlaag: PIR/EPS-kern + constructieve platen + binnenafwerking
  (6, 'structure', 'Zelfdragend sandwichpaneel (bijv. Unidek Aero)',
     160.0, 45.0, NULL, NULL, NULL, NULL, 'structural',
     '{"product_class":"self_supporting_sandwich","examples":["Unidek Aero"],'
     '"replaces":["sheathing","framing","insulation","vapor_barrier","lining"],'
     '"note":"Koppel catalogus met fabrieks-R (Rw/C/Ctr of octaafbanden). '
     'Dikte = paneeldikte; ρ is indicatief — spectrum uit catalogus heeft voorrang. '
     'Geen aparte lining/isolatie-lagen in deze template."}')
) AS v(layer_order, layer_kind, label, thickness_mm, density_kg_m3, cavity_depth_mm,
       stud_width_mm, stud_depth_mm, stud_spacing_mm, acoustic_role, params)
WHERE a.code = 'ASM-DAK-HELLEND-SANDWICH-V1';
