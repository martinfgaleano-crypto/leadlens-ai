-- 007_ai_enrichment.sql
-- Adds AI enrichment columns to lead_results.
-- Computed server-side by pure functions at insertion time — no LLM required.
-- All columns nullable for backwards compatibility with pre-Phase 8 leads.

ALTER TABLE lead_results
  ADD COLUMN IF NOT EXISTS ai_reasoning      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_fit         TEXT,
  ADD COLUMN IF NOT EXISTS temperature       TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_score INTEGER,
  ADD COLUMN IF NOT EXISTS strengths         TEXT[],
  ADD COLUMN IF NOT EXISTS weaknesses        TEXT[];
