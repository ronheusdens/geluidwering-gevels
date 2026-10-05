-- app-gevelwering DDL 0.2.50 — 2026-09-13
-- Na schaal (her)kalibratie: alle metrische snapshots van een sectie herberekenen.
-- Geometrie (norm-punten) blijft; area_m2 / perimeter_m / length_m / seal.length_m
-- + VR-vloer / vlak-area; GA-resultaten wissen.
--
-- Let op: loop-record mag niet `r` heten — dat schaduwt table-alias `r` in PL/pgSQL
-- en geeft "record r is not assigned yet" vóór de eerste FOR-iteratie.

CREATE OR REPLACE FUNCTION app_gevelwering.fw_recompute_section_metrics(p_section_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
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
$$;

COMMENT ON FUNCTION app_gevelwering.fw_recompute_section_metrics(uuid) IS
  'Na schaalwijziging: herbereken area_m2/perimeter_m/length_m/seal.length_m voor alle subsections; sync VR-vloer en vlak; wis GA.';
