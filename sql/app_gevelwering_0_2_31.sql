-- app-gevelwering DDL 0.2.31 — 2026-08-14
-- bppServer phase 3: VR façade components for GA (port handleFloormapVrComponentsList).

CREATE OR REPLACE FUNCTION app_gevelwering.fw_ga_same_vr_nr(a text, b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT a IS NOT NULL
    AND b IS NOT NULL
    AND length(btrim(a)) > 0
    AND lower(btrim(a)) = lower(btrim(b));
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_jsonb_find_row(p_rows jsonb, p_id text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  i int;
  n int;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR p_id IS NULL OR btrim(p_id) = '' THEN
    RETURN NULL;
  END IF;
  n := jsonb_array_length(p_rows);
  FOR i IN 0..(n - 1) LOOP
    IF (p_rows -> i ->> 'id') = p_id THEN
      RETURN p_rows -> i;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_live_length_m_from_row(p_row jsonb)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_row -> 'analysis' ->> 'length_m' IS NOT NULL
      AND (p_row -> 'analysis' ->> 'length_m') ~ '^-?\d'
      THEN round((p_row -> 'analysis' ->> 'length_m')::numeric, 2)::double precision
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_live_area_m2_from_row(p_row jsonb)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT app_gevelwering.fw_live_area_m2(
    (p_row ->> 'area_norm')::double precision,
    (p_row ->> 'area_m2')::double precision,
    (p_row ->> 'metres_per_norm_unit')::double precision,
    (p_row ->> 'region_mpu')::double precision,
    (p_row ->> 'region_aspect_yx')::double precision,
    coalesce(p_row -> 'analysis' ->> 'quantity_kind', '')
  );
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_ga_has_material_id(p_analysis jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_analysis ->> 'material_id', '') <> '';
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_ga_compose_sources_complete(
  p_component jsonb,
  p_all jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  ca jsonb;
  src jsonb;
  sid text;
  child jsonb;
  i int;
BEGIN
  ca := coalesce(p_component -> 'analysis', '{}'::jsonb);
  IF coalesce(ca ->> 'boolean_op', '') = '' THEN
    RETURN true;
  END IF;
  src := ca -> 'source_subsection_ids';
  IF src IS NULL OR jsonb_typeof(src) <> 'array' OR jsonb_array_length(src) < 2 THEN
    RETURN true;
  END IF;
  FOR i IN 0..(jsonb_array_length(src) - 1) LOOP
    sid := btrim(src ->> i);
    IF sid = '' OR sid = (p_component ->> 'id') THEN
      CONTINUE;
    END IF;
    child := app_gevelwering.fw_jsonb_find_row(p_all, sid);
    IF child IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT app_gevelwering.fw_ga_has_material_id(coalesce(child -> 'analysis', '{}'::jsonb)) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_ga_collect_superseded_ids(p_all jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  superseded text[] := ARRAY[]::text[];
  i int;
  j int;
  c jsonb;
  ca jsonb;
  src jsonb;
  sid text;
  src_row jsonb;
  sa jsonb;
  c_mat text;
  c_cat text;
  s_mat text;
  s_cat text;
BEGIN
  IF p_all IS NULL OR jsonb_typeof(p_all) <> 'array' THEN
    RETURN superseded;
  END IF;
  FOR i IN 0..(jsonb_array_length(p_all) - 1) LOOP
    c := p_all -> i;
    ca := coalesce(c -> 'analysis', '{}'::jsonb);
    src := ca -> 'source_subsection_ids';
    IF src IS NULL OR jsonb_typeof(src) <> 'array' OR jsonb_array_length(src) < 2 THEN
      CONTINUE;
    END IF;
    IF coalesce(ca ->> 'boolean_op', '') = '' THEN
      CONTINUE;
    END IF;
    c_mat := btrim(coalesce(ca ->> 'material_id', ''));
    c_cat := lower(btrim(coalesce(ca ->> 'master_category', '')));
    FOR j IN 0..(jsonb_array_length(src) - 1) LOOP
      sid := btrim(src ->> j);
      IF sid = '' THEN
        CONTINUE;
      END IF;
      src_row := app_gevelwering.fw_jsonb_find_row(p_all, sid);
      IF src_row IS NULL THEN
        CONTINUE;
      END IF;
      sa := coalesce(src_row -> 'analysis', '{}'::jsonb);
      s_mat := btrim(coalesce(sa ->> 'material_id', ''));
      s_cat := lower(btrim(coalesce(sa ->> 'master_category', '')));
      IF s_mat = '' AND s_cat = '' THEN
        superseded := array_append(superseded, sid);
      ELSIF c_mat <> '' AND s_mat <> '' AND c_mat = s_mat THEN
        superseded := array_append(superseded, sid);
      ELSIF c_cat <> '' AND s_cat <> '' AND c_cat = s_cat THEN
        superseded := array_append(superseded, sid);
      END IF;
    END LOOP;
  END LOOP;
  RETURN superseded;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_ga_build_constituents(
  p_analysis jsonb,
  p_composite_id text,
  p_all jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a jsonb;
  op text;
  src jsonb;
  signs jsonb;
  outer_id text;
  out jsonb := '[]'::jsonb;
  i int;
  sid text;
  row jsonb;
  ra jsonb;
  sign text;
  catalog text;
  name text;
  mat_id text;
BEGIN
  a := coalesce(p_analysis, '{}'::jsonb);
  op := coalesce(a ->> 'boolean_op', '');
  IF op <> 'compose' AND op <> 'difference' THEN
    RETURN out;
  END IF;
  src := a -> 'source_subsection_ids';
  IF src IS NULL OR jsonb_typeof(src) <> 'array' OR jsonb_array_length(src) < 2 THEN
    RETURN out;
  END IF;
  signs := CASE
    WHEN jsonb_typeof(a -> 'constituent_signs') = 'object' THEN a -> 'constituent_signs'
    ELSE '{}'::jsonb
  END;
  outer_id := coalesce(a ->> 'outer_subsection_id', '');
  FOR i IN 0..(jsonb_array_length(src) - 1) LOOP
    sid := btrim(src ->> i);
    IF sid = '' THEN
      CONTINUE;
    END IF;
    row := app_gevelwering.fw_jsonb_find_row(p_all, sid);
    ra := coalesce(row -> 'analysis', '{}'::jsonb);
    mat_id := btrim(coalesce(ra ->> 'material_id', ''));
    catalog := btrim(coalesce(ra ->> 'catalog_id', ''));
    name := coalesce(
      nullif(btrim(ra ->> 'material_name'), ''),
      nullif(btrim(row ->> 'label'), ''),
      left(sid, 8)
    );
    sign := coalesce(signs ->> sid, '');
    IF sign <> '+' AND sign <> '-' THEN
      IF outer_id <> '' AND sid = outer_id THEN
        sign := '+';
      ELSIF i = 0 THEN
        sign := '+';
      ELSE
        sign := '-';
      END IF;
    END IF;
    out := out || jsonb_build_array(jsonb_build_object(
      'id', sid,
      'sign', sign,
      'label', coalesce(row ->> 'label', name),
      'catalog_id', nullif(catalog, ''),
      'material_name', name,
      'area_m2', CASE
        WHEN row ->> 'area_m2' IS NOT NULL THEN (row ->> 'area_m2')::double precision
        ELSE NULL
      END,
      'is_result', sid = p_composite_id
    ));
  END LOOP;
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_vr_facade_components(
  p_building_id uuid,
  p_vr_nr text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_vr text := btrim(p_vr_nr);
  v_all jsonb;
  v_superseded text[];
  v_eligible jsonb := '[]'::jsonb;
  v_excluded jsonb := '[]'::jsonb;
  v_for_vr int := 0;
  v_healed int := 0;
  i int;
  j int;
  row jsonb;
  row_id text;
  a jsonb;
  mid text;
  cat text;
  mat_info record;
  qkind text;
  live_area double precision;
  live_len double precision;
  ga_ready boolean;
  mat_ids uuid[] := ARRAY[]::uuid[];
  catalog_ids text[] := ARRAY[]::text[];
  heal_id uuid;
  heal_analysis jsonb;
  fresh_id uuid;
  fresh_name text;
  constituents jsonb;
  eligible_one jsonb;
  ga_ready_count int := 0;
BEGIN
  IF v_vr = '' OR v_vr !~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$' THEN
    RAISE EXCEPTION 'invalid vr_nr';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id::text,
        'section_id', s.section_id::text,
        'region_kind', r.region_kind,
        'section_label', r.label,
        'label', s.label,
        'level_hint', s.level_hint,
        'vg_nr', s.vg_nr,
        'vr_nr', s.vr_nr,
        'area_norm', s.area_norm,
        'area_m2', s.area_m2,
        'metres_per_norm_unit', s.metres_per_norm_unit,
        'analysis', coalesce(s.analysis, '{}'::jsonb),
        'region_mpu', r.metres_per_norm_unit,
        'region_aspect_yx', r.scale_aspect_yx
      )
      ORDER BY r.label ASC NULLS LAST, s.sort_order ASC, s.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_all
  FROM app_gevelwering.drawing_subsection s
  JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
  WHERE s.building_id = p_building_id
    AND r.region_kind = ANY (ARRAY['FACADE', 'SECTION', 'CROSS_SECTION']::text[]);

  v_superseded := app_gevelwering.fw_ga_collect_superseded_ids(v_all);

  FOR i IN 0..(jsonb_array_length(v_all) - 1) LOOP
    row := v_all -> i;
    IF NOT app_gevelwering.fw_ga_same_vr_nr(row ->> 'vr_nr', v_vr) THEN
      CONTINUE;
    END IF;
    v_for_vr := v_for_vr + 1;
    row_id := row ->> 'id';
    IF row_id = ANY (v_superseded) THEN
      v_excluded := v_excluded || jsonb_build_array(jsonb_build_object(
        'id', row_id,
        'label', row ->> 'label',
        'vr_nr', row ->> 'vr_nr',
        'area_m2', CASE
          WHEN row ->> 'area_m2' IS NOT NULL THEN (row ->> 'area_m2')::double precision
          ELSE NULL
        END
      ));
      CONTINUE;
    END IF;

    a := coalesce(row -> 'analysis', '{}'::jsonb);
    mid := btrim(coalesce(a ->> 'material_id', ''));
    IF mid <> '' AND mid ~* '^[0-9a-f-]{36}$' THEN
      mat_ids := array_append(mat_ids, mid::uuid);
    END IF;
    cat := btrim(coalesce(a ->> 'catalog_id', ''));
    IF cat <> '' THEN
      catalog_ids := array_append(catalog_ids, cat);
    END IF;

    -- compose source material refs
    IF jsonb_typeof(a -> 'source_subsection_ids') = 'array' THEN
      FOR j IN 0..(jsonb_array_length(a -> 'source_subsection_ids') - 1) LOOP
        DECLARE
          src_row jsonb;
          src_a jsonb;
          src_mid text;
          src_cat text;
        BEGIN
          src_row := app_gevelwering.fw_jsonb_find_row(v_all, btrim(a -> 'source_subsection_ids' ->> j));
          IF src_row IS NULL THEN
            CONTINUE;
          END IF;
          src_a := coalesce(src_row -> 'analysis', '{}'::jsonb);
          src_mid := btrim(coalesce(src_a ->> 'material_id', ''));
          IF src_mid <> '' AND src_mid ~* '^[0-9a-f-]{36}$' THEN
            mat_ids := array_append(mat_ids, src_mid::uuid);
          END IF;
          src_cat := btrim(coalesce(src_a ->> 'catalog_id', ''));
          IF src_cat <> '' THEN
            catalog_ids := array_append(catalog_ids, src_cat);
          END IF;
        END;
      END LOOP;
    END IF;
  END LOOP;

  CREATE TEMP TABLE IF NOT EXISTS _fw_mat_lookup (
    id uuid PRIMARY KEY,
    ra_dba double precision,
    catalog_id text,
    name text
  ) ON COMMIT DROP;
  TRUNCATE _fw_mat_lookup;

  IF coalesce(array_length(mat_ids, 1), 0) > 0 OR coalesce(array_length(catalog_ids, 1), 0) > 0 THEN
    INSERT INTO _fw_mat_lookup (id, ra_dba, catalog_id, name)
    SELECT DISTINCT ON (m.id)
      m.id,
      CASE
        WHEN m.ra_dba IS NOT NULL AND (m.ra_dba = m.ra_dba) THEN m.ra_dba::double precision
        ELSE NULL
      END,
      nullif(btrim(m.catalog_id), ''),
      m.name
    FROM app_gevelwering.material m
    WHERE (coalesce(array_length(mat_ids, 1), 0) > 0 AND m.id = ANY (mat_ids))
       OR (coalesce(array_length(catalog_ids, 1), 0) > 0 AND m.catalog_id = ANY (catalog_ids));
  END IF;

  FOR i IN 0..(jsonb_array_length(v_all) - 1) LOOP
    row := v_all -> i;
    IF NOT app_gevelwering.fw_ga_same_vr_nr(row ->> 'vr_nr', v_vr) THEN
      CONTINUE;
    END IF;
    row_id := row ->> 'id';
    IF row_id = ANY (v_superseded) THEN
      CONTINUE;
    END IF;

    a := coalesce(row -> 'analysis', '{}'::jsonb);
    mid := btrim(coalesce(a ->> 'material_id', ''));
    cat := btrim(coalesce(a ->> 'catalog_id', ''));

    IF (mid = '' OR NOT EXISTS (SELECT 1 FROM _fw_mat_lookup WHERE id::text = mid))
       AND cat <> ''
       AND EXISTS (SELECT 1 FROM _fw_mat_lookup WHERE catalog_id = cat)
    THEN
      SELECT m.id, m.name
      INTO fresh_id, fresh_name
      FROM _fw_mat_lookup m
      WHERE m.catalog_id = cat
      LIMIT 1;
      IF fresh_id IS NOT NULL AND fresh_id::text <> mid THEN
        heal_analysis := a || jsonb_build_object(
          'material_id', fresh_id::text,
          'material_name', coalesce(fresh_name, a ->> 'material_name')
        );
        UPDATE app_gevelwering.drawing_subsection
        SET analysis = heal_analysis,
            updated_at = now()
        WHERE id = row_id::uuid;
        a := heal_analysis;
        row := row || jsonb_build_object('analysis', heal_analysis);
        v_all := jsonb_set(v_all, ARRAY[i::text], row, false);
        v_healed := v_healed + 1;
        mid := fresh_id::text;
      END IF;
    END IF;

    SELECT ml.id::text, ml.ra_dba, ml.catalog_id, ml.name
    INTO mat_info
    FROM _fw_mat_lookup ml
    WHERE (mid <> '' AND ml.id::text = mid)
       OR (cat <> '' AND ml.catalog_id = cat)
    LIMIT 1;

    qkind := coalesce(
      nullif(a ->> 'quantity_kind', ''),
      CASE WHEN a ->> 'length_m' IS NOT NULL THEN 'length' ELSE 'area' END
    );
    live_area := CASE WHEN qkind = 'length' THEN NULL ELSE app_gevelwering.fw_live_area_m2_from_row(row) END;
    live_len := CASE WHEN qkind = 'length' THEN app_gevelwering.fw_live_length_m_from_row(row) ELSE NULL END;

    ga_ready :=
      coalesce(mat_info.id::text, nullif(mid, '')) IS NOT NULL
      AND app_gevelwering.fw_ga_compose_sources_complete(row, v_all);
    IF ga_ready THEN
      ga_ready_count := ga_ready_count + 1;
    END IF;

    constituents := app_gevelwering.fw_ga_build_constituents(a, row_id, v_all);

    eligible_one := jsonb_build_object(
      'id', row_id,
      'section_id', row ->> 'section_id',
      'region_kind', row ->> 'region_kind',
      'section_label', row ->> 'section_label',
      'label', row ->> 'label',
      'vg_nr', CASE WHEN row ->> 'vg_nr' IS NOT NULL THEN (row ->> 'vg_nr')::int ELSE NULL END,
      'vr_nr', row ->> 'vr_nr',
      'area_m2', live_area,
      'quantity_kind', qkind,
      'length_m', live_len,
      'ga_ready', ga_ready,
      'material_id', coalesce(mat_info.id::text, nullif(mid, '')),
      'catalog_id', coalesce(mat_info.catalog_id, nullif(cat, '')),
      'master_category', a ->> 'master_category',
      'material_name', coalesce(mat_info.name, a ->> 'material_name'),
      'ra_dba', mat_info.ra_dba,
      'boolean_op', nullif(a ->> 'boolean_op', ''),
      'constituents', constituents
    );
    v_eligible := v_eligible || jsonb_build_array(eligible_one);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'building_id', p_building_id::text,
    'vr_nr', v_vr,
    'rule', 'include matching VR; exclude same-material boolean sources and geometry-only outlines',
    'material_id_healed', v_healed,
    'eligible', v_eligible,
    'excluded_as_source', v_excluded,
    'counts', jsonb_build_object(
      'for_vr', v_for_vr,
      'eligible', jsonb_array_length(v_eligible),
      'ga_ready', ga_ready_count,
      'excluded_as_source', jsonb_array_length(v_excluded)
    )
  );
END;
$$;
