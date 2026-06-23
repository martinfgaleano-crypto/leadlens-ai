-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — Public Onboarding Requests (Phase 17)
-- Tracks public form submissions before account creation completes.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS onboarding_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact
  full_name         TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  company_name      TEXT        NOT NULL,
  website           TEXT,
  country           TEXT,
  phone             TEXT,

  -- Business
  what_you_sell     TEXT        NOT NULL,
  ideal_customer    TEXT        NOT NULL,
  target_countries  TEXT[]      NOT NULL DEFAULT '{}',
  target_industries TEXT[]      NOT NULL DEFAULT '{}',
  target_job_titles TEXT[]      NOT NULL DEFAULT '{}',
  notes             TEXT,

  -- Brand
  logo_url          TEXT,

  -- Plan
  plan              TEXT        NOT NULL DEFAULT 'starter',
  lead_count        INTEGER     NOT NULL DEFAULT 10,

  -- Status
  status            TEXT        NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  admin_notes       TEXT,

  -- Links to auto-created records
  user_id           UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  icp_id            UUID,
  search_id         UUID,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onboarding_requests_status_idx     ON onboarding_requests(status);
CREATE INDEX IF NOT EXISTS onboarding_requests_email_idx      ON onboarding_requests(email);
CREATE INDEX IF NOT EXISTS onboarding_requests_created_at_idx ON onboarding_requests(created_at DESC);

DROP TRIGGER IF EXISTS onboarding_requests_set_updated_at ON onboarding_requests;
CREATE TRIGGER onboarding_requests_set_updated_at
  BEFORE UPDATE ON onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
