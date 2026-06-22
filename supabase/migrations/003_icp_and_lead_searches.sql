-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — ICP Builder + Lead Searches Foundation (Phase 2)
-- Run this in Supabase SQL Editor AFTER 002_customer_auth_foundation.sql
-- Requires: set_updated_at() function from 001_saas_foundation.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── icps ─────────────────────────────────────────────────────────────────────
-- One row per Ideal Customer Profile, owned by a customer user.
-- All array fields store comma-separated concepts as individual text elements.

CREATE TABLE IF NOT EXISTS icps (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  target_countries TEXT[]      NOT NULL DEFAULT '{}',
  target_regions   TEXT[]      NOT NULL DEFAULT '{}',
  industries       TEXT[]      NOT NULL DEFAULT '{}',
  company_sizes    TEXT[]      NOT NULL DEFAULT '{}',
  target_job_titles TEXT[]     NOT NULL DEFAULT '{}',
  keywords         TEXT[]      NOT NULL DEFAULT '{}',
  exclusions       TEXT[]      NOT NULL DEFAULT '{}',
  priority         TEXT        NOT NULL DEFAULT 'balance',  -- 'volume' | 'precision' | 'balance'
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS icps_user_id_idx    ON icps(user_id);
CREATE INDEX IF NOT EXISTS icps_created_at_idx ON icps(created_at DESC);

DROP TRIGGER IF EXISTS icps_set_updated_at ON icps;
CREATE TRIGGER icps_set_updated_at
  BEFORE UPDATE ON icps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS: icps ────────────────────────────────────────────────────────────────
-- Full CRUD for authenticated users on their own rows only.
-- Service role (admin API + webhooks) bypasses RLS automatically.

ALTER TABLE icps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icps_select_own" ON icps;
CREATE POLICY "icps_select_own"
  ON icps FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "icps_insert_own" ON icps;
CREATE POLICY "icps_insert_own"
  ON icps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "icps_update_own" ON icps;
CREATE POLICY "icps_update_own"
  ON icps FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "icps_delete_own" ON icps;
CREATE POLICY "icps_delete_own"
  ON icps FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── lead_searches ────────────────────────────────────────────────────────────
-- One row per lead search request. Created by customer; fulfilled by admin.
-- status lifecycle: pending → processing → completed | failed
-- admin_notes is write-protected from the client (no UPDATE policy for users).

CREATE TABLE IF NOT EXISTS lead_searches (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  icp_id               UUID        REFERENCES icps(id) ON DELETE SET NULL,
  name                 TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed
  requested_lead_count INTEGER     NOT NULL DEFAULT 25,
  countries            TEXT[]      NOT NULL DEFAULT '{}',
  industries           TEXT[]      NOT NULL DEFAULT '{}',
  notes                TEXT,
  admin_notes          TEXT,        -- admin-only write; client read is fine
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_searches_user_id_idx    ON lead_searches(user_id);
CREATE INDEX IF NOT EXISTS lead_searches_icp_id_idx     ON lead_searches(icp_id);
CREATE INDEX IF NOT EXISTS lead_searches_status_idx     ON lead_searches(status);
CREATE INDEX IF NOT EXISTS lead_searches_created_at_idx ON lead_searches(created_at DESC);

DROP TRIGGER IF EXISTS lead_searches_set_updated_at ON lead_searches;
CREATE TRIGGER lead_searches_set_updated_at
  BEFORE UPDATE ON lead_searches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS: lead_searches ───────────────────────────────────────────────────────
-- SELECT: users see only their own searches (including admin_notes as read-only).
-- INSERT: users can create searches; user_id must match their auth UID.
-- UPDATE: intentionally NOT granted to authenticated role.
--         Only the service role (admin API) can update status and admin_notes.
-- DELETE: users can only delete their own searches that are still 'pending'.

ALTER TABLE lead_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_searches_select_own" ON lead_searches;
CREATE POLICY "lead_searches_select_own"
  ON lead_searches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lead_searches_insert_own" ON lead_searches;
CREATE POLICY "lead_searches_insert_own"
  ON lead_searches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy for authenticated users — intentional.
-- Admin updates status and admin_notes via service role key.

DROP POLICY IF EXISTS "lead_searches_delete_pending_own" ON lead_searches;
CREATE POLICY "lead_searches_delete_pending_own"
  ON lead_searches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- ─── Notes ────────────────────────────────────────────────────────────────────
-- 1. No UPDATE policy on lead_searches is deliberate: customers cannot change
--    status or admin_notes. If client-side name/notes editing is needed later,
--    add a scoped UPDATE policy that explicitly excludes status and admin_notes.
-- 2. Service role bypasses RLS — admin API can freely update any row.
-- 3. icps.priority valid values: 'volume' | 'precision' | 'balance'
-- 4. lead_searches.status valid values: 'pending' | 'processing' | 'completed' | 'failed'
