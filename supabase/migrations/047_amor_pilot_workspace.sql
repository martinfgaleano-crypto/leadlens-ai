-- Block 13 canonical pilot + activity. Generated only; do not apply automatically.
create table if not exists public.intelligence_pilots(
 id text primary key,tenant_user_id uuid references auth.users(id) on delete cascade,client_id text not null,
 slug text not null,canonical_name text not null,status text not null,pilot_json jsonb not null,
 methodology_version text not null,idempotency_key text not null,updated_at timestamptz not null,created_at timestamptz not null default now(),
 unique nulls not distinct(tenant_user_id,client_id,slug),unique nulls not distinct(tenant_user_id,idempotency_key));
create table if not exists public.intelligence_pilot_activity(
 id text primary key,tenant_user_id uuid references auth.users(id) on delete cascade,pilot_id text not null references public.intelligence_pilots(id),
 client_id text not null,event_type text not null,actor_id uuid references auth.users(id),object_type text not null,object_id text not null,
 before_summary jsonb,after_summary jsonb,provenance jsonb not null default '[]',methodology_version text not null,
 occurred_at timestamptz not null,idempotency_key text not null,created_at timestamptz not null default now(),
 unique nulls not distinct(tenant_user_id,pilot_id,idempotency_key));
alter table public.intelligence_pilots enable row level security;alter table public.intelligence_pilot_activity enable row level security;
revoke all on public.intelligence_pilots,public.intelligence_pilot_activity from anon,authenticated;
grant select,insert,update on public.intelligence_pilots to service_role;grant select,insert on public.intelligence_pilot_activity to service_role;
