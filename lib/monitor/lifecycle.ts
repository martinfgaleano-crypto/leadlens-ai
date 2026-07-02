// ─── Monitor Lifecycle v0 ─────────────────────────────────────────────────────
// Single lifecycle state per monitor series for customer-facing surfaces.
// Wraps the same signals as lib/monitor/readiness.ts (admin QA verdicts) but
// speaks the customer journey: setup → run → report → compare.
//
// Pure derivation from existing data — no schema, no persistence.

export type MonitorLifecycleState =
  | "setup_incomplete"   // no onboarding_requests linkage — runs impossible
  | "processing"         // a FRESH run is in flight (also covers blocked_duplicate)
  | "stale_processing"   // a processing run passed the stale cutoff — retriable
  | "failed"             // latest run failed and no completed report exists
  | "needs_review"       // completed report exists but newest run failed / QA flagged
  | "ready_to_run"       // setup complete, no runs yet
  | "baseline_ready"     // exactly one completed report (first cycle)
  | "comparison_ready";  // 2+ completed reports — change comparison active

export interface LifecycleInput {
  hasOnboardingLink: boolean | null; // null = unknown → treated as complete (fail open for display only)
  totalRuns: number;
  /** a FRESH processing run exists (stale rows excluded server-side) */
  hasProcessingRun: boolean;
  /** a processing run past the stale cutoff exists (per-run is_stale flags) */
  hasStaleProcessingRun?: boolean;
  latestRunStatus: "processing" | "completed" | "failed" | null;
  completedRuns: number;
  /** optional QA signal (admin-derived); customer surfaces usually pass false */
  latestNeedsReview?: boolean;
}

export function deriveMonitorLifecycle(input: LifecycleInput): MonitorLifecycleState {
  if (input.hasOnboardingLink === false) return "setup_incomplete";
  if (input.hasProcessingRun) return "processing";
  if (input.hasStaleProcessingRun && input.completedRuns === 0) return "stale_processing";
  if (input.latestRunStatus === "failed" && input.completedRuns === 0) return "failed";
  if (input.latestRunStatus === "failed" || input.latestNeedsReview) return "needs_review";
  if (input.totalRuns === 0 || input.completedRuns === 0) return "ready_to_run";
  if (input.completedRuns === 1) return "baseline_ready";
  return "comparison_ready";
}

// Customer-safe copy — no raw enums, no internal QA language.
export const LIFECYCLE_CUSTOMER_LABELS: Record<MonitorLifecycleState, string> = {
  setup_incomplete: "Setup incomplete",
  processing:       "Processing",
  stale_processing: "Taking longer than expected — you can start a new run",
  failed:           "Needs internal review",
  needs_review:     "Needs internal review",
  ready_to_run:     "Ready to run",
  baseline_ready:   "Report ready — baseline",
  comparison_ready: "Report ready — compared",
};

export const LIFECYCLE_BADGE_COLORS: Record<MonitorLifecycleState, { bg: string; color: string }> = {
  setup_incomplete: { bg: "#fee2e2", color: "#dc2626" },
  processing:       { bg: "#e0f2fe", color: "#075985" },
  stale_processing: { bg: "#fef3c7", color: "#92400e" },
  failed:           { bg: "#fef3c7", color: "#92400e" },
  needs_review:     { bg: "#fef3c7", color: "#92400e" },
  ready_to_run:     { bg: "#f1f5f9", color: "#475569" },
  baseline_ready:   { bg: "#e0e7ff", color: "#4338ca" },
  comparison_ready: { bg: "#f0fdf4", color: "#15803d" },
};
