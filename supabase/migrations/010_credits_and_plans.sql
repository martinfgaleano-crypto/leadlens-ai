-- 010_credits_and_plans.sql
-- Credits + Billing Foundation.
-- plans:              static plan catalog (written only by admins/migrations).
-- customer_credits:   one row per user, credit balance.
-- credit_transactions: immutable ledger of every credit change.
-- All tables: service role for writes; customers SELECT own rows only.

-- ─── plans ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL UNIQUE,
  monthly_credits INTEGER     NOT NULL DEFAULT 0,
  price_usd       INTEGER     NOT NULL DEFAULT 0,  -- cents, e.g. 2900 = $29
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial plan catalog
INSERT INTO plans (name, monthly_credits, price_usd, active) VALUES
  ('free',     0,    0,      true),
  ('sample',   50,   700,    true),
  ('starter',  200,  2900,   true),
  ('standard', 600,  7900,   true),
  ('pro',      1500, 14900,  true)
ON CONFLICT (name) DO NOTHING;

-- ─── customer_credits ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_credits (
  user_id          UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  credit_balance   INTEGER     NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  lifetime_credits INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_credits_user_id_idx ON customer_credits (user_id);

ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_credits_select_own"
  ON customer_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── credit_transactions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('grant', 'consume', 'refund', 'manual')),
  amount      INTEGER     NOT NULL,  -- positive = credits added, negative = credits used
  description TEXT,
  search_id   UUID        REFERENCES lead_searches(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx    ON credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS credit_transactions_type_idx       ON credit_transactions (type);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_transactions_select_own"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Auto-update updated_at on customer_credits ───────────────────────────────

DROP TRIGGER IF EXISTS customer_credits_set_updated_at ON customer_credits;
CREATE TRIGGER customer_credits_set_updated_at
  BEFORE UPDATE ON customer_credits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Bootstrap trigger: credit row created on profile insert ──────────────────
-- Fires when a new profile row is inserted (signup or lazy-create).
-- Grants 100 welcome credits automatically. Idempotent.

CREATE OR REPLACE FUNCTION bootstrap_customer_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO customer_credits (user_id, credit_balance, lifetime_credits)
  VALUES (NEW.id, 100, 100)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO credit_transactions (user_id, type, amount, description)
  SELECT NEW.id, 'grant', 100, 'Welcome credits — account created'
  WHERE NOT EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = NEW.id AND type = 'grant' AND description LIKE 'Welcome credits%'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION bootstrap_customer_credits();

-- ─── Backfill existing profiles ───────────────────────────────────────────────
-- Grants 100 credits to any existing user who doesn't have a credits row yet.

INSERT INTO customer_credits (user_id, credit_balance, lifetime_credits)
SELECT id, 100, 100 FROM profiles
WHERE id NOT IN (SELECT user_id FROM customer_credits)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO credit_transactions (user_id, type, amount, description)
SELECT p.id, 'grant', 100, 'Welcome credits — account created'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM credit_transactions ct
  WHERE ct.user_id = p.id AND ct.type = 'grant' AND ct.description LIKE 'Welcome credits%'
);
