-- app-gevelwering DDL 0.2.59 — 2026-10-05
-- Document view rotation (0/90/180/270) for engineer PDF review + floormap crops.

ALTER TABLE app_gevelwering.document
  ADD COLUMN IF NOT EXISTS view_rotate integer NOT NULL DEFAULT 0;

ALTER TABLE app_gevelwering.document
  DROP CONSTRAINT IF EXISTS document_view_rotate_check;

ALTER TABLE app_gevelwering.document
  ADD CONSTRAINT document_view_rotate_check
  CHECK (view_rotate IN (0, 90, 180, 270));

COMMENT ON COLUMN app_gevelwering.document.view_rotate IS
  'Extra CW rotation degrees applied on top of PDF page /Rotate when rendering '
  '(engineer review + floormap crops). Region coords are in this viewport space.';

-- Rotate a single {x,y} point by delta degrees CW in normalized [0,1] space.
CREATE OR REPLACE FUNCTION app_gevelwering.fw_rotate_norm_point(
  p_x double precision,
  p_y double precision,
  p_delta integer
) RETURNS double precision[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  x double precision := COALESCE(p_x, 0);
  y double precision := COALESCE(p_y, 0);
  d integer := ((COALESCE(p_delta, 0) % 360) + 360) % 360;
  nx double precision;
  ny double precision;
BEGIN
  IF d = 0 THEN
    RETURN ARRAY[x, y];
  ELSIF d = 90 THEN
    -- CW: (x,y) → (y, 1-x)
    RETURN ARRAY[y, 1.0 - x];
  ELSIF d = 180 THEN
    RETURN ARRAY[1.0 - x, 1.0 - y];
  ELSIF d = 270 THEN
    -- CW 270 = CCW 90: (x,y) → (1-y, x)
    RETURN ARRAY[1.0 - y, x];
  END IF;
  RETURN ARRAY[x, y];
END;
$$;

-- Rotate a JSON array of {x,y} points.
CREATE OR REPLACE FUNCTION app_gevelwering.fw_rotate_norm_points(
  p_points jsonb,
  p_delta integer
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d integer := ((COALESCE(p_delta, 0) % 360) + 360) % 360;
  out jsonb := '[]'::jsonb;
  pt jsonb;
  xy double precision[];
  i integer;
  n integer;
BEGIN
  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' OR d = 0 THEN
    RETURN COALESCE(p_points, '[]'::jsonb);
  END IF;
  n := jsonb_array_length(p_points);
  FOR i IN 0 .. n - 1 LOOP
    pt := p_points -> i;
    xy := app_gevelwering.fw_rotate_norm_point(
      (pt ->> 'x')::double precision,
      (pt ->> 'y')::double precision,
      d
    );
    out := out || jsonb_build_array(jsonb_build_object('x', xy[1], 'y', xy[2]));
  END LOOP;
  RETURN out;
END;
$$;

-- Rotate axis-aligned norm box; returns [x_min,y_min,x_max,y_max].
CREATE OR REPLACE FUNCTION app_gevelwering.fw_rotate_norm_box(
  p_xmin double precision,
  p_ymin double precision,
  p_xmax double precision,
  p_ymax double precision,
  p_delta integer
) RETURNS double precision[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d integer := ((COALESCE(p_delta, 0) % 360) + 360) % 360;
  c1 double precision[];
  c2 double precision[];
  c3 double precision[];
  c4 double precision[];
  xmin double precision;
  ymin double precision;
  xmax double precision;
  ymax double precision;
BEGIN
  IF d = 0 THEN
    RETURN ARRAY[p_xmin, p_ymin, p_xmax, p_ymax];
  END IF;
  c1 := app_gevelwering.fw_rotate_norm_point(p_xmin, p_ymin, d);
  c2 := app_gevelwering.fw_rotate_norm_point(p_xmax, p_ymin, d);
  c3 := app_gevelwering.fw_rotate_norm_point(p_xmax, p_ymax, d);
  c4 := app_gevelwering.fw_rotate_norm_point(p_xmin, p_ymax, d);
  xmin := LEAST(c1[1], c2[1], c3[1], c4[1]);
  ymin := LEAST(c1[2], c2[2], c3[2], c4[2]);
  xmax := GREATEST(c1[1], c2[1], c3[1], c4[1]);
  ymax := GREATEST(c1[2], c2[2], c3[2], c4[2]);
  RETURN ARRAY[xmin, ymin, xmax, ymax];
END;
$$;

-- Set absolute view_rotate; transform all regions/subsections by the delta.
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
      -- mpu is width-based; after ±90° old height becomes new width.
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

    UPDATE app_gevelwering.drawing_subsection s
    SET
      points = app_gevelwering.fw_rotate_norm_points(s.points, v_delta),
      analysis = CASE
        WHEN s.analysis IS NULL OR s.analysis -> 'holes' IS NULL THEN s.analysis
        ELSE s.analysis || jsonb_build_object(
          'holes', (
            SELECT COALESCE(jsonb_agg(app_gevelwering.fw_rotate_norm_points(h, v_delta)), '[]'::jsonb)
            FROM jsonb_array_elements(s.analysis -> 'holes') AS h
          )
        )
      END,
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

-- Include view_rotate on floormap section payloads.
CREATE OR REPLACE FUNCTION app_gevelwering.fw_get_floormap_section(p_section_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN r.id IS NULL THEN jsonb_build_object('ok', false, 'error', 'scalable section not found')
    ELSE jsonb_build_object(
      'ok', true,
      'section', jsonb_build_object(
        'id', r.id::text,
        'document_id', r.document_id::text,
        'page_index', r.page_index,
        'label', r.label,
        'region_kind', r.region_kind,
        'x_min', r.x_min,
        'y_min', r.y_min,
        'x_max', r.x_max,
        'y_max', r.y_max,
        'scale_ratio', r.scale_ratio,
        'metres_per_norm_unit', r.metres_per_norm_unit,
        'scale_aspect_yx', r.scale_aspect_yx,
        'scale_source', r.scale_source,
        'view_rotate', COALESCE(d.view_rotate, 0),
        'analysis_status', r.analysis_status,
        'room_count', (
          SELECT count(*)::int
          FROM app_gevelwering.drawing_subsection s
          WHERE s.section_id = r.id
        )
      )
    )
  END
  FROM app_gevelwering.drawing_region r
  LEFT JOIN app_gevelwering.document d ON d.id = r.document_id
  WHERE r.id = p_section_id
    AND r.region_kind = ANY (ARRAY['FLOORMAP', 'FACADE', 'SECTION', 'CROSS_SECTION']::text[]);
$$;
