-- app-gevelwering 0.2.21 — GG rubriek (1–9) + category-specific subrubriek
-- Idempotent. Existing master_category values are remapped; Elementen split via heuristics in assign script.

CREATE TABLE IF NOT EXISTS app_gevelwering.material_rubriek (
  nr    smallint PRIMARY KEY CHECK (nr BETWEEN 1 AND 9),
  name  text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS app_gevelwering.material_subrubriek (
  rubriek_nr  smallint NOT NULL REFERENCES app_gevelwering.material_rubriek (nr) ON DELETE CASCADE,
  nr          smallint NOT NULL CHECK (nr >= 1),
  name        text NOT NULL,
  PRIMARY KEY (rubriek_nr, nr)
);

CREATE INDEX IF NOT EXISTS material_subrubriek_name_idx
  ON app_gevelwering.material_subrubriek (rubriek_nr, name);

COMMENT ON TABLE app_gevelwering.material_rubriek IS
  'DGMR GG main categories (rubrieken) 1–9.';
COMMENT ON TABLE app_gevelwering.material_subrubriek IS
  'Subrubrieken are specific to each rubriek (not global).';

-- Seed rubrieken
INSERT INTO app_gevelwering.material_rubriek (nr, name) VALUES
  (1, 'Steenachtigen/beton/blokken'),
  (2, 'Glas'),
  (3, 'Dak-, vloer-, plafondconstructies'),
  (4, 'Lichte paneelconstr./borstweringen/deuren'),
  (5, 'Enkelvoudige plaatmaterialen/panelen'),
  (6, 'Ventilatievoorzieningen'),
  (7, 'Ventilatievoorzieningen oud (voor 1-1-2012)'),
  (8, 'Lichte scheidingsconstructies'),
  (9, 'Kier- en naaddichtingsprofielen')
ON CONFLICT (nr) DO UPDATE SET name = EXCLUDED.name;

-- Clear + reseed subrubrieken (taxonomy is authoritative)
DELETE FROM app_gevelwering.material_subrubriek;

INSERT INTO app_gevelwering.material_subrubriek (rubriek_nr, nr, name) VALUES
  -- 1 Steenachtigen
  (1, 1, 'Baksteen licht/zwaar'),
  (1, 2, 'Kalkzandsteen'),
  (1, 3, 'Grindbeton/natuursteen'),
  (1, 4, 'Lichtbeton/cellenbeton'),
  (1, 5, '(hout-)vezelbeton'),
  (1, 6, 'Lichte blokken/gipsblokken'),
  (1, 7, 'Voorzetwanden'),
  (1, 8, 'Enkelsteensmuur, rekenmethode'),
  (1, 9, 'Spouwmuur, rekenmethode'),
  (1, 10, 'Diversen'),
  -- 2 Glas
  (2, 1, 'Enkel glas'),
  (2, 2, 'Dubbel glas'),
  (2, 3, 'Enkel glas gelamineerd'),
  (2, 4, 'Dubbel glas 1-zijdig gelamineerd'),
  (2, 5, 'Dubbel glas 2-zijdig gelamineerd'),
  (2, 6, 'Schuiframen'),
  (2, 7, 'Enkel glas, rekenmethode T'),
  (2, 8, 'Dubbel glas, rekenmethode T'),
  (2, 9, 'Diversen'),
  (2, 10, 'Drievoudig glas'),
  -- 3 Dak/vloer/plafond
  (3, 1, 'Plat dak houtachtig'),
  (3, 2, 'Plat dak (gas)beton'),
  (3, 3, 'Plat dak metaalplaat'),
  (3, 4, 'Hellend dak houtachtig'),
  (3, 5, 'Hellend dak gas(beton)'),
  (3, 6, 'Dakramen'),
  (3, 7, 'Dakkapellen'),
  (3, 8, 'Vloeren'),
  (3, 9, 'Diversen'),
  -- 4 Lichte panelen
  (4, 1, 'Sandwich panelen'),
  (4, 2, 'Samengestelde panelen'),
  (4, 3, 'Deuren'),
  (4, 4, 'Samengestelde vloeren'),
  (4, 5, 'Kozijnen'),
  (4, 6, 'Diversen'),
  -- 5 Enkelvoudige plaat
  (5, 1, 'Spaanplaat/board'),
  (5, 2, 'Triplex/multiplex/meubelplaat'),
  (5, 3, 'Hout/vloerdelen'),
  (5, 4, 'Gipsplaat/asbestcement'),
  (5, 5, 'Mineraalvezels/mineraalwol'),
  (5, 6, 'Kunststof (massief)'),
  (5, 7, 'Metaalplaat'),
  (5, 8, 'Diversen'),
  -- 6 Ventilatie
  (6, 1, 'Openingen/roosters'),
  (6, 2, 'Suskasten'),
  (6, 3, 'Muurdempers'),
  (6, 4, 'Dakdempers'),
  (6, 5, 'Mechanische ventilatie unit'),
  (6, 6, 'Diversen'),
  (6, 7, 'Ventilatie rekenmethode RM'),
  -- 7 Ventilatie oud
  (7, 1, 'Openingen/roosters'),
  (7, 2, 'Suskasten'),
  (7, 3, 'Muurdempers'),
  (7, 4, 'Diversen'),
  -- 8 Lichte scheiding
  (8, 1, 'Gipskarton wanden. U-profielen'),
  (8, 2, 'Gipskarton wanden. Stijlen'),
  (8, 3, 'Spaanplaatachtige wanden'),
  (8, 4, 'Metalen wanden'),
  (8, 5, 'Houtwolcement wanden'),
  (8, 6, 'Schuifbare wanden'),
  (8, 7, 'Diversen'),
  -- 9 Kier/naad
  (9, 1, 'Kierdichtingsprofielen'),
  (9, 2, 'Naaddichtingsprofielen'),
  (9, 3, 'Beglazingsranden');

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS rubriek_nr smallint
    REFERENCES app_gevelwering.material_rubriek (nr);

ALTER TABLE app_gevelwering.material
  ADD COLUMN IF NOT EXISTS subrubriek_nr smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'material_subrubriek_fk'
  ) THEN
    ALTER TABLE app_gevelwering.material
      ADD CONSTRAINT material_subrubriek_fk
      FOREIGN KEY (rubriek_nr, subrubriek_nr)
      REFERENCES app_gevelwering.material_subrubriek (rubriek_nr, nr);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS material_rubriek_nr_idx
  ON app_gevelwering.material (rubriek_nr);
CREATE INDEX IF NOT EXISTS material_rubriek_sub_idx
  ON app_gevelwering.material (rubriek_nr, subrubriek_nr);

COMMENT ON COLUMN app_gevelwering.material.rubriek_nr IS
  'GG rubriek 1–9; master_category mirrors material_rubriek.name.';
COMMENT ON COLUMN app_gevelwering.material.subrubriek_nr IS
  'Subrubriek within rubriek; category column mirrors material_subrubriek.name.';
COMMENT ON COLUMN app_gevelwering.material.master_category IS
  'GG rubriek name (1–9); see app_gevelwering.material_rubriek.';
COMMENT ON COLUMN app_gevelwering.material.category IS
  'GG subrubriek name (category-specific); see app_gevelwering.material_subrubriek.';
