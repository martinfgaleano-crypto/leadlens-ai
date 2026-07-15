-- 033_source_review.sql
-- Human calibration of source-benchmark auto-flags. Admin-only; does not touch
-- ranking, ML training, or customer surfaces. Backend-only (service role);
-- RLS enabled, no policies (pattern of 024/029/031/032).
-- Apply after 032_ml_foundation.sql.

CREATE TABLE IF NOT EXISTS source_benchmark_reviews (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  result_key       TEXT        NOT NULL UNIQUE,   -- sha of canonical_url + query_id
  query_id         TEXT,
  region           TEXT,
  provider         TEXT,
  canonical_url    TEXT        NOT NULL,
  -- Human verdicts (booleans; NULL = not judged on that axis)
  company_match          BOOLEAN,
  relevant               BOOLEAN,
  date_valid             BOOLEAN,
  grounded_claim         BOOLEAN,
  valid_signal           BOOLEAN,
  qualified_opportunity  BOOLEAN,
  insufficient_evidence  BOOLEAN,
  -- The auto-flags at review time, so agreement can be computed later
  auto_flags       JSONB,
  reason_codes     TEXT[]      NOT NULL DEFAULT '{}',
  note             TEXT,
  reviewer         TEXT        NOT NULL DEFAULT 'admin',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_reviews_query_idx ON source_benchmark_reviews (query_id);

ALTER TABLE source_benchmark_reviews ENABLE ROW LEVEL SECURITY;
