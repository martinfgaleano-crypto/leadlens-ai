-- 060_vault_observe_company_rpc.sql
-- CANONICAL VAULT V2 — atomic observation counter.
--
-- WHY: last_seen_at is already advanced on re-observation via a plain UPDATE (safe: last-
-- writer-wins is correct for "most recent observation"). An accurate observation_count,
-- however, must be incremented ATOMICALLY — a read-modify-write in application code races
-- under concurrent runs and loses increments. This RPC does the increment in one statement.
--
-- USAGE (paired code, enabled after apply): touchVaultCompanyObservation switches from the
-- plain last_seen UPDATE to:  db.rpc('vault_observe_company', { p_id })  -- atomic count++.
-- (Retry-idempotency of the COUNT specifically — one observation per logical run — still
-- ideally uses a vault_company_observations relation; this RPC is the minimal atomic counter.)
--
-- ADDITIVE: function only; no table/column change; SECURITY INVOKER (service-role callers).
-- ROLLBACK: drop function if exists public.vault_observe_company(uuid, timestamptz);
--
-- FOUNDER ACTION REQUIRED: apply in the Supabase SQL editor (or `supabase db push`). NOT
-- applied by this environment.

create or replace function public.vault_observe_company(p_id uuid, p_now timestamptz default now())
returns void
language sql
as $$
  update public.vault_companies
     set observation_count = observation_count + 1,
         last_seen_at = p_now
   where id = p_id;
$$;
