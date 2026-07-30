-- 043_signal_temporal_monitoring.sql
-- Block 8: internal-only immutable signal observations and bounded monitoring.
-- Generated for manual application. It does not schedule provider calls or affect ranking/reports.

CREATE TABLE IF NOT EXISTS intelligence_monitoring_runs (
  id TEXT PRIMARY KEY,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  baseline_cutoff TIMESTAMPTZ NOT NULL,
  source_cutoff TIMESTAMPTZ NOT NULL,
  requested_from TIMESTAMPTZ NOT NULL,
  requested_to TIMESTAMPTZ NOT NULL,
  limits_json JSONB NOT NULL,
  execution_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_date_behavior TEXT NOT NULL CHECK (provider_date_behavior = 'requested_not_guaranteed'),
  operational_mode TEXT NOT NULL CHECK (operational_mode = 'observation'),
  status TEXT NOT NULL CHECK (status IN ('planned','running','completed','failed')),
  error_code TEXT,
  ranking_impact TEXT NOT NULL DEFAULT 'off' CHECK (ranking_impact = 'off'),
  report_impact TEXT NOT NULL DEFAULT 'off' CHECK (report_impact = 'off'),
  methodology_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE NULLS NOT DISTINCT (tenant_user_id, client_id, baseline_cutoff, source_cutoff, methodology_version)
);

CREATE TABLE IF NOT EXISTS intelligence_monitoring_triggers (
  id TEXT PRIMARY KEY,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  account_id TEXT NOT NULL,
  category TEXT NOT NULL,
  trigger_json JSONB NOT NULL,
  baseline_cutoff TIMESTAMPTZ NOT NULL,
  active_status TEXT NOT NULL CHECK (active_status IN ('active','paused','retired')),
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  methodology_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  supersedes_trigger_id TEXT REFERENCES intelligence_monitoring_triggers(id) ON DELETE SET NULL,
  UNIQUE NULLS NOT DISTINCT (tenant_user_id, client_id, account_id, category, baseline_cutoff)
);

CREATE TABLE IF NOT EXISTS intelligence_signals (
  id TEXT PRIMARY KEY,
  signal_key TEXT NOT NULL,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  account_id TEXT NOT NULL,
  monitoring_run_id TEXT NOT NULL REFERENCES intelligence_monitoring_runs(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  normalized_event_type TEXT NOT NULL,
  event_statement TEXT NOT NULL,
  event_status TEXT NOT NULL,
  current_status TEXT NOT NULL,
  prior_status TEXT,
  publication_date TIMESTAMPTZ,
  effective_date TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL,
  first_observed TIMESTAMPTZ NOT NULL,
  last_observed TIMESTAMPTZ NOT NULL,
  claim_ids TEXT[] NOT NULL DEFAULT '{}',
  supporting_evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  contradicting_evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  provenance_json JSONB NOT NULL,
  assessment_json JSONB NOT NULL,
  operational_mode TEXT NOT NULL CHECK (operational_mode = 'observation'),
  review_state TEXT NOT NULL CHECK (review_state IN ('unreviewed','reviewed')),
  ranking_impact TEXT NOT NULL DEFAULT 'off' CHECK (ranking_impact = 'off'),
  report_impact TEXT NOT NULL DEFAULT 'off' CHECK (report_impact = 'off'),
  methodology_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  supersedes_signal_id TEXT REFERENCES intelligence_signals(id) ON DELETE SET NULL,
  UNIQUE NULLS NOT DISTINCT (tenant_user_id, client_id, signal_key, monitoring_run_id)
);

CREATE TABLE IF NOT EXISTS intelligence_signal_changes (
  id TEXT PRIMARY KEY,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  account_id TEXT NOT NULL,
  signal_key TEXT,
  monitoring_run_id TEXT NOT NULL REFERENCES intelligence_monitoring_runs(id) ON DELETE RESTRICT,
  prior_signal_id TEXT REFERENCES intelligence_signals(id) ON DELETE SET NULL,
  current_signal_id TEXT REFERENCES intelligence_signals(id) ON DELETE SET NULL,
  change_state TEXT NOT NULL,
  change_json JSONB NOT NULL,
  qualification_transition_json JSONB,
  methodology_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_user_id, client_id, monitoring_run_id, account_id, signal_key, change_state)
);

CREATE INDEX IF NOT EXISTS intelligence_monitoring_runs_scope_idx
  ON intelligence_monitoring_runs (tenant_user_id, client_id, source_cutoff DESC);
CREATE INDEX IF NOT EXISTS intelligence_monitoring_triggers_active_idx
  ON intelligence_monitoring_triggers (tenant_user_id, client_id, account_id, active_status, next_check_at);
CREATE INDEX IF NOT EXISTS intelligence_signals_history_idx
  ON intelligence_signals (tenant_user_id, client_id, account_id, signal_key, detected_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_signal_changes_history_idx
  ON intelligence_signal_changes (tenant_user_id, client_id, account_id, created_at DESC);

ALTER TABLE intelligence_monitoring_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_monitoring_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_signal_changes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE intelligence_monitoring_runs IS 'Backend-only bounded monitoring run ledger; no scheduler.';
COMMENT ON TABLE intelligence_monitoring_triggers IS 'Backend-only durable trigger definitions. Tenant identity is supplied server-side.';
COMMENT ON TABLE intelligence_signals IS 'Immutable internal signal observations with provenance; ranking and report impact remain off.';
COMMENT ON TABLE intelligence_signal_changes IS 'Immutable What Changed v2 and qualification-transition history.';
