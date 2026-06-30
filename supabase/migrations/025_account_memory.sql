-- 025_account_memory.sql
-- Tracks which accounts (companies) have appeared in previous pipeline runs.
-- Used by the Anti-Repetition layer to classify novelty and exclude do_not_show accounts.
-- No personal data — company-level only.
-- All backend access uses the service role key (bypasses RLS by design).

CREATE TABLE IF NOT EXISTS account_memory (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           TEXT        NOT NULL DEFAULT 'global',

  -- Match keys (normalized for case/punctuation-insensitive matching)
  normalized_domain   TEXT,                          -- e.g. "acmecorp.com" — primary match key
  normalized_company  TEXT        NOT NULL,          -- e.g. "acme corp" — fallback match key
  country             TEXT,                          -- from candidate.location, for company fallback

  -- Lifecycle tracking
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_job_id         TEXT,                          -- which snapshot last included this account
  times_seen          INTEGER     NOT NULL DEFAULT 1 CHECK (times_seen >= 1),

  -- Last known state
  last_category       TEXT        CHECK (last_category IN ('HOT','WARM','COLD','DISCARD')),
  last_fit_score      NUMERIC     CHECK (last_fit_score BETWEEN 0 AND 10),

  -- Account Memory state (computed at pipeline time)
  state               TEXT        NOT NULL DEFAULT 'new_opportunity'
                      CHECK (state IN (
                        'new_opportunity',
                        'previously_seen',
                        'repeated_without_new_signal',
                        'reactivated_with_new_signal',
                        'upgraded_priority',
                        'downgraded_priority',
                        'dropped',
                        'do_not_show'
                      )),

  do_not_show         BOOLEAN     NOT NULL DEFAULT false,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary deduplication: domain (most reliable match)
CREATE UNIQUE INDEX IF NOT EXISTS account_memory_domain_idx
  ON account_memory (client_id, normalized_domain)
  WHERE normalized_domain IS NOT NULL;

-- Secondary lookup: company name within client
CREATE INDEX IF NOT EXISTS account_memory_company_idx
  ON account_memory (client_id, normalized_company);

-- Fast lookup for do_not_show exclusions
CREATE INDEX IF NOT EXISTS account_memory_dontshow_idx
  ON account_memory (client_id)
  WHERE do_not_show = true;

-- RLS enabled — no public policies; service role bypasses RLS automatically
ALTER TABLE account_memory ENABLE ROW LEVEL SECURITY;
