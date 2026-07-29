-- app-gevelwering DDL version 0.2.13 — 2026-07-22
-- Normalize category for glass products: name contains 'glas' → category 'glas'
-- Requires 0.2.12 applied first.

UPDATE app_gevelwering.material
SET category = 'glas',
    updated_at = now()
WHERE name ILIKE '%glas%'
  AND (category IS DISTINCT FROM 'glas');

COMMENT ON COLUMN app_gevelwering.material.category IS
  'Optional code (GDG/GDL/GDR/GE/glas). Glass products (name ILIKE %glas%) use category glas.';
