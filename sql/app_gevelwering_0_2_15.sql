-- app-gevelwering DDL version 0.2.15 — 2026-07-22
-- Fix false 'glas' subcategory: only master_category Glas is real glass.
-- Name matches under other masters (foamglas, GlasMax, glasdeur, …) → category Elementen.
-- Does not change master_category Glas (434 real glass rows stay Glas / glas).
-- Requires 0.2.14 applied first.

UPDATE app_gevelwering.material
SET category = 'Elementen',
    updated_at = now()
WHERE category = 'glas'
  AND master_category IS DISTINCT FROM 'Glas';
