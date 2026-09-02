// Entitlements V1 — resolver + capability gate + atomic consumption policy.
// Deterministic (fake db). The live race + real route gate are proven in accept-entitlements-v1.mts.

import {
  resolveEntitlements, intelligenceRunGate, consumeRunSlotAtomic, entitlementSupportView,
} from "../../lib/entitlements/entitlements-v1";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

// Fake db: profiles + customer_credits keyed by user. Models the atomic guarded UPDATE
// (credit_balance := balance - cost WHERE credit_balance >= cost).
function fakeDb(state: Record<string, { plan?: string; credits?: number }>) {
  const table = (name: string) => {
    const b: any = { _name: name, _eqUser: "", _casBalance: null as number | null, _mode: "read", _patch: null as any };
    b.select = () => b;
    b.update = (patch: any) => { b._mode = "update"; b._patch = patch; return b; };
    b.eq = (c: string, v: any) => { if (c === "credit_balance") b._casBalance = v; else b._eqUser = v; return b; };
    b.insert = () => ({ then: (r: any) => r() });
    b.maybeSingle = async () => {
      const u = state[b._eqUser]; if (!u) return { data: null };
      if (name === "profiles") return { data: { plan: u.plan ?? "free" } };
      if (name === "customer_credits") return { data: u.credits != null ? { credit_balance: u.credits } : null };
      return { data: null };
    };
    b.then = (resolve: any) => {
      // UPDATE chain = compare-and-swap: applies only if current balance equals the CAS predicate.
      const u = state[b._eqUser];
      if (b._mode === "update" && name === "customer_credits" && u && b._casBalance != null && u.credits === b._casBalance) {
        u.credits = b._patch.credit_balance; return resolve({ data: [{ credit_balance: u.credits }] });
      }
      return resolve({ data: [] });
    };
    return b;
  };
  return { from: (n: string) => table(n) } as any;
}

async function run() {
  // CASE 1 — beta user (free plan, 0 credits): intelligence open, monitor closed.
  const beta = await resolveEntitlements(fakeDb({ u: { plan: "free", credits: 0 } }), "u");
  t("beta: accessSource beta", beta.accessSource === "beta");
  t("beta: can_run_intelligence", beta.capabilities.can_run_intelligence === true);
  t("beta: can_run_monitor false (recurring stays active-only)", beta.capabilities.can_run_monitor === false);
  t("beta: gate allows", intelligenceRunGate(beta) === null);

  // CASE 2 — paid legacy plan (starter): active customer.
  const paid = await resolveEntitlements(fakeDb({ u: { plan: "starter", credits: 0 } }), "u");
  t("paid: accessSource one_time", paid.accessSource === "one_time");
  t("paid: can_run_intelligence + monitor", paid.capabilities.can_run_intelligence && paid.capabilities.can_run_monitor);

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

  // CASE 10 — client cannot forge plan: resolver reads server state only (no client input param).
  t("resolver takes only (db,userId) — no client-supplied plan/quota", resolveEntitlements.length === 2);

  // Finite-plan gate: at 0 remaining → usage_limit_reached.
  const finite = { ...beta, limits: { max_runs_per_period: 3, max_active_monitors: 1 }, usage: { credits_remaining: 0 } };
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
