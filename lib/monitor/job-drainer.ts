// ─── Monitor Job Drainer v0 ───────────────────────────────────────────────────
// Finds recoverable monitor jobs and re-triggers them safely. This is the
// self-healing layer for lost fire-and-forget triggers and dead workers.
// See docs/strategy/SELF_HEALING_MONITOR_INFRASTRUCTURE.md.
//
// Rules (bounded, idempotent-leaning):
//   - Only `processing` jobs WITH search_id are considered. Never legacy/unscoped.
//   - Only STALE jobs (past PROCESSING_STALE_MS) are re-triggered — a fresh job
//     may genuinely be running; re-triggering it would race two pipelines.
//   - Per series: newest stale job wins; older stale jobs are marked failed
//     ("superseded") so they stop being candidates. Auditable, never deleted.
//   - Series with a FRESH in-flight job: stale leftovers are superseded,
//     nothing is re-triggered.
//   - Jobs older than MAX_RECOVERY_AGE_MS are abandoned (marked failed) —
//     bounds retries for jobs that die on every attempt.
//   - Batch-limited per invocation.

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  failSnapshot,
  isProcessingFresh,
} from "@/lib/storage/snapshot-store";
import { triggerProcessor } from "@/lib/monitor/run-jobs";

/** Jobs stuck in processing longer than this are abandoned, not re-triggered. */
export const MAX_RECOVERY_AGE_MS = 6 * 60 * 60 * 1000;

export const DRAIN_DEFAULT_LIMIT = 10;
export const DRAIN_MAX_LIMIT = 25;

export interface DrainSummary {
  scanned: number;
  retriggered: number;
  superseded: number;
  abandoned: number;
  skipped_fresh: number;
  dry_run: boolean;
  errors: string[];
  /** job_ids per action — ids only, no customer data */
  actions: { job_id: string; search_id: string; action: "retrigger" | "supersede" | "abandon" | "skip_fresh" }[];
}

interface ProcessingRow {
  job_id: string;
  search_id: string;
  plan: string;
  status: string;
  created_at: string;
}

export async function drainMonitorJobs(
  db: any,
  options: { limit?: number; dryRun?: boolean } = {},
): Promise<DrainSummary> {
  const limit = Math.min(Math.max(options.limit ?? DRAIN_DEFAULT_LIMIT, 1), DRAIN_MAX_LIMIT);
  const dryRun = options.dryRun === true;

  const summary: DrainSummary = {
    scanned: 0, retriggered: 0, superseded: 0, abandoned: 0, skipped_fresh: 0,
    dry_run: dryRun, errors: [], actions: [],
  };

  // Oldest first so long-stuck jobs are handled before the batch limit cuts off.
  // search_id NOT NULL is enforced in the query — unscoped rows never enter.
  const { data, error } = await db
    .from("snapshot_reports")
    .select("job_id, search_id, plan, status, created_at")
    .eq("status", "processing")
    .not("search_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    summary.errors.push(`query: ${error.message}`);
    return summary;
  }

  const rows = ((data ?? []) as ProcessingRow[]).filter(r => !!r.search_id);
  summary.scanned = rows.length;
  if (rows.length === 0) return summary;

  // Group by series. Within a series decide: fresh in flight? newest stale?
  const bySeries = new Map<string, ProcessingRow[]>();
  for (const row of rows) {
    const list = bySeries.get(row.search_id) ?? [];
    list.push(row);
    bySeries.set(row.search_id, list);
  }

  const now = Date.now();

  for (const searchId of Array.from(bySeries.keys())) {
    const seriesRows: ProcessingRow[] = bySeries.get(searchId) ?? [];
    const fresh = seriesRows.filter(r => isProcessingFresh(r.created_at));
    const stale = seriesRows.filter(r => !isProcessingFresh(r.created_at));
    // newest stale last (rows are oldest-first)
    const newestStale = stale[stale.length - 1] ?? null;

    for (const row of fresh) {
      // May genuinely be running — never touched.
      summary.skipped_fresh++;
      summary.actions.push({ job_id: row.job_id, search_id: searchId, action: "skip_fresh" });
    }

    for (const row of stale) {
      const age = now - new Date(row.created_at).getTime();

      if (age > MAX_RECOVERY_AGE_MS) {
        summary.abandoned++;
        summary.actions.push({ job_id: row.job_id, search_id: searchId, action: "abandon" });
        if (!dryRun) {
          console.log(`[drainer] abandon job=${row.job_id} search=${searchId} age_ms=${age}`);
          await failSnapshot(row.job_id, row.plan, "Abandoned — exceeded recovery window", searchId)
            .catch((e: unknown) => summary.errors.push(`abandon ${row.job_id}: ${e instanceof Error ? e.message : "error"}`));
        }
        continue;
      }

      const isNewestStale = newestStale !== null && row.job_id === newestStale.job_id;
      const seriesHasFresh = fresh.length > 0;

      if (!isNewestStale || seriesHasFresh) {
        // Older duplicate, or a newer fresh run owns the series.
        summary.superseded++;
        summary.actions.push({ job_id: row.job_id, search_id: searchId, action: "supersede" });
        if (!dryRun) {
          console.log(`[drainer] supersede job=${row.job_id} search=${searchId}`);
          await failSnapshot(row.job_id, row.plan, "Superseded by a newer run (auto-recovery)", searchId)
            .catch((e: unknown) => summary.errors.push(`supersede ${row.job_id}: ${e instanceof Error ? e.message : "error"}`));
        }
        continue;
      }

      // Newest stale job in a series with no fresh run → re-trigger.
      summary.retriggered++;
      summary.actions.push({ job_id: row.job_id, search_id: searchId, action: "retrigger" });
      if (!dryRun) {
        console.log(`[drainer] retrigger job=${row.job_id} search=${searchId} age_ms=${age}`);
        triggerProcessor(row.job_id);
      }
    }
  }

  return summary;
}
