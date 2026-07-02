// ─── Monitor readiness (Beta Readiness Status v0) ─────────────────────────────
// Derives a single readiness status for a monitor series from existing
// run/search state. No schema, no persistence — pure derivation.
//
// Status priority (first match wins):
//   missing_onboarding_link → rerun impossible; setup must be fixed first
//   no_runs                 → nothing produced yet
//   processing              → a run is in flight
//   failed                  → most recent run failed and nothing newer completed
//   needs_review            → latest completed run has QA flags
//   ready                   → latest completed run is clean

export type MonitorReadiness =
  | "missing_onboarding_link"
  | "no_runs"
  | "processing"
  | "failed"
  | "needs_review"
  | "ready";

export interface ReadinessInput {
  /** false when onboarding_requests.search_id linkage is missing; null = unknown */
  hasOnboardingLink: boolean | null;
  totalRuns: number;
  hasProcessingRun: boolean;
  /** status of the newest run in the series (any status) */
  latestRunStatus: "processing" | "completed" | "failed" | null;
  /** true when the latest COMPLETED run carries QA flags */
  latestCompletedNeedsReview: boolean;
  /** true when at least one completed run exists */
  hasCompletedRun: boolean;
}

export function deriveMonitorReadiness(input: ReadinessInput): MonitorReadiness {
  if (input.hasOnboardingLink === false) return "missing_onboarding_link";
  if (input.totalRuns === 0) return "no_runs";
  if (input.hasProcessingRun) return "processing";
  if (input.latestRunStatus === "failed" && !input.hasCompletedRun) return "failed";
  if (input.latestRunStatus === "failed") return "needs_review"; // newer run failed after a completed one
  if (input.latestCompletedNeedsReview) return "needs_review";
  return "ready";
}

// Admin-facing labels — technical detail is fine, keep readable.
export const READINESS_ADMIN_LABELS: Record<MonitorReadiness, string> = {
  missing_onboarding_link: "SETUP INCOMPLETE — no onboarding linkage",
  no_runs:                 "NO RUNS YET",
  processing:              "PROCESSING",
  failed:                  "FAILED",
  needs_review:            "REVIEW RECOMMENDED",
  ready:                   "READY TO REVIEW",
};

// Customer-safe copy — never exposes internal QA language beyond
// "needs internal review".
export const READINESS_CUSTOMER_LABELS: Record<MonitorReadiness, string> = {
  missing_onboarding_link: "Setup incomplete",
  no_runs:                 "No reports yet",
  processing:              "Processing",
  failed:                  "Needs internal review",
  needs_review:            "Needs internal review",
  ready:                   "Report ready",
};
