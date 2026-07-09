-- 030_lead_hunter.sql
-- LeadLens Lead Hunter v0 — compliance-safe, signal-based, review-first
-- account discovery. Output = Vault candidates pending review. NOT a scraper,
-- NOT a contact database. See docs/strategy/LEADLENS_LEAD_HUNTER_ARCHITECTURE.md.
-- Admin/backend only (service role). Apply after 029_vault_foundation.sql.

CREATE TABLE IF NOT EXISTS lead_hunter_briefs (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT        NOT NULL,
  target_market              TEXT,
  region                     TEXT,
  country                    TEXT,
  industry                   TEXT,
  icp_notes                  TEXT,
  signal_types               TEXT[]      NOT NULL DEFAULT '{}',
  allowed_source_categories  TEXT[]      NOT NULL DEFAULT '{}',
  excluded_source_categories TEXT[]      NOT NULL DEFAULT '{}',
  max_candidates             INTEGER     NOT NULL DEFAULT 25,
  language                   TEXT        NOT NULL DEFAULT 'en',
  created_by_email           TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_hunter_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        UUID        REFERENCES lead_hunter_briefs(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'draft',      -- draft|queued|processing|completed|failed|cancelled
  provider_mode   TEXT        NOT NULL DEFAULT 'manual_sources',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  candidate_count INTEGER     NOT NULL DEFAULT 0,
  approved_count  INTEGER     NOT NULL DEFAULT 0,
  rejected_count  INTEGER     NOT NULL DEFAULT 0,
  error_message   TEXT,
  run_summary     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lh_runs_brief_idx  ON lead_hunter_runs (brief_id);
CREATE INDEX IF NOT EXISTS lh_runs_status_idx ON lead_hunter_runs (status);

CREATE TABLE IF NOT EXISTS lead_hunter_candidates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID        REFERENCES lead_hunter_runs(id) ON DELETE CASCADE,
  brief_id            UUID        REFERENCES lead_hunter_briefs(id) ON DELETE SET NULL,
  company_name        TEXT        NOT NULL,
  domain              TEXT,
  website_url         TEXT,
  region              TEXT,
  country             TEXT,
  industry            TEXT,
  signal_type         TEXT,
  signal_summary      TEXT,
  signal_date         DATE,
  source_url          TEXT        NOT NULL,   -- provenance is mandatory
  source_title        TEXT,
  source_category     TEXT        NOT NULL,
  evidence_snippet    TEXT,
  evidence_quality    TEXT,
  freshness_status    TEXT,
  confidence_score    INTEGER,
  fit_rationale       TEXT,
  suggested_action    TEXT,
  usage_rights_status TEXT        NOT NULL DEFAULT 'unverified',
  safety_status       TEXT        NOT NULL DEFAULT 'needs_review', -- ok|needs_review|blocked
  review_status       TEXT        NOT NULL DEFAULT 'pending_review', -- pending_review|approved|rejected|reserved
  review_notes        TEXT,
  vault_company_id    UUID,
  vault_contact_id    UUID,
  vault_signal_id     UUID,
  vault_source_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lh_cand_run_idx      ON lead_hunter_candidates (run_id);
CREATE INDEX IF NOT EXISTS lh_cand_brief_idx    ON lead_hunter_candidates (brief_id);
CREATE INDEX IF NOT EXISTS lh_cand_review_idx   ON lead_hunter_candidates (review_status);
CREATE INDEX IF NOT EXISTS lh_cand_safety_idx   ON lead_hunter_candidates (safety_status);
CREATE INDEX IF NOT EXISTS lh_cand_source_idx   ON lead_hunter_candidates (source_category);
CREATE INDEX IF NOT EXISTS lh_cand_signal_idx   ON lead_hunter_candidates (signal_type);
CREATE INDEX IF NOT EXISTS lh_cand_region_idx   ON lead_hunter_candidates (region, country);
CREATE INDEX IF NOT EXISTS lh_cand_conf_idx     ON lead_hunter_candidates (confidence_score);
CREATE INDEX IF NOT EXISTS lh_cand_url_idx      ON lead_hunter_candidates (source_url);
CREATE INDEX IF NOT EXISTS lh_cand_rights_idx   ON lead_hunter_candidates (usage_rights_status);

CREATE TABLE IF NOT EXISTS lead_hunter_source_inputs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID        REFERENCES lead_hunter_runs(id) ON DELETE CASCADE,
  source_url          TEXT        NOT NULL,
  source_title        TEXT,
  source_category     TEXT        NOT NULL,
  pasted_context      TEXT,
  usage_rights_status TEXT        NOT NULL DEFAULT 'unverified',
  safety_status       TEXT        NOT NULL DEFAULT 'needs_review',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lh_src_run_idx ON lead_hunter_source_inputs (run_id);
CREATE INDEX IF NOT EXISTS lh_src_url_idx ON lead_hunter_source_inputs (source_url);
