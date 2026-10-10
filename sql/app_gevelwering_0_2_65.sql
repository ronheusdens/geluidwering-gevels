-- app-gevelwering DDL 0.2.65 — 2026-10-07
-- Subsection points/holes are SECTION-LOCAL (0–1 within the crop).
-- When view_rotate changes, only page-norm region boxes move; local room
-- polygons must stay put (same crop content, same local axes).
-- Previous fw_set_document_view_rotate wrongly applied page-norm rotation to
-- points — that broke overlays after rotate (Koninginneweg 168).

CREATE OR REPLACE FUNCTION app_gevelwering.fw_set_document_view_rotate(
  p_document_id uuid,
  p_view_rotate integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_old integer;
  v_new integer;
  v_delta integer;
  r RECORD;
  box double precision[];
  old_mpu double precision;
  old_aspect double precision;
  new_mpu double precision;
  new_aspect double precision;
  n integer;
  region_count integer := 0;
  sub_count integer := 0;
BEGIN
  v_new := ((COALESCE(p_view_rotate, 0) % 360) + 360) % 360;
  IF v_new NOT IN (0, 90, 180, 270) THEN
    RAISE EXCEPTION 'view_rotate must be 0, 90, 180 or 270';
  END IF;

  SELECT view_rotate INTO v_old
  FROM app_gevelwering.document
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'document not found';
  END IF;

  v_delta := ((v_new - v_old) % 360 + 360) % 360;
  IF v_delta = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'document_id', p_document_id,
      'view_rotate', v_new,
      'delta', 0,
      'regions', 0,
      'subsections', 0
    );
  END IF;

  FOR r IN
    SELECT id, x_min, y_min, x_max, y_max, metres_per_norm_unit, scale_aspect_yx
    FROM app_gevelwering.drawing_region
    WHERE document_id = p_document_id
  LOOP
    box := app_gevelwering.fw_rotate_norm_box(r.x_min, r.y_min, r.x_max, r.y_max, v_delta);
    old_mpu := r.metres_per_norm_unit;
    old_aspect := COALESCE(NULLIF(r.scale_aspect_yx, 0), 1);
    IF v_delta IN (90, 270) AND old_mpu IS NOT NULL AND old_mpu > 0 THEN
      new_mpu := old_mpu * old_aspect;
      new_aspect := 1.0 / old_aspect;
    ELSE
      new_mpu := old_mpu;
      new_aspect := r.scale_aspect_yx;
    END IF;

    UPDATE app_gevelwering.drawing_region
    SET
      x_min = box[1],
      y_min = box[2],
      x_max = box[3],
      y_max = box[4],
      width_norm = box[3] - box[1],
      height_norm = box[4] - box[2],
      area_norm = (box[3] - box[1]) * (box[4] - box[2]),
      perimeter_norm = 2.0 * ((box[3] - box[1]) + (box[4] - box[2])),
      metres_per_norm_unit = new_mpu,
      scale_aspect_yx = new_aspect,
      updated_at = now()
    WHERE id = r.id;
    region_count := region_count + 1;

    -- Do NOT rotate section-local points/holes — only sync scale snapshot.
    UPDATE app_gevelwering.drawing_subsection s
    SET
      metres_per_norm_unit = COALESCE(new_mpu, s.metres_per_norm_unit),
      updated_at = now()
    WHERE s.section_id = r.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    sub_count := sub_count + n;
  END LOOP;

  UPDATE app_gevelwering.document
  SET view_rotate = v_new, updated_at = now()
  WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'view_rotate', v_new,
    'delta', v_delta,
    'regions', region_count,
    'subsections', sub_count
  );
END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_set_document_view_rotate(uuid, integer) IS
  'Set document view_rotate; rotate page-norm region boxes (+ mpu aspect). Subsection points stay section-local.';
