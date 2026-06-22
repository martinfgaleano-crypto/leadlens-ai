-- 004_lead_results.sql
-- Lead delivery table. Admins populate rows via service role;
-- customers can only SELECT their own results through the join below.

CREATE TABLE IF NOT EXISTS lead_results (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id    UUID        NOT NULL REFERENCES lead_searches(id) ON DELETE CASCADE,
  company_name TEXT        NOT NULL,
  website      TEXT,
  contact_name TEXT,
  title        TEXT,
  email        TEXT,
  linkedin_url TEXT,
  country      TEXT,
  source       TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_results_search_id_idx ON lead_results(search_id);

ALTER TABLE lead_results ENABLE ROW LEVEL SECURITY;

-- Customers may read results that belong to their own searches.
DROP POLICY IF EXISTS "lead_results_select_own" ON lead_results;
CREATE POLICY "lead_results_select_own"
  ON lead_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_searches
      WHERE lead_searches.id   = lead_results.search_id
        AND lead_searches.user_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policies for authenticated role.
-- Only the service role key (admin API routes) may write to this table.
