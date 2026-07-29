-- Acoustics DDL 0.2.24 — anisotropic scale for non-square floormap crops
-- metres_per_norm_unit = metres for full section width (Δx_norm = 1).
-- scale_aspect_yx = cropHeight/cropWidth; Δy_norm = 1 spans mpu * aspect metres.
-- Area_m2 = area_norm * mpu * mpu * aspect; lengths use separate mx/my axes.

ALTER TABLE app_gevelwering.drawing_region
  ADD COLUMN IF NOT EXISTS scale_aspect_yx double precision;

COMMENT ON COLUMN app_gevelwering.drawing_region.metres_per_norm_unit IS
  'Metres for Δx_norm = 1 (full section/crop width). Pair with scale_aspect_yx for Y.';

COMMENT ON COLUMN app_gevelwering.drawing_region.scale_aspect_yx IS
  'Pixel aspect height/width of the scaled section crop. NULL/≤0 means treat as 1 (legacy).';
