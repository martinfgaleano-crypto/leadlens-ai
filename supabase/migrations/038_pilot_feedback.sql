-- ─── 038: Tier-level pilot feedback (managed_pilot_v0) ───────────────────────
-- Additive. Stores per-tier debrief feedback from complimentary pilot runs:
-- perceived value, willingness to pay, decision impact. Account-level feedback
-- keeps using the existing opportunity-feedback flow; this table is the
-- TIER-level layer (one row per submitted debrief answer set).
-- Service-role writes only (admin-mediated pilots); no client PII beyond the
-- email already present on the job.

CREATE TABLE IF NOT EXISTS tier_feedback (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_job_id        TEXT        NOT NULL,             -- batch_jobs.id of the pilot run
  pilot_id            TEXT,                             -- pilot_<ts> audit id
  product_code        TEXT        NOT NULL,
  tier                TEXT        NOT NULL,
  reference_price     NUMERIC,
  usefulness          INTEGER     CHECK (usefulness BETWEEN 1 AND 5),
  actionability       INTEGER     CHECK (actionability BETWEEN 1 AND 5),
  evidence_trust      INTEGER     CHECK (evidence_trust BETWEEN 1 AND 5),
  perceived_value_usd NUMERIC,                          -- what the client says it is worth
  would_pay           BOOLEAN,                          -- would pay the reference price
  decision_changed    BOOLEAN,
  accounts_would_work INTEGER,                          -- how many accounts they would actually pursue
  best_section        TEXT,
  confusing_section   TEXT,
  missing_expected    TEXT,
  upgrade_interest    BOOLEAN,
  monitoring_interest BOOLEAN,
  comments            TEXT,
  submitted_by        TEXT        NOT NULL DEFAULT 'admin_debrief',  -- admin-mediated capture
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tier_feedback_job ON tier_feedback (pilot_job_id);
CREATE INDEX IF NOT EXISTS idx_tier_feedback_tier ON tier_feedback (tier);

-- RLS: deny-all by default; only the service role (server) reads/writes.
ALTER TABLE tier_feedback ENABLE ROW LEVEL SECURITY;
