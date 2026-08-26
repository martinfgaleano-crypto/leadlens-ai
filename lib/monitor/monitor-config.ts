// ─── Recurring Monitor V1 — technical budgets + cadence (single source) ───────
//
// Monitor = bounded PERIODIC re-evaluation of KNOWN accounts. NOT real-time
// crawling, surveillance, or intent tracking. These are technical safety limits,
// NOT pricing entitlements or commercial cadence tiers.

import type { DecisionState } from "@/lib/deliverable/deliverable-view-model";

export interface MonitorBudget {
  maxAccountsPerRun: number;
  maxProviderCallsPerAccount: number;
  maxProviderCallsPerRun: number;
  maxQueriesPerAccount: number;
  maxExtractionsPerAccount: number;
  maxRetries: number;
  timeoutPerAccountMs: number;
  timeoutPerRunMs: number;
  /** Minimum planned routes that must be ATTEMPTED before NO_MATERIAL_CHANGE may
   *  be concluded (research-sufficiency gate). */
  minRoutesForSufficiency: number;
}

export const DEFAULT_MONITOR_BUDGET: MonitorBudget = {
  maxAccountsPerRun: 10,
  maxProviderCallsPerAccount: 6,
  maxProviderCallsPerRun: 60,
  maxQueriesPerAccount: 5,
  maxExtractionsPerAccount: 3,
  maxRetries: 1,
  timeoutPerAccountMs: 45_000,
  timeoutPerRunMs: 300_000,
  minRoutesForSufficiency: 1,
};

/** Technical re-evaluation cadence per Decision (days). NOT a pricing cadence.
 *  Hold has no cadence — it is only reviewed on an explicit revisit trigger. */
export const REVIEW_CADENCE_DAYS: Record<DecisionState, number | null> = {
  validate: 14,   // decision-critical unknowns deserve tighter revisit
  prioritize: 30, // freshness protection
  monitor: 30,
  hold: null,     // trigger-only
};

/** Evidence older than this (days) is a freshness gap candidate — NOT
 *  counterevidence, may motivate a validate/next-review. */
export const EVIDENCE_FRESHNESS_DAYS = 120;

// ─── Recurring scheduler (bounded automatic execution) ────────────────────────

/** Master kill switch for AUTOMATIC recurring execution. Off by default; the
 *  scheduler route refuses to run when this is false. The authenticated MANUAL
 *  trigger is unaffected. Set MONITOR_SCHEDULER_ENABLED=true in the environment
 *  to activate. */
export function schedulerEnabled(): boolean {
  return process.env.MONITOR_SCHEDULER_ENABLED === "true";
}

export interface SchedulerBudget {
  maxTenantsPerRun: number;
  maxAccountsPerRun: number;
  maxProviderCallsPerRun: number;
  maxRuntimeMs: number;
}

/** Technical safety limits for one scheduled wake (NOT pricing). One wake reviews
 *  only DUE accounts, up to these caps; the rest stay due (deferred). */
export const DEFAULT_SCHEDULER_BUDGET: SchedulerBudget = {
  maxTenantsPerRun: 25,
  maxAccountsPerRun: 40,
  maxProviderCallsPerRun: 240,
  maxRuntimeMs: 280_000,
};

/** Conservative default cron cadence (documentation only — the actual cron entry
 *  lives in vercel.json). Scheduler WAKE frequency ≠ per-account review cadence:
 *  each wake defers to deterministic Monitor eligibility for what is actually due. */
export const SCHEDULER_WAKE_CRON = "0 9 * * *"; // daily 09:00 UTC
