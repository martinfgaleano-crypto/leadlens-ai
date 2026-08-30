-- 059_vault_company_observation_tracking.sql
-- CANONICAL VAULT V2 — observation tracking (the fix for the "frozen at 98" perception).
--
-- WHY: forensic audit (2026-08-30) proved automatic accretion works (31 of 98 companies are
-- source_status=customer_run, 30 signals in 24h), but re-observation of an EXISTING company is
-- invisible: updated_at != created_at on 0/98 rows. So a run that correctly rediscovers a known
-- company (no duplicate, invariant #22) leaves no trace, and the count looks static. This adds
-- durable observation metadata so reuse is visible and growth is explainable.
--
-- WHAT: additive columns on vault_companies. first_seen_at backfills from created_at;
-- observation_count starts at 1 (each existing row has been observed at least once).
--
-- ADDITIVE + BACKWARD-COMPATIBLE: nullable/defaulted; no RLS/identity change; the 057 UNIQUE
-- index on domain is untouched. No customer-relative fields (global public facts only).
--
-- ROLLBACK:
--   alter table vault_companies drop column if exists first_seen_at;
--   alter table vault_companies drop column if exists last_seen_at;
--   alter table vault_companies drop column if exists observation_count;
--
-- FOUNDER ACTION REQUIRED: apply in the Supabase SQL editor (or `supabase db push`). NOT applied
-- by this environment. PAIRED CODE (deferred until columns exist): createVaultCompany's conflict
-- path (23505 → existing) should additionally bump observation_count + last_seen_at atomically
-- (update ... set observation_count = observation_count + 1, last_seen_at = now()); the canonical
-- /admin/vault surface then shows first/last-seen + observation counts (reuse becomes visible).

ALTER TABLE vault_companies
  ADD COLUMN IF NOT EXISTS first_seen_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at    timestamptz,
  ADD COLUMN IF NOT EXISTS observation_count integer NOT NULL DEFAULT 1;

-- Backfill existing rows conservatively from creation time (one prior observation each).
UPDATE vault_companies
   SET first_seen_at = COALESCE(first_seen_at, created_at),
       last_seen_at  = COALESCE(last_seen_at, updated_at, created_at)
 WHERE first_seen_at IS NULL OR last_seen_at IS NULL;
