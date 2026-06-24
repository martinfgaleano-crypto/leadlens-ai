-- ═══════════════════════════════════════════════════════════════════════════
-- LeadLens Phase 22 — Vault Candidate System
--
-- vault_candidates  : staging area for companies discovered before a customer
--                     requests them. Claude Scout → Claude Reviewer → Vault.
-- candidate_sources : registry of scout routines (future automation).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── vault_candidates ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_candidates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company identity
  company_name        TEXT        NOT NULL,
  website             TEXT,
  domain              TEXT,

  -- Segment
  country             TEXT,
  industry            TEXT,

  -- Discovery provenance
  source_url          TEXT,
  source_type         TEXT,        -- "manual" | "claude_scout" | "import" | etc.
  discovered_by       TEXT,        -- agent name, admin user, or source label

  -- Raw notes from the scout (free text, not structured)
  raw_notes           TEXT,

  -- Review
  confidence_score    INTEGER      CHECK (confidence_score BETWEEN 0 AND 100),
  review_status       TEXT         NOT NULL DEFAULT 'new'
                                   CHECK (review_status IN ('new','needs_review','approved','rejected','duplicate')),
  claude_review_notes TEXT,
  approved_for_vault  BOOLEAN      NOT NULL DEFAULT false,

  -- Deduplication: points to the canonical record when this is a duplicate
  duplicate_of        UUID         REFERENCES vault_candidates (id) ON DELETE SET NULL,

  -- Promotion tracking
  promoted_at         TIMESTAMPTZ,

  -- Timestamps
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  reviewed_at         TIMESTAMPTZ
);

-- Lookup / filter indexes
CREATE INDEX IF NOT EXISTS vc_website_idx       ON vault_candidates (website)       WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS vc_domain_idx        ON vault_candidates (domain)        WHERE domain  IS NOT NULL;
CREATE INDEX IF NOT EXISTS vc_country_idx       ON vault_candidates (country)       WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS vc_industry_idx      ON vault_candidates (industry)      WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS vc_review_status_idx ON vault_candidates (review_status);
CREATE INDEX IF NOT EXISTS vc_approved_idx      ON vault_candidates (approved_for_vault) WHERE approved_for_vault = true;
CREATE INDEX IF NOT EXISTS vc_created_at_idx    ON vault_candidates (created_at DESC);

-- ── candidate_sources ─────────────────────────────────────────────────────────
-- Registry of scout routines. Populated manually today; future Claude Scout
-- routines will register themselves here and update last_run / last_results.

CREATE TABLE IF NOT EXISTS candidate_sources (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  source_name   TEXT        NOT NULL UNIQUE,
  source_type   TEXT,        -- "manual" | "claude_task" | "rss" | "api" | etc.
  active        BOOLEAN     NOT NULL DEFAULT true,

  last_run      TIMESTAMPTZ,
  last_results  INTEGER,     -- # of candidates submitted in the last run
  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed one manual source so the table is never empty from day one
INSERT INTO candidate_sources (source_name, source_type, active, notes)
VALUES ('manual_admin', 'manual', true, 'Candidates submitted manually by admin staff.')
ON CONFLICT (source_name) DO NOTHING;
