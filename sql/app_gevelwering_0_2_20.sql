-- Allow the same VR on multiple façade/section components (for GA insulation).
-- Floormap room VR uniqueness is enforced in floormap-api (FLOORMAP only).

DROP INDEX IF EXISTS app_gevelwering.drawing_subsection_building_vr_nr_uidx;
