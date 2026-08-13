-- Additive bridge from authenticated Commercial Intent to the existing
-- onboarding_requests model. Legacy rows remain readable and nullable.
alter table public.onboarding_requests
  add column if not exists commercial_intent_id uuid references public.commercial_intents(id) on delete set null,
  add column if not exists product_code text check (product_code is null or product_code in (
    'preview_launch_v0', 'brief_launch_v0', 'intelligence_launch_v0', 'premium_launch_v0'
  )),
  add column if not exists commercial_objective text,
  add column if not exists locale text check (locale is null or locale in ('en', 'es', 'pt', 'ja'));

create index if not exists onboarding_requests_user_created_idx
  on public.onboarding_requests (user_id, created_at desc);
create index if not exists onboarding_requests_commercial_intent_idx
  on public.onboarding_requests (commercial_intent_id)
  where commercial_intent_id is not null;

alter table public.onboarding_requests enable row level security;

drop policy if exists "onboarding_requests_owner_select" on public.onboarding_requests;
create policy "onboarding_requests_owner_select" on public.onboarding_requests
  for select to authenticated using (auth.uid() = user_id);

-- Writes remain server-only through the authenticated customer onboarding API.
-- This also protects legacy administrative fields on onboarding_requests.
drop policy if exists "onboarding_requests_owner_insert" on public.onboarding_requests;
drop policy if exists "onboarding_requests_owner_update" on public.onboarding_requests;

-- The relationship may only point to an intent owned by the same user. This
-- cannot be expressed as a simple FK, so enforce it for every non-null link.
create or replace function public.enforce_onboarding_intent_owner()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.commercial_intent_id is not null and not exists (
    select 1 from public.commercial_intents ci
    where ci.id = new.commercial_intent_id and ci.user_id = new.user_id
  ) then
    raise exception 'commercial intent owner mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists onboarding_requests_intent_owner on public.onboarding_requests;
create trigger onboarding_requests_intent_owner
  before insert or update of commercial_intent_id, user_id on public.onboarding_requests
  for each row execute function public.enforce_onboarding_intent_owner();
