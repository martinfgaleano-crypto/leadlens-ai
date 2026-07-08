-- 029_vault_foundation.sql
-- LeadLens Vault Foundation v0 — compliance-safe research memory.
--
-- The Vault is NOT a resale contact database. Every record tracks source
-- provenance, usage rights, freshness, review status, suppression, and usage
-- history. See docs/strategy/LEADLENS_DATA_SOURCING_COMPLIANCE.md.
--
-- All tables are backend/admin-only (service role). Distinct from the legacy
-- vault_leads/vault_candidates tables (migrations 015/022) — no changes there.

-- ─── vault_companies ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_companies (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  domain               TEXT,
  website_url          TEXT,
  linkedin_company_url TEXT,        -- reference only; never scraped/automated
  industry             TEXT,
  region               TEXT,
  country              TEXT,
  company_size         TEXT,
  description          TEXT,
  source_status        TEXT,
  vault_status         TEXT        NOT NULL DEFAULT 'candidate',
  suppression_status   TEXT        NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_companies_domain_idx  ON vault_companies (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_companies_region_idx  ON vault_companies (region, country);
CREATE INDEX IF NOT EXISTS vault_companies_status_idx  ON vault_companies (vault_status);

-- ─── vault_contacts ───────────────────────────────────────────────────────────
-- Contacts stored ONLY with permitted sourcing; usage_rights_status is
-- mandatory context for any downstream use. Internal/admin only.

CREATE TABLE IF NOT EXISTS vault_contacts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID        REFERENCES vault_companies(id) ON DELETE CASCADE,
  full_name           TEXT,
  title               TEXT,
  seniority           TEXT,
  department          TEXT,
  email               TEXT,
  email_status        TEXT,
  linkedin_url        TEXT,        -- reference only; never automated
  region              TEXT,
  country             TEXT,
  source_status       TEXT,
  usage_rights_status TEXT        NOT NULL DEFAULT 'unverified',
  vault_status        TEXT        NOT NULL DEFAULT 'candidate',
  review_status       TEXT        NOT NULL DEFAULT 'pending_review',
  suppression_status  TEXT        NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_contacts_email_idx   ON vault_contacts (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_contacts_company_idx ON vault_contacts (company_id);
CREATE INDEX IF NOT EXISTS vault_contacts_review_idx  ON vault_contacts (review_status);
CREATE INDEX IF NOT EXISTS vault_contacts_status_idx  ON vault_contacts (vault_status);
CREATE INDEX IF NOT EXISTS vault_contacts_region_idx  ON vault_contacts (region, country);

-- ─── vault_sources ────────────────────────────────────────────────────────────
-- Provenance: where a record/claim came from and what we may do with it.

CREATE TABLE IF NOT EXISTS vault_sources (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         TEXT,
  source_type         TEXT        NOT NULL,
  source_url          TEXT,
  source_title        TEXT,
  retrieved_at        TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  freshness_status    TEXT,
  confidence_score    INTEGER,
  usage_rights_status TEXT        NOT NULL DEFAULT 'unverified',
  notes               TEXT,
  raw_metadata        JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_sources_url_idx  ON vault_sources (source_url) WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_sources_type_idx ON vault_sources (source_type);

-- ─── vault_signals ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_signals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        REFERENCES vault_companies(id) ON DELETE CASCADE,
  contact_id       UUID        REFERENCES vault_contacts(id) ON DELETE SET NULL,
  source_id        UUID        REFERENCES vault_sources(id) ON DELETE SET NULL,
  signal_type      TEXT        NOT NULL,
  signal_summary   TEXT,
  signal_date      DATE,
  expires_at       DATE,
  strength_score   INTEGER,
  confidence_score INTEGER,
  review_status    TEXT        NOT NULL DEFAULT 'pending_review',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_signals_company_idx ON vault_signals (company_id);
CREATE INDEX IF NOT EXISTS vault_signals_type_idx    ON vault_signals (signal_type);
CREATE INDEX IF NOT EXISTS vault_signals_review_idx  ON vault_signals (review_status);

-- ─── vault_usage_history ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_usage_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID        REFERENCES vault_companies(id) ON DELETE CASCADE,
  contact_id     UUID        REFERENCES vault_contacts(id) ON DELETE SET NULL,
  order_id       UUID,
  job_id         UUID,
  customer_email TEXT,
  usage_type     TEXT        NOT NULL,
  delivered_at   TIMESTAMPTZ,
  fit_score      INTEGER,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_usage_company_idx ON vault_usage_history (company_id);
CREATE INDEX IF NOT EXISTS vault_usage_contact_idx ON vault_usage_history (contact_id);

-- ─── vault_reservations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_reservations (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID        REFERENCES vault_companies(id) ON DELETE CASCADE,
  contact_id                UUID        REFERENCES vault_contacts(id) ON DELETE SET NULL,
  reserved_for_customer_email TEXT,
  reserved_for_order_id     UUID,
  reservation_reason        TEXT,
  expires_at                TIMESTAMPTZ,
  status                    TEXT        NOT NULL DEFAULT 'active',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_reservations_status_idx ON vault_reservations (status, expires_at);

-- ─── vault_suppression_list ───────────────────────────────────────────────────
-- Deletion/opt-out requests are respected here first.

CREATE TABLE IF NOT EXISTS vault_suppression_list (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  suppression_type TEXT        NOT NULL,   -- email | domain | company
  value            TEXT        NOT NULL,
  reason           TEXT        NOT NULL,
  source           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_suppression_value_idx ON vault_suppression_list (suppression_type, value);
