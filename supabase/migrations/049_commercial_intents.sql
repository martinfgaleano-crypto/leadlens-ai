-- Minimal authenticated commercial-intent foundation. This is not an order,
-- payment, entitlement or checkout record.
create table if not exists public.commercial_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null check (product_code in (
    'preview_launch_v0', 'brief_launch_v0', 'intelligence_launch_v0', 'premium_launch_v0'
  )),
  catalog_version text not null default 'launch_tier_architecture_v0',
  source_cta text,
  locale text not null default 'en' check (locale in ('en', 'es', 'pt', 'ja')),
  return_to text not null default '/dashboard',
  status text not null default 'captured' check (status in (
    'captured', 'onboarding_started', 'onboarding_completed', 'checkout_started',
    'converted', 'cancelled', 'expired'
  )),
  onboarding_id uuid,
  job_id uuid,
  checkout_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_intents_user_created_idx
  on public.commercial_intents (user_id, created_at desc);

alter table public.commercial_intents enable row level security;

drop policy if exists "commercial_intents_owner_select" on public.commercial_intents;
create policy "commercial_intents_owner_select" on public.commercial_intents
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "commercial_intents_owner_insert" on public.commercial_intents;
create policy "commercial_intents_owner_insert" on public.commercial_intents
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "commercial_intents_owner_update" on public.commercial_intents;
create policy "commercial_intents_owner_update" on public.commercial_intents
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
