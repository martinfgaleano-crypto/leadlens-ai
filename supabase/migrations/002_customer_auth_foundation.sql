-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — Customer Auth Foundation (Phase 1)
-- Run this in Supabase SQL Editor AFTER 001_saas_foundation.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- One row per authenticated user. Created on signup.
-- Links to Supabase auth.users — cascades on user deletion.

CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT,
  full_name             TEXT,
  role                  TEXT        NOT NULL DEFAULT 'customer',  -- 'customer' | 'admin'
  plan                  TEXT        NOT NULL DEFAULT 'free',      -- 'free' | 'sample' | 'starter' | 'standard' | 'pro'
  credits_remaining     INTEGER     NOT NULL DEFAULT 0,
  onboarding_completed  BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- ─── updated_at trigger (same pattern as 001) ─────────────────────────────────
-- set_updated_at() function already exists from 001_saas_foundation.sql.
-- This trigger keeps updated_at current on any UPDATE.

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────────
-- Profiles table uses RLS to scope data to the owning user.
-- Admin/service-role access bypasses RLS entirely (Supabase default behavior).
-- Existing operational tables (orders, jobs, reports, etc.) are NOT changed here.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can insert their own profile (id must match their auth UID)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── Notes ────────────────────────────────────────────────────────────────────
-- 1. DELETE is intentionally not permitted via RLS. Use Supabase admin API or
--    service role to delete accounts. Cascade from auth.users handles cleanup.
-- 2. The service role key (used by admin dashboard + webhooks) bypasses RLS.
--    No existing admin queries are affected.
-- 3. orders.user_id is NOT added here to keep scope narrow. Recommend adding in
--    Phase 2 or Phase 3 once customer sessions are stable.
