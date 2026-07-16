-- 036_review_origin.sql
-- Distinguishes WHO adjudicated a signal review: human, ai_assisted, or
-- system_auto. Existing rows were created by the human admin via the review
-- UI → backfilled default 'human'. AI-assisted reviews always carry the agent
-- id, policy version and requires_human_confirmation=true. Additive; RLS
-- unchanged. Apply after 035_institutional_snapshots.sql.

ALTER TABLE vault_signal_reviews
  ADD COLUMN IF NOT EXISTS review_origin               TEXT    NOT NULL DEFAULT 'human'
    CHECK (review_origin IN ('human','ai_assisted','system_auto')),
  ADD COLUMN IF NOT EXISTS reviewer_agent              TEXT,
  ADD COLUMN IF NOT EXISTS review_policy_version       TEXT,
  ADD COLUMN IF NOT EXISTS review_confidence           NUMERIC,
  ADD COLUMN IF NOT EXISTS requires_human_confirmation BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS vsr_origin_idx ON vault_signal_reviews (review_origin);
