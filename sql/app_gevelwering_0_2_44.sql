-- app-gevelwering DDL 0.2.44 — 2026-09-05
-- Favorite presets: create empty, get items, add/remove single material (catalog admin UX).

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
  v_material_id uuid;
  v_count int;
  v_sort int;
  v_already boolean;
  fav record;
  item record;
  mats jsonb;
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

  -- Create empty named preset (catalog admin).
  IF v_action = 'create' THEN
    v_name := left(btrim(coalesce(p_payload ->> 'name', '')), 120);
    IF v_name = '' THEN RAISE EXCEPTION 'name is required'; END IF;
    IF EXISTS (
      SELECT 1 FROM app_gevelwering.material_favorite_preset WHERE name = v_name
    ) THEN
      RAISE EXCEPTION 'preset name already exists';
    END IF;
    INSERT INTO app_gevelwering.material_favorite_preset (name, created_by)
    VALUES (v_name, p_user_id)
    RETURNING id INTO v_preset_id;
    RETURN jsonb_build_object(
      'ok', true,
      'preset_id', v_preset_id::text,
      'name', v_name,
      'material_count', 0
    );
  END IF;

  -- Detail + materials for one preset.
  IF v_action = 'get' THEN
    v_preset_id := nullif(btrim(p_payload ->> 'preset_id'), '')::uuid;
    IF v_preset_id IS NULL THEN RAISE EXCEPTION 'invalid preset_id'; END IF;
    SELECT p.name INTO v_name
    FROM app_gevelwering.material_favorite_preset p
    WHERE p.id = v_preset_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'preset not found'; END IF;

    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'material_id', m.id::text,
        'catalog_id', coalesce(m.catalog_id, ''),
        'name', coalesce(m.name, ''),
        'master_category', coalesce(m.master_category, ''),
        'ra_dba', m.ra_dba,
        'sort_order', i.sort_order
      )
      ORDER BY i.sort_order ASC, m.catalog_id ASC, m.name ASC
    ), '[]'::jsonb)
    INTO mats
    FROM app_gevelwering.material_favorite_preset_item i
    JOIN app_gevelwering.material m ON m.id = i.material_id
    WHERE i.preset_id = v_preset_id;

    SELECT count(*)::int INTO v_count
    FROM app_gevelwering.material_favorite_preset_item
    WHERE preset_id = v_preset_id;

    RETURN jsonb_build_object(
      'ok', true,
      'preset_id', v_preset_id::text,
      'name', v_name,
      'material_count', v_count,
      'materials', mats
    );
  END IF;

  -- Add one material to an existing preset.
  IF v_action = 'add_item' THEN
    v_preset_id := nullif(btrim(p_payload ->> 'preset_id'), '')::uuid;
    v_material_id := nullif(btrim(p_payload ->> 'material_id'), '')::uuid;
    IF v_preset_id IS NULL OR v_material_id IS NULL THEN
      RAISE EXCEPTION 'preset_id and material_id required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM app_gevelwering.material_favorite_preset WHERE id = v_preset_id
    ) THEN
      RAISE EXCEPTION 'preset not found';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM app_gevelwering.material WHERE id = v_material_id
    ) THEN
      RAISE EXCEPTION 'material not found';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM app_gevelwering.material_favorite_preset_item
      WHERE preset_id = v_preset_id AND material_id = v_material_id
    ) INTO v_already;

    IF NOT v_already THEN
      SELECT coalesce(max(sort_order), -1) + 1 INTO v_sort
      FROM app_gevelwering.material_favorite_preset_item
      WHERE preset_id = v_preset_id;
      INSERT INTO app_gevelwering.material_favorite_preset_item (preset_id, material_id, sort_order)
      VALUES (v_preset_id, v_material_id, v_sort);
    END IF;

    UPDATE app_gevelwering.material_favorite_preset
    SET updated_at = now()
    WHERE id = v_preset_id;

    SELECT count(*)::int INTO v_count
    FROM app_gevelwering.material_favorite_preset_item
    WHERE preset_id = v_preset_id;

    SELECT name INTO v_name FROM app_gevelwering.material_favorite_preset WHERE id = v_preset_id;

    RETURN jsonb_build_object(
      'ok', true,
      'preset_id', v_preset_id::text,
      'name', v_name,
      'material_id', v_material_id::text,
      'already_present', v_already,
      'material_count', v_count
    );
  END IF;

  -- Remove one material from a preset.
  IF v_action = 'remove_item' THEN
    v_preset_id := nullif(btrim(p_payload ->> 'preset_id'), '')::uuid;
    v_material_id := nullif(btrim(p_payload ->> 'material_id'), '')::uuid;
    IF v_preset_id IS NULL OR v_material_id IS NULL THEN
      RAISE EXCEPTION 'preset_id and material_id required';
    END IF;
    DELETE FROM app_gevelwering.material_favorite_preset_item
    WHERE preset_id = v_preset_id AND material_id = v_material_id;
    UPDATE app_gevelwering.material_favorite_preset
    SET updated_at = now()
    WHERE id = v_preset_id;
    SELECT count(*)::int INTO v_count
    FROM app_gevelwering.material_favorite_preset_item
    WHERE preset_id = v_preset_id;
    RETURN jsonb_build_object(
      'ok', true,
      'preset_id', v_preset_id::text,
      'material_id', v_material_id::text,
      'material_count', v_count
    );
  END IF;

  -- Which presets already contain this material (for catalog checkmarks).
  IF v_action = 'presets_for_material' THEN
    v_material_id := nullif(btrim(p_payload ->> 'material_id'), '')::uuid;
    IF v_material_id IS NULL THEN RAISE EXCEPTION 'material_id required'; END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'material_id', v_material_id::text,
      'preset_ids', coalesce(
        (
          SELECT jsonb_agg(i.preset_id::text ORDER BY p.name ASC)
          FROM app_gevelwering.material_favorite_preset_item i
          JOIN app_gevelwering.material_favorite_preset p ON p.id = i.preset_id
          WHERE i.material_id = v_material_id
        ),
        '[]'::jsonb
      )
    );
  END IF;

  RAISE EXCEPTION 'unknown action';
END;
$$;

COMMENT ON FUNCTION app_gevelwering.fw_material_favorite_preset_action(uuid, jsonb) IS
  'Favorite presets: save/apply/delete/rename + create/get/add_item/remove_item/presets_for_material.';
