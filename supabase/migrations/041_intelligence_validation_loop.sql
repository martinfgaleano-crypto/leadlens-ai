-- Intelligence OS Block 4: append-only, tenant-scoped validation lifecycle.
-- Service-role only. Applying this migration does not enable ranking or reports.

CREATE TABLE IF NOT EXISTS intelligence_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  output_id TEXT NOT NULL,
  validation_state TEXT NOT NULL CHECK (validation_state IN (
    'unreviewed','human_approved','human_corrected','client_relevant','client_rejected',
    'acted_upon','confirmed','partially_confirmed','refuted','no_outcome','expired'
  )),
  output_snapshot JSONB NOT NULL,
  lifecycle_snapshot JSONB NOT NULL,
  report_eligibility TEXT NOT NULL CHECK (report_eligibility IN (
    'internal_only','review_required','customer_safe_with_limitations','customer_safe','expired'
  )),
  methodology_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS intelligence_validation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID NOT NULL REFERENCES intelligence_validations(id) ON DELETE RESTRICT,
  tenant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  output_id TEXT NOT NULL,
  review JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS intelligence_commercial_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID NOT NULL REFERENCES intelligence_validations(id) ON DELETE RESTRICT,
  tenant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  output_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_kind TEXT NOT NULL CHECK (action_kind IN ('research','save','contact','response','meeting','proposal','other')),
  action_snapshot JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_user_id, idempotency_key),
  UNIQUE (tenant_user_id, action_id)
);

CREATE TABLE IF NOT EXISTS intelligence_commercial_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID NOT NULL REFERENCES intelligence_validations(id) ON DELETE RESTRICT,
  tenant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  output_id TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  outcome_kind TEXT NOT NULL CHECK (outcome_kind IN ('progressed','terminal_positive','terminal_negative','no_outcome')),
  attribution_confidence NUMERIC NOT NULL CHECK (attribution_confidence >= 0 AND attribution_confidence <= 1),
  attribution_limitations JSONB NOT NULL CHECK (jsonb_array_length(attribution_limitations) > 0),
  outcome_snapshot JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_user_id, idempotency_key),
  UNIQUE (tenant_user_id, outcome_id),
  FOREIGN KEY (tenant_user_id, action_id) REFERENCES intelligence_commercial_actions(tenant_user_id, action_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS intelligence_learning_implications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID NOT NULL REFERENCES intelligence_validations(id) ON DELETE RESTRICT,
  tenant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  output_id TEXT NOT NULL,
  implication_id TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  implication_type TEXT NOT NULL CHECK (implication_type IN ('reinforce','correct','investigate','exception','no_learning')),
  mode TEXT NOT NULL CHECK (mode IN ('observation','shadow','human_reviewed')),
  human_approved BOOLEAN NOT NULL DEFAULT false,
  ranking_impact TEXT NOT NULL DEFAULT 'off' CHECK (ranking_impact = 'off'),
  implication_snapshot JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_user_id, idempotency_key),
  UNIQUE (tenant_user_id, implication_id),
  FOREIGN KEY (tenant_user_id, outcome_id) REFERENCES intelligence_commercial_outcomes(tenant_user_id, outcome_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS intelligence_validations_output_idx
  ON intelligence_validations (tenant_user_id, output_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_actions_output_idx
  ON intelligence_commercial_actions (tenant_user_id, output_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_outcomes_output_idx
  ON intelligence_commercial_outcomes (tenant_user_id, output_id, created_at DESC);

ALTER TABLE intelligence_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_validation_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_commercial_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_commercial_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_learning_implications ENABLE ROW LEVEL SECURITY;

-- Deliberately no authenticated policies: writes/reads are mediated by trusted
-- server services that derive tenant and actor identity. Service role bypasses RLS.
