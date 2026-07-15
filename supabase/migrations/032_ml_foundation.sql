-- 032_ml_foundation.sql
-- ML Foundation v0: training examples, labels with provenance, dataset
-- versions, model registry, shadow predictions and async ML jobs. Everything
-- here is OBSERVATION/SHADOW infrastructure — nothing is read by the selector,
-- scorer, Decision Engine or any customer-facing route. Backend-only (service
-- role); RLS enabled, no policies (pattern of 024/029/031).
-- Apply after 031_intelligence_foundation.sql.

-- ── Training examples (real opportunities → versioned ML rows) ────────────────
CREATE TABLE IF NOT EXISTS ml_training_examples (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  example_key            TEXT        NOT NULL UNIQUE,      -- deterministic: sha256(job_id|company_key)
  company_key_hash       TEXT        NOT NULL,             -- sha256 of normalized company key (no raw names required downstream)
  tenant_user_id         UUID,                             -- restricted reference: NEVER exported as a model feature
  search_id              UUID,
  job_id                 TEXT,
  feature_snapshot       JSONB       NOT NULL,
  feature_schema_version INTEGER     NOT NULL DEFAULT 1,
  baseline_meta          JSONB,                            -- baseline score/rank/category — EXCLUDED from independent model features
  provenance             TEXT        NOT NULL DEFAULT 'real_unlabeled'
                                     CHECK (provenance IN ('real_unlabeled','weak_labeled','llm_silver','human_gold','customer_feedback','confirmed_outcome','demo_fixture')),
  label_status           TEXT        NOT NULL DEFAULT 'unlabeled'
                                     CHECK (label_status IN ('unlabeled','weak','silver','gold','conflict','abstain')),
  aggregated_label       SMALLINT    CHECK (aggregated_label IS NULL OR aggregated_label IN (0, 1)),
  aggregated_probability NUMERIC,
  near_duplicate_cluster TEXT,                             -- company_key_hash by default; leakage-safe group splits
  split_assignment       TEXT        CHECK (split_assignment IS NULL OR split_assignment IN ('train','validation','test')),
  dataset_version        TEXT,
  review_priority_score  NUMERIC,
  review_priority_reason TEXT,
  missingness            JSONB,
  demo_only              BOOLEAN     NOT NULL DEFAULT false,  -- fixtures NEVER mix into real datasets (builder + gate enforce)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ml_examples_company_idx ON ml_training_examples (company_key_hash);
CREATE INDEX IF NOT EXISTS ml_examples_status_idx  ON ml_training_examples (label_status, demo_only);
CREATE INDEX IF NOT EXISTS ml_examples_dataset_idx ON ml_training_examples (dataset_version);
CREATE INDEX IF NOT EXISTS ml_examples_review_idx  ON ml_training_examples (review_priority_score DESC NULLS LAST);

-- ── Labels (every label carries full provenance) ──────────────────────────────
CREATE TABLE IF NOT EXISTS ml_labels (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  training_example_id UUID        NOT NULL REFERENCES ml_training_examples(id) ON DELETE CASCADE,
  source_type         TEXT        NOT NULL CHECK (source_type IN ('weak_labeler','llm_judge','human_reviewer','customer_feedback','confirmed_outcome')),
  label               SMALLINT    CHECK (label IS NULL OR label IN (0, 1)),   -- NULL = abstained
  probability         NUMERIC,
  confidence          NUMERIC,
  reason_codes        TEXT[]      NOT NULL DEFAULT '{}',
  labeler_id          TEXT        NOT NULL,   -- e.g. weak:stale_signal, judge:evidence, human:<admin>
  labeler_version     TEXT        NOT NULL DEFAULT '1',
  abstained           BOOLEAN     NOT NULL DEFAULT false,
  conflict            BOOLEAN     NOT NULL DEFAULT false,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ml_labels_example_idx ON ml_labels (training_example_id);
CREATE INDEX IF NOT EXISTS ml_labels_source_idx  ON ml_labels (source_type);

-- ── Dataset versions (reproducible manifests) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_dataset_versions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version        TEXT        NOT NULL UNIQUE,
  feature_schema_version INTEGER     NOT NULL,
  manifest               JSONB       NOT NULL,
  counts                 JSONB       NOT NULL DEFAULT '{}'::jsonb,
  checksum               TEXT,
  status                 TEXT        NOT NULL DEFAULT 'draft'
                                     CHECK (status IN ('draft','ready','blocked_insufficient_data','blocked_quality_gate','archived')),
  demo_only              BOOLEAN     NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Model registry (no automatic champion in v0) ─────────────────────────────
CREATE TABLE IF NOT EXISTS ml_models (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name        TEXT        NOT NULL,
  model_version     TEXT        NOT NULL,
  algorithm         TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'experimental'
                                CHECK (status IN ('experimental','candidate','shadow','challenger','champion','rejected','retired')),
  dataset_version   TEXT        NOT NULL,
  feature_schema    INTEGER     NOT NULL DEFAULT 1,
  artifact_path     TEXT        NOT NULL,     -- server-side path; artifacts are never public
  artifact_checksum TEXT        NOT NULL,
  metrics           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  demo_only         BOOLEAN     NOT NULL DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_name, model_version)
);

-- ── Shadow predictions (never read by ranking) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_predictions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id         UUID        REFERENCES ml_models(id) ON DELETE SET NULL,
  example_key      TEXT        NOT NULL,
  job_id           TEXT,
  probability      NUMERIC,
  predicted_class  SMALLINT    CHECK (predicted_class IS NULL OR predicted_class IN (0, 1)),
  ood              BOOLEAN     NOT NULL DEFAULT false,
  missingness      JSONB,
  top_factors      JSONB,
  shadow           JSONB,       -- baseline_rank, shadow_rank, rank_delta, would_enter_topk, would_leave_topk, disagreement
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ml_predictions_job_idx   ON ml_predictions (job_id);
CREATE INDEX IF NOT EXISTS ml_predictions_model_idx ON ml_predictions (model_id);

-- ── Async ML jobs (reuses the durable-row lifecycle convention) ───────────────
CREATE TABLE IF NOT EXISTS ml_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type    TEXT        NOT NULL CHECK (job_type IN ('dataset_build','weak_labeling','llm_judging','review_prioritization','training','evaluation','batch_inference','shadow_scoring','source_benchmark','growth_aggregation')),
  status      TEXT        NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  inputs      JSONB,
  outputs     JSONB,
  error       TEXT,
  idempotency_key TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ml_jobs_idempotency_idx ON ml_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ml_jobs_status_idx ON ml_jobs (job_type, status);

-- Backend-only: RLS on, no anon/authenticated policies; service role bypasses.
ALTER TABLE ml_training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_labels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_dataset_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_jobs              ENABLE ROW LEVEL SECURITY;
