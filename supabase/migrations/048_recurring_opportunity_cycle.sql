-- Recurring Opportunity Cycle V1 — durable Account Memory events + Outcomes.
-- Generated only; DO NOT apply automatically. Founder approval required before apply.
-- Append-only event log (no update/delete grants). One table holds both memory
-- events and captured outcomes, discriminated by `kind`. Tenant-scoped, RLS-on.
--
-- Rollback:
--   drop table if exists public.intelligence_account_events;
--
create table if not exists public.intelligence_account_events(
  id text primary key,
  tenant_user_id uuid references auth.users(id) on delete cascade,
  client_id text not null,
  cycle_id text not null,
  account_id text not null,
  kind text not null check (kind in ('memory_event','outcome')),
  event_type text not null,            -- MemoryEventType | OutcomeStatus
  status_group text,                   -- outcome group when kind='outcome'
  reason_code text,
  actor text not null,
  source text not null default 'active_admin_session',
  previous_state text,
  new_state text,
  reason text,
  payload jsonb not null default '{}', -- full validated AccountMemoryEvent | AccountOutcome
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  idempotency_key text not null,
  unique nulls not distinct (tenant_user_id, client_id, idempotency_key)
);

-- Indexed for account, tenant, cycle and date lookups.
create index if not exists idx_iae_client_account on public.intelligence_account_events(client_id, account_id);
create index if not exists idx_iae_client_cycle  on public.intelligence_account_events(client_id, cycle_id);
create index if not exists idx_iae_tenant        on public.intelligence_account_events(tenant_user_id);
create index if not exists idx_iae_occurred      on public.intelligence_account_events(occurred_at);

alter table public.intelligence_account_events enable row level security;
revoke all on public.intelligence_account_events from anon, authenticated;
-- Append-only: service_role may read and insert, but NOT update or delete.
grant select, insert on public.intelligence_account_events to service_role;
