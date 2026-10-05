-- app-gevelwering DDL 0.2.35 — 2026-08-23
-- Migrate legacy kier siblings (seal_for_subsection_id) → analysis.seal on parent.
-- GA: emit derived length when analysis.seal.enabled; skip leftover seal siblings.

-- ---------------------------------------------------------------------------
-- 1) One-time data migration (idempotent)
-- ---------------------------------------------------------------------------
DO $mig$
DECLARE
  r record;
  parent_id uuid;
  parent_a jsonb;
  seal jsonb;
  migrated int := 0;
  orphans int := 0;
  skipped int := 0;
  len_m double precision;
BEGIN
  FOR r IN
    SELECT s.id, s.analysis
    FROM app_gevelwering.drawing_subsection s
    WHERE coalesce(btrim(s.analysis ->> 'seal_for_subsection_id'), '') <> ''
  LOOP
    BEGIN
      parent_id := (btrim(r.analysis ->> 'seal_for_subsection_id'))::uuid;
    EXCEPTION WHEN OTHERS THEN
      DELETE FROM app_gevelwering.drawing_subsection WHERE id = r.id;
      orphans := orphans + 1;
      CONTINUE;
    END;

    SELECT analysis INTO parent_a
    FROM app_gevelwering.drawing_subsection
    WHERE id = parent_id;

    IF parent_a IS NULL THEN
      DELETE FROM app_gevelwering.drawing_subsection WHERE id = r.id;
      orphans := orphans + 1;
      CONTINUE;
    END IF;

    IF coalesce(parent_a -> 'seal' ->> 'enabled', '') IN ('true', 't', '1') THEN
      DELETE FROM app_gevelwering.drawing_subsection WHERE id = r.id;
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    len_m := NULL;
    IF (r.analysis ->> 'length_m') ~ '^-?\d' THEN
      len_m := round((r.analysis ->> 'length_m')::numeric, 2)::double precision;
    END IF;

    seal := jsonb_strip_nulls(jsonb_build_object(
      'enabled', true,
      'material_id', nullif(btrim(coalesce(r.analysis ->> 'material_id', '')), ''),
      'catalog_id', nullif(btrim(coalesce(r.analysis ->> 'catalog_id', '')), ''),
      'material_name', nullif(btrim(coalesce(r.analysis ->> 'material_name', '')), ''),
      'master_category', nullif(btrim(coalesce(r.analysis ->> 'master_category', '')), ''),
      'category', nullif(btrim(coalesce(r.analysis ->> 'category', '')), ''),
      'rubriek_nr', CASE
        WHEN (r.analysis ->> 'rubriek_nr') ~ '^\d+$' THEN (r.analysis ->> 'rubriek_nr')::int
        ELSE 9
      END,
      'length_m', len_m
    ));

    UPDATE app_gevelwering.drawing_subsection
    SET analysis = (coalesce(parent_a, '{}'::jsonb) - 'seal_for_subsection_id')
                   || jsonb_build_object('seal', seal),
        updated_at = now()
    WHERE id = parent_id;

    DELETE FROM app_gevelwering.drawing_subsection WHERE id = r.id;
    migrated := migrated + 1;
  END LOOP;

  RAISE NOTICE '0.2.35 kier seal migration: merged=%, orphan_deleted=%, already_had_seal=%',
    migrated, orphans, skipped;
END
$mig$;

-- ---------------------------------------------------------------------------
-- 2) fw_list_vr_facade_components — seal length + skip legacy siblings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_vr_facade_components(p_building_id uuid, p_vr_nr text)
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
  seal jsonb;
  seal_mid text;
  seal_cat text;
  seal_mat record;
  seal_len double precision;
  seal_ready boolean;
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
    row_id := row ->> 'id';
    a := coalesce(row -> 'analysis', '{}'::jsonb);
    IF coalesce(btrim(a ->> 'seal_for_subsection_id'), '') <> '' THEN
      CONTINUE;
    END IF;
    v_for_vr := v_for_vr + 1;
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

    mid := btrim(coalesce(a ->> 'material_id', ''));
    IF mid <> '' AND mid ~* '^[0-9a-f-]{36}$' THEN
      mat_ids := array_append(mat_ids, mid::uuid);
    END IF;
    cat := btrim(coalesce(a ->> 'catalog_id', ''));
    IF cat <> '' THEN
      catalog_ids := array_append(catalog_ids, cat);
    END IF;

    seal := a -> 'seal';
    IF jsonb_typeof(seal) = 'object'
       AND coalesce(seal ->> 'enabled', '') IN ('true', 't', '1') THEN
      seal_mid := btrim(coalesce(seal ->> 'material_id', ''));
      IF seal_mid <> '' AND seal_mid ~* '^[0-9a-f-]{36}$' THEN
        mat_ids := array_append(mat_ids, seal_mid::uuid);
      END IF;
      seal_cat := btrim(coalesce(seal ->> 'catalog_id', ''));
      IF seal_cat <> '' THEN
        catalog_ids := array_append(catalog_ids, seal_cat);
      END IF;
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
    a := coalesce(row -> 'analysis', '{}'::jsonb);
    IF coalesce(btrim(a ->> 'seal_for_subsection_id'), '') <> '' THEN
      CONTINUE;
    END IF;

    -- Superseded area sources: still emit derived seal length (kier stays on the source
    -- after migration when that was the seal_for parent).
    IF row_id = ANY (v_superseded) THEN
      seal := a -> 'seal';
      IF jsonb_typeof(seal) = 'object'
         AND coalesce(seal ->> 'enabled', '') IN ('true', 't', '1') THEN
        seal_mid := btrim(coalesce(seal ->> 'material_id', ''));
        seal_cat := btrim(coalesce(seal ->> 'catalog_id', ''));
        SELECT ml.id::text, ml.ra_dba, ml.catalog_id, ml.name
        INTO seal_mat
        FROM _fw_mat_lookup ml
        WHERE (seal_mid <> '' AND ml.id::text = seal_mid)
           OR (seal_cat <> '' AND ml.catalog_id = seal_cat)
        LIMIT 1;
        seal_len := NULL;
        IF (seal ->> 'length_m') ~ '^-?\d' THEN
          seal_len := round((seal ->> 'length_m')::numeric, 2)::double precision;
        END IF;
        seal_ready := coalesce(seal_mat.id::text, nullif(seal_mid, '')) IS NOT NULL
          AND seal_len IS NOT NULL AND seal_len > 0;
        IF seal_ready THEN
          ga_ready_count := ga_ready_count + 1;
        END IF;
        eligible_one := jsonb_build_object(
          'id', row_id || '#seal',
          'section_id', row ->> 'section_id',
          'region_kind', row ->> 'region_kind',
          'section_label', row ->> 'section_label',
          'label', coalesce(nullif(btrim(row ->> 'label'), ''), 'component') || ' · kierdichting',
          'vg_nr', CASE WHEN row ->> 'vg_nr' IS NOT NULL THEN (row ->> 'vg_nr')::int ELSE NULL END,
          'vr_nr', row ->> 'vr_nr',
          'area_m2', NULL,
          'quantity_kind', 'length',
          'length_m', seal_len,
          'ga_ready', seal_ready,
          'material_id', coalesce(seal_mat.id::text, nullif(seal_mid, '')),
          'catalog_id', coalesce(seal_mat.catalog_id, nullif(seal_cat, '')),
          'master_category', coalesce(nullif(seal ->> 'master_category', ''), seal_mat.name),
          'material_name', coalesce(seal_mat.name, seal ->> 'material_name'),
          'ra_dba', seal_mat.ra_dba,
          'boolean_op', NULL,
          'orientatie', nullif(btrim(coalesce(a ->> 'orientatie', '')), ''),
          'from_seal', true,
          'source_subsection_id', row_id,
          'constituents', '[]'::jsonb
        );
        v_eligible := v_eligible || jsonb_build_array(eligible_one);
      END IF;
      CONTINUE;
    END IF;

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
      'orientatie', nullif(btrim(coalesce(a ->> 'orientatie', '')), ''),
      'from_seal', false,
      'source_subsection_id', row_id,
      'constituents', constituents
    );
    v_eligible := v_eligible || jsonb_build_array(eligible_one);

    seal := a -> 'seal';
    IF jsonb_typeof(seal) = 'object'
       AND coalesce(seal ->> 'enabled', '') IN ('true', 't', '1')
       AND qkind <> 'length' THEN
      seal_mid := btrim(coalesce(seal ->> 'material_id', ''));
      seal_cat := btrim(coalesce(seal ->> 'catalog_id', ''));
      SELECT ml.id::text, ml.ra_dba, ml.catalog_id, ml.name
      INTO seal_mat
      FROM _fw_mat_lookup ml
      WHERE (seal_mid <> '' AND ml.id::text = seal_mid)
         OR (seal_cat <> '' AND ml.catalog_id = seal_cat)
      LIMIT 1;

      seal_len := NULL;
      IF (seal ->> 'length_m') ~ '^-?\d' THEN
        seal_len := round((seal ->> 'length_m')::numeric, 2)::double precision;
      END IF;

      seal_ready := coalesce(seal_mat.id::text, nullif(seal_mid, '')) IS NOT NULL
        AND seal_len IS NOT NULL AND seal_len > 0;
      IF seal_ready THEN
        ga_ready_count := ga_ready_count + 1;
      END IF;

      eligible_one := jsonb_build_object(
        'id', row_id || '#seal',
        'section_id', row ->> 'section_id',
        'region_kind', row ->> 'region_kind',
        'section_label', row ->> 'section_label',
        'label', coalesce(nullif(btrim(row ->> 'label'), ''), 'component') || ' · kierdichting',
        'vg_nr', CASE WHEN row ->> 'vg_nr' IS NOT NULL THEN (row ->> 'vg_nr')::int ELSE NULL END,
        'vr_nr', row ->> 'vr_nr',
        'area_m2', NULL,
        'quantity_kind', 'length',
        'length_m', seal_len,
        'ga_ready', seal_ready,
        'material_id', coalesce(seal_mat.id::text, nullif(seal_mid, '')),
        'catalog_id', coalesce(seal_mat.catalog_id, nullif(seal_cat, '')),
        'master_category', coalesce(nullif(seal ->> 'master_category', ''), seal_mat.name),
        'material_name', coalesce(seal_mat.name, seal ->> 'material_name'),
        'ra_dba', seal_mat.ra_dba,
        'boolean_op', NULL,
        'orientatie', nullif(btrim(coalesce(a ->> 'orientatie', '')), ''),
        'from_seal', true,
        'source_subsection_id', row_id,
        'constituents', '[]'::jsonb
      );
      v_eligible := v_eligible || jsonb_build_array(eligible_one);
    END IF;
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
$$

