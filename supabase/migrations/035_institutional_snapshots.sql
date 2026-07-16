-- 035_institutional_snapshots.sql
-- Reproducible persistence of assembled Institutional Reports: one frozen,
-- checksummed snapshot per (job_id, schema_version). Presentation-layer only —
-- never read by ranking/selector. Backend-only; RLS on, no policies.
-- Apply after 034_vault_signal_review.sql.

CREATE TABLE IF NOT EXISTS institutional_report_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          TEXT        NOT NULL,
  schema_version  INTEGER     NOT NULL,
  report          JSONB       NOT NULL,        -- assembled InstitutionalOpportunityReportV1
  checksum        TEXT        NOT NULL,        -- sha256 of canonical JSON
  source_versions JSONB,                       -- _versions of the underlying report
  assembled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, schema_version)
);
CREATE INDEX IF NOT EXISTS irs_job_idx ON institutional_report_snapshots (job_id);

ALTER TABLE institutional_report_snapshots ENABLE ROW LEVEL SECURITY;
