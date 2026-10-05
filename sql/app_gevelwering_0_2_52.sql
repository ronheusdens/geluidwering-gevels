-- app-gevelwering DDL 0.2.52 — 2026-10-03
-- Fix fw_recompute_section_metrics: PL/pgSQL record `r` shadowed table alias `r`,
-- so every scale save failed with "record r is not assigned yet" (LED stayed off).
-- Re-applies the corrected body from 0.2.50 (\ir = relative to this file).

\ir app_gevelwering_0_2_50.sql
