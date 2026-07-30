-- Generated for Block 12. Do not apply without explicit authorization.
create table if not exists public.intelligence_client_context_versions(
 id text primary key,tenant_user_id uuid references auth.users(id) on delete cascade,client_id text not null,
 version_number integer not null,status text not null,context_json jsonb not null,changed_fields text[] not null default '{}',
 previous_version_id text references public.intelligence_client_context_versions(id),source_intake_id text,
 effective_at timestamptz not null,reviewer_id uuid references auth.users(id),methodology_version text not null,
 idempotency_key text not null,created_at timestamptz not null default now(),
 unique nulls not distinct(tenant_user_id,client_id,idempotency_key));
create table if not exists public.intelligence_client_intakes(
 id text primary key,tenant_user_id uuid references auth.users(id) on delete cascade,client_id text not null,
 context_version text not null,status text not null,intake_json jsonb not null,fixture_mode boolean not null default false check(fixture_mode=false),
 supersedes_id text references public.intelligence_client_intakes(id),methodology_version text not null,
 idempotency_key text not null,created_at timestamptz not null default now(),
 unique nulls not distinct(tenant_user_id,client_id,idempotency_key));
create table if not exists public.intelligence_customer_safety_reviews(
 id text primary key,tenant_user_id uuid references auth.users(id) on delete cascade,client_id text not null,account_id text not null,
 thesis_id text not null,context_version_id text references public.intelligence_client_context_versions(id),
 assessment_json jsonb not null,state text not null,reviewer_id uuid references auth.users(id),
 reviewed_at timestamptz,internal_only boolean not null default true check(internal_only=true),
 ranking_impact text not null default 'off' check(ranking_impact='off'),methodology_version text not null,
 idempotency_key text not null,created_at timestamptz not null default now(),
 unique nulls not distinct(tenant_user_id,client_id,idempotency_key));
alter table public.intelligence_client_context_versions enable row level security;
alter table public.intelligence_client_intakes enable row level security;
alter table public.intelligence_customer_safety_reviews enable row level security;
revoke all on public.intelligence_client_context_versions,public.intelligence_client_intakes,public.intelligence_customer_safety_reviews from anon,authenticated;
grant select,insert on public.intelligence_client_context_versions,public.intelligence_client_intakes,public.intelligence_customer_safety_reviews to service_role;
