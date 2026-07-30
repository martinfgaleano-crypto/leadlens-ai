-- 042_evidence_temporal_intelligence.sql
-- Block 6: canonical evidence → claims → historical account state → dossiers.
-- Backend/admin-only. This schema does not mutate ranking or customer reports.

CREATE TABLE IF NOT EXISTS intelligence_evidence (
  id TEXT PRIMARY KEY,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('account','market','segment')),
  scope_key TEXT NOT NULL,
  source_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  domain TEXT,
  publisher TEXT,
  source_type TEXT,
  provider TEXT,
  provider_result_id TEXT,
  title TEXT,
  excerpt TEXT,
  claim_text TEXT,
  claim_type TEXT,
  publication_date TIMESTAMPTZ,
  publication_date_state TEXT NOT NULL CHECK (publication_date_state IN ('exact','inferred','retrieved_only','conflicting','invalid','unknown')),
  publication_date_confidence NUMERIC CHECK (publication_date_confidence BETWEEN 0 AND 1),
  retrieved_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  language TEXT,
  country TEXT,
  entity_match TEXT,
  entity_match_confidence NUMERIC CHECK (entity_match_confidence BETWEEN 0 AND 1),
  source_quality NUMERIC CHECK (source_quality BETWEEN 0 AND 1),
  duplicate_cluster_id TEXT NOT NULL,
  syndicated_from TEXT,
  contradiction_group_id TEXT,
  extraction_method TEXT,
  methodology_version TEXT NOT NULL,
  raw_reference TEXT,
  supersedes_evidence_id TEXT REFERENCES intelligence_evidence(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_claims (
  id TEXT PRIMARY KEY,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('account','market','segment')),
  scope_key TEXT NOT NULL,
  category TEXT NOT NULL,
  statement TEXT NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  independent_source_count INTEGER NOT NULL DEFAULT 0 CHECK (independent_source_count >= 0),
  source_diversity INTEGER NOT NULL DEFAULT 0 CHECK (source_diversity >= 0),
  support_count INTEGER NOT NULL DEFAULT 0 CHECK (support_count >= 0),
  contradiction_count INTEGER NOT NULL DEFAULT 0 CHECK (contradiction_count >= 0),
  confidence NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh','recent','stale','unknown')),
  corroboration_state TEXT NOT NULL CHECK (corroboration_state IN ('unsupported','single_source','partially_corroborated','corroborated','strongly_corroborated','contradicted','stale','unresolved')),
  prior_claim_id TEXT REFERENCES intelligence_claims(id) ON DELETE SET NULL,
  change_reason TEXT,
  methodology_version TEXT NOT NULL,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_claim_evidence (
  claim_id TEXT NOT NULL REFERENCES intelligence_claims(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES intelligence_evidence(id) ON DELETE RESTRICT,
  relation TEXT NOT NULL CHECK (relation IN ('supports','contradicts','context')),
  semantic_compatibility NUMERIC CHECK (semantic_compatibility BETWEEN 0 AND 1),
  time_compatible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, evidence_id, relation)
);

CREATE TABLE IF NOT EXISTS intelligence_client_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  context_json JSONB NOT NULL,
  context_fingerprint TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_user_id, client_id, context_fingerprint)
);

CREATE TABLE IF NOT EXISTS intelligence_account_states (
  id TEXT PRIMARY KEY,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  account_key TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  fingerprint TEXT NOT NULL,
  structural_score NUMERIC,
  timing_state TEXT NOT NULL CHECK (timing_state IN ('current_opportunity','monitor','structural_only','insufficient_evidence','contradicted')),
  corroborated_claims INTEGER NOT NULL DEFAULT 0,
  contradicted_claims INTEGER NOT NULL DEFAULT 0,
  claim_ids TEXT[] NOT NULL DEFAULT '{}',
  material_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  methodology_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_user_id, client_id, account_key, fingerprint)
);

CREATE TABLE IF NOT EXISTS intelligence_dossiers (
  id TEXT PRIMARY KEY,
  tenant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  account_key TEXT NOT NULL,
  account_state_id TEXT NOT NULL REFERENCES intelligence_account_states(id) ON DELETE RESTRICT,
  dossier_json JSONB NOT NULL,
  internal_only BOOLEAN NOT NULL DEFAULT true CHECK (internal_only = true),
  methodology_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  supersedes_dossier_id TEXT REFERENCES intelligence_dossiers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_evidence_scope_idx ON intelligence_evidence (tenant_user_id, client_id, scope, scope_key, retrieved_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_evidence_canonical_idx ON intelligence_evidence (canonical_url, duplicate_cluster_id);
CREATE INDEX IF NOT EXISTS intelligence_claims_scope_idx ON intelligence_claims (tenant_user_id, client_id, scope_key, created_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_account_states_history_idx ON intelligence_account_states (tenant_user_id, client_id, account_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_dossiers_account_idx ON intelligence_dossiers (tenant_user_id, client_id, account_key, generated_at DESC);

ALTER TABLE intelligence_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_client_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_account_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_dossiers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE intelligence_evidence IS 'Backend-only canonical evidence registry. Duplicate or syndicated copies do not imply independent corroboration.';
COMMENT ON TABLE intelligence_dossiers IS 'Internal-only account intelligence dossiers; never a customer-facing report by default.';
