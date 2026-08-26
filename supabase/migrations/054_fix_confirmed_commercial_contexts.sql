-- Reconcile a STRAY, incomplete `confirmed_commercial_contexts` table found live
-- in Supabase that did NOT originate from migration 053. The live table was
-- missing the canonical owner/payload columns (user_id, client_id, schema_version,
-- objective_type, payload, provenance_summary, effective_from) — so migration 053
-- (which uses `create table if not exists`) could neither create the correct table
-- nor build its user_id index against it.
--
-- 053 is not edited (its file stays the canonical definition of record). This
-- migration brings any environment to the canonical schema:
--   • If a stray table WITHOUT `user_id` exists AND is empty, drop it (it is not
--     created by any repo migration and holds no data), then create canonically.
--   • If the canonical table already exists (has `user_id`), do nothing to it.
--   • If nothing exists, create it.
--
-- The guard refuses to drop a table that has rows or already has `user_id`, so a
-- correctly-applied or data-bearing environment is never harmed.

do $$
declare
  has_table boolean;
  has_owner boolean;
  row_count bigint;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'confirmed_commercial_contexts'
  ) into has_table;

  if has_table then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'confirmed_commercial_contexts'
        and column_name = 'user_id'
    ) into has_owner;

    if not has_owner then
      execute 'select count(*) from public.confirmed_commercial_contexts' into row_count;
      if row_count = 0 then
        drop table public.confirmed_commercial_contexts cascade;
      else
        raise exception 'confirmed_commercial_contexts exists without user_id but has % row(s); manual reconciliation required', row_count;
      end if;
    end if;
  end if;
end $$;

-- Canonical definition (identical in intent to migration 053).
create table if not exists public.confirmed_commercial_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_id text not null,
  version integer not null check (version >= 1),
  supersedes_version integer,
  client_id text,
  schema_version text not null default '1' check (schema_version = '1'),
  objective_type text not null,
  payload jsonb not null,
  provenance_summary text not null,
  effective_from timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, context_id, version)
);

create index if not exists confirmed_contexts_latest_idx
  on public.confirmed_commercial_contexts (user_id, context_id, version desc);
create index if not exists confirmed_contexts_user_created_idx
  on public.confirmed_commercial_contexts (user_id, created_at desc);

create or replace function public.leadlens_prevent_context_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'confirmed_commercial_contexts rows are immutable (append a new version)'
    using errcode = '42501';
end;
$$;

drop trigger if exists confirmed_contexts_no_update on public.confirmed_commercial_contexts;
create trigger confirmed_contexts_no_update
  before update or delete on public.confirmed_commercial_contexts
  for each row execute function public.leadlens_prevent_context_mutation();

alter table public.confirmed_commercial_contexts enable row level security;

drop policy if exists "confirmed_contexts_owner_select" on public.confirmed_commercial_contexts;
create policy "confirmed_contexts_owner_select" on public.confirmed_commercial_contexts
  for select to authenticated using (auth.uid() = user_id);
