-- 028_onboarding_search_id_idx.sql
-- Adds an index on onboarding_requests.search_id to support the rerun endpoint query:
--   SELECT ... FROM onboarding_requests WHERE search_id = $1 ORDER BY created_at DESC LIMIT 1
--
-- The column was added in 016_onboarding_requests.sql without an index.
-- Partial index (WHERE search_id IS NOT NULL) keeps it small — only rows that
-- have a linked search are indexed, which is the only case queried.

CREATE INDEX IF NOT EXISTS onboarding_requests_search_id_idx
  ON onboarding_requests (search_id)
  WHERE search_id IS NOT NULL;
