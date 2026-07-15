-- PRELIMINARY DESIGN ONLY
-- DO NOT APPLY BEFORE AUDITING THE REAL LEADLENS SCHEMA
-- REQUIRES_REPOSITORY_SCHEMA_AUDIT
create table if not exists ml_dataset_versions (
  id uuid primary key default gen_random_uuid(), dataset_version text unique not null,
  feature_schema_version int not null, label_schema_version int not null,
  manifest jsonb not null, created_at timestamptz not null default now()
);
create table if not exists ml_models (
  id uuid primary key default gen_random_uuid(), model_name text not null,
  model_version text not null, status text not null check (status in ('experimental','candidate','shadow','challenger','champion','rejected','retired')),
  dataset_version text not null, artifact_location text not null, artifact_checksum text not null,
  metrics jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(model_name,model_version)
);
create table if not exists ml_predictions (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references ml_models(id),
  opportunity_key text not null, feature_snapshot jsonb not null, prediction jsonb not null,
  created_at timestamptz not null default now()
);
-- Enable RLS after mapping real tenant/admin model. No policies are defined here intentionally.
