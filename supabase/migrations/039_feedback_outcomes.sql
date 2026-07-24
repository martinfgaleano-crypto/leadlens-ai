-- 039_feedback_outcomes.sql
-- Separates research-quality labels from workflow and commercial outcomes.
-- Commercial progress must never be interpreted as fit sentiment. Also makes
-- feedback retries idempotent under concurrent requests at the database layer.

ALTER TABLE opportunity_feedback
  ADD COLUMN IF NOT EXISTS feedback_dimension TEXT NOT NULL DEFAULT 'research_quality',
  ADD COLUMN IF NOT EXISTS commercial_outcome TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$ BEGIN
  ALTER TABLE opportunity_feedback ADD CONSTRAINT opportunity_feedback_dimension_chk
    CHECK (feedback_dimension IN ('research_quality','commercial_outcome','workflow'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE opportunity_feedback ADD CONSTRAINT opportunity_feedback_outcome_chk
    CHECK (commercial_outcome IS NULL OR commercial_outcome IN ('progressed','terminal_positive','terminal_negative'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing semantic contract: one lifecycle signal per account per run.
-- Preserve the earliest event and remove only exact semantic retries before
-- adding the unique index. Different lifecycle stages remain separate rows.
DELETE FROM opportunity_feedback newer
USING opportunity_feedback older
WHERE newer.job_id IS NOT NULL
  AND older.job_id = newer.job_id
  AND lower(older.company) = lower(newer.company)
  AND older.feedback_signal = newer.feedback_signal
  AND (older.created_at < newer.created_at OR (older.created_at = newer.created_at AND older.id < newer.id));

CREATE UNIQUE INDEX IF NOT EXISTS opp_feedback_semantic_idempotency_idx
  ON opportunity_feedback (job_id, lower(company), feedback_signal)
  WHERE job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS opp_feedback_client_idempotency_idx
  ON opportunity_feedback (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS opp_feedback_dimension_created_idx
  ON opportunity_feedback (feedback_dimension, created_at DESC);
