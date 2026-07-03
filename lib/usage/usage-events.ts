// ─── Usage Events v0 (soft tracking — NO deduction) ──────────────────────────
// Single future integration point for credit deduction in the async run
// architecture. Today this is a no-op logger: no credits move, no billing is
// faked. When billing ships, ONLY this file changes.
//
// Decided rules (see ASYNC_RUN_EXECUTION.md / DECISION_LOG):
//   - Deduct on SUCCESSFUL COMPLETION (completeSnapshot), never on job
//     creation — dead/killed runs must not charge.
//   - job_id is the idempotency key: one deduction per job_id, ever. Retrying
//     a stale job re-completes the SAME job_id → no double charge. A retry of
//     a FAILED job creates a NEW job_id → charges only if it completes.
//   - Failed runs never charge.
//   - initiated_by distinguishes customer/admin/scheduler runs; admin-initiated
//     recovery runs default to NOT charging the customer (founder decision to
//     revisit at billing time).
//   - The future scheduler checks entitlement BEFORE job creation (see
//     lib/monitor/scheduling.ts) — deduction still happens at completion.
//
// Future implementation: INSERT INTO credit_transactions
//   (user_id, type='consume', amount=-N, search_id, description=job_id)
// guarded by a job_id-unique check so replays are no-ops.

export type UsageInitiator = "customer" | "admin" | "scheduler";

export interface MonitorRunUsageEvent {
  job_id: string;
  search_id: string;
  plan: string;
  initiated_by: UsageInitiator;
  outcome: "completed" | "failed";
}

/** Soft tracking only — logs the billable event shape; deducts nothing. */
export function recordMonitorRunUsage(event: MonitorRunUsageEvent): void {
  // ids/status only — never report content or personal data
  console.log(
    `[usage-event] job=${event.job_id} search=${event.search_id} plan=${event.plan} by=${event.initiated_by} outcome=${event.outcome} (soft tracking — no deduction)`,
  );
}
