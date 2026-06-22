-- 013_search_credit_usage.sql
-- Adds credit tracking and clean observability columns to lead_searches.

ALTER TABLE lead_searches
  ADD COLUMN IF NOT EXISTS credits_consumed          INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message             TEXT;

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_lead_searches_credits_consumed
  ON lead_searches (credits_consumed);

CREATE INDEX IF NOT EXISTS idx_lead_searches_processing_started_at
  ON lead_searches (processing_started_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_lead_searches_processing_completed_at
  ON lead_searches (processing_completed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_lead_searches_error_message_not_null
  ON lead_searches (id)
  WHERE error_message IS NOT NULL;
