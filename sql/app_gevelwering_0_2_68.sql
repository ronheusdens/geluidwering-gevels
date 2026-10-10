-- app-gevelwering DDL 0.2.68 — 2026-10-08
-- Kozijnhout-oppervlak = Σ(balklengte × balkbreedte), niet de gevulde openingscontour.
-- Helper + override in save/recompute zodat GA/floormap dezelfde m² zien.

CREATE OR REPLACE FUNCTION app_gevelwering.fw_kozijn_wood_beam_metrics(
  p_frame jsonb,
  p_mpu double precision,
  p_aspect double precision
)
RETURNS TABLE (
  length_m double precision,
  area_m2 double precision,
  area_norm double precision
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  seg jsonb;
  pts jsonb;
  n int;
  i int;
  w double precision;
  edge_len double precision;
  sum_len double precision := 0;
  sum_area double precision := 0;
  pair jsonb;
  mx double precision;
  my double precision;
  aspect double precision;
BEGIN
  IF p_frame IS NULL OR jsonb_typeof(p_frame) <> 'object' THEN
    RETURN;
  END IF;
  IF p_mpu IS NULL OR p_mpu <= 0 OR p_mpu <> p_mpu THEN
    RETURN;
  END IF;
  IF jsonb_typeof(p_frame -> 'segments') <> 'array' THEN
    RETURN;
  END IF;

  aspect := app_gevelwering.fw_normalize_aspect_yx(p_aspect);
  mx := p_mpu;
  my := p_mpu * aspect;

  FOR seg IN SELECT value FROM jsonb_array_elements(p_frame -> 'segments')
  LOOP
    IF jsonb_typeof(seg) <> 'object' THEN
      CONTINUE;
    END IF;
    pts := seg -> 'points';
    IF jsonb_typeof(pts) <> 'array' THEN
      CONTINUE;
    END IF;
    n := jsonb_array_length(pts);
    IF n < 2 THEN
      CONTINUE;
    END IF;
    w := coalesce(nullif(seg ->> 'width_m', '')::double precision, 0.067);
    IF w IS NULL OR w <= 0 OR w <> w THEN
      w := 0.067;
    END IF;
    FOR i IN 0..(n - 2) LOOP
      pair := jsonb_build_array(pts -> i, pts -> (i + 1));
      edge_len := app_gevelwering.fw_scaled_path_length(pair, p_mpu, aspect, false);
      IF edge_len IS NOT NULL AND edge_len > 0 THEN
        sum_len := sum_len + edge_len;
        sum_area := sum_area + edge_len * w;
      END IF;
    END LOOP;
  END LOOP;

  IF sum_len <= 0 THEN
    RETURN;
  END IF;

  length_m := round(sum_len::numeric, 2)::double precision;
  area_m2 := round(sum_area::numeric, 2)::double precision;
  area_norm := CASE WHEN mx * my > 0 THEN sum_area / (mx * my) ELSE 0 END;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_kozijn_wood_beam_metrics(jsonb, double precision, double precision) IS
  'Kozijnhout: som balklengte × breedte (m / m² / norm-area).';

CREATE OR REPLACE FUNCTION app_gevelwering.fw_save_drawing_subsection(p_user_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
  IF v_level_hint NOT IN ('SOUTERRAIN', 'GROUND', 'BEL_ETAGE', 'FIRST', 'SECOND', 'THIRD', 'ROOF', 'OTHER') THEN
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

  -- Uniek is de combinatie VG+VR (zelfde VR in een andere VG mag).
  IF v_sec.region_kind = 'FLOORMAP' AND v_vg_nr IS NOT NULL AND v_vr_nr IS NOT NULL THEN
    SELECT s.id::text
    INTO v_dup_id
    FROM app_gevelwering.drawing_subsection s
    JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
    WHERE s.building_id = v_sec.building_id
      AND s.vg_nr IS NOT NULL
      AND s.vr_nr IS NOT NULL
      AND s.vg_nr = v_vg_nr
      AND lower(s.vr_nr) = lower(v_vr_nr)
      AND r.region_kind = 'FLOORMAP'
      AND (v_subsection_id IS NULL OR s.id <> v_subsection_id)
    LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'VG/VR combination already used on another room in this project'
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

  -- Kozijnhout: oppervlak = Σ(balklengte × breedte), omtrek = balklengte.
  IF coalesce(v_analysis ->> 'kozijn_role', '') = 'wood'
     AND jsonb_typeof(v_analysis -> 'kozijn_frame') = 'object'
     AND v_mpu IS NOT NULL THEN
    SELECT m.length_m, m.area_m2, m.area_norm
      INTO v_peri_m, v_area_m2, v_area_norm
    FROM app_gevelwering.fw_kozijn_wood_beam_metrics(v_analysis -> 'kozijn_frame', v_mpu, v_aspect) m;
    IF v_area_m2 IS NOT NULL THEN
      v_analysis := v_analysis || jsonb_build_object(
        'kozijn_frame',
        coalesce(v_analysis -> 'kozijn_frame', '{}'::jsonb)
          || jsonb_build_object(
            'wood_beam_length_m', v_peri_m,
            'wood_area_m2', v_area_m2
          )
      );
    END IF;
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
    RAISE EXCEPTION 'VG/VR combination already used on another room in this project';
END;
$function$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_recompute_section_metrics(p_section_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_mpu double precision;
  v_aspect double precision;
  v_kind text;
  sub record;
  v_analysis jsonb;
  v_holes jsonb;
  v_open boolean;
  v_qk text;
  v_area_norm double precision;
  v_peri_norm double precision;
  v_area_m2 double precision;
  v_peri_m double precision;
  v_seal jsonb;
  v_seal_len double precision;
  v_n_sub int := 0;
  v_n_vr_floor int := 0;
  v_n_vlak int := 0;
  v_n_ga int := 0;
  v_pts int;
  dx0 double precision;
  dy0 double precision;
BEGIN
  SELECT
    dr.metres_per_norm_unit::double precision,
    app_gevelwering.fw_normalize_aspect_yx(dr.scale_aspect_yx::double precision),
    dr.region_kind
  INTO v_mpu, v_aspect, v_kind
  FROM app_gevelwering.drawing_region dr
  WHERE dr.id = p_section_id
    AND dr.region_kind IN ('FLOORMAP', 'FACADE', 'SECTION', 'CROSS_SECTION');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scalable section not found';
  END IF;
  IF v_mpu IS NULL OR v_mpu <= 0 OR v_mpu <> v_mpu THEN
    RAISE EXCEPTION 'section has no valid metres_per_norm_unit';
  END IF;

  FOR sub IN
    SELECT s.id, s.points, s.analysis
    FROM app_gevelwering.drawing_subsection s
    WHERE s.section_id = p_section_id
  LOOP
    v_n_sub := v_n_sub + 1;
    v_analysis := CASE
      WHEN jsonb_typeof(sub.analysis) = 'object' THEN sub.analysis
      ELSE '{}'::jsonb
    END;
    v_holes := app_gevelwering.fw_normalize_holes(v_analysis -> 'holes');
    v_qk := coalesce(nullif(btrim(v_analysis ->> 'quantity_kind'), ''), 'area');
    v_pts := coalesce(jsonb_array_length(sub.points), 0);

    v_open := coalesce(v_analysis ->> 'open_path', '') IN ('true', 't', '1');
    IF NOT v_open AND v_qk = 'length' AND v_pts >= 2 THEN
      dx0 := (sub.points -> 0 ->> 'x')::double precision
           - (sub.points -> (v_pts - 1) ->> 'x')::double precision;
      dy0 := (sub.points -> 0 ->> 'y')::double precision
           - (sub.points -> (v_pts - 1) ->> 'y')::double precision;
      v_open := app_gevelwering.fw_euclid_len(dx0, dy0) > 1e-6;
    END IF;

    IF v_open OR v_qk = 'length' THEN
      v_area_norm := 0;
    ELSE
      v_area_norm := app_gevelwering.fw_net_area_norm(sub.points, v_holes);
    END IF;

    IF v_open THEN
      v_peri_norm := app_gevelwering.fw_open_polyline_length(sub.points);
    ELSE
      v_peri_norm := app_gevelwering.fw_polyline_perimeter(sub.points);
    END IF;

    IF v_area_norm > 0 THEN
      v_area_m2 := round(
        app_gevelwering.fw_scaled_area_m2(v_area_norm, v_mpu, v_aspect)::numeric,
        2
      )::double precision;
    ELSE
      v_area_m2 := NULL;
    END IF;

    IF v_pts >= 2 THEN
      v_peri_m := round(
        app_gevelwering.fw_scaled_path_length(sub.points, v_mpu, v_aspect, NOT v_open)::numeric,
        2
      )::double precision;
    ELSE
      v_peri_m := NULL;
    END IF;

    -- Kozijnhout: lengte × breedte (schaalwijziging herberekent vanuit segments).
    IF coalesce(v_analysis ->> 'kozijn_role', '') = 'wood'
       AND jsonb_typeof(v_analysis -> 'kozijn_frame') = 'object' THEN
      SELECT m.length_m, m.area_m2, m.area_norm
        INTO v_peri_m, v_area_m2, v_area_norm
      FROM app_gevelwering.fw_kozijn_wood_beam_metrics(v_analysis -> 'kozijn_frame', v_mpu, v_aspect) m;
      IF v_area_m2 IS NOT NULL THEN
        v_analysis := v_analysis || jsonb_build_object(
          'kozijn_frame',
          coalesce(v_analysis -> 'kozijn_frame', '{}'::jsonb)
            || jsonb_build_object(
              'wood_beam_length_m', v_peri_m,
              'wood_area_m2', v_area_m2
            )
        );
      END IF;
    END IF;

    IF v_qk = 'length' THEN
      v_analysis := v_analysis || jsonb_build_object(
        'quantity_kind', 'length',
        'length_norm', v_peri_norm,
        'open_path', v_open
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

    -- Kierdichting: omtrek in meters opnieuw (gesloten pad)
    v_seal := v_analysis -> 'seal';
    IF jsonb_typeof(v_seal) = 'object'
       AND coalesce(v_seal ->> 'enabled', '') IN ('true', 't', '1')
       AND v_pts >= 2 THEN
      v_seal_len := round(
        app_gevelwering.fw_scaled_path_length(sub.points, v_mpu, v_aspect, true)::numeric,
        2
      )::double precision;
      v_analysis := jsonb_set(
        v_analysis,
        '{seal,length_m}',
        to_jsonb(v_seal_len),
        true
      );
    END IF;

    UPDATE app_gevelwering.drawing_subsection
    SET metres_per_norm_unit = v_mpu,
        area_norm = v_area_norm,
        perimeter_norm = v_peri_norm,
        area_m2 = v_area_m2,
        perimeter_m = v_peri_m,
        analysis = v_analysis,
        updated_at = now()
    WHERE id = sub.id;

    IF v_kind = 'FLOORMAP'
       AND v_qk <> 'length'
       AND v_area_m2 IS NOT NULL THEN
      UPDATE app_gevelwering.verblijfsruimte
      SET vloer_m2 = v_area_m2,
          volume_m3 = CASE
            WHEN hoogte_m > 0 THEN round((v_area_m2 * hoogte_m)::numeric, 2)
            ELSE volume_m3
          END,
          updated_at = now()
      WHERE subsection_id = sub.id;
      IF FOUND THEN
        v_n_vr_floor := v_n_vr_floor + 1;
      END IF;
    END IF;

    IF v_kind <> 'FLOORMAP'
       AND v_qk <> 'length'
       AND v_area_m2 IS NOT NULL THEN
      UPDATE app_gevelwering.vlak
      SET area_m2 = v_area_m2,
          updated_at = now()
      WHERE facade_subsection_id = sub.id;
      IF FOUND THEN
        v_n_vlak := v_n_vlak + 1;
      END IF;
    END IF;
  END LOOP;

  -- GA-resultaten wissen voor alle VR’s gekoppeld aan deze sectie
  WITH touched AS (
    UPDATE app_gevelwering.verblijfsruimte vr
    SET ga_dba = NULL, lbi_dba = NULL, gak_dba = NULL, updated_at = now()
    WHERE (
            vr.subsection_id IN (
              SELECT id FROM app_gevelwering.drawing_subsection WHERE section_id = p_section_id
            )
         OR vr.id IN (
              SELECT v.verblijfsruimte_id
              FROM app_gevelwering.vlak v
              JOIN app_gevelwering.drawing_subsection s ON s.id = v.facade_subsection_id
              WHERE s.section_id = p_section_id
            )
          )
      AND (vr.ga_dba IS NOT NULL OR vr.lbi_dba IS NOT NULL OR vr.gak_dba IS NOT NULL)
    RETURNING vr.id
  )
  SELECT count(*)::int INTO v_n_ga FROM touched;

  RETURN jsonb_build_object(
    'ok', true,
    'section_id', p_section_id::text,
    'metres_per_norm_unit', v_mpu,
    'scale_aspect_yx', v_aspect,
    'subsections', v_n_sub,
    'verblijfsruimten_vloer', v_n_vr_floor,
    'vlakken', v_n_vlak,
    'ga_cleared', v_n_ga
  );
END;
$function$;


-- Eenmalig: bestaande kozijn-houtcomponenten herberekend.
WITH wood AS (
  SELECT
    s.id,
    m.length_m,
    m.area_m2,
    m.area_norm
  FROM app_gevelwering.drawing_subsection s
  CROSS JOIN LATERAL app_gevelwering.fw_kozijn_wood_beam_metrics(
    s.analysis -> 'kozijn_frame',
    coalesce(
      s.metres_per_norm_unit,
      (SELECT dr.metres_per_norm_unit FROM app_gevelwering.drawing_region dr WHERE dr.id = s.section_id)
    ),
    coalesce(
      (
        SELECT app_gevelwering.fw_normalize_aspect_yx(dr.scale_aspect_yx::double precision)
        FROM app_gevelwering.drawing_region dr
        WHERE dr.id = s.section_id
      ),
      1.0
    )
  ) m
  WHERE coalesce(s.analysis ->> 'kozijn_role', '') = 'wood'
    AND jsonb_typeof(s.analysis -> 'kozijn_frame') = 'object'
    AND m.area_m2 IS NOT NULL
)
UPDATE app_gevelwering.drawing_subsection s
SET
  area_m2 = w.area_m2,
  area_norm = w.area_norm,
  perimeter_m = w.length_m,
  analysis = s.analysis
    || jsonb_build_object('area_m2', w.area_m2, 'area_norm', w.area_norm)
    || jsonb_build_object(
      'kozijn_frame',
      coalesce(s.analysis -> 'kozijn_frame', '{}'::jsonb)
        || jsonb_build_object(
          'wood_beam_length_m', w.length_m,
          'wood_area_m2', w.area_m2
        )
    ),
  updated_at = now()
FROM wood w
WHERE s.id = w.id;

UPDATE app_gevelwering.vlak v
SET area_m2 = s.area_m2,
    updated_at = now()
FROM app_gevelwering.drawing_subsection s
WHERE v.facade_subsection_id = s.id
  AND coalesce(s.analysis ->> 'kozijn_role', '') = 'wood'
  AND s.area_m2 IS NOT NULL;

COMMENT ON FUNCTION app_gevelwering.fw_save_drawing_subsection(uuid, jsonb) IS
  'Save subsection; kozijn_role=wood gebruikt lengte×breedte i.p.v. gevulde contour.';
