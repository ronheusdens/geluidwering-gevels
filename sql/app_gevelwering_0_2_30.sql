-- app-gevelwering DDL 0.2.30 — 2026-08-14
-- bppServer phase 2: drawing subsection CRUD (shared with Node floormap-api.mjs).

-- ---------------------------------------------------------------------------
-- Geometry helpers (norm-space 0–1 coordinates, jsonb [{x,y},…])
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_gevelwering.fw_is_length_rubriek(p_val text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_val IS NULL OR btrim(p_val) = '' THEN false
    WHEN p_val ~ '^\d+$' AND p_val::int = 9 THEN true
    WHEN lower(p_val) LIKE '%kier%' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_shoelace_area(p_points jsonb)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  i int;
  sum double precision := 0;
  ax double precision;
  ay double precision;
  bx double precision;
  py double precision;
BEGIN
  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) < 3 THEN
    RETURN 0;
  END IF;
  n := jsonb_array_length(p_points);
  FOR i IN 0..(n - 1) LOOP
    ax := (p_points -> i ->> 'x')::double precision;
    ay := (p_points -> i ->> 'y')::double precision;
    bx := (p_points -> ((i + 1) % n) ->> 'x')::double precision;
    py := (p_points -> ((i + 1) % n) ->> 'y')::double precision;
    sum := sum + ax * py - bx * ay;
  END LOOP;
  RETURN abs(sum) / 2.0;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_normalize_ring(p_points jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  i int;
  pt jsonb;
  x double precision;
  y double precision;
  out jsonb := '[]'::jsonb;
  first_x double precision;
  first_y double precision;
  last_x double precision;
  last_y double precision;
BEGIN
  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) < 3 THEN
    RETURN NULL;
  END IF;
  n := jsonb_array_length(p_points);
  FOR i IN 0..(n - 1) LOOP
    pt := p_points -> i;
    x := (pt ->> 'x')::double precision;
    y := (pt ->> 'y')::double precision;
    IF x IS NULL OR y IS NULL OR NOT (x >= -0.05 AND x <= 1.05 AND y >= -0.05 AND y <= 1.05) THEN
      RETURN NULL;
    END IF;
    out := out || jsonb_build_array(jsonb_build_object(
      'x', greatest(0.0, least(1.0, x)),
      'y', greatest(0.0, least(1.0, y))
    ));
  END LOOP;
  first_x := (out -> 0 ->> 'x')::double precision;
  first_y := (out -> 0 ->> 'y')::double precision;
  last_x := (out -> (jsonb_array_length(out) - 1) ->> 'x')::double precision;
  last_y := (out -> (jsonb_array_length(out) - 1) ->> 'y')::double precision;
  IF app_gevelwering.fw_euclid_len(first_x - last_x, first_y - last_y) > 1e-6 THEN
    out := out || jsonb_build_array(jsonb_build_object('x', first_x, 'y', first_y));
  END IF;
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_normalize_path(p_points jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  i int;
  pt jsonb;
  x double precision;
  y double precision;
  out jsonb := '[]'::jsonb;
BEGIN
  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) < 2 THEN
    RETURN NULL;
  END IF;
  n := jsonb_array_length(p_points);
  FOR i IN 0..(n - 1) LOOP
    pt := p_points -> i;
    x := (pt ->> 'x')::double precision;
    y := (pt ->> 'y')::double precision;
    IF x IS NULL OR y IS NULL OR NOT (x >= -0.05 AND x <= 1.05 AND y >= -0.05 AND y <= 1.05) THEN
      RETURN NULL;
    END IF;
    out := out || jsonb_build_array(jsonb_build_object(
      'x', greatest(0.0, least(1.0, x)),
      'y', greatest(0.0, least(1.0, y))
    ));
  END LOOP;
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_normalize_holes(p_raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  holes jsonb := '[]'::jsonb;
  i int;
  ring jsonb;
  norm jsonb;
BEGIN
  IF p_raw IS NULL OR jsonb_typeof(p_raw) <> 'array' OR jsonb_array_length(p_raw) < 1 THEN
    RETURN '[]'::jsonb;
  END IF;
  FOR i IN 0..(jsonb_array_length(p_raw) - 1) LOOP
    norm := app_gevelwering.fw_normalize_ring(p_raw -> i);
    IF norm IS NOT NULL AND app_gevelwering.fw_shoelace_area(norm) > 1e-12 THEN
      holes := holes || jsonb_build_array(norm);
    END IF;
  END LOOP;
  RETURN holes;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_net_area_norm(p_outer jsonb, p_holes jsonb)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  hole_sum double precision := 0;
  i int;
BEGIN
  IF p_holes IS NOT NULL AND jsonb_typeof(p_holes) = 'array' THEN
    FOR i IN 0..(jsonb_array_length(p_holes) - 1) LOOP
      hole_sum := hole_sum + app_gevelwering.fw_shoelace_area(p_holes -> i);
    END LOOP;
  END IF;
  RETURN greatest(0.0, app_gevelwering.fw_shoelace_area(p_outer) - hole_sum);
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_polyline_perimeter(p_points jsonb)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  i int;
  sum double precision := 0;
  ax double precision;
  ay double precision;
  bx double precision;
  py double precision;
BEGIN
  IF p_points IS NULL OR jsonb_array_length(p_points) < 2 THEN RETURN 0; END IF;
  n := jsonb_array_length(p_points);
  FOR i IN 0..(n - 1) LOOP
    ax := (p_points -> i ->> 'x')::double precision;
    ay := (p_points -> i ->> 'y')::double precision;
    bx := (p_points -> ((i + 1) % n) ->> 'x')::double precision;
    py := (p_points -> ((i + 1) % n) ->> 'y')::double precision;
    sum := sum + sqrt((bx - ax) * (bx - ax) + (py - ay) * (py - ay));
  END LOOP;
  RETURN sum;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_open_polyline_length(p_points jsonb)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  i int;
  sum double precision := 0;
BEGIN
  IF p_points IS NULL OR jsonb_array_length(p_points) < 2 THEN RETURN 0; END IF;
  n := jsonb_array_length(p_points);
  FOR i IN 0..(n - 2) LOOP
    sum := sum + sqrt(
      power((p_points -> (i + 1) ->> 'x')::double precision - (p_points -> i ->> 'x')::double precision, 2) +
      power((p_points -> (i + 1) ->> 'y')::double precision - (p_points -> i ->> 'y')::double precision, 2)
    );
  END LOOP;
  RETURN sum;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_normalize_aspect_yx(p_aspect double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_aspect IS NULL OR p_aspect <= 0 OR NOT (p_aspect = p_aspect) THEN 1.0
    ELSE p_aspect
  END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_scaled_area_m2(
  p_area_norm double precision,
  p_mpu double precision,
  p_aspect double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_area_norm * p_mpu * p_mpu * app_gevelwering.fw_normalize_aspect_yx(p_aspect);
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_scaled_path_length(
  p_points jsonb,
  p_mpu double precision,
  p_aspect double precision,
  p_closed boolean
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  mx double precision;
  my double precision;
  n int;
  i int;
  sum double precision := 0;
  dx double precision;
  dy double precision;
BEGIN
  IF p_points IS NULL OR jsonb_array_length(p_points) < 2 OR p_mpu IS NULL OR p_mpu <= 0 THEN
    RETURN 0;
  END IF;
  mx := p_mpu;
  my := p_mpu * app_gevelwering.fw_normalize_aspect_yx(p_aspect);
  n := jsonb_array_length(p_points);
  IF p_closed THEN
    FOR i IN 0..(n - 1) LOOP
      dx := (p_points -> ((i + 1) % n) ->> 'x')::double precision - (p_points -> i ->> 'x')::double precision;
      dy := (p_points -> ((i + 1) % n) ->> 'y')::double precision - (p_points -> i ->> 'y')::double precision;
      sum := sum + sqrt((dx * mx) * (dx * mx) + (dy * my) * (dy * my));
    END LOOP;
  ELSE
    FOR i IN 0..(n - 2) LOOP
      dx := (p_points -> (i + 1) ->> 'x')::double precision - (p_points -> i ->> 'x')::double precision;
      dy := (p_points -> (i + 1) ->> 'y')::double precision - (p_points -> i ->> 'y')::double precision;
      sum := sum + sqrt((dx * mx) * (dx * mx) + (dy * my) * (dy * my));
    END LOOP;
  END IF;
  RETURN sum;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_live_area_m2(
  p_area_norm double precision,
  p_area_m2 double precision,
  p_mpu double precision,
  p_region_mpu double precision,
  p_aspect double precision,
  p_quantity_kind text
)
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_quantity_kind, '') = 'length' THEN NULL
    WHEN coalesce(p_mpu, p_region_mpu) IS NOT NULL
      AND coalesce(p_mpu, p_region_mpu) > 0
      AND p_area_norm IS NOT NULL
      AND p_area_norm > 0
      THEN round(
        app_gevelwering.fw_scaled_area_m2(
          p_area_norm,
          coalesce(p_mpu, p_region_mpu),
          coalesce(p_aspect, 1.0)
        )::numeric,
        2
      )::double precision
    WHEN p_area_m2 IS NOT NULL THEN p_area_m2
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- List / get / delete / reorder
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_drawing_subsections(p_section_id uuid)
RETURNS jsonb
LANGUAGE sql
VOLATILE
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'section_id', p_section_id::text,
    'subsections', coalesce(
      (
        SELECT jsonb_agg(row_data ORDER BY sort_order ASC, created_at ASC)
        FROM (
          SELECT
            s.sort_order,
            s.created_at,
            jsonb_build_object(
              'id', s.id::text,
              'section_id', s.section_id::text,
              'label', s.label,
              'level_hint', s.level_hint,
              'vg_nr', s.vg_nr,
              'vr_nr', s.vr_nr,
              'geom_kind', s.geom_kind,
              'points', s.points,
              'area_norm', s.area_norm,
              'perimeter_norm', s.perimeter_norm,
              'area_m2',
                app_gevelwering.fw_live_area_m2(
                  s.area_norm,
                  s.area_m2,
                  s.metres_per_norm_unit,
                  r.metres_per_norm_unit,
                  r.scale_aspect_yx,
                  coalesce(s.analysis ->> 'quantity_kind', '')
                ),
              'perimeter_m', s.perimeter_m,
              'metres_per_norm_unit', s.metres_per_norm_unit,
              'analysis_status', s.analysis_status,
              'analysis',
                CASE
                  WHEN app_gevelwering.fw_live_area_m2(
                    s.area_norm,
                    s.area_m2,
                    s.metres_per_norm_unit,
                    r.metres_per_norm_unit,
                    r.scale_aspect_yx,
                    coalesce(s.analysis ->> 'quantity_kind', '')
                  ) IS NOT NULL
                  THEN coalesce(s.analysis, '{}'::jsonb) || jsonb_build_object(
                    'area_m2',
                    app_gevelwering.fw_live_area_m2(
                      s.area_norm,
                      s.area_m2,
                      s.metres_per_norm_unit,
                      r.metres_per_norm_unit,
                      r.scale_aspect_yx,
                      coalesce(s.analysis ->> 'quantity_kind', '')
                    )
                  )
                  ELSE coalesce(s.analysis, '{}'::jsonb)
                END,
              'sort_order', s.sort_order,
              'region_mpu', r.metres_per_norm_unit,
              'region_aspect_yx', r.scale_aspect_yx
            ) AS row_data
          FROM app_gevelwering.drawing_subsection s
          JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
          WHERE s.section_id = p_section_id
        ) sub
      ),
      '[]'::jsonb
    )
  );
$$;

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
  WHERE r.id = p_section_id
    AND r.region_kind = ANY (ARRAY['FLOORMAP', 'FACADE', 'SECTION', 'CROSS_SECTION']::text[]);
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_delete_drawing_subsection(p_subsection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text;
BEGIN
  DELETE FROM app_gevelwering.drawing_subsection
  WHERE id = p_subsection_id
  RETURNING id::text INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'subsection not found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'deleted_subsection_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_reorder_drawing_subsections(
  p_section_id uuid,
  p_ordered_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  existing_ids uuid[];
  i int;
BEGIN
  IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'ordered_ids is required';
  END IF;
  IF array_length(p_ordered_ids, 1) <> (SELECT count(*) FROM app_gevelwering.drawing_subsection WHERE section_id = p_section_id) THEN
    RAISE EXCEPTION 'ordered_ids must include every subsection of this section';
  END IF;

  SELECT array_agg(id ORDER BY sort_order ASC, created_at ASC)
  INTO existing_ids
  FROM app_gevelwering.drawing_subsection
  WHERE section_id = p_section_id;

  IF NOT (SELECT bool_and(x = ANY (existing_ids)) FROM unnest(p_ordered_ids) AS x) THEN
    RAISE EXCEPTION 'ordered_ids contains ids not in this section';
  END IF;

  IF (SELECT count(DISTINCT x) FROM unnest(p_ordered_ids) AS x) <> array_length(p_ordered_ids, 1) THEN
    RAISE EXCEPTION 'ordered_ids contains duplicates';
  END IF;

  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    UPDATE app_gevelwering.drawing_subsection
    SET sort_order = i - 1,
        updated_at = now()
    WHERE id = p_ordered_ids[i]
      AND section_id = p_section_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'section_id', p_section_id::text,
    'count', array_length(p_ordered_ids, 1)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Save (port of handleFloormapSubsectionSave)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_gevelwering.fw_save_drawing_subsection(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_section_id uuid;
  v_subsection_id uuid;
  v_label text;
  v_level_hint text;
  v_vg_nr int;
  v_vr_nr text;
  v_points jsonb;
  v_holes jsonb := '[]'::jsonb;
  v_holes_from_body jsonb := '[]'::jsonb;
  v_open_path boolean := false;
  v_wants_length boolean := false;
  v_ring jsonb;
  v_path jsonb;
  v_sec record;
  v_prev_analysis jsonb := '{}'::jsonb;
  v_analysis jsonb := '{}'::jsonb;
  v_area_norm double precision;
  v_peri_norm double precision;
  v_mpu double precision;
  v_aspect double precision;
  v_area_m2 double precision;
  v_peri_m double precision;
  v_quantity_kind text;
  v_body_mpu double precision;
  v_body_aspect double precision;
  v_sec_mpu double precision;
  v_sec_aspect double precision;
  v_next_sort int;
  v_row record;
  v_vg_raw text;
  v_vr_raw text;
  v_dup_id text;
BEGIN
  v_section_id := nullif(btrim(p_payload ->> 'section_id'), '')::uuid;
  IF v_section_id IS NULL THEN
    RAISE EXCEPTION 'invalid section_id';
  END IF;

  IF nullif(btrim(p_payload ->> 'subsection_id'), '') IS NOT NULL THEN
    v_subsection_id := (p_payload ->> 'subsection_id')::uuid;
  END IF;

  v_label := left(coalesce(nullif(btrim(p_payload ->> 'label'), ''), 'Room'), 200);
  v_level_hint := upper(coalesce(nullif(btrim(p_payload ->> 'level_hint'), ''), 'OTHER'));
  IF v_level_hint NOT IN ('GROUND', 'FIRST', 'SECOND', 'THIRD', 'ROOF', 'OTHER') THEN
    v_level_hint := 'OTHER';
  END IF;

  v_wants_length :=
    coalesce(p_payload -> 'analysis' ->> 'quantity_kind', '') = 'length'
    OR coalesce((p_payload ->> 'open_path')::boolean, false)
    OR app_gevelwering.fw_is_length_rubriek(p_payload -> 'analysis' ->> 'master_category')
    OR app_gevelwering.fw_is_length_rubriek(p_payload -> 'analysis' ->> 'rubriek_nr');

  IF v_wants_length THEN
    v_path := app_gevelwering.fw_normalize_path(p_payload -> 'points');
    v_ring := app_gevelwering.fw_normalize_ring(p_payload -> 'points');
    IF coalesce((p_payload ->> 'open_path')::boolean, false) AND v_path IS NOT NULL THEN
      v_points := v_path;
      v_open_path := true;
    ELSIF v_ring IS NOT NULL THEN
      v_points := v_ring;
      v_open_path := false;
    ELSIF v_path IS NOT NULL THEN
      v_points := v_path;
      v_open_path := true;
    END IF;
  ELSE
    v_points := app_gevelwering.fw_normalize_ring(p_payload -> 'points');
  END IF;

  IF v_points IS NULL THEN
    IF v_wants_length THEN
      RAISE EXCEPTION 'kierdichting: pad met ≥2 punten of gesloten polygoon (≥3) in 0–1';
    ELSE
      RAISE EXCEPTION 'points must be a closed polyline with ≥3 vertices in 0–1';
    END IF;
  END IF;

  v_vg_raw := p_payload ->> 'vg_nr';
  v_vr_raw := p_payload ->> 'vr_nr';
  IF v_vg_raw IS NULL OR btrim(v_vg_raw) = '' THEN
    v_vg_nr := NULL;
  ELSE
    IF v_vg_raw !~ '^\d+$' OR (v_vg_raw::int) < 1 THEN
      RAISE EXCEPTION 'VG must be a positive whole number; VR must be like 3 or 3A (letters/digits, max 16)';
    END IF;
    v_vg_nr := v_vg_raw::int;
  END IF;
  IF v_vr_raw IS NULL OR btrim(v_vr_raw) = '' THEN
    v_vr_nr := NULL;
  ELSE
    v_vr_nr := btrim(v_vr_raw);
    IF v_vr_nr !~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$' THEN
      RAISE EXCEPTION 'VG must be a positive whole number; VR must be like 3 or 3A (letters/digits, max 16)';
    END IF;
  END IF;
  IF (v_vg_nr IS NULL) <> (v_vr_nr IS NULL) THEN
    RAISE EXCEPTION 'VG and VR must both be set, or both empty';
  END IF;

  v_holes_from_body := app_gevelwering.fw_normalize_holes(
    coalesce(
      p_payload -> 'holes',
      CASE
        WHEN jsonb_typeof(p_payload -> 'analysis') = 'object' THEN p_payload -> 'analysis' -> 'holes'
        ELSE NULL
      END
    )
  );

  SELECT r.id,
         r.building_id,
         r.document_id,
         r.page_index,
         r.region_kind,
         r.metres_per_norm_unit,
         r.scale_aspect_yx
  INTO v_sec
  FROM app_gevelwering.drawing_region r
  WHERE r.id = v_section_id
    AND r.region_kind = ANY (ARRAY['FLOORMAP', 'FACADE', 'SECTION', 'CROSS_SECTION']::text[]);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scalable section not found';
  END IF;

  IF v_sec.region_kind = 'FLOORMAP' AND (v_vg_nr IS NULL OR v_vr_nr IS NULL) THEN
    RAISE EXCEPTION 'VG and VR numbers are required for floormap rooms';
  END IF;

  IF v_sec.region_kind = 'FLOORMAP' AND v_vr_nr IS NOT NULL THEN
    SELECT s.id::text
    INTO v_dup_id
    FROM app_gevelwering.drawing_subsection s
    JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
    WHERE s.building_id = v_sec.building_id
      AND s.vr_nr IS NOT NULL
      AND lower(s.vr_nr) = lower(v_vr_nr)
      AND r.region_kind = 'FLOORMAP'
      AND (v_subsection_id IS NULL OR s.id <> v_subsection_id)
    LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'VR number already used on another room in this project'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_subsection_id IS NOT NULL THEN
    SELECT analysis
    INTO v_prev_analysis
    FROM app_gevelwering.drawing_subsection
    WHERE id = v_subsection_id
      AND section_id = v_section_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'subsection not found';
    END IF;
    v_analysis := coalesce(v_prev_analysis, '{}'::jsonb);
    IF jsonb_array_length(v_holes_from_body) = 0 THEN
      v_holes := app_gevelwering.fw_normalize_holes(v_prev_analysis -> 'holes');
    END IF;
  END IF;

  IF jsonb_typeof(p_payload -> 'analysis') = 'object' THEN
    v_analysis := v_analysis || (p_payload -> 'analysis');
  END IF;

  IF jsonb_array_length(v_holes_from_body) > 0 THEN
    v_holes := v_holes_from_body;
    v_analysis := v_analysis || jsonb_build_object('holes', v_holes_from_body);
  ELSIF jsonb_array_length(v_holes) > 0 THEN
    v_analysis := v_analysis || jsonb_build_object('holes', v_holes);
  ELSE
    v_analysis := v_analysis - 'holes';
  END IF;

  IF v_open_path THEN
    v_holes := '[]'::jsonb;
    v_analysis := v_analysis - 'holes';
  END IF;

  v_area_norm := CASE WHEN v_open_path THEN 0 ELSE app_gevelwering.fw_net_area_norm(v_points, v_holes) END;
  v_peri_norm := CASE
    WHEN v_open_path THEN app_gevelwering.fw_open_polyline_length(v_points)
    ELSE app_gevelwering.fw_polyline_perimeter(v_points)
  END;

  v_body_mpu := nullif(p_payload ->> 'metres_per_norm_unit', '')::double precision;
  v_sec_mpu := v_sec.metres_per_norm_unit::double precision;
  v_mpu := CASE
    WHEN v_body_mpu IS NOT NULL AND v_body_mpu > 0 THEN v_body_mpu
    WHEN v_sec_mpu IS NOT NULL AND v_sec_mpu > 0 THEN v_sec_mpu
    ELSE NULL
  END;

  v_body_aspect := nullif(p_payload ->> 'scale_aspect_yx', '')::double precision;
  v_sec_aspect := v_sec.scale_aspect_yx::double precision;
  v_aspect := app_gevelwering.fw_normalize_aspect_yx(
    CASE
      WHEN v_body_aspect IS NOT NULL AND v_body_aspect > 0 THEN v_body_aspect
      WHEN v_sec_aspect IS NOT NULL AND v_sec_aspect > 0 THEN v_sec_aspect
      ELSE 1.0
    END
  );

  IF v_mpu IS NOT NULL THEN
    v_area_m2 := round(app_gevelwering.fw_scaled_area_m2(v_area_norm, v_mpu, v_aspect)::numeric, 2)::double precision;
    v_peri_m := round(
      app_gevelwering.fw_scaled_path_length(v_points, v_mpu, v_aspect, NOT v_open_path)::numeric,
      2
    )::double precision;
  ELSE
    v_area_m2 := NULL;
    v_peri_m := NULL;
  END IF;

  v_quantity_kind := CASE
    WHEN v_wants_length
      OR app_gevelwering.fw_is_length_rubriek(v_analysis ->> 'master_category')
      OR app_gevelwering.fw_is_length_rubriek(v_analysis ->> 'rubriek_nr')
      THEN 'length'
    ELSE 'area'
  END;

  IF v_quantity_kind = 'length' THEN
    v_analysis := v_analysis
      || jsonb_build_object(
        'quantity_kind', 'length',
        'length_norm', v_peri_norm,
        'open_path', v_open_path
      );
    IF v_peri_m IS NOT NULL THEN
      v_analysis := v_analysis || jsonb_build_object('length_m', v_peri_m);
    ELSE
      v_analysis := v_analysis - 'length_m';
    END IF;
    v_analysis := v_analysis - 'area_m2' - 'area_norm';
  ELSE
    v_analysis := v_analysis - 'quantity_kind' - 'length_m' - 'length_norm' - 'open_path';
    v_analysis := v_analysis || jsonb_build_object('area_norm', v_area_norm);
    IF v_area_m2 IS NOT NULL THEN
      v_analysis := v_analysis || jsonb_build_object('area_m2', v_area_m2);
    ELSE
      v_analysis := v_analysis - 'area_m2';
    END IF;
  END IF;

  IF v_subsection_id IS NOT NULL THEN
    UPDATE app_gevelwering.drawing_subsection
    SET label = v_label,
        level_hint = v_level_hint,
        vg_nr = v_vg_nr,
        vr_nr = v_vr_nr,
        points = v_points,
        area_norm = v_area_norm,
        perimeter_norm = v_peri_norm,
        area_m2 = v_area_m2,
        perimeter_m = v_peri_m,
        metres_per_norm_unit = v_mpu,
        analysis = v_analysis,
        analysis_status = 'READY_FOR_ANALYSIS',
        updated_at = now()
    WHERE id = v_subsection_id
      AND section_id = v_section_id
    RETURNING * INTO v_row;
  ELSE
    SELECT coalesce(max(sort_order), -1) + 1
    INTO v_next_sort
    FROM app_gevelwering.drawing_subsection
    WHERE section_id = v_section_id;

    INSERT INTO app_gevelwering.drawing_subsection (
      section_id,
      building_id,
      document_id,
      page_index,
      label,
      level_hint,
      vg_nr,
      vr_nr,
      geom_kind,
      points,
      area_norm,
      perimeter_norm,
      area_m2,
      perimeter_m,
      metres_per_norm_unit,
      analysis,
      analysis_status,
      sort_order,
      created_by
    )
    VALUES (
      v_section_id,
      v_sec.building_id,
      v_sec.document_id,
      v_sec.page_index,
      v_label,
      v_level_hint,
      v_vg_nr,
      v_vr_nr,
      'POLYLINE',
      v_points,
      v_area_norm,
      v_peri_norm,
      v_area_m2,
      v_peri_m,
      v_mpu,
      coalesce(v_analysis, '{}'::jsonb),
      'READY_FOR_ANALYSIS',
      v_next_sort,
      p_user_id
    )
    RETURNING * INTO v_row;
  END IF;

  IF v_sec.region_kind = 'FLOORMAP'
    AND v_quantity_kind = 'area'
    AND v_area_m2 IS NOT NULL
  THEN
    UPDATE app_gevelwering.verblijfsruimte
    SET vloer_m2 = v_area_m2,
        volume_m3 = CASE
          WHEN hoogte_m > 0 THEN round((v_area_m2 * hoogte_m)::numeric, 2)
          ELSE volume_m3
        END,
        ga_dba = NULL,
        lbi_dba = NULL,
        gak_dba = NULL,
        updated_at = now()
    WHERE subsection_id = v_row.id;
  END IF;

  IF v_sec.region_kind <> 'FLOORMAP'
    AND v_quantity_kind = 'area'
    AND v_area_m2 IS NOT NULL
  THEN
    UPDATE app_gevelwering.vlak
    SET area_m2 = v_area_m2,
        updated_at = now()
    WHERE facade_subsection_id = v_row.id;

    UPDATE app_gevelwering.verblijfsruimte vr
    SET ga_dba = NULL,
        lbi_dba = NULL,
        gak_dba = NULL,
        updated_at = now()
    FROM app_gevelwering.vlak v
    WHERE v.verblijfsruimte_id = vr.id
      AND v.facade_subsection_id = v_row.id;
  ELSIF v_sec.region_kind <> 'FLOORMAP'
    AND v_quantity_kind = 'length'
    AND v_peri_m IS NOT NULL
  THEN
    UPDATE app_gevelwering.verblijfsruimte vr
    SET ga_dba = NULL,
        lbi_dba = NULL,
        gak_dba = NULL,
        updated_at = now()
    FROM app_gevelwering.vlak v
    WHERE v.verblijfsruimte_id = vr.id
      AND v.facade_subsection_id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'subsection_id', v_row.id::text,
    'vg_nr', v_row.vg_nr,
    'vr_nr', v_row.vr_nr,
    'area_norm', v_row.area_norm,
    'perimeter_norm', v_row.perimeter_norm,
    'area_m2', v_row.area_m2,
    'perimeter_m', v_row.perimeter_m,
    'metres_per_norm_unit', v_row.metres_per_norm_unit,
    'analysis', coalesce(v_row.analysis, '{}'::jsonb)
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'VR number already used on another room in this project';
END;
$$;
