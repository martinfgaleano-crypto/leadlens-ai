// Entitlements V1 — resolver + capability gate + atomic consumption policy.
// Deterministic (fake db). The live race + real route gate are proven in accept-entitlements-v1.mts.

import {
  resolveEntitlements, intelligenceRunGate, consumeRunSlotAtomic, entitlementSupportView,
} from "../../lib/entitlements/entitlements-v1";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

// Fake db modeling profiles + customer_credits (+ CAS), customer_subscriptions, and the
// subscription_usage_periods ledger. Supports the read chains the resolver uses and the
// guarded UPDATE (credit_balance := balance - cost WHERE credit_balance = <read value>).
type UserState = { plan?: string; credits?: number; subscription?: any; usagePeriod?: any };
function fakeDb(state: Record<string, UserState>) {
  const table = (name: string) => {
    const b: any = { _name: name, _filters: {} as Record<string, any>, _mode: "read", _patch: null as any, _cas: null as number | null };
    b.select = () => b;
    b.update = (patch: any) => { b._mode = "update"; b._patch = patch; return b; };
    b.eq = (c: string, v: any) => { if (c === "credit_balance") b._cas = v; else b._filters[c] = v; return b; };
    b.lte = () => b; b.gte = () => b; b.order = () => b; b.limit = () => b;
    b.insert = () => ({ then: (r: any) => r() });
    const uid = () => b._filters["user_id"] ?? b._filters["id"];
    b.maybeSingle = async () => {
      const u = state[uid()]; if (!u) return { data: null };
      if (name === "profiles") return { data: { plan: u.plan ?? "free" } };
      if (name === "customer_credits") return { data: u.credits != null ? { credit_balance: u.credits } : null };
      return { data: null };
    };
    b.then = (resolve: any) => {
      const u = state[uid()];
      if (b._mode === "update" && name === "customer_credits") {
        if (u && b._cas != null && u.credits === b._cas) { u.credits = b._patch.credit_balance; return resolve({ data: [{ credit_balance: u.credits }] }); }
        return resolve({ data: [] });
      }
      if (name === "customer_subscriptions") return resolve({ data: u?.subscription ? [u.subscription] : [] });
      if (name === "subscription_usage_periods") return resolve({ data: u?.usagePeriod ? [u.usagePeriod] : [] });
      return resolve({ data: [] });
    };
    return b;
  };
  return { from: (n: string) => table(n) } as any;
}

const future = new Date(Date.now() + 20 * 86400e3).toISOString();
const past = new Date(Date.now() - 1 * 86400e3).toISOString();
const activeSub = (plan_code: string, interval = "month") => ({
  user_id: "u", payment_provider: "lemon_squeezy", provider_customer_id: "c", provider_subscription_id: "s",
  plan_code, billing_interval: interval, status: "active",
  current_period_start: past, current_period_end: future, cancel_at_period_end: false, ended_at: null,
  last_event_id: "e", last_event_at: past,
});

async function run() {
  // CASE 1 — beta user (free plan, 0 credits): metered Limited Beta (matrix §12).
  const beta = await resolveEntitlements(fakeDb({ u: { plan: "free", credits: 0 } }), "u");
  t("beta: accessSource beta", beta.accessSource === "beta");
  t("beta: can_run_intelligence", beta.capabilities.can_run_intelligence === true);
  t("beta: can_run_monitor true (metered monitor capacity, §12)", beta.capabilities.can_run_monitor === true);
  t("beta: metered limits 10 credits / 5 monitors / 14d", beta.limits.max_runs_per_period === 10 && beta.limits.max_active_monitors === 5 && beta.limits.cadence_min_days === 14);
  t("beta: usage pending_ledger at full allowance", beta.usage.credits_remaining === 10 && beta.usage.metering === "pending_ledger");
  t("beta: gate allows", intelligenceRunGate(beta) === null);

  // CASE 2 — paid legacy plan (starter): active one-time customer.
  const paid = await resolveEntitlements(fakeDb({ u: { plan: "starter", credits: 0 } }), "u");
  t("paid: accessSource one_time", paid.accessSource === "one_time");
  t("paid: can_run_intelligence + monitor", paid.capabilities.can_run_intelligence && paid.capabilities.can_run_monitor);
  t("paid: one_time not period-gated", paid.limits.max_runs_per_period === null && intelligenceRunGate(paid) === null);

  // credits-only active
  const cred = await resolveEntitlements(fakeDb({ u: { plan: "free", credits: 5 } }), "u");
  t("credits>0: active one_time", cred.accessSource === "one_time" && cred.usage.credits_remaining === 5);

  // CASE 3 — blocked account: safe denial.
  const blocked = await resolveEntitlements(fakeDb({ u: { plan: "blocked" } }), "u");
  t("blocked: accessSource none + cannot run", blocked.accessSource === "none" && !blocked.capabilities.can_run_intelligence);
  const denial = intelligenceRunGate(blocked);
  t("blocked: gate denies 403 access_not_enabled", denial?.status === 403 && denial?.code === "access_not_enabled");
  t("blocked: denial message is customer-safe (no db/provider terms)", Boolean(denial) && !/plan|credit|db|provider|profiles/i.test(denial!.message));

  // internal source
  const internal = await resolveEntitlements(fakeDb({ u: { plan: "internal" } }), "u");
  t("internal: accessSource internal + active", internal.accessSource === "internal" && internal.capabilities.can_run_monitor);

  // CASE — subscription (MONITOR): canonical limits from plan-config; overrides beta.
  const sub = await resolveEntitlements(fakeDb({ u: { plan: "free", credits: 0, subscription: activeSub("monitor") } }), "u");
  t("subscription: accessSource subscription", sub.accessSource === "subscription");
  t("subscription: planCode = monitor", sub.planCode === "monitor");
  t("subscription: MONITOR limits 30 credits / 20 monitors / 14d", sub.limits.max_runs_per_period === 30 && sub.limits.max_active_monitors === 20 && sub.limits.cadence_min_days === 14);
  t("subscription: can_run_intelligence + monitor", sub.capabilities.can_run_intelligence && sub.capabilities.can_run_monitor);
  t("subscription: usage pending_ledger → full allowance, gate allows", sub.usage.credits_remaining === 30 && intelligenceRunGate(sub) === null);

  // CASE — subscription WATCH with exhausted ledger period → 402 usage_limit_reached.
  const exhausted = await resolveEntitlements(fakeDb({ u: {
    plan: "free", credits: 0, subscription: activeSub("watch"),
    usagePeriod: { allowance: 3, consumed: 3, period_start: past, period_end: future },
  } }), "u");
  t("subscription exhausted: metering ledger + remaining 0", exhausted.usage.metering === "ledger" && exhausted.usage.credits_remaining === 0);
  t("subscription exhausted: gate → 402 usage_limit_reached", intelligenceRunGate(exhausted)?.code === "usage_limit_reached");

  // CASE — subscription overrides beta precedence (§24): free plan + active sub → subscription, not beta.
  t("precedence: active subscription overrides beta", sub.accessSource === "subscription");

  // CASE — cancelled but period still active → still grants (subscription).
  const cancelled = await resolveEntitlements(fakeDb({ u: { plan: "free", subscription: { ...activeSub("intelligence"), status: "canceled", cancel_at_period_end: true } } }), "u");
  t("cancel-at-period-end within period → subscription access retained", cancelled.accessSource === "subscription" && cancelled.planCode === "intelligence");

  // CASE — ended subscription (period past) → falls back (here to beta).
  const ended = await resolveEntitlements(fakeDb({ u: { plan: "free", credits: 0, subscription: { ...activeSub("monitor"), status: "expired", current_period_end: past } } }), "u");
  t("ended subscription → fallback (beta here)", ended.accessSource === "beta");

  // CASE 10 — client cannot forge plan: resolver reads server state only (no client input param).
  t("resolver takes only (db,userId) — no client-supplied plan/quota", resolveEntitlements.length === 2);

  // Finite-plan gate: at 0 remaining → usage_limit_reached.
  const finite = { ...beta, limits: { max_runs_per_period: 3, max_active_monitors: 1, cadence_min_days: 14 }, usage: { credits_remaining: 0, metering: "ledger" } };
  t("finite plan at 0 remaining → 402 usage_limit_reached", intelligenceRunGate(finite as any)?.code === "usage_limit_reached");

  // Atomic consumption: N credits → exactly N succeed, N+1 denied (guarded UPDATE).
  const st = { u: { plan: "starter", credits: 2 } };
  const db = fakeDb(st);
  const r1 = await consumeRunSlotAtomic(db, "u");
  const r2 = await consumeRunSlotAtomic(db, "u");
  const r3 = await consumeRunSlotAtomic(db, "u");
  t("consume: first two succeed", r1.ok && r2.ok && r1.remaining === 1 && r2.remaining === 0);
  t("consume: third denied (insufficient), balance floor 0", !r3.ok && r3.reason === "insufficient" && st.u.credits === 0);
  const none = await consumeRunSlotAtomic(fakeDb({}), "ghost");
  t("consume: no credits account → no_account", none.reason === "no_account");

  // CASE 15 — support view is safe + reflects resolution.
  const view = entitlementSupportView(blocked);
  t("support view reflects access + no secrets", view.access_source === "none" && view.can_run_intelligence === false && !("service_role" in view));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((e) => { console.error(e); process.exit(1); });
