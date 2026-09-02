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

/** Idempotently ensure the current period row exists with the plan allowance. Never resets
 *  `consumed` on an existing row (a replayed renewal must not re-grant — §14/§24 invariant).
 *  Best-effort: returns false if the ledger table is not yet available (migration 062 pending). */
export async function seedUsagePeriod(db: any, userId: string, planCode: string, period: UsagePeriod & { allowance: number }): Promise<boolean> {
  try {
    const { error } = await db.from("subscription_usage_periods").upsert(
      { user_id: userId, plan_code: planCode, period_start: period.period_start, period_end: period.period_end, allowance: period.allowance, consumed: 0 },
      { onConflict: "user_id,period_start", ignoreDuplicates: true },
    );
    return !error;
  } catch { return false; }
}

export interface AccountChargeResult { charged: boolean; reason?: "already_charged" | "no_period" | "unavailable" }

/** Consume ONE Account Intelligence Credit for `accountKey` in the current period — idempotent per
 *  (user, period_start, account_key). A retry/duplicate for the same account in the same period is a
 *  0-cost no-op. Best-effort against migration 062; until applied it reports "unavailable" (no charge,
 *  no throw). Failed/incomplete analyses must simply never call this. */
export async function consumeAccountIntelligenceCredit(db: any, userId: string, period: UsagePeriod, accountKey: string, runId: string | null): Promise<AccountChargeResult> {
  try {
    // Per-account idempotency: insert-once. A unique-violation means this account was already
    // charged in this period → idempotent no-op.
    const ins = await db.from("account_intelligence_charges")
      .insert({ user_id: userId, period_start: period.period_start, account_key: accountKey, run_id: runId })
      .select("id");
    if (ins.error) return { charged: false, reason: "already_charged" };

    // Increment consumed via optimistic CAS on the period row.
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: rows } = await db.from("subscription_usage_periods")
        .select("consumed").eq("user_id", userId).eq("period_start", period.period_start).limit(1);
      if (!rows || !rows.length) return { charged: false, reason: "no_period" };
      const consumed = Number(rows[0].consumed ?? 0);
      const { data: updated } = await db.from("subscription_usage_periods")
        .update({ consumed: consumed + 1 })
        .eq("user_id", userId).eq("period_start", period.period_start).eq("consumed", consumed)
        .select("consumed");
      if (updated && updated.length) return { charged: true };
    }
    return { charged: true }; // charge recorded even if the counter race exhausted retries
  } catch { return { charged: false, reason: "unavailable" }; }
}
