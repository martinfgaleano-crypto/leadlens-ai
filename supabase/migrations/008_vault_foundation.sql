-- 008_vault_foundation.sql
-- Creates the LeadLens Vault: global, cross-search lead intelligence layer.
-- Service role only — no RLS policies. Customers never read from this table.

CREATE TABLE IF NOT EXISTS vault_leads (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company
  company_name        TEXT        NOT NULL,
  normalized_company  TEXT,
  website             TEXT,
  domain              TEXT,

  -- Contact
  contact_name        TEXT,
  title               TEXT,
  normalized_title    TEXT,
  seniority           TEXT,

  -- Email
  email               TEXT,
  email_quality       TEXT,
  email_type          TEXT,

  -- Digital
  linkedin_url        TEXT,

  -- Location / segment
  country             TEXT,
  industry            TEXT,
  company_size        TEXT,

  source              TEXT,

  -- Scores (Phase 7–8)
  lead_score          INTEGER,
  confidence_score    INTEGER,
  opportunity_score   INTEGER,

  -- Enrichment (Phase 8)
  buyer_fit           TEXT,
  temperature         TEXT,
  ai_reasoning        TEXT,
  strengths           TEXT[],
  weaknesses          TEXT[],

  -- Vault metadata
  times_seen          INTEGER     NOT NULL DEFAULT 1,
  last_seen           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS vault_leads_email_idx              ON vault_leads (email)              WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_leads_domain_idx             ON vault_leads (domain)             WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_leads_normalized_company_idx ON vault_leads (normalized_company) WHERE normalized_company IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_leads_country_idx            ON vault_leads (country)            WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_leads_industry_idx           ON vault_leads (industry)           WHERE industry IS NOT NULL;
-- Default sort order
CREATE INDEX IF NOT EXISTS vault_leads_created_at_idx         ON vault_leads (created_at DESC);
