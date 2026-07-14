-- 031_intelligence_foundation.sql
-- Intelligence Foundation v0: structured feedback (reason codes + immutable
-- feature snapshots + decision versions) and observation-only learned
-- preferences. NOTHING in this migration affects selection, scoring or
-- ranking — learned_preferences is written by a batch learner and read only
-- by admin surfaces. Backend-only (service role); RLS enabled, no policies
-- (same pattern as 024/029). Apply after 030_lead_hunter.sql.

-- ── 1. opportunity_feedback: additive intelligence columns ────────────────────
ALTER TABLE opportunity_feedback
  ADD COLUMN IF NOT EXISTS reason_codes            TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS feature_snapshot        JSONB,
  ADD COLUMN IF NOT EXISTS versions                JSONB,
  ADD COLUMN IF NOT EXISTS normalized_sentiment    SMALLINT,
  ADD COLUMN IF NOT EXISTS feedback_schema_version INTEGER  NOT NULL DEFAULT 1;

-- normalized_sentiment: -1 | 0 | 1 | NULL (NULL = operational event, no fit sentiment)
DO $$ BEGIN
  ALTER TABLE opportunity_feedback
    ADD CONSTRAINT opportunity_feedback_sentiment_chk
    CHECK (normalized_sentiment IS NULL OR normalized_sentiment IN (-1, 0, 1));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS opp_feedback_reason_codes_idx ON opportunity_feedback USING GIN (reason_codes);
CREATE INDEX IF NOT EXISTS opp_feedback_user_created_idx ON opportunity_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS opp_feedback_search_created_idx ON opportunity_feedback (search_id, created_at DESC);

-- ── 2. learned_preferences: observation-only preference aggregates ────────────
CREATE TABLE IF NOT EXISTS learned_preferences (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id        UUID        NOT NULL,   -- auth.users id; no FK: preferences must survive user-table churn for audit
  scope                 TEXT        NOT NULL CHECK (scope IN ('customer', 'monitor')),
  monitor_id            UUID,                   -- lead_searches.id when scope = 'monitor'
  feature_key           TEXT        NOT NULL,   -- e.g. signal_type.expansion, freshness_bucket.stale, combo.expansion+hiring
  direction             TEXT        NOT NULL CHECK (direction IN ('positive', 'negative', 'neutral')),
  status                TEXT        NOT NULL DEFAULT 'inferred_weak'
                                    CHECK (status IN ('explicit', 'inferred_weak', 'inferred_validated', 'frozen', 'revoked')),
  strength              NUMERIC,                -- Laplace-smoothed positive proportion (pos+1)/(pos+neg+2)
  confidence            NUMERIC,                -- Wilson 95% lower bound of positive proportion
  effective_confidence  NUMERIC,                -- confidence * 0.5^(days_since_last_obs / half_life_days)
  observations          INTEGER     NOT NULL DEFAULT 0,
  positive_obs          INTEGER     NOT NULL DEFAULT 0,
  neutral_obs           INTEGER     NOT NULL DEFAULT 0,
  negative_obs          INTEGER     NOT NULL DEFAULT 0,
  distinct_report_count INTEGER     NOT NULL DEFAULT 0,
  evidence_source       TEXT        NOT NULL DEFAULT 'customer_feedback'
                                    CHECK (evidence_source IN ('customer_feedback', 'explicit_setting', 'outcome')),
  first_observed_at     TIMESTAMPTZ,
  last_observed_at      TIMESTAMPTZ,
  half_life_days        INTEGER     NOT NULL DEFAULT 90,
  max_rank_impact       NUMERIC     NOT NULL DEFAULT 5,   -- future metadata; unused while observation-only
  can_affect_ranking    BOOLEAN     NOT NULL DEFAULT false,
  explanation           TEXT,
  version               INTEGER     NOT NULL DEFAULT 1,
  audit_trail           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique identity per tenant/scope/monitor/feature (NULL-safe via expression index)
CREATE UNIQUE INDEX IF NOT EXISTS learned_prefs_identity_idx
  ON learned_preferences (tenant_user_id, scope, COALESCE(monitor_id, '00000000-0000-0000-0000-000000000000'::uuid), feature_key);
CREATE INDEX IF NOT EXISTS learned_prefs_tenant_idx  ON learned_preferences (tenant_user_id, status);
CREATE INDEX IF NOT EXISTS learned_prefs_monitor_idx ON learned_preferences (monitor_id) WHERE monitor_id IS NOT NULL;

-- Backend-only: RLS on, no anon/authenticated policies; service role bypasses.
ALTER TABLE learned_preferences ENABLE ROW LEVEL SECURITY;
