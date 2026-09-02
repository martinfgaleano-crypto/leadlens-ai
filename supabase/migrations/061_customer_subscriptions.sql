-- 061_customer_subscriptions.sql
-- Billing Core V1 — normalized, provider-agnostic subscription state.
--
-- WHY: the Entitlements V1 resolver must derive access from ONE internal, normalized billing
-- truth — never raw provider objects. This table is that truth. Provider-specific identifiers
-- live only here (the billing boundary); the rest of the product reasons about status/plan_code/
-- interval. Additive and backward compatible: the existing one-time `orders` flow is untouched,
-- and resolveEntitlements reads this table best-effort (absent rows → no change to current access).
--
-- IDEMPOTENCY / ORDERING: last_event_id dedups replayed webhooks; last_event_at guards against
-- stale out-of-order events overwriting newer canonical state (the webhook applies an event only
-- when its timestamp is >= the stored one).
--
-- ROLLBACK: DROP TABLE IF EXISTS public.customer_subscriptions;
-- APPLY: Supabase SQL editor (or `supabase db push`). NOT APPLIED by this repo — founder applies.

CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_provider         TEXT        NOT NULL DEFAULT 'lemon_squeezy',
  provider_customer_id     TEXT,
  provider_subscription_id TEXT        NOT NULL,
  plan_code                TEXT        NOT NULL,
  billing_interval         TEXT        NOT NULL DEFAULT 'month'
                             CHECK (billing_interval IN ('month', 'year')),
  -- Canonical internal lifecycle (provider states are normalized into these five).
  status                   TEXT        NOT NULL
                             CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN     NOT NULL DEFAULT false,
  ended_at                 TIMESTAMPTZ,
  -- Webhook idempotency + out-of-order protection.
  last_event_id            TEXT,
  last_event_at            TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One canonical row per provider subscription (upsert target; forbids duplicates).
  UNIQUE (payment_provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS customer_subscriptions_user_id_idx ON public.customer_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS customer_subscriptions_status_idx  ON public.customer_subscriptions (status);

-- Owner-scoped read; writes are server-only (service role bypasses RLS). No client write policy.
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_subscriptions_select_own" ON public.customer_subscriptions;
CREATE POLICY "customer_subscriptions_select_own"
  ON public.customer_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep updated_at current (set_updated_at() exists from 001_saas_foundation.sql).
DROP TRIGGER IF EXISTS customer_subscriptions_set_updated_at ON public.customer_subscriptions;
CREATE TRIGGER customer_subscriptions_set_updated_at
  BEFORE UPDATE ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
