-- Generated for Block 11. Do not apply without explicit authorization.
create table if not exists public.intelligence_account_opportunity_syntheses (
  id text primary key, tenant_user_id uuid references auth.users(id) on delete cascade,
  client_id text not null, account_id text not null, context_id uuid references public.intelligence_client_contexts(id),
  thesis_json jsonb not null, review_state text not null default 'unreviewed',
  internal_only boolean not null default true check (internal_only=true),
  ranking_impact text not null default 'off' check (ranking_impact='off'),
  report_impact text not null default 'off' check (report_impact='off'),
  methodology_version text not null, generated_at timestamptz not null,
  supersedes_id text references public.intelligence_account_opportunity_syntheses(id),
  idempotency_key text not null, created_at timestamptz not null default now(),
  unique nulls not distinct (tenant_user_id,client_id,idempotency_key)
);
create table if not exists public.intelligence_portfolio_syntheses (
  id text primary key, tenant_user_id uuid references auth.users(id) on delete cascade,
  client_id text not null, context_id uuid references public.intelligence_client_contexts(id),
  synthesis_json jsonb not null, internal_only boolean not null default true check (internal_only=true),
  ranking_impact text not null default 'off' check (ranking_impact='off'),
  methodology_version text not null, generated_at timestamptz not null,
  supersedes_id text references public.intelligence_portfolio_syntheses(id),
  idempotency_key text not null, created_at timestamptz not null default now(),
  unique nulls not distinct (tenant_user_id,client_id,idempotency_key)
);
alter table public.intelligence_account_opportunity_syntheses enable row level security;
alter table public.intelligence_portfolio_syntheses enable row level security;
revoke all on public.intelligence_account_opportunity_syntheses,public.intelligence_portfolio_syntheses from anon,authenticated;
grant select,insert on public.intelligence_account_opportunity_syntheses,public.intelligence_portfolio_syntheses to service_role;
