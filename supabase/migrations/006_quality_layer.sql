-- 006_quality_layer.sql
-- Adds quality enrichment columns to lead_results.
-- Written by the processing pipeline at insertion time.
-- All columns are optional (nullable) to remain backwards-compatible with
-- manually-inserted leads that skip the quality engine.

ALTER TABLE lead_results
  ADD COLUMN IF NOT EXISTS email_quality      TEXT,
  ADD COLUMN IF NOT EXISTS email_type         TEXT,
  ADD COLUMN IF NOT EXISTS domain             TEXT,
  ADD COLUMN IF NOT EXISTS company_size       TEXT,
  ADD COLUMN IF NOT EXISTS industry           TEXT,
  ADD COLUMN IF NOT EXISTS seniority          TEXT,
  ADD COLUMN IF NOT EXISTS lead_score         INTEGER,
  ADD COLUMN IF NOT EXISTS confidence_score   INTEGER,
  ADD COLUMN IF NOT EXISTS normalized_title   TEXT,
  ADD COLUMN IF NOT EXISTS normalized_company TEXT;
