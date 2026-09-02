-- 062_subscription_usage_periods.sql
-- Billing → Entitlement Live V1 — per-account, period-scoped usage ledger.
--
-- WHY (frozen OPERATIONAL ENTITLEMENT MATRIX V1, owner-accepted engineering implications):
--   #1 The commercial unit is 1 ACCOUNT INTELLIGENCE CREDIT (one account materialized/re-
--      analyzed), idempotent per (user, analysis_key/review_id, account) — NOT per run/job, and
--      NOT per (period, account) which would wrongly cap paid reviews at one per account per month.
--   #2 The subscription/Beta periodic allowance is DISTINCT from durable one-time
--      customer_credits, so subscription consumption never draws down preserved one-time
--      rights (§13). That allowance lives here, not in customer_credits.
--   #3 Annual subscriptions refresh MONTHLY, anchored to the billing/start day (§15) — the
--      monthly window is computed internally; one period row per (user, period_start).
--
-- Additive + backward compatible: no existing table is touched; the resolver reads this
-- best-effort (absent table/row → full-allowance "pending_ledger", never a wrong denial).
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.account_intelligence_charges;
--   DROP TABLE IF EXISTS public.subscription_usage_periods;
-- APPLY: Supabase SQL editor (or `supabase db push`). NOT APPLIED by this repo — founder applies.

-- ── Period allowance/consumption (one row per user per monthly entitlement period) ──
CREATE TABLE IF NOT EXISTS public.subscription_usage_periods (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_code     TEXT        NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  allowance     INTEGER     NOT NULL CHECK (allowance >= 0),
  consumed      INTEGER     NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One canonical period row per user per window → idempotent seeding; a replayed renewal
  -- (ignoreDuplicates upsert) never re-grants or resets consumed.
  UNIQUE (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS subscription_usage_periods_user_idx ON public.subscription_usage_periods (user_id);
CREATE INDEX IF NOT EXISTS subscription_usage_periods_window_idx ON public.subscription_usage_periods (user_id, period_start, period_end);

ALTER TABLE public.subscription_usage_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_usage_periods_select_own" ON public.subscription_usage_periods;
CREATE POLICY "subscription_usage_periods_select_own"
  ON public.subscription_usage_periods FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS subscription_usage_periods_set_updated_at ON public.subscription_usage_periods;
CREATE TRIGGER subscription_usage_periods_set_updated_at
  BEFORE UPDATE ON public.subscription_usage_periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Per-account idempotency ledger (insert-once = exactly one credit per logical analysis) ──
-- The commercial unit is 1 ACCOUNT INTELLIGENCE CREDIT per *material analysis/re-analysis* of an
-- account (matrix §5/§6). The idempotency key is therefore (user, analysis_key, account_key) where
-- analysis_key is the LOGICAL analysis identity (the review_id / run id) — NOT the period. This is
-- critical:
--   • a technical RETRY of the same logical analysis reuses analysis_key → conflict → 0-cost no-op;
--   • a NEW legitimate re-analysis of the same account is a NEW review_id → new row → +1 credit.
-- Keying on (user, period_start, account) instead would WRONGLY cap paid reviews at one per account
-- per month. period_start is retained for allowance accounting (which period the charge counts to),
-- not for idempotency. This mirrors the Account Memory key (owner, client, account, review_id).
CREATE TABLE IF NOT EXISTS public.account_intelligence_charges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start  TIMESTAMPTZ NOT NULL,
  account_key   TEXT        NOT NULL,
  analysis_key  TEXT        NOT NULL,   -- logical analysis/review id (review_id); stable across retries
  run_id        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, analysis_key, account_key)
);

CREATE INDEX IF NOT EXISTS account_intelligence_charges_period_idx ON public.account_intelligence_charges (user_id, period_start);
CREATE INDEX IF NOT EXISTS account_intelligence_charges_account_idx ON public.account_intelligence_charges (user_id, account_key);

ALTER TABLE public.account_intelligence_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_intelligence_charges_select_own" ON public.account_intelligence_charges;
CREATE POLICY "account_intelligence_charges_select_own"
  ON public.account_intelligence_charges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Append-only: charges are an immutable idempotency record (no update/delete by anyone).
DROP TRIGGER IF EXISTS account_intelligence_charges_immutable ON public.account_intelligence_charges;
CREATE OR REPLACE FUNCTION public.forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'account_intelligence_charges is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER account_intelligence_charges_immutable
  BEFORE UPDATE OR DELETE ON public.account_intelligence_charges
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
