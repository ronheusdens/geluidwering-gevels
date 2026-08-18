-- app-gevelwering DDL 0.2.32 — 2026-08-14
-- bppServer phase 4: materials list/create, alternatives, favorites, presets, subsection-material.

-- ---------------------------------------------------------------------------
-- Material catalog (engineer floormap pick list)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_gevelwering.fw_material_row_json(m app_gevelwering.material)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'material_id', m.id::text,
    'catalog_id', coalesce(m.catalog_id, ''),
    'material_no', m.material_no,
    'rubriek_nr', m.rubriek_nr,
    'subrubriek_nr', m.subrubriek_nr,
    'master_category', coalesce(m.master_category, ''),
    'name', coalesce(m.name, ''),
    'category', coalesce(m.category, ''),
    'source', coalesce(m.source, ''),
    'thickness_mm', m.thickness_mm,
    'ra_dba', m.ra_dba,
    'r_125_hz', m.r_125_hz,
    'r_250_hz', m.r_250_hz,
    'r_500_hz', m.r_500_hz,
    'r_1000_hz', m.r_1000_hz,
    'r_2000_hz', m.r_2000_hz
  );
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_material_categories()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cats jsonb := '[]'::jsonb;
  r record;
  subs jsonb;
  counts jsonb;
BEGIN
  SELECT coalesce(
    jsonb_object_agg(rubriek_nr::text, material_count),
    '{}'::jsonb
  )
  INTO counts
  FROM (
    SELECT COALESCE(rubriek_nr, 0)::int AS rubriek_nr,
           COUNT(*)::int AS material_count
    FROM app_gevelwering.material
    GROUP BY rubriek_nr
  ) t;

  FOR r IN
    SELECT nr, name FROM app_gevelwering.material_rubriek ORDER BY nr ASC
  LOOP
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subrubriek_nr', s.nr,
          'category', s.name,
          'label', s.nr::text || ' - ' || s.name
        )
        ORDER BY s.nr ASC
      ),
      '[]'::jsonb
    )
    INTO subs
    FROM app_gevelwering.material_subrubriek s
    WHERE s.rubriek_nr = r.nr;

    cats := cats || jsonb_build_array(jsonb_build_object(
      'rubriek_nr', r.nr,
      'master_category', r.name,
      'label', r.nr::text || '. ' || r.name,
      'material_count', coalesce((counts ->> r.nr::text)::int, 0),
      'subrubrieken', subs
    ));
  END LOOP;

  -- Orphan master_category values without rubriek_nr 1–9
  FOR r IN
    SELECT master_category, COUNT(*)::int AS material_count
    FROM app_gevelwering.material
    WHERE rubriek_nr IS NULL OR rubriek_nr < 1 OR rubriek_nr > 9
    GROUP BY master_category
    ORDER BY master_category ASC
  LOOP
    cats := cats || jsonb_build_array(jsonb_build_object(
      'rubriek_nr', NULL,
      'master_category', r.master_category,
      'label', r.master_category,
      'material_count', r.material_count,
      'subrubrieken', '[]'::jsonb
    ));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'categories', cats);
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_materials(
  p_master_category text,
  p_category text,
  p_q text,
  p_limit int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_master text := nullif(btrim(p_master_category), '');
  v_cat text := nullif(btrim(p_category), '');
  v_q text := nullif(left(btrim(coalesce(p_q, '')), 120), '');
  v_limit int := coalesce(p_limit, 800);
  v_rub_nr int;
  v_rub_name text;
  v_sub_nr int;
  mats jsonb;
BEGIN
  IF v_limit < 1 THEN v_limit := 800; END IF;
  IF v_limit > 2000 THEN v_limit := 2000; END IF;
  IF v_master IS NULL AND v_q IS NULL THEN
    RAISE EXCEPTION 'master_category or q is required';
  END IF;

  IF v_master IS NOT NULL THEN
    SELECT nr, name INTO v_rub_nr, v_rub_name
    FROM app_gevelwering.material_rubriek
    WHERE lower(name) = lower(v_master)
       OR lower(name) LIKE lower(left(v_master, 24)) || '%'
    ORDER BY CASE WHEN lower(name) = lower(v_master) THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_cat IS NOT NULL AND v_rub_nr IS NOT NULL THEN
    SELECT nr INTO v_sub_nr
    FROM app_gevelwering.material_subrubriek
    WHERE rubriek_nr = v_rub_nr
      AND (name = v_cat OR nr::text = v_cat)
    LIMIT 1;
  END IF;

  SELECT coalesce(jsonb_agg(app_gevelwering.fw_material_row_json(m.*) ORDER BY m.subrubriek_nr ASC NULLS LAST, m.material_no ASC, m.name ASC), '[]'::jsonb)
  INTO mats
  FROM (
    SELECT *
    FROM app_gevelwering.material m
    WHERE (v_rub_nr IS NULL OR m.rubriek_nr = v_rub_nr)
      AND (v_rub_nr IS NOT NULL OR v_master IS NULL OR m.master_category = v_master)
      AND (v_sub_nr IS NULL OR m.subrubriek_nr = v_sub_nr)
      AND (v_sub_nr IS NOT NULL OR v_cat IS NULL OR m.category = v_cat)
      AND (
        v_q IS NULL
        OR m.name ILIKE '%' || replace(replace(replace(v_q, '\', ''), '%', ''), '_', '') || '%'
        OR m.catalog_id ILIKE '%' || replace(replace(replace(v_q, '\', ''), '%', ''), '_', '') || '%'
      )
    ORDER BY m.subrubriek_nr ASC NULLS LAST, m.material_no ASC, m.name ASC
    LIMIT v_limit
  ) m;

  RETURN jsonb_build_object(
    'ok', true,
    'master_category', coalesce(v_rub_name, v_master),
    'rubriek_nr', v_rub_nr,
    'category', v_cat,
    'materials', mats
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_create_material(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text := left(btrim(coalesce(p_payload ->> 'name', '')), 200);
  v_ra double precision := nullif(p_payload ->> 'ra_dba', '')::double precision;
  v_rubriek int := nullif(p_payload ->> 'rubriek_nr', '')::int;
  v_subrubriek int := nullif(p_payload ->> 'subrubriek_nr', '')::int;
  v_category text := left(btrim(coalesce(p_payload ->> 'category', '')), 120);
  v_subsection_id uuid;
  v_master text;
  v_sub_name text;
  v_material_no int;
  v_catalog_index int;
  v_catalog_id text;
  v_mat app_gevelwering.material%ROWTYPE;
  v_analysis jsonb;
  v_prev jsonb;
  v_assigned boolean := false;
BEGIN
  IF nullif(btrim(p_payload ->> 'subsection_id'), '') IS NOT NULL THEN
    v_subsection_id := (p_payload ->> 'subsection_id')::uuid;
  END IF;

  IF v_name = '' THEN RAISE EXCEPTION 'name is required'; END IF;
  IF v_ra IS NULL OR v_ra < 0 OR v_ra > 100 THEN
    RAISE EXCEPTION 'ra_dba must be between 0 and 100';
  END IF;
  IF v_rubriek IS NULL OR v_rubriek < 1 OR v_rubriek > 9 THEN
    RAISE EXCEPTION 'rubriek_nr must be 1–9';
  END IF;

  SELECT name INTO v_master FROM app_gevelwering.material_rubriek WHERE nr = v_rubriek;
  IF v_master IS NULL THEN
    v_master := 'Rubriek ' || v_rubriek::text;
  END IF;

  IF v_subrubriek IS NOT NULL THEN
    SELECT name INTO v_sub_name
    FROM app_gevelwering.material_subrubriek
    WHERE rubriek_nr = v_rubriek AND nr = v_subrubriek;
    IF v_sub_name IS NOT NULL THEN
      v_category := v_sub_name;
    ELSE
      v_subrubriek := NULL;
    END IF;
  ELSIF v_category <> '' THEN
    SELECT nr INTO v_subrubriek
    FROM app_gevelwering.material_subrubriek
    WHERE rubriek_nr = v_rubriek AND name = v_category
    LIMIT 1;
  END IF;

  SELECT
    COALESCE(MAX(material_no), 0) + 1,
    COALESCE(MAX(catalog_index), -1) + 1
  INTO v_material_no, v_catalog_index
  FROM app_gevelwering.material
  WHERE source = 'app';

  v_catalog_id := 'A' || lpad(v_material_no::text, 5, '0');

  INSERT INTO app_gevelwering.material (
    catalog_index, catalog_id, material_no, master_category, name, category,
    rubriek_nr, subrubriek_nr, ra_dba, spectrum_ok, source, source_ref
  ) VALUES (
    v_catalog_index, v_catalog_id, v_material_no, v_master, v_name,
    nullif(v_category, ''),
    v_rubriek, v_subrubriek, v_ra, true, 'app', 'app catalogus'
  )
  RETURNING * INTO v_mat;

  IF v_subsection_id IS NOT NULL THEN
    SELECT analysis INTO v_prev
    FROM app_gevelwering.drawing_subsection
    WHERE id = v_subsection_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'subsection not found';
    END IF;
    v_analysis := coalesce(v_prev, '{}'::jsonb) || jsonb_build_object(
      'material_id', v_mat.id::text,
      'material_name', v_mat.name,
      'catalog_id', v_mat.catalog_id,
      'master_category', v_mat.master_category,
      'rubriek_nr', v_rubriek
    );
    IF v_rubriek = 9 THEN
      v_analysis := v_analysis || jsonb_build_object('quantity_kind', 'length');
    END IF;
    UPDATE app_gevelwering.drawing_subsection
    SET analysis = v_analysis, updated_at = now()
    WHERE id = v_subsection_id;
    v_assigned := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'material', jsonb_build_object(
      'material_id', v_mat.id::text,
      'catalog_id', v_mat.catalog_id,
      'name', v_mat.name,
      'master_category', v_mat.master_category,
      'category', coalesce(v_mat.category, ''),
      'rubriek_nr', v_mat.rubriek_nr,
      'subrubriek_nr', v_mat.subrubriek_nr,
      'ra_dba', v_mat.ra_dba,
      'source', 'app'
    ),
    'subsection_id', CASE WHEN v_subsection_id IS NULL THEN NULL ELSE v_subsection_id::text END,
    'assigned', v_assigned
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_material_alternatives(
  p_material_id uuid,
  p_limit int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_limit int := coalesce(p_limit, 6);
  base record;
  v_ra double precision;
  alts jsonb;
BEGIN
  IF v_limit < 1 THEN v_limit := 6; END IF;
  IF v_limit > 20 THEN v_limit := 20; END IF;

  SELECT id::text AS material_id,
         catalog_id,
         name,
         rubriek_nr,
         subrubriek_nr,
         master_category,
         coalesce(category, '') AS category,
         ra_dba
  INTO base
  FROM app_gevelwering.material
  WHERE id = p_material_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'materiaal niet gevonden';
  END IF;

  v_ra := base.ra_dba;
  IF v_ra IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'current', jsonb_build_object(
        'material_id', base.material_id,
        'catalog_id', base.catalog_id,
        'name', base.name,
        'ra_dba', NULL,
        'rubriek_nr', base.rubriek_nr,
        'subrubriek_nr', base.subrubriek_nr,
        'master_category', base.master_category,
        'category', base.category
      ),
      'alternatives', '[]'::jsonb,
      'reason', 'huidig materiaal heeft geen RA'
    );
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'material_id', m.id::text,
        'catalog_id', m.catalog_id,
        'name', m.name,
        'rubriek_nr', m.rubriek_nr,
        'subrubriek_nr', m.subrubriek_nr,
        'master_category', m.master_category,
        'category', coalesce(m.category, ''),
        'ra_dba', m.ra_dba,
        'delta_ra', round((m.ra_dba - v_ra)::numeric, 1),
        'thickness_mm', m.thickness_mm
      )
      ORDER BY m.ra_dba ASC, m.name ASC
    ),
    '[]'::jsonb
  )
  INTO alts
  FROM (
    SELECT *
    FROM app_gevelwering.material m
    WHERE m.id <> p_material_id
      AND m.ra_dba IS NOT NULL
      AND m.ra_dba > v_ra
      AND (base.rubriek_nr IS NULL OR m.rubriek_nr = base.rubriek_nr)
      AND (base.rubriek_nr IS NOT NULL OR base.master_category IS NULL OR m.master_category = base.master_category)
      AND (base.subrubriek_nr IS NULL OR m.subrubriek_nr = base.subrubriek_nr)
    ORDER BY m.ra_dba ASC, m.name ASC
    LIMIT v_limit
  ) m;

  RETURN jsonb_build_object(
    'ok', true,
    'current', jsonb_build_object(
      'material_id', base.material_id,
      'catalog_id', base.catalog_id,
      'name', base.name,
      'ra_dba', v_ra,
      'rubriek_nr', base.rubriek_nr,
      'subrubriek_nr', base.subrubriek_nr,
      'master_category', base.master_category,
      'category', base.category
    ),
    'alternatives', alts
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_save_subsection_material(
  p_subsection_id uuid,
  p_material_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_kind text;
  v_prev jsonb;
  v_mat record;
BEGIN
  SELECT r.region_kind, coalesce(s.analysis, '{}'::jsonb)
  INTO v_kind, v_prev
  FROM app_gevelwering.drawing_subsection s
  JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
  WHERE s.id = p_subsection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'component niet gevonden';
  END IF;
  IF upper(v_kind) = 'FLOORMAP' THEN
    RAISE EXCEPTION 'materiaal hoort bij gevelcomponenten, niet bij plattegrondruimten';
  END IF;

  SELECT id::text AS material_id,
         catalog_id,
         name,
         rubriek_nr,
         subrubriek_nr,
         master_category,
         coalesce(category, '') AS category,
         ra_dba
  INTO v_mat
  FROM app_gevelwering.material
  WHERE id = p_material_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'materiaal niet gevonden';
  END IF;

  v_prev := v_prev || jsonb_build_object(
    'material_id', v_mat.material_id,
    'material_name', coalesce(v_mat.name, '')
  );
  IF v_mat.catalog_id IS NOT NULL AND btrim(v_mat.catalog_id) <> '' THEN
    v_prev := v_prev || jsonb_build_object('catalog_id', v_mat.catalog_id);
  ELSE
    v_prev := v_prev - 'catalog_id';
  END IF;
  IF v_mat.master_category IS NOT NULL THEN
    v_prev := v_prev || jsonb_build_object('master_category', v_mat.master_category);
  END IF;
  IF v_mat.category <> '' THEN
    v_prev := v_prev || jsonb_build_object('category', v_mat.category);
  END IF;
  IF v_mat.rubriek_nr IS NOT NULL THEN
    v_prev := v_prev || jsonb_build_object('rubriek_nr', v_mat.rubriek_nr);
  END IF;
  IF v_mat.subrubriek_nr IS NOT NULL THEN
    v_prev := v_prev || jsonb_build_object('subrubriek_nr', v_mat.subrubriek_nr);
  END IF;
  IF v_mat.ra_dba IS NOT NULL THEN
    v_prev := v_prev || jsonb_build_object('ra_dba', v_mat.ra_dba);
  END IF;

  UPDATE app_gevelwering.drawing_subsection
  SET analysis = v_prev, updated_at = now()
  WHERE id = p_subsection_id;

  RETURN jsonb_build_object(
    'ok', true,
    'subsection_id', p_subsection_id::text,
    'material', jsonb_build_object(
      'material_id', v_mat.material_id,
      'catalog_id', v_mat.catalog_id,
      'name', v_mat.name,
      'ra_dba', v_mat.ra_dba,
      'master_category', v_mat.master_category,
      'category', v_mat.category
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Favorites + presets
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_material_favorites(p_building_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'building_id', p_building_id::text,
    'materials', coalesce(
      (
        SELECT jsonb_agg(
          app_gevelwering.fw_material_row_json(m.*) || jsonb_build_object('sort_order', f.sort_order)
          ORDER BY f.sort_order ASC, m.name ASC
        )
        FROM app_gevelwering.building_material_favorite f
        JOIN app_gevelwering.material m ON m.id = f.material_id
        WHERE f.building_id = p_building_id
      ),
      '[]'::jsonb
    )
  );
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_add_material_favorite(
  p_building_id uuid,
  p_material_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_sort int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_gevelwering.building WHERE id = p_building_id) THEN
    RAISE EXCEPTION 'building not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_gevelwering.material WHERE id = p_material_id) THEN
    RAISE EXCEPTION 'material not found';
  END IF;
  SELECT coalesce(max(sort_order), -1) + 1 INTO v_sort
  FROM app_gevelwering.building_material_favorite
  WHERE building_id = p_building_id;
  INSERT INTO app_gevelwering.building_material_favorite (building_id, material_id, sort_order)
  VALUES (p_building_id, p_material_id, v_sort)
  ON CONFLICT (building_id, material_id) DO NOTHING;
  RETURN jsonb_build_object(
    'ok', true,
    'building_id', p_building_id::text,
    'material_id', p_material_id::text,
    'favorited', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_remove_material_favorite(
  p_building_id uuid,
  p_material_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM app_gevelwering.building_material_favorite
  WHERE building_id = p_building_id AND material_id = p_material_id;
  RETURN jsonb_build_object(
    'ok', true,
    'building_id', p_building_id::text,
    'material_id', p_material_id::text,
    'favorited', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_list_material_favorite_presets()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'presets', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'preset_id', p.id::text,
            'name', p.name,
            'material_count', (
              SELECT count(*)::int
              FROM app_gevelwering.material_favorite_preset_item i
              WHERE i.preset_id = p.id
            ),
            'created_at', p.created_at,
            'updated_at', p.updated_at
          )
          ORDER BY p.name ASC
        )
        FROM app_gevelwering.material_favorite_preset p
      ),
      '[]'::jsonb
    )
  );
$$;

CREATE OR REPLACE FUNCTION app_gevelwering.fw_material_favorite_preset_action(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_action text := lower(btrim(coalesce(p_payload ->> 'action', '')));
  v_name text;
  v_building_id uuid;
  v_preset_id uuid;
  v_count int;
  fav record;
  item record;
BEGIN
  IF v_action = 'save' THEN
    v_name := left(btrim(coalesce(p_payload ->> 'name', '')), 120);
    v_building_id := nullif(btrim(p_payload ->> 'building_id'), '')::uuid;
    IF v_name = '' THEN RAISE EXCEPTION 'name is required'; END IF;
    IF v_building_id IS NULL THEN RAISE EXCEPTION 'invalid building_id'; END IF;

    SELECT count(*)::int INTO v_count
    FROM app_gevelwering.building_material_favorite
    WHERE building_id = v_building_id;
    IF v_count < 1 THEN RAISE EXCEPTION 'geen favorieten om op te slaan'; END IF;

    SELECT id INTO v_preset_id
    FROM app_gevelwering.material_favorite_preset
    WHERE name = v_name;
    IF v_preset_id IS NOT NULL THEN
      UPDATE app_gevelwering.material_favorite_preset
      SET updated_at = now(), created_by = p_user_id
      WHERE id = v_preset_id;
      DELETE FROM app_gevelwering.material_favorite_preset_item WHERE preset_id = v_preset_id;
    ELSE
      INSERT INTO app_gevelwering.material_favorite_preset (name, created_by)
      VALUES (v_name, p_user_id)
      RETURNING id INTO v_preset_id;
    END IF;

    FOR fav IN
      SELECT material_id, sort_order
      FROM app_gevelwering.building_material_favorite
      WHERE building_id = v_building_id
      ORDER BY sort_order ASC
    LOOP
      INSERT INTO app_gevelwering.material_favorite_preset_item (preset_id, material_id, sort_order)
      VALUES (v_preset_id, fav.material_id, coalesce(fav.sort_order, 0))
      ON CONFLICT DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object(
      'ok', true,
      'preset_id', v_preset_id::text,
      'name', v_name,
      'material_count', v_count
    );
  END IF;

  IF v_action = 'apply' THEN
    v_building_id := nullif(btrim(p_payload ->> 'building_id'), '')::uuid;
    IF v_building_id IS NULL THEN RAISE EXCEPTION 'invalid building_id'; END IF;
    IF nullif(btrim(p_payload ->> 'preset_id'), '') IS NOT NULL THEN
      v_preset_id := (p_payload ->> 'preset_id')::uuid;
    ELSE
      v_name := btrim(coalesce(p_payload ->> 'name', ''));
      IF v_name = '' THEN RAISE EXCEPTION 'preset_id or name required'; END IF;
      SELECT id INTO v_preset_id FROM app_gevelwering.material_favorite_preset WHERE name = v_name;
    END IF;
    IF v_preset_id IS NULL THEN RAISE EXCEPTION 'preset not found'; END IF;

    DELETE FROM app_gevelwering.building_material_favorite WHERE building_id = v_building_id;
    v_count := 0;
    FOR item IN
      SELECT material_id, sort_order
      FROM app_gevelwering.material_favorite_preset_item
      WHERE preset_id = v_preset_id
      ORDER BY sort_order ASC
    LOOP
      INSERT INTO app_gevelwering.building_material_favorite (building_id, material_id, sort_order)
      VALUES (v_building_id, item.material_id, coalesce(item.sort_order, 0));
      v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
      'ok', true,
      'building_id', v_building_id::text,
      'preset_id', v_preset_id::text,
      'material_count', v_count
    );
  END IF;

  IF v_action = 'delete' THEN
    v_preset_id := nullif(btrim(p_payload ->> 'preset_id'), '')::uuid;
    IF v_preset_id IS NULL THEN RAISE EXCEPTION 'invalid preset_id'; END IF;
    DELETE FROM app_gevelwering.material_favorite_preset WHERE id = v_preset_id;
    RETURN jsonb_build_object('ok', true, 'preset_id', v_preset_id::text, 'deleted', true);
  END IF;

  IF v_action = 'rename' THEN
    v_preset_id := nullif(btrim(p_payload ->> 'preset_id'), '')::uuid;
    v_name := left(btrim(coalesce(p_payload ->> 'name', '')), 120);
    IF v_preset_id IS NULL OR v_name = '' THEN
      RAISE EXCEPTION 'preset_id and name required';
    END IF;
    UPDATE app_gevelwering.material_favorite_preset
    SET name = v_name, updated_at = now()
    WHERE id = v_preset_id
    RETURNING id INTO v_preset_id;
    IF v_preset_id IS NULL THEN RAISE EXCEPTION 'preset not found'; END IF;
    RETURN jsonb_build_object('ok', true, 'preset_id', v_preset_id::text, 'name', v_name);
  END IF;

  RAISE EXCEPTION 'unknown action';
END;
$$;
