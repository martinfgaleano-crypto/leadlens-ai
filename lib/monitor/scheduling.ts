// ─── Monitor Scheduling Foundation v0 (INERT) ─────────────────────────────────
// Types and design contract for future monthly automation. NOTHING here runs:
// there is no runner, no cron creating monitor jobs, and SCHEDULING_ENABLED is
// hard-false. This file exists so the future runner has one obvious contract
// to implement instead of inventing a parallel path without guards.
//
// Schema note: lead_searches has NO cadence/next_run_at columns yet — adding
// them is deferred until a runner exists (nullable, default-inactive migration
// documented below). No migration ships in this sprint.

/** Hard kill-switch. The future runner MUST return immediately while false. */
export const SCHEDULING_ENABLED = false as const;

export type MonitorCadence = "manual" | "monthly";

/** Shape of the future schedule metadata (today: derived defaults only). */
export interface MonitorSchedule {
  search_id: string;
  cadence: MonitorCadence;      // default "manual" — never auto-activated
  schedule_enabled: boolean;    // default false
  next_run_at: string | null;   // null until a runner computes it
  timezone: string | null;      // customer TZ for "monthly on day N" semantics
}

/** Today every monitor is manual. The future runner replaces this lookup with
 *  real schema columns; defaults MUST stay inactive. */
export function getMonitorSchedule(searchId: string): MonitorSchedule {
  return {
    search_id: searchId,
    cadence: "manual",
    schedule_enabled: false,
    next_run_at: null,
    timezone: null,
  };
}

// Honest customer copy — never promise automation before the runner exists.
export const SCHEDULING_CUSTOMER_COPY = {
  cadence_line: "Monthly cadence is manual for now — automatic scheduling is not enabled yet.",
  manual_enabled: "Manual runs enabled",
  automation_status: "Monthly automation not enabled yet",
} as const;

/*
 * Future runner contract (design — see SELF_HEALING_MONITOR_INFRASTRUCTURE.md):
 *
 * 1. Gate on SCHEDULING_ENABLED (env-driven once real).
 * 2. SELECT lead_searches WHERE schedule_enabled AND next_run_at <= now()
 *    LIMIT small batch (bounded, oldest first).
 * 3. Per search, in order:
 *      a. onboarding_requests linkage exists?        else skip + log
 *      b. getEntitlements(user).can_run_monitor?     else skip + log (no error to customer)
 *      c. createMonitorRunJob (same dedup/staleness guards as manual runs)
 *      d. triggerProcessor(job_id)
 *      e. UPDATE next_run_at = +1 month REGARDLESS of job outcome
 *         (prevents infinite retries; failed runs surface via ops center)
 * 4. The drainer remains the safety net for lost triggers.
 *
 * Future migration (when the runner ships — defaults inactive):
 *   ALTER TABLE lead_searches
 *     ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'manual',
 *     ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT false,
 *     ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ,
 *     ADD COLUMN IF NOT EXISTS schedule_timezone TEXT;
 */
