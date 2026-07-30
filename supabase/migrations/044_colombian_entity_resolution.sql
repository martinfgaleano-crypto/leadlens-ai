-- Block 10: minimal append-only envelope for entity-resolution history.
-- Generated only. Do not apply without explicit authorization.
create table if not exists public.intelligence_entity_resolution_records (
  id text primary key,
  tenant_id uuid not null,
  account_id text not null,
  record_type text not null check (record_type in ('profile','candidate','anchor','relationship','official_property','provider_health','event_attribution','run')),
  methodology_version text not null,
  payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null,
  supersedes_id text references public.intelligence_entity_resolution_records(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);
create index if not exists intelligence_entity_resolution_account_idx
  on public.intelligence_entity_resolution_records(tenant_id, account_id, observed_at desc);
alter table public.intelligence_entity_resolution_records enable row level security;
revoke all on public.intelligence_entity_resolution_records from anon, authenticated;
grant select, insert on public.intelligence_entity_resolution_records to service_role;
comment on table public.intelligence_entity_resolution_records is
  'Server-written, append-only entity resolution history. Ambiguous entities remain separate; payloads must exclude secrets and raw provider responses.';
