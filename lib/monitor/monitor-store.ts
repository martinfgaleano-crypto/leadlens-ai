// ─── Monitor persistence + default re-observer ────────────────────────────────
//
// - loadCurrentSnapshots: the latest ACCEPTED snapshot per account for an owner+
//   client, from account_review_snapshots (owner-scoped).
// - persistMonitorRun: run summary on the existing snapshot_reports (no new table).
// - defaultReobserver: bounded, real, CONSERVATIVE re-observation reusing existing
//   providers. Without a dedicated event-date/materiality extractor (P2), it does
//   NOT assert event dates — so items are conservatively contextual/temporal-
//   rejected rather than fabricated as new What Changed. Graceful degradation.

import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";
import type { SnapshotScope } from "@/lib/deliverable/account-memory-store";
import type { MonitoredAccountState } from "./monitor-eligibility";
import { monitoredStateFromSnapshot } from "./monitor-eligibility";
import type { AccountObservation, MonitorReviewPlan, ObservedItem } from "./delta-research";
import type { MonitorRun } from "./monitor-cycle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Latest accepted snapshot per account for owner+client → monitored states + priors. */
export async function loadCurrentSnapshots(db: Db, scope: SnapshotScope): Promise<{ states: MonitoredAccountState[]; priorById: Record<string, AccountReviewSnapshot> }> {
  const q = db.from("account_review_snapshots").select("account_id,reviewed_at,snapshot").eq("client_key", scope.clientKey).order("reviewed_at", { ascending: false });
  const scoped = scope.ownerUserId ? q.eq("owner_user_id", scope.ownerUserId) : q.is("owner_user_id", null);
  const { data, error } = await scoped;
  if (error || !data) return { states: [], priorById: {} };
  const priorById: Record<string, AccountReviewSnapshot> = {};
  for (const row of data as Array<{ account_id: string; snapshot: AccountReviewSnapshot }>) {
    if (!priorById[row.account_id]) priorById[row.account_id] = row.snapshot; // first = latest (desc)
  }
  const states = Object.values(priorById).map((s) => monitoredStateFromSnapshot(s, scope));
  return { states, priorById };
}

/** Persist a run summary (observability) on snapshot_reports. Immutable by
 *  convention: keyed by runId; accepted account snapshots live in account_review_snapshots. */
export async function persistMonitorRun(db: Db, run: MonitorRun): Promise<{ created: boolean }> {
  const { error } = await db.from("snapshot_reports").insert({
    job_id: run.runId,
    user_id: run.scope.ownerUserId,
    plan: "monitor_run",
    status: run.status === "completed" ? "completed" : "failed",
    report_json: {
      _status: run.status, job_id: run.runId, kind: "monitor_run",
      _monitor_run: { scope: run.scope, startedAt: run.startedAt, completedAt: run.completedAt, observability: run.observability, alerts: run.alerts },
    },
  });
  if (error) {
    if (error.code === "23505" || /duplicate key|already exists/i.test(error.message)) return { created: false };
    throw new Error(`persist monitor run failed: ${error.message}`);
  }
  return { created: true };
}

// ─── Default re-observer (bounded, conservative, graceful) ────────────────────

export async function defaultReobserver(plan: MonitorReviewPlan): Promise<AccountObservation> {
  const { braveProvider, tavilyProvider } = await import("@/lib/sources/access/providers");
  const providers = [braveProvider, tavilyProvider];
  const available: string[] = [];
  const failed: string[] = [];
  const items: ObservedItem[] = [];
  const themes = plan.routeThemes.slice(0, 3); // bounded
  let routesAttempted = 0;

  for (const theme of themes) {
    routesAttempted++;
    const query = `${plan.accountId} ${theme.replace(/^(resolve|change):/, "").replace(/_/g, " ")}`.trim();
    for (const p of providers) {
      try {
        const res = await p.search({ query, max_results: 5, freshness_days: 90, query_type: "company_specific" });
        if (res.ok) {
          if (!available.includes(p.id)) available.push(p.id);
          for (const r of res.results) {
            let host = "";
            try { host = new URL(r.url).host.replace(/^www\./, "").toLowerCase(); } catch { host = ""; }
            if (!host) continue;
            items.push({
              sourceHost: host, sourceUrl: r.url, originId: null, kind: plan.watchSignalFamilies[0] ?? "signal",
              // CONSERVATIVE: no dedicated event-date extractor in V1 → we do NOT
              // assert an event date. publication_date is recorded but never used as
              // the event date. Such items become contextual/temporal-rejected, never
              // fabricated What Changed.
              eventDate: null, publicationDate: r.published_date ?? null, retrievedAt: r.retrieved_at,
              isDatedMaterialEvent: false, relevantToCase: true,
            });
          }
        } else if (!failed.includes(p.id)) failed.push(p.id);
      } catch { if (!failed.includes(p.id)) failed.push(p.id); }
    }
  }
  const operatingMode: AccountObservation["operatingMode"] = available.length === 0 ? "stopped" : (failed.length ? "degraded" : "full");
  return { accountId: plan.accountId, items, providersAvailable: available, providersFailed: failed, routesAttempted, operatingMode };
}
