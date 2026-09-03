#!/usr/bin/env node
// REAL acceptance: the recurring Monitor path meters Account Intelligence Credits through the
// PRODUCTION wiring — runScheduledMonitor → resolveUsageMeter → monitorUsageGate →
// claimAccountIntelligenceCredit → applied migration 062. Research is faked (no provider cost);
// the scheduler, entitlement resolution, ledger, and snapshot persistence are all real. Self-cleaning.
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { runScheduledMonitor } = await import("@/lib/monitor/scheduler");
const { loadDueMonitoredWork } = await import("@/lib/monitor/monitor-store");
const { SupabaseAccountMemoryRepo } = await import("@/lib/deliverable/account-memory-store");
const { resolveEntitlements } = await import("@/lib/entitlements/entitlements-v1");
const { snapshotFingerprint } = await import("@/lib/deliverable/account-memory");
const db = createServerClient()!;

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };

const stamp = Date.now();
const now = new Date();
const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(); // beta anchor = calendar month
const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400e3).toISOString();
let owner: string | null = null;
const clientKey = `ctx_${stamp}`;

// A fake sufficient no-change observation → an ACCEPTED (materialized) review, no provider calls.
const noChange = async (plan: any) => ({ accountId: plan.accountId, items: [], providersAvailable: ["brave", "tavily"], providersFailed: [], routesAttempted: 2, operatingMode: "full" });
const monSnap = (accountId: string) => ({
  reviewId: `r_${accountId}_${stamp}`, reviewedAt: daysAgo(40), contextVersion: "ctx", accountId, decision: "monitor",
  fit: "Moderate", timing: "Limited", evidence: "Moderate",
  accountIdentity: { stableAccountKey: accountId, canonicalName: `Co ${accountId}`, domain: `${accountId}.example`, aliases: [], country: "US", organizationType: "private_company", confidence: "verified", fromUniverse: true, lineage: "candidate_universe" },
  changeKeys: [], hasVerifiedChange: false, evidenceOrigins: ["reuters.com"], independentSupport: false,
  counterCount: 0, hasMaterialCounter: false, validationThemeKeys: [], decisionCriticalThemeKeys: [], hasRevisitTrigger: false, revisitTrigger: null, monitorReason: null,
});
const seedDue = async (accountIds: string[]) => {
  await db.from("account_review_snapshots").delete().eq("owner_user_id", owner);
  for (const id of accountIds) {
    const s = monSnap(id);
    await db.from("account_review_snapshots").insert({ owner_user_id: owner, client_key: clientKey, account_id: id, review_id: s.reviewId, context_version: "ctx", reviewed_at: s.reviewedAt, snapshot: s, fingerprint: snapshotFingerprint(s as any) });
  }
};
// account_intelligence_charges is append-only (immutable) — never deleted. Cases use distinct
// wake/account ids and DELTA measurement so accumulated charges never cross-contaminate.
const setPeriod = async (allowance: number, consumed: number) => {
  await db.from("subscription_usage_periods").upsert({ user_id: owner, plan_code: "beta", period_start: periodStart, period_end: periodEnd, allowance, consumed }, { onConflict: "user_id,period_start" });
  await db.from("subscription_usage_periods").update({ allowance, consumed }).eq("user_id", owner).eq("period_start", periodStart);
};
const chargeCount = async () => ((await db.from("account_intelligence_charges").select("id", { count: "exact", head: true }).eq("user_id", owner)).count ?? 0);
const consumedNow = async () => Number(((await db.from("subscription_usage_periods").select("consumed").eq("user_id", owner).eq("period_start", periodStart).maybeSingle()).data?.consumed) ?? -1);
const reviewSnapCount = async () => ((await db.from("account_review_snapshots").select("review_id", { count: "exact", head: true }).eq("owner_user_id", owner)).count ?? 0);

const resolveUsageMeter = async (scope: any) => scope.ownerUserId ? { db, entitlement: await resolveEntitlements(db, scope.ownerUserId) } : undefined;
const runWake = async (wakeId: string) => {
  const tenants = (await loadDueMonitoredWork(db)).filter((t: any) => t.scope.ownerUserId === owner);
  return runScheduledMonitor({ wakeId, tenants, reobserve: noChange as any, memoryRepo: new SupabaseAccountMemoryRepo(db), origin: "scheduled", now: () => new Date(), resolveUsageMeter });
};

try {
  owner = (await db.auth.admin.createUser({ email: `ll-monuse-${stamp}@example.com`, password: `Mu-${stamp}-Aa!`, email_confirm: true })).data.user!.id;
  await db.from("profiles").upsert({ id: owner, email: `ll-monuse-${stamp}@example.com`, plan: "free" }, { onConflict: "id" });
  await db.from("customer_credits").upsert({ user_id: owner, credit_balance: 0 }, { onConflict: "user_id" });
  const e = await resolveEntitlements(db, owner);
  check("owner resolves to metered beta (can_run_monitor)", e.accessSource === "beta" && e.capabilities.can_run_monitor === true && e.limits.max_runs_per_period === 10);

  const dCharges = async (fn: () => Promise<unknown>) => { const b = await chargeCount(); await fn(); return (await chargeCount()) - b; };

  // ── Q1 — successful scheduled Review #2 → exactly 1 credit ──
  await seedDue(["q1acct"]); await setPeriod(10, 0);
  const before1 = await reviewSnapCount();
  const d1 = await dCharges(() => runWake("Q1WAKE"));
  check("Q1 exactly 1 Account Intelligence Credit charged", d1 === 1 && await consumedNow() === 1, `charged=${d1} consumed=${await consumedNow()}`);
  check("Q1 a new Review #2 snapshot materialized", await reviewSnapCount() === before1 + 1);

  // ── Q2 — exhausted usage → no material research → 0 charge ──
  await seedDue(["q2acct"]); await setPeriod(10, 10); // consumed == allowance → exhausted
  const before2 = await reviewSnapCount();
  let s2: any;
  const d2 = await dCharges(async () => { s2 = await runWake("Q2WAKE"); });
  check("Q2 exhausted → 0 new charge", d2 === 0 && await consumedNow() === 10, `charged=${d2} consumed=${await consumedNow()}`);
  check("Q2 no new materialized review (no material research)", await reviewSnapCount() === before2);
  check("Q2 accounts reported as usage-deferred (not attempted)", s2.accountsReviewed === 0);

  // ── Q3 — duplicate/retry of same logical scheduled review → exactly 1 eventual charge ──
  await seedDue(["q3acct"]); await setPeriod(10, 0);
  const d3 = await dCharges(async () => { await runWake("Q3WAKE"); await runWake("Q3WAKE"); }); // same wakeId → same runId
  check("Q3 duplicate wake → exactly 1 credit (idempotent)", d3 === 1 && await consumedNow() === 1, `charged=${d3} consumed=${await consumedNow()}`);

  // ── Q4 — one remaining credit, two due accounts → at most one materialization crosses ──
  await seedDue(["q4a", "q4b"]); await setPeriod(10, 9); // 1 slot left
  const before4 = await reviewSnapCount();
  const d4 = await dCharges(() => runWake("Q4WAKE"));
  check("Q4 one remaining credit → exactly one charge crosses", d4 === 1 && await consumedNow() === 10, `charged=${d4} consumed=${await consumedNow()}`);
  check("Q4 at most one new materialization", await reviewSnapCount() === before4 + 1);

  // ── Q4b — concurrent wakes on one account, one slot → ledger admits at most one ──
  await seedDue(["q5acct"]); await setPeriod(10, 9);
  const d5 = await dCharges(() => Promise.all([runWake("Q5WAKEa"), runWake("Q5WAKEb")]).then(() => undefined)); // distinct runIds racing one slot
  check("Q4b concurrent wakes with one slot → at most one charge (no overspend)", d5 <= 1 && await consumedNow() <= 10, `charged=${d5} consumed=${await consumedNow()}`);

  const failures = checks.filter((c) => !c.ok);
  console.log(`\nMONITOR-RECURRING-USAGE :: ${checks.length - failures.length}/${checks.length} checks passed`);
} catch (err) {
  check("harness completed without throw", false, err instanceof Error ? err.message : String(err));
} finally {
  if (owner) {
    await db.from("account_intelligence_charges").delete().eq("user_id", owner);
    await db.from("subscription_usage_periods").delete().eq("user_id", owner);
    await db.from("account_review_snapshots").delete().eq("owner_user_id", owner);
    await db.from("snapshot_reports").delete().eq("user_id", owner);
    await db.from("customer_credits").delete().eq("user_id", owner);
    await db.from("profiles").delete().eq("id", owner);
    await db.auth.admin.deleteUser(owner).catch(() => {});
  }
  console.log("cleanup :: disposable owner removed");
}
process.exit(checks.some((c) => !c.ok) ? 2 : 0);
