-- 009_company_profiles.sql
-- Company intelligence layer: aggregates contacts into reusable company profiles.
-- Populated automatically by the lead processing pipeline.
-- Service role only — no RLS.

CREATE TABLE IF NOT EXISTS company_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  normalized_company  TEXT        NOT NULL UNIQUE,
  company_name        TEXT        NOT NULL,
  domain              TEXT,

  -- Segment
  industry            TEXT,
  company_size        TEXT,

  -- Aggregate intelligence
  countries_seen      TEXT[]      NOT NULL DEFAULT '{}',
  titles_seen         TEXT[]      NOT NULL DEFAULT '{}',
  contacts_count      INTEGER     NOT NULL DEFAULT 0,
  times_seen          INTEGER     NOT NULL DEFAULT 1,

  -- Scores
  average_score       INTEGER,
  top_score           INTEGER,

  -- Timestamps
  first_seen          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_profiles_normalized_company_idx ON company_profiles (normalized_company);
CREATE INDEX IF NOT EXISTS company_profiles_domain_idx             ON company_profiles (domain)   WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_profiles_industry_idx           ON company_profiles (industry) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_profiles_top_score_idx          ON company_profiles (top_score DESC);
CREATE INDEX IF NOT EXISTS company_profiles_created_at_idx         ON company_profiles (created_at DESC);
