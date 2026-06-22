-- 011_lead_hunter.sql
-- Lead Hunter Foundation: source catalog, run tracking, and match attribution.
-- Architecture only — no scraping logic lives here.

-- ─── lead_sources ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_sources (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO lead_sources (name, description, active) VALUES
  ('apollo',           'Apollo.io people search API',                    true),
  ('google_maps',      'Google Maps Places API for local business data',  false),
  ('linkedin',         'LinkedIn public profile scraping',                false),
  ('company_websites', 'Direct company website contact extraction',       false),
  ('directories',      'Business directories (Yelp, Yellow Pages, etc.)', false),
  ('crunchbase',       'Crunchbase startup and investor data',            false)
ON CONFLICT (name) DO NOTHING;

-- ─── source_runs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS source_runs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id      UUID        REFERENCES lead_searches(id) ON DELETE SET NULL,
  source_name    TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'processing'
                             CHECK (status IN ('processing', 'completed', 'failed', 'skipped')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  duration_ms    INTEGER,
  results_found  INTEGER     NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_runs_search_id_idx    ON source_runs (search_id)    WHERE search_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS source_runs_source_name_idx  ON source_runs (source_name);
CREATE INDEX IF NOT EXISTS source_runs_status_idx       ON source_runs (status);
CREATE INDEX IF NOT EXISTS source_runs_started_at_idx   ON source_runs (started_at DESC);

-- ─── lead_source_matches ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_source_matches (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_result_id UUID        NOT NULL REFERENCES lead_results(id) ON DELETE CASCADE,
  source_name    TEXT        NOT NULL,
  confidence     INTEGER     CHECK (confidence BETWEEN 0 AND 100),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_source_matches_lead_id_idx     ON lead_source_matches (lead_result_id);
CREATE INDEX IF NOT EXISTS lead_source_matches_source_name_idx ON lead_source_matches (source_name);

ALTER TABLE lead_source_matches ENABLE ROW LEVEL SECURITY;
-- Service role only — no customer policies.
