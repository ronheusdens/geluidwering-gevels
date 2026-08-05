-- Acoustics DDL 0.2.27 — orientatie op gevelvlak (basis Lb per gevel → CL)
-- Compass: N NO O ZO Z ZW W NW (Dutch short codes)

ALTER TABLE app_gevelwering.vlak
  ADD COLUMN IF NOT EXISTS orientatie text NOT NULL DEFAULT '';

ALTER TABLE app_gevelwering.vlak
  DROP CONSTRAINT IF EXISTS vlak_orientatie_check;

ALTER TABLE app_gevelwering.vlak
  ADD CONSTRAINT vlak_orientatie_check CHECK (
    orientatie = ''
    OR orientatie IN ('N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW')
  );

COMMENT ON COLUMN app_gevelwering.vlak.orientatie IS
  'Windrichting van het gevelvlak (N/NO/O/ZO/Z/ZW/W/NW). Basis voor koppeling geluidbelasting per geveloriëntatie en bepaling CL.';
