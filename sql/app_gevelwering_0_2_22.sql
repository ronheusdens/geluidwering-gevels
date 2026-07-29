-- app-gevelwering DDL version 0.2.22 — 2026-07-26
-- Rename engineer display role: Drawing reviewer → Engineer

UPDATE app_gevelwering.service_user
SET display_name = 'Engineer'
WHERE username = 'engineer'
  AND display_name IN ('Drawing reviewer', 'Drawing Reviewer');
