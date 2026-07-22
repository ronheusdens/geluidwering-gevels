-- acoustics DDL version 0.2.1 — 2026-07-20
-- Additive: seed service user ronheusdens; claim pre-auth (NULL owner) rows
-- Requires 0.2.0 applied first. See acoustics-postgres-schema.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Service login: ronheusdens / demo
INSERT INTO acoustics.service_user (username, password_hash, display_name)
SELECT 'ronheusdens', crypt('demo', gen_salt('bf')), 'Ron Heusdens'
WHERE NOT EXISTS (
  SELECT 1 FROM acoustics.service_user WHERE username = 'ronheusdens'
);

-- Assign orphan customer/building rows (entered before login) to ronheusdens
UPDATE acoustics.customer c
SET owner_user_id = u.id,
    updated_at = now()
FROM acoustics.service_user u
WHERE u.username = 'ronheusdens'
  AND c.owner_user_id IS NULL;

UPDATE acoustics.building b
SET owner_user_id = u.id,
    updated_at = now()
FROM acoustics.service_user u
WHERE u.username = 'ronheusdens'
  AND b.owner_user_id IS NULL;
