-- 040_admin_authorization.sql
-- Production Admin authorization: an explicit, revocable allowlist keyed to
-- Supabase Auth users. Authentication stays in Supabase Auth (email/password);
-- this table only answers "is this authenticated user an active administrator?".
-- Idempotent. RLS ON with NO policies → normal (anon/authenticated) clients can
-- never read or write it; only the server service-role key may manage it, and
-- authorization lookups therefore fail closed for everyone else.

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

-- Enable RLS and add NO policies: the table is invisible to anon/authenticated
-- roles. The server reaches it exclusively through the service-role key, which
-- bypasses RLS. This keeps the allowlist unreadable by normal users.
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Keep updated_at honest on writes.
CREATE OR REPLACE FUNCTION admin_users_touch_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_users_touch ON admin_users;
CREATE TRIGGER admin_users_touch BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION admin_users_touch_updated_at();

-- Active-admins index for fast fail-closed lookups.
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON admin_users (user_id) WHERE is_active AND revoked_at IS NULL;

-- ── First-admin bootstrap (manual, run once by the owner) ───────────────────
-- 1. Create the user in Supabase Dashboard → Authentication → Users (email+password).
-- 2. Copy that user's UUID.
-- 3. Authorize them:
--      INSERT INTO admin_users (user_id, role, created_by)
--      VALUES ('<UUID>', 'super_admin', '<UUID>')
--      ON CONFLICT (user_id) DO UPDATE SET is_active = true, revoked_at = NULL;
-- 4. Revoke later:
--      UPDATE admin_users SET is_active = false, revoked_at = now() WHERE user_id = '<UUID>';
