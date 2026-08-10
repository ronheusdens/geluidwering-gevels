-- app-gevelwering DDL 0.2.28 — 2026-08-09
-- Material catalog is app-owned after one-time seed (no DROP on restart).
-- Project favorites ("meest gebruikt") + named preset templates.

CREATE TABLE IF NOT EXISTS app_gevelwering.app_meta (
  key         text PRIMARY KEY,
  value       text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_gevelwering.app_meta IS
  'App-level key/value flags (e.g. material_catalog_seeded=1).';

CREATE TABLE IF NOT EXISTS app_gevelwering.building_material_favorite (
  building_id  uuid NOT NULL REFERENCES app_gevelwering.building(id) ON DELETE CASCADE,
  material_id  uuid NOT NULL REFERENCES app_gevelwering.material(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (building_id, material_id)
);

CREATE INDEX IF NOT EXISTS building_material_favorite_material_idx
  ON app_gevelwering.building_material_favorite (material_id);

CREATE INDEX IF NOT EXISTS building_material_favorite_building_sort_idx
  ON app_gevelwering.building_material_favorite (building_id, sort_order, material_id);

COMMENT ON TABLE app_gevelwering.building_material_favorite IS
  'Per-project "meest gebruikt" materials for quick pick on façade components.';

CREATE TABLE IF NOT EXISTS app_gevelwering.material_favorite_preset (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_by  uuid REFERENCES app_gevelwering.service_user(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_favorite_preset_name_unique UNIQUE (name)
);

COMMENT ON TABLE app_gevelwering.material_favorite_preset IS
  'Named template of favorite materials reusable across projects.';

CREATE TABLE IF NOT EXISTS app_gevelwering.material_favorite_preset_item (
  preset_id    uuid NOT NULL REFERENCES app_gevelwering.material_favorite_preset(id) ON DELETE CASCADE,
  material_id  uuid NOT NULL REFERENCES app_gevelwering.material(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, material_id)
);

CREATE INDEX IF NOT EXISTS material_favorite_preset_item_material_idx
  ON app_gevelwering.material_favorite_preset_item (material_id);

COMMENT ON TABLE app_gevelwering.material_favorite_preset_item IS
  'Materials belonging to a favorite preset template.';

-- Mark existing non-empty catalogs as already seeded (idempotent).
INSERT INTO app_gevelwering.app_meta (key, value, updated_at)
SELECT 'material_catalog_seeded', '1', now()
WHERE EXISTS (SELECT 1 FROM app_gevelwering.material LIMIT 1)
ON CONFLICT (key) DO NOTHING;
