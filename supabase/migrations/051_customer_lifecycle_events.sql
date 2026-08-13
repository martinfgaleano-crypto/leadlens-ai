-- Persisted, idempotent server lifecycle milestones. Payload is deliberately
-- coarse and must not contain business descriptions, report content or email.
create table if not exists public.customer_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'commercial_intent_created', 'onboarding_completed', 'portfolio_ready',
    'brief_ready', 'first_usable_opportunity_delivered'
  )),
  object_type text not null,
  object_id text not null,
  product_code text,
  locale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, event_name, object_type, object_id)
);

alter table public.customer_lifecycle_events enable row level security;
drop policy if exists "customer_lifecycle_events_owner_select" on public.customer_lifecycle_events;
create policy "customer_lifecycle_events_owner_select" on public.customer_lifecycle_events
  for select to authenticated using (auth.uid() = user_id);

-- Inserts are server-only. The service role bypasses RLS; authenticated users
-- cannot forge activation milestones from the browser.
create index if not exists customer_lifecycle_events_user_created_idx
  on public.customer_lifecycle_events (user_id, created_at desc);
