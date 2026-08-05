-- Acoustics DDL 0.2.26 — customer report inbox (published concept/definitief versions)
-- Engineer publishes a generated HTML report into the opdrachtgever inbox.

CREATE TABLE IF NOT EXISTS app_gevelwering.customer_report_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES app_gevelwering.building (id) ON DELETE CASCADE,
  filename text NOT NULL,
  report_kind text NOT NULL
    CHECK (report_kind IN ('concept', 'definitief')),
  version_label text NOT NULL DEFAULT '1.0',
  content_hash text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  published_by uuid REFERENCES app_gevelwering.service_user (id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  downloaded_at timestamptz,
  email_requested_at timestamptz,
  CONSTRAINT customer_report_inbox_building_file_uidx UNIQUE (building_id, filename)
);

CREATE INDEX IF NOT EXISTS customer_report_inbox_building_idx
  ON app_gevelwering.customer_report_inbox (building_id, published_at DESC);

CREATE INDEX IF NOT EXISTS customer_report_inbox_unread_idx
  ON app_gevelwering.customer_report_inbox (building_id)
  WHERE read_at IS NULL;

COMMENT ON TABLE app_gevelwering.customer_report_inbox IS
  'Published report versions visible to the building owner (opdrachtgever inbox).';
