// ─── Subscription/Beta usage ledger (per-account, period-scoped) ──────────────
//
// Frozen matrix consequences (owner-accepted engineering implications):
//   #1 Commercial usage is PER ACCOUNT (1 Account Intelligence Credit = one account
//      materialized/re-analyzed), not per run/job. Idempotent per (period, account).
//   #2 The subscription/Beta periodic allowance is DISTINCT from durable one-time
//      customer_credits — it lives here, so subscription consumption never draws down
//      preserved one-time rights (§13).
//   #3 Annual subscriptions refresh MONTHLY, anchored to the billing/start day — not one
//      annual pool. The monthly window is computed internally (Lemon emits no monthly
//      event for annual plans).
//
// The pure period math (monthlyPeriodBoundaries / currentUsagePeriod) is used now. The DB
// seams (seed/consume) target migration 062 (subscription_usage_periods +
// account_intelligence_charges); until that migration is applied they fail safe (no-op),
// so this module is CODE-READY — MIGRATION-PENDING for live metering.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UsagePeriod { period_start: string; period_end: string }

function daysInMonth(year: number, monthIdx: number): number {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

/** The monthly entitlement window containing `now`, anchored to the day-of-month (and time) of
 *  `anchorIso` (the subscription start/billing day). Month-end days are clamped (e.g. a 31st
 *  anchor → the last day of a short month). Works for both monthly and annual plans (§15). */
export function monthlyPeriodBoundaries(anchorIso: string, now: number = Date.now()): UsagePeriod {
  const anchor = new Date(anchorIso);
  const day = anchor.getUTCDate();
  const hh = anchor.getUTCHours(), mm = anchor.getUTCMinutes(), ss = anchor.getUTCSeconds();
  const n = new Date(now);
  let y = n.getUTCFullYear(), m = n.getUTCMonth();
  const at = (yy: number, mm2: number) => Date.UTC(yy, mm2, Math.min(day, daysInMonth(yy, mm2)), hh, mm, ss);

  let start = at(y, m);
  if (start > now) { m -= 1; if (m < 0) { m = 11; y -= 1; } start = at(y, m); }
  let ey = y, em = m + 1; if (em > 11) { em = 0; ey += 1; }
  const end = at(ey, em);
  return { period_start: new Date(start).toISOString(), period_end: new Date(end).toISOString() };
}

/** Current usage period + allowance for a subscription (or beta), anchored to `anchorIso`. */
export function currentUsagePeriod(anchorIso: string, allowance: number, now: number = Date.now()): UsagePeriod & { allowance: number } {
  return { ...monthlyPeriodBoundaries(anchorIso, now), allowance };
}

/** Idempotently ensure the current period row exists with the plan allowance. Invariants:
 *   • never resets `consumed` on an existing row (a replayed renewal must not re-grant — §14);
 *   • an UPGRADE raises the current period's allowance immediately (§18);
 *   • a DOWNGRADE never lowers the current period mid-cycle (§19) — it takes effect only when the
 *     next period's row is seeded — so allowance is RAISE-ONLY here.
 *  Best-effort: returns false if the ledger table is not yet available (migration 062 pending). */
export async function seedUsagePeriod(db: any, userId: string, planCode: string, period: UsagePeriod & { allowance: number }): Promise<boolean> {
  try {
    // Insert the period if absent (idempotent renewal seed; consumed starts at 0).
    await db.from("subscription_usage_periods").upsert(
      { user_id: userId, plan_code: planCode, period_start: period.period_start, period_end: period.period_end, allowance: period.allowance, consumed: 0 },
      { onConflict: "user_id,period_start", ignoreDuplicates: true },
    );
    // Raise-only allowance alignment for the CURRENT period (upgrade immediate, downgrade deferred).
    const { data } = await db.from("subscription_usage_periods").select("allowance")
      .eq("user_id", userId).eq("period_start", period.period_start).limit(1);
    const current = data && data[0] ? Number(data[0].allowance) : null;
    if (current != null && period.allowance > current) {
      await db.from("subscription_usage_periods").update({ allowance: period.allowance, plan_code: planCode })
        .eq("user_id", userId).eq("period_start", period.period_start);
    }
    return true;
  } catch { return false; }
}

export interface ClaimInput { userId: string; periodStart: string; accountKey: string; analysisKey: string; runId: string | null }
export interface ClaimResult { charged: boolean; alreadyCharged?: boolean; reason?: "exhausted" | "no_period" | "unavailable" }

/** Best-effort CAS decrement of `consumed` (release a reserved slot). */
async function releaseSlot(db: any, userId: string, periodStart: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const { data: rows } = await db.from("subscription_usage_periods").select("consumed").eq("user_id", userId).eq("period_start", periodStart).limit(1);
    if (!rows || !rows.length) return;
    const consumed = Number(rows[0].consumed ?? 0);
    if (consumed <= 0) return;
    const { data: updated } = await db.from("subscription_usage_periods").update({ consumed: consumed - 1 })
      .eq("user_id", userId).eq("period_start", periodStart).eq("consumed", consumed).select("consumed");
    if (updated && updated.length) return;
  }
}

/** Claim ONE Account Intelligence Credit for `accountKey` under logical analysis `analysisKey`
 *  (the review/run id). RESERVATION semantics:
 *    1. Idempotency pre-check on (user, analysis_key, account_key) — a technical retry of the same
 *       logical analysis is a 0-cost no-op (alreadyCharged); a NEW analysis_key charges again.
 *    2. Reserve a slot: CAS-increment `consumed` only while `consumed < allowance` → concurrent
 *       final-slot claims for different accounts consume it at most once (no overspend).
 *    3. Insert the append-only charge; a concurrent duplicate insert releases the reserved slot.
 *  Failed/aborted account analyses must simply never call this. Best-effort against a missing
 *  ledger (pre-062) → reports "unavailable" without throwing. */
export async function claimAccountIntelligenceCredit(db: any, input: ClaimInput): Promise<ClaimResult> {
  try {
    const pre = await db.from("account_intelligence_charges").select("id")
      .eq("user_id", input.userId).eq("analysis_key", input.analysisKey).eq("account_key", input.accountKey).limit(1);
    if (pre.data && pre.data.length) return { charged: false, alreadyCharged: true };

    let reserved = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const { data: rows } = await db.from("subscription_usage_periods")
        .select("allowance,consumed").eq("user_id", input.userId).eq("period_start", input.periodStart).limit(1);
      if (!rows || !rows.length) return { charged: false, reason: "no_period" };
      const allowance = Number(rows[0].allowance ?? 0), consumed = Number(rows[0].consumed ?? 0);
      if (consumed >= allowance) return { charged: false, reason: "exhausted" };
      const { data: updated } = await db.from("subscription_usage_periods").update({ consumed: consumed + 1 })
        .eq("user_id", input.userId).eq("period_start", input.periodStart).eq("consumed", consumed).select("consumed");
      if (updated && updated.length) { reserved = true; break; }
    }
    if (!reserved) return { charged: false, reason: "unavailable" };

    const ins = await db.from("account_intelligence_charges")
      .insert({ user_id: input.userId, period_start: input.periodStart, account_key: input.accountKey, analysis_key: input.analysisKey, run_id: input.runId })
      .select("id");
    if (ins.error) { await releaseSlot(db, input.userId, input.periodStart); return { charged: false, alreadyCharged: true }; }
    return { charged: true };
  } catch { return { charged: false, reason: "unavailable" }; }
}
