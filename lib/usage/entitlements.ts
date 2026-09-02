// ─── Usage / Entitlements v0 ──────────────────────────────────────────────────
// Self-serve usage gate WITHOUT billing integration. Derives entitlement from
// data that already exists (profiles.plan, customer_credits.credit_balance).
//
// Honest gate: a customer may run monitors when they are an "active customer" —
// a non-free plan OR a positive credit balance. Monitor runs do NOT consume
// credits yet; per-run pricing/deduction is future billing work (see
// SELF_SERVE_SAAS_ARCHITECTURE.md). Nothing here fakes paid status: the
// values come straight from the plan/credits tables.
//
// Admin routes are never gated by this helper.
//
// Async run model (ASYNC_RUN_EXECUTION.md):
//   - Entitlement is checked ONCE, at job creation time, by the route that
//     creates the processing snapshot. The internal processor does not
//     re-check — the snapshot is the authorization token.
//   - Future credit deduction point: on successful completion
//     (completeSnapshot), via credit_transactions type='consume'. Never on
//     job creation (dead runs must not charge) — no deduction exists today.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Entitlements {
  plan_name: string;
  credits_remaining: number;
  can_create_monitor: boolean;
  can_run_monitor: boolean;
  /** Inert for now — surfaced when billing lands. null = no enforced limit. */
  monthly_run_limit: number | null;
  blocked_reason: string | null;
}

const FREE_PLANS = new Set(["free"]);

export async function getEntitlements(db: any, userId: string): Promise<Entitlements> {
  // Delegates to the ONE canonical resolver (Entitlements V1) so the Monitor path and the
  // primary Intelligence path derive capabilities from the same server-authoritative truth.
  // Kept as a thin backward-compatible shape for existing callers (/api/monitor/[id]/run,
  // /api/credits). Note: can_run_monitor now follows the resolved capability, which is beta-open
  // for authenticated Limited Beta customers (previously required an "active customer").
  const { resolveEntitlements } = await import("@/lib/entitlements/entitlements-v1");
  const e = await resolveEntitlements(db, userId);
  return {
    plan_name: e.planCode,
    credits_remaining: e.usage.credits_remaining,
    can_create_monitor: e.capabilities.can_create_monitor,
    can_run_monitor: e.capabilities.can_run_monitor,
    monthly_run_limit: e.limits.max_runs_per_period,
    blocked_reason: e.blocked_reason,
  };
}
