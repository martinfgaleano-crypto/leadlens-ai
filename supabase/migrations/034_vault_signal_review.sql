-- 034_vault_signal_review.sql
-- Governed human review of Vault signals: append-only audit trail of review
-- decisions (rights, evidence tier, verdicts, dedupe cluster). Admin-only;
-- backend writes. Never overwrites a human decision — each change is a new row;
-- the active decision is the most recent. Does not change ranking/selector.
-- Backend-only (service role); RLS enabled, no policies (024/029/031/032/033).
-- Apply after 033_source_review.sql.

CREATE TABLE IF NOT EXISTS vault_signal_reviews (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id             UUID        NOT NULL,   -- vault_signals.id (no FK: audit survives signal churn)
  reviewer_user_id      TEXT        NOT NULL,   -- reviewer identity (mandatory)
  review_status         TEXT        NOT NULL CHECK (review_status IN
                          ('pending_review','in_review','approved','approved_monitor_only','quarantined','rejected','duplicate','revoked')),
  rights_status         TEXT        CHECK (rights_status IS NULL OR rights_status IN
                          ('metadata_only','link_and_summary_allowed','short_excerpt_allowed','customer_display_allowed','internal_only','restricted','unknown')),
  evidence_tier         TEXT        CHECK (evidence_tier IS NULL OR evidence_tier IN ('A','B','C','D','E')),
  company_match_verdict BOOLEAN,
  date_verdict          BOOLEAN,
  claim_verdict         BOOLEAN,
  signal_verdict        BOOLEAN,
  opportunity_verdict   BOOLEAN,
  duplicate_cluster_id  TEXT,
  canonical_signal_id   UUID,
  reason_codes          TEXT[]      NOT NULL DEFAULT '{}',
  reviewer_note         TEXT,
  reviewed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_version        INTEGER     NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS vsr_signal_idx  ON vault_signal_reviews (signal_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS vsr_status_idx  ON vault_signal_reviews (review_status);
CREATE INDEX IF NOT EXISTS vsr_cluster_idx ON vault_signal_reviews (duplicate_cluster_id) WHERE duplicate_cluster_id IS NOT NULL;

ALTER TABLE vault_signal_reviews ENABLE ROW LEVEL SECURITY;
