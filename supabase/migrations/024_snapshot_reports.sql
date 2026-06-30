-- 024_snapshot_reports.sql
-- Persists LeadLens AI pipeline runs (opportunity snapshots).
-- report_json contains sensitive commercial intelligence — RLS enabled.
-- All backend access uses the service role key, which bypasses RLS by design.
-- No anon or authenticated policies are created; this table is backend-only.

CREATE TABLE IF NOT EXISTS snapshot_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      TEXT        NOT NULL,
  plan        TEXT        NOT NULL DEFAULT 'starter',
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'completed'
                          CHECK (status IN ('processing', 'completed', 'failed')),
  lead_count  INTEGER,
  hot_count   INTEGER,
  warm_count  INTEGER,
  avg_score   NUMERIC,
  report_json JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique on job_id so upsert is safe
CREATE UNIQUE INDEX IF NOT EXISTS snapshot_reports_job_id_idx
  ON snapshot_reports (job_id);

CREATE INDEX IF NOT EXISTS snapshot_reports_created_idx
  ON snapshot_reports (created_at DESC);

-- RLS enabled — no public policies; service role bypasses RLS automatically
ALTER TABLE snapshot_reports ENABLE ROW LEVEL SECURITY;
