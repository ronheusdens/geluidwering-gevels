-- app-gevelwering DDL 0.2.54 — 2026-10-04
-- Add SOUTERRAIN (souterrain) to subsection level_hint; lowest floor in UI order.

ALTER TABLE app_gevelwering.drawing_subsection
  DROP CONSTRAINT IF EXISTS drawing_subsection_level_hint_check;

ALTER TABLE app_gevelwering.drawing_subsection
  ADD CONSTRAINT drawing_subsection_level_hint_check CHECK (
    level_hint IN (
      'SOUTERRAIN',
      'GROUND',
      'BEL_ETAGE',
      'FIRST',
      'SECOND',
      'THIRD',
      'ROOF',
      'OTHER'
    )
  );

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'app_gevelwering'
    AND p.proname = 'fw_save_drawing_subsection';

  IF def IS NULL THEN
    RAISE NOTICE 'fw_save_drawing_subsection not found — constraint updated only';
    RETURN;
  END IF;

  IF position('''SOUTERRAIN''' in def) = 0 THEN
    -- Prefer replacing the current allow-list (with BEL_ETAGE).
    IF position(
      '''GROUND'', ''BEL_ETAGE'', ''FIRST'', ''SECOND'', ''THIRD'', ''ROOF'', ''OTHER'''
      in def
    ) > 0 THEN
      def := replace(
        def,
        '''GROUND'', ''BEL_ETAGE'', ''FIRST'', ''SECOND'', ''THIRD'', ''ROOF'', ''OTHER''',
        '''SOUTERRAIN'', ''GROUND'', ''BEL_ETAGE'', ''FIRST'', ''SECOND'', ''THIRD'', ''ROOF'', ''OTHER'''
      );
    ELSIF position(
      '''GROUND'', ''FIRST'', ''SECOND'', ''THIRD'', ''ROOF'', ''OTHER'''
      in def
    ) > 0 THEN
      def := replace(
        def,
        '''GROUND'', ''FIRST'', ''SECOND'', ''THIRD'', ''ROOF'', ''OTHER''',
        '''SOUTERRAIN'', ''GROUND'', ''BEL_ETAGE'', ''FIRST'', ''SECOND'', ''THIRD'', ''ROOF'', ''OTHER'''
      );
    ELSE
      RAISE NOTICE 'fw_save_drawing_subsection: level_hint allow-list pattern not found';
      RETURN;
    END IF;
    EXECUTE def;
  END IF;
END $$;

COMMENT ON CONSTRAINT drawing_subsection_level_hint_check ON app_gevelwering.drawing_subsection IS
  'Floor level hint: souterrain → begane vloer → bel-etage → verdiepingen → zolder.';
