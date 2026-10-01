-- 066 — Durable, scoped Market / Route Intelligence memory.
-- Additive and idempotent. Service-role only: RLS enabled with no customer policies.
-- Rollback: drop table market_source_observations; drop table market_intelligence_snapshots.

create table if not exists public.market_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  universe_id text not null,
  version text not null,
  tenant_user_id uuid,
  client_id uuid,
  objective_fingerprint text not null,
  geography text[] not null default '{}',
  category_context text,
  generated_at timestamptz not null,
  freshness_until timestamptz,
  fingerprint text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_user_id, client_id, universe_id, fingerprint)
);
create index if not exists market_intelligence_scope_idx on public.market_intelligence_snapshots (tenant_user_id, client_id, objective_fingerprint, generated_at desc);
create index if not exists market_intelligence_geography_gin on public.market_intelligence_snapshots using gin (geography);
alter table public.market_intelligence_snapshots enable row level security;

create table if not exists public.market_source_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_user_id uuid,
  client_id uuid,
  universe_id text not null,
  source_id text not null,
  canonical_url text not null,
  domain text not null,
  source_type text not null,
  relationship text not null,
  route_ids text[] not null default '{}',
  account_refs text[] not null default '{}',
  published_at timestamptz,
  retrieved_at timestamptz not null,
  content_sha256 text,
  extraction_provenance jsonb,
  observation jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_user_id, client_id, universe_id, source_id, retrieved_at)
);
create index if not exists market_source_scope_idx on public.market_source_observations (tenant_user_id, client_id, universe_id, retrieved_at desc);
create index if not exists market_source_url_idx on public.market_source_observations (canonical_url, retrieved_at desc);
alter table public.market_source_observations enable row level security;

-- Deliberately no anon/authenticated policies. Server-side repositories use service role.
