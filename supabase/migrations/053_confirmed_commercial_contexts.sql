-- Durable, versioned persistence for a user-CONFIRMED commercial context
-- (ConfirmedCommercialContextV1). This is the STRUCTURED, VALIDATED execution
-- configuration a self-serve customer confirmed — NOT raw prose, NOT an LLM
-- response, NOT evidence. It becomes the input LeadLens execution consumes,
-- replacing the customer's original description for Stage B.
--
-- Design invariants:
--   • IMMUTABLE versions. A row is never updated or deleted. A changed objective
--     / target / geography / conditions / exclusions creates a NEW version so
--     historical Opportunity Cases stay attributable to the context version that
--     produced them (Account Memory cause attribution).
--   • OWNER ISOLATION. Every row is owned by user_id; RLS lets a user read only
--     their own contexts. Writes are server-only (service role) after the API
--     verifies the JWT — a browser can never insert or force a version.
--   • The confirmed context is stored as VALIDATED JSONB (schema_version '1');
--     denormalized columns exist only for lookup/lineage, not as truth.
--
-- This migration does NOT modify any historical migration and does NOT re-apply
-- 049/050/051/052.

create table if not exists public.confirmed_commercial_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Stable logical identity that groups all versions of one commercial context.
  context_id text not null,
  version integer not null check (version >= 1),
  -- Version this one supersedes (previous version of the same context_id).
  supersedes_version integer,

  -- Optional client/company identity when the customer operates on behalf of a
  -- specific company (kept loose; not an FK to preserve legacy flexibility).
  client_id text,

  schema_version text not null default '1' check (schema_version = '1'),

  -- Denormalized for filtering/observability ONLY. Truth lives in payload.
  objective_type text not null,

  -- The validated ConfirmedCommercialContextV1. No raw prose, no model response.
  payload jsonb not null,
  -- Provenance roll-up so downstream never mistakes user context for evidence.
  provenance_summary text not null,

  effective_from timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- One row per (owner, logical context, version): the versioning contract.
  unique (user_id, context_id, version)
);

-- Latest-version lookup for a given owner + context is the hot path.
create index if not exists confirmed_contexts_latest_idx
  on public.confirmed_commercial_contexts (user_id, context_id, version desc);
create index if not exists confirmed_contexts_user_created_idx
  on public.confirmed_commercial_contexts (user_id, created_at desc);

-- ── Immutability: rows are append-only, even for the service role ──────────────
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

-- ── RLS: owner-read only; writes are server-only (service role bypasses RLS) ───
alter table public.confirmed_commercial_contexts enable row level security;

drop policy if exists "confirmed_contexts_owner_select" on public.confirmed_commercial_contexts;
create policy "confirmed_contexts_owner_select" on public.confirmed_commercial_contexts
  for select to authenticated using (auth.uid() = user_id);

-- Intentionally NO insert/update/delete policy for authenticated: only the
-- server (service role) may write, and only after it validates + confirms the
-- interpretation. The immutability trigger additionally blocks update/delete for
-- everyone, including the service role.
