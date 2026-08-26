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
