-- Durable, append-only per-account runtime execution traces for LIVE validation.
-- Global internal telemetry: service-role only. Immutable historical observations.
-- Idempotent by trace_key = "<run_id>::<account_id>" so one execution never
-- double-persists an account trace. Carries only the IntelligenceRunTrace, which
-- holds no secrets, no raw source body, no prompts/completions, and no customer
-- prose (queries are category+hash; context is a safe reference).
--
-- FORWARD-ONLY. Founder-applied (Supabase SQL editor or `supabase db push`).
-- Not applied by this repo. Re-check after apply: select count(*) from
-- public.intelligence_run_traces;

create table if not exists public.intelligence_run_traces (
  id uuid primary key default gen_random_uuid(),
  trace_key text not null unique,
  run_id text not null,
  account_id text not null,
  provenance text not null check (provenance in ('live','controlled')),
  observed_at timestamptz not null,
  trace_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_run_traces_run_idx
  on public.intelligence_run_traces (run_id);
create index if not exists intelligence_run_traces_observed_idx
  on public.intelligence_run_traces (observed_at desc);

alter table public.intelligence_run_traces enable row level security;

-- Deliberately no anon/authenticated policies. Only the service role writes/reads
-- runtime traces; customer sessions cannot read internal runtime telemetry.

-- Append-only: reject UPDATE and DELETE so a historical observation is immutable.
create or replace function public.intelligence_run_traces_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'intelligence_run_traces is append-only';
end;
$$;

drop trigger if exists intelligence_run_traces_no_mutate on public.intelligence_run_traces;
create trigger intelligence_run_traces_no_mutate
  before update or delete on public.intelligence_run_traces
  for each row execute function public.intelligence_run_traces_immutable();
