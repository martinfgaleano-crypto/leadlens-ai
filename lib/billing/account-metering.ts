// ─── Account Intelligence metering seam (subscription + beta) ─────────────────
//
// Bridges resolved entitlement ↔ the per-account usage ledger (migration 062). Two operations
// the productive run path uses, both keyed on the frozen commercial unit (1 credit = one account
// materialized under one logical analysis):
//
//   remainingAllowanceForRun()  — PRODUCTION cap (matrix §9): how many accounts this run may
//     paid-materialize. The executor caps its research/delivery budget by this so it never
//     produces more paid Account Intelligence than the allowance (never "produce 5, charge 3").
//     Returns null for non-metered access (one_time/internal) → no cap.
//
//   chargeMaterializedAccounts() — COMMIT (matrix §6): charge exactly one credit per account that
//     durably materialized valid Intelligence under this run (analysis_key = runId). Idempotent
//     (retry/duplicate → 0), allowance-bounded, race-safe. Non-metered → no-op (one-time keeps its
//     own credit path; internal is unlimited). Failed accounts are simply not passed in.
//
// Subscription/beta only. one_time consumption stays on customer_credits (§13 separation).

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EffectiveEntitlement } from "@/lib/entitlements/entitlements-v1";
import { currentUsagePeriod, seedUsagePeriod, claimAccountIntelligenceCredit, type UsagePeriod } from "@/lib/billing/usage-ledger";

export function isMetered(e: EffectiveEntitlement): boolean {
  return e.accessSource === "subscription" || e.accessSource === "beta";
}

/** Resolve + lazily seed the current metered period for a subscription/beta customer. Subscription
 *  anchors to the provider billing/start day; beta anchors to the calendar month. */
async function meteredPeriod(db: any, e: EffectiveEntitlement, now: number): Promise<(UsagePeriod & { allowance: number; planCode: string }) | null> {
  if (!isMetered(e)) return null;
  const allowance = e.limits.max_runs_per_period ?? 0;
  let anchorIso: string;
  let planCode: string;
  if (e.accessSource === "subscription") {
    let anchor: string | null = null;
    try {
      const { data } = await db.from("customer_subscriptions").select("current_period_start").eq("user_id", e.userId).order("updated_at", { ascending: false }).limit(1);
      anchor = (data && data[0]?.current_period_start) || null;
    } catch { anchor = null; }
    anchorIso = anchor ?? new Date(now).toISOString();
    planCode = e.planCode;
  } else {
    const d = new Date(now);
    anchorIso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
    planCode = "beta";
  }
  const period = currentUsagePeriod(anchorIso, allowance, now);
  await seedUsagePeriod(db, e.userId, planCode, period);
  return { ...period, allowance, planCode };
}

async function readRemaining(db: any, userId: string, periodStart: string, fallbackAllowance: number): Promise<number> {
  try {
    const { data } = await db.from("subscription_usage_periods").select("allowance,consumed").eq("user_id", userId).eq("period_start", periodStart).limit(1);
    if (!data || !data.length) return fallbackAllowance;
    return Math.max(0, Number(data[0].allowance ?? fallbackAllowance) - Number(data[0].consumed ?? 0));
  } catch { return fallbackAllowance; }
}

/** Credits this logical analysis (analysis_key) has ALREADY charged — added back to the budget so a
 *  recovery re-run of the same runId can reproduce its own accounts (idempotent) without being
 *  starved by its own prior charges. */
async function ownPriorCharges(db: any, userId: string, analysisKey: string): Promise<number> {
  try {
    const { count } = await db.from("account_intelligence_charges").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("analysis_key", analysisKey);
    return count ?? 0;
  } catch { return 0; }
}

/** Remaining paid Account Intelligence Credits available to this run, or null when unmetered
 *  (one_time/internal → no production cap). Lazily seeds the period. When `analysisKey` (the runId)
 *  is given, this run's own prior charges are added back so a recovery re-run reproduces its own
 *  accounts rather than starving on slots it already claimed. */
export async function remainingAllowanceForRun(db: any, e: EffectiveEntitlement, now: number = Date.now(), analysisKey?: string): Promise<number | null> {
  const period = await meteredPeriod(db, e, now);
  if (!period) return null;
  const remaining = await readRemaining(db, e.userId, period.period_start, period.allowance);
  if (!analysisKey) return remaining;
  return remaining + await ownPriorCharges(db, e.userId, analysisKey);
}

export interface MeteringResult { metered: boolean; charged: string[]; already: string[]; exhausted: string[] }

/** Charge one credit per materialized account (analysis_key = runId), idempotent + allowance-bounded.
 *  `accountKeys` must be the accounts that durably materialized valid Intelligence (failures excluded). */
export async function chargeMaterializedAccounts(db: any, e: EffectiveEntitlement, ctx: { runId: string; now?: number }, accountKeys: string[]): Promise<MeteringResult> {
  const now = ctx.now ?? Date.now();
  const period = await meteredPeriod(db, e, now);
  if (!period) return { metered: false, charged: [], already: [], exhausted: [] };

  const charged: string[] = [], already: string[] = [], exhausted: string[] = [];
  const seen = new Set<string>();
  for (const accountKey of accountKeys) {
    if (!accountKey || seen.has(accountKey)) continue;
    seen.add(accountKey);
    const r = await claimAccountIntelligenceCredit(db, { userId: e.userId, periodStart: period.period_start, accountKey, analysisKey: ctx.runId, runId: ctx.runId });
    if (r.charged) charged.push(accountKey);
    else if (r.alreadyCharged) already.push(accountKey);
    else exhausted.push(accountKey);
  }
  return { metered: true, charged, already, exhausted };
}
