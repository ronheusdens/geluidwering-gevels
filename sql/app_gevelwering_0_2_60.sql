-- app-gevelwering DDL 0.2.60 — 2026-10-05
-- Reorder drawing regions (engineer section list drag-and-drop).

CREATE OR REPLACE FUNCTION app_gevelwering.fw_reorder_drawing_regions(
  p_document_id uuid,
  p_ordered_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_expected integer;
  v_got integer;
  i integer;
BEGIN
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'document_id required';
  END IF;
  IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'ordered_ids required';
  END IF;

  SELECT count(*)::int INTO v_expected
  FROM app_gevelwering.drawing_region
  WHERE document_id = p_document_id;

  v_got := array_length(p_ordered_ids, 1);
  IF v_got <> v_expected THEN
    RAISE EXCEPTION 'ordered_ids length % does not match region count %', v_got, v_expected;
  END IF;

  IF (
    SELECT count(DISTINCT x)::int FROM unnest(p_ordered_ids) AS x
  ) <> v_got THEN
    RAISE EXCEPTION 'ordered_ids contains duplicates';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_ordered_ids) AS x(id)
    LEFT JOIN app_gevelwering.drawing_region r
      ON r.id = x.id AND r.document_id = p_document_id
    WHERE r.id IS NULL
  ) THEN
    RAISE EXCEPTION 'ordered_ids contains unknown region for this document';
  END IF;

  FOR i IN 1 .. v_got LOOP
    UPDATE app_gevelwering.drawing_region
    SET sort_order = i - 1,
        updated_at = now()
    WHERE id = p_ordered_ids[i]
      AND document_id = p_document_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'count', v_got
  );
END;
$$;
