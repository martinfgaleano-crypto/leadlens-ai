-- ============================================================================
-- LeadLens — Production Admin bootstrap (SINGLE PASTE)
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run.
-- It applies migration 040 (idempotent) AND authorizes the owner account
-- (martinfgaleano@gmail.com) as an active super_admin. Safe to re-run.
-- ============================================================================

-- ── Migration 040: admin_users allowlist ────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'admin',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  revoked_at  timestamptz
);

DO $$ BEGIN
  ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_chk
    CHECK (role IN ('admin','super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION admin_users_touch_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_users_touch ON admin_users;
CREATE TRIGGER admin_users_touch BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION admin_users_touch_updated_at();

CREATE INDEX IF NOT EXISTS admin_users_active_idx ON admin_users (user_id) WHERE is_active AND revoked_at IS NULL;

-- ── Authorize the owner (martinfgaleano@gmail.com) ──────────────────────────
INSERT INTO admin_users (user_id, role, created_by)
VALUES ('e9c5fc31-6d9b-45eb-a110-1d6647c04f50', 'super_admin', 'e9c5fc31-6d9b-45eb-a110-1d6647c04f50')
ON CONFLICT (user_id) DO UPDATE SET is_active = true, revoked_at = NULL, role = 'super_admin';

-- ── Verify (should return one active row) ───────────────────────────────────
SELECT user_id, role, is_active, revoked_at FROM admin_users
WHERE user_id = 'e9c5fc31-6d9b-45eb-a110-1d6647c04f50';

-- Revoke later if ever needed:
--   UPDATE admin_users SET is_active=false, revoked_at=now()
--   WHERE user_id='e9c5fc31-6d9b-45eb-a110-1d6647c04f50';
