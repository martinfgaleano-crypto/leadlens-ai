#!/usr/bin/env node
// REAL acceptance for per-account Account Intelligence Credit metering against the applied
// migration 062 (subscription_usage_periods + account_intelligence_charges). Proves the frozen
// commercial unit end to end: reservation, per-analysis idempotency, legitimate re-analysis,
// multi-account allowance cap, concurrency safety, exhaustion, append-only charges, one-time
// separation, and resolver→gate reflection. Self-cleaning.
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { claimAccountIntelligenceCredit, seedUsagePeriod } = await import("@/lib/billing/usage-ledger");
const { chargeMaterializedAccounts, remainingAllowanceForRun } = await import("@/lib/billing/account-metering");
const { resolveEntitlements, intelligenceRunGate } = await import("@/lib/entitlements/entitlements-v1");
const db = createServerClient()!;

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };

const stamp = Date.now();
const P = new Date(Date.UTC(2026, 0, 1)).toISOString();          // manual period start
const Pend = new Date(Date.UTC(2026, 1, 1)).toISOString();
let uA: string | null = null, uB: string | null = null, uC: string | null = null, uD: string | null = null, uE: string | null = null;
const mkUser = async (tag: string) => {
  const email = `ll-meter-${tag}-${stamp}@example.com`;
  const id = (await db.auth.admin.createUser({ email, password: `Mt-${stamp}-${tag}a!`, email_confirm: true })).data.user!.id;
  await db.from("profiles").upsert({ id, email, plan: "free" }, { onConflict: "id" });
  await db.from("customer_credits").upsert({ user_id: id, credit_balance: 0 }, { onConflict: "user_id" });
  return id;
};
const consumedOf = async (uid: string, ps: string) => Number(((await db.from("subscription_usage_periods").select("consumed").eq("user_id", uid).eq("period_start", ps).maybeSingle()).data?.consumed) ?? -1);
const seedManual = async (uid: string, allowance: number) => { await db.from("subscription_usage_periods").upsert({ user_id: uid, plan_code: "test", period_start: P, period_end: Pend, allowance, consumed: 0 }, { onConflict: "user_id,period_start" }); };
const claim = (uid: string, analysis: string, account: string) => claimAccountIntelligenceCredit(db, { userId: uid, periodStart: P, accountKey: account, analysisKey: analysis, runId: analysis });

try {
  uA = await mkUser("A"); uB = await mkUser("B"); uC = await mkUser("C");

  // ── PART A: ledger primitives (allowance 3) ──
  await seedManual(uA, 3);
  check("1-account success → 1 charge", (await claim(uA, "R1", "acct-X")).charged === true && await consumedOf(uA, P) === 1);
  check("technical retry (same analysis+account) → no second charge", (await claim(uA, "R1", "acct-X")).alreadyCharged === true && await consumedOf(uA, P) === 1);
  check("duplicate request (same key) → no charge", (await claim(uA, "R1", "acct-X")).charged === false && await consumedOf(uA, P) === 1);
  check("legitimate re-analysis (new analysis, same account) → new charge", (await claim(uA, "R2", "acct-X")).charged === true && await consumedOf(uA, P) === 2);

  // multi-account under one analysis, allowance 3 (already consumed 2) → 1 more, then exhausted
  const r3 = [await claim(uA, "R3", "acct-Y"), await claim(uA, "R3", "acct-Z"), await claim(uA, "R3", "acct-W")];
  check("allowance cap: only remaining slots charge (1 charged, 2 exhausted)", r3.filter((r) => r.charged).length === 1 && r3.filter((r) => r.reason === "exhausted").length === 2 && await consumedOf(uA, P) === 3);
  check("exhaustion: further claim → exhausted, no overspend", (await claim(uA, "R4", "acct-Q")).reason === "exhausted" && await consumedOf(uA, P) === 3);

  // concurrency: fresh period, 1 slot, two concurrent DIFFERENT-account claims → exactly 1 charges
  await db.from("account_intelligence_charges").delete().eq("user_id", uA);
  await db.from("subscription_usage_periods").update({ allowance: 1, consumed: 0 }).eq("user_id", uA).eq("period_start", P);
  const race = await Promise.all([claim(uA, "RC", "race-1"), claim(uA, "RC2", "race-2")]);
  check("concurrent final slot → exactly one charges (no overspend)", race.filter((r) => r.charged).length === 1 && await consumedOf(uA, P) === 1);

  // append-only charges (immutability trigger)
  const anyCharge = (await db.from("account_intelligence_charges").select("id").eq("user_id", uA).limit(1)).data?.[0]?.id;
  const upd = await db.from("account_intelligence_charges").update({ run_id: "tamper" }).eq("id", anyCharge);
  const del = await db.from("account_intelligence_charges").delete().eq("id", anyCharge);
  check("charges are append-only (update + delete rejected)", Boolean(upd.error) && Boolean(del.error));

  // tenant isolation
  await seedManual(uB, 3);
  await claim(uB, "RB", "acct-X");
  check("tenant isolation: B's charge does not touch A", await consumedOf(uB, P) === 1 && await consumedOf(uA, P) === 1);

  // ── PART B: seam + resolver (real subscription entitlement) ──
  const subId = `meter-sub-${stamp}`;
  await db.from("customer_subscriptions").upsert({
    user_id: uC, payment_provider: "lemon_squeezy", provider_customer_id: "c", provider_subscription_id: subId,
    plan_code: "monitor", billing_interval: "month", status: "active",
    current_period_start: new Date(Date.UTC(2026, 8, 1)).toISOString(), current_period_end: new Date(Date.UTC(2026, 11, 1)).toISOString(),
    cancel_at_period_end: false, ended_at: null, last_event_id: "e", last_event_at: new Date().toISOString(),
  }, { onConflict: "payment_provider,provider_subscription_id" });
  const eC = await resolveEntitlements(db, uC);
  check("subscription entitlement resolves (monitor, allowance 30)", eC.accessSource === "subscription" && eC.limits.max_runs_per_period === 30);

  const seam = await chargeMaterializedAccounts(db, eC, { runId: "RUN-X" }, ["a1", "a2", "a3", "a2"]); // a2 duplicated in-list
  check("seam charges each unique materialized account once (3, dedup a2)", seam.metered && seam.charged.length === 3);
  const eC2 = await resolveEntitlements(db, uC);
  check("resolver reflects ledger consumption (30-3=27, metering=ledger)", eC2.usage.credits_remaining === 27 && eC2.usage.metering === "ledger");
  check("gate allows while allowance remains", intelligenceRunGate(eC2) === null);

  const seamRetry = await chargeMaterializedAccounts(db, eC, { runId: "RUN-X" }, ["a1", "a2", "a3"]);
  check("seam re-run same runId → all alreadyCharged, no new consumption", seamRetry.charged.length === 0 && seamRetry.already.length === 3 && (await resolveEntitlements(db, uC)).usage.credits_remaining === 27);

  const budgetSameRun = await remainingAllowanceForRun(db, eC, Date.now(), "RUN-X");
  const budgetNewRun = await remainingAllowanceForRun(db, eC, Date.now(), "RUN-Y");
  check("recovery budget adds back own prior charges (RUN-X: 27+3=30; RUN-Y: 27)", budgetSameRun === 30 && budgetNewRun === 27);

  // UPGRADE (monitor→intelligence): current-period allowance raised immediately, consumed preserved (§18).
  await db.from("customer_subscriptions").update({ plan_code: "intelligence" }).eq("provider_subscription_id", subId);
  const eUp = await resolveEntitlements(db, uC);
  const upBudget = await remainingAllowanceForRun(db, eUp, Date.now(), "RUN-Z"); // seeds/raises
  check("upgrade: allowance raised to 100 immediately, 3 consumed preserved → 97", eUp.limits.max_runs_per_period === 100 && upBudget === 97 && (await resolveEntitlements(db, uC)).usage.credits_remaining === 97);

  // DOWNGRADE (intelligence→watch): current period NOT lowered mid-cycle (§19); stays at raised allowance.
  await db.from("customer_subscriptions").update({ plan_code: "watch" }).eq("provider_subscription_id", subId);
  const eDown = await resolveEntitlements(db, uC);
  const downBudget = await remainingAllowanceForRun(db, eDown, Date.now(), "RUN-W");
  check("downgrade: current period allowance NOT cut mid-cycle → remains 97", downBudget === 97);

  // ── PART C: non-metered separation, beta meter, partial failure ──
  uD = await mkUser("D");
  await db.from("customer_credits").upsert({ user_id: uD, credit_balance: 5 }, { onConflict: "user_id" }); // one-time customer
  const eD = await resolveEntitlements(db, uD);
  const seamD = await chargeMaterializedAccounts(db, eD, { runId: "RUN-D" }, ["d1", "d2"]);
  const creditsD = Number((await db.from("customer_credits").select("credit_balance").eq("user_id", uD).maybeSingle()).data?.credit_balance);
  check("one_time customer: seam is a no-op (not metered) + customer_credits untouched", eD.accessSource === "one_time" && seamD.metered === false && seamD.charged.length === 0 && creditsD === 5);
  check("one_time: no production cap (remainingAllowanceForRun null)", (await remainingAllowanceForRun(db, eD, Date.now(), "RUN-D")) === null);

  uE = await mkUser("E"); // free + 0 credits → beta (metered 10)
  const eE = await resolveEntitlements(db, uE);
  const seamE = await chargeMaterializedAccounts(db, eE, { runId: "RUN-E" }, ["e1", "e2"]); // partial: e-fail excluded by caller
  const creditsE = Number((await db.from("customer_credits").select("credit_balance").eq("user_id", uE).maybeSingle()).data?.credit_balance);
  check("beta uses the SAME meter (accessSource beta, 2 charged of allowance 10)", eE.accessSource === "beta" && seamE.metered === true && seamE.charged.length === 2);
  check("partial failure: only the accounts passed (materialized) are charged", seamE.charged.length === 2);
  check("beta metering does NOT touch one-time customer_credits (stays 0)", creditsE === 0 && (await resolveEntitlements(db, uE)).usage.credits_remaining === 8);

  const failures = checks.filter((c) => !c.ok);
  console.log(`\nACCOUNT-METERING :: ${checks.length - failures.length}/${checks.length} checks passed`);
} catch (e) {
  check("harness completed without throw", false, e instanceof Error ? e.message : String(e));
} finally {
  for (const uid of [uA, uB, uC, uD, uE]) if (uid) {
    await db.from("account_intelligence_charges").delete().eq("user_id", uid);
    await db.from("subscription_usage_periods").delete().eq("user_id", uid);
    await db.from("customer_subscriptions").delete().eq("user_id", uid);
    await db.from("customer_credits").delete().eq("user_id", uid);
    await db.from("profiles").delete().eq("id", uid);
    await db.auth.admin.deleteUser(uid).catch(() => {});
  }
  console.log("cleanup :: disposable users removed");
}
process.exit(checks.some((c) => !c.ok) ? 2 : 0);
