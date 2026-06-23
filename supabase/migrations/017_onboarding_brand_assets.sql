-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — Onboarding Brand Assets & Extended Fields (Phase 17 CX Sprint)
-- Extends onboarding_requests with brand, sender, and delivery columns.
-- New status vocabulary: new | in_review | ready_for_processing | completed
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE onboarding_requests
  ADD COLUMN IF NOT EXISTS linkedin_url           TEXT,
  ADD COLUMN IF NOT EXISTS value_proposition      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_persona          TEXT,
  ADD COLUMN IF NOT EXISTS exclusions             TEXT,
  ADD COLUMN IF NOT EXISTS target_company_sizes   TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_color            TEXT,
  ADD COLUMN IF NOT EXISTS sender_name            TEXT,
  ADD COLUMN IF NOT EXISTS sender_title           TEXT,
  ADD COLUMN IF NOT EXISTS sender_email           TEXT,
  ADD COLUMN IF NOT EXISTS credibility_statement  TEXT,
  ADD COLUMN IF NOT EXISTS proof_point            TEXT,
  ADD COLUMN IF NOT EXISTS delivery_email         TEXT;

-- Index for delivery email lookups
CREATE INDEX IF NOT EXISTS onboarding_requests_delivery_email_idx
  ON onboarding_requests(delivery_email);
