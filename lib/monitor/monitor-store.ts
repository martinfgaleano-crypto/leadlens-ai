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
import { extractEvent, type EventCandidate } from "./event-extraction";

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

export interface TenantWork {
  scope: SnapshotScope;
  states: MonitoredAccountState[];
  priorById: Record<string, AccountReviewSnapshot>;
}

/** Cross-tenant due-work loader for the scheduler. Reads recent accepted snapshots,
 *  reduces to the LATEST per (owner, client, account), and groups by tenant. Bounded
 *  by `limit`. Owner/client/context isolation is preserved: each tenant carries only
 *  its own scope. Eligibility (what is actually DUE) is decided downstream. */
export async function loadDueMonitoredWork(db: Db, limit = 2000): Promise<TenantWork[]> {
  const { data, error } = await db.from("account_review_snapshots")
    .select("owner_user_id,client_key,account_id,reviewed_at,snapshot")
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const latest = new Map<string, { owner: string | null; client: string; snapshot: AccountReviewSnapshot }>();
  for (const row of data as Array<{ owner_user_id: string | null; client_key: string; account_id: string; snapshot: AccountReviewSnapshot }>) {
    const key = `${row.owner_user_id ?? ""}|${row.client_key}|${row.account_id}`;
    if (!latest.has(key)) latest.set(key, { owner: row.owner_user_id ?? null, client: row.client_key, snapshot: row.snapshot });
  }
  const tenants = new Map<string, TenantWork>();
  latest.forEach(({ owner, client, snapshot }) => {
    const tkey = `${owner ?? ""}|${client}`;
    const scope: SnapshotScope = { ownerUserId: owner, clientKey: client };
    const tw = tenants.get(tkey) ?? { scope, states: [], priorById: {} };
    tw.states.push(monitoredStateFromSnapshot(snapshot, scope));
    tw.priorById[snapshot.accountId] = snapshot;
    tenants.set(tkey, tw);
  });
  return Array.from(tenants.values());
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

// ─── Default re-observer (bounded, graceful) ──────────────────────────────────

/** Best-effort event-date PHRASE from text (ISO / "Month YYYY" / "QN YYYY").
 *  Never the publication or retrieval date — extractEvent validates it. */
function scrapeDatePhrase(text: string): string | null {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];
  const my = text.match(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}\b/i);
  if (my) return my[0];
  const q = text.match(/\bq[1-4]\s*\d{4}\b/i);
  if (q) return q[0];
  return null;
}

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
            const titleAndContent = `${r.title ?? ""}. ${r.snippet ?? ""}`.trim();
            // Best-effort event-date phrase from the title/snippet (a full-text LLM
            // event extractor is the P2 deepening). Deterministic gates in
            // extractEvent decide materiality/kind and validate the date — an item
            // with no defensible event date never becomes a fabricated What Changed.
            const candidate: EventCandidate = {
              accountId: plan.accountId, sourceHost: host, sourceUrl: r.url, originId: null,
              titleAndContent, eventDateRaw: scrapeDatePhrase(titleAndContent), publicationDate: r.published_date ?? null,
              retrievedAt: r.retrieved_at,
            };
            items.push(extractEvent(candidate, plan.watchSignalFamilies).item);
          }
        } else if (!failed.includes(p.id)) failed.push(p.id);
      } catch { if (!failed.includes(p.id)) failed.push(p.id); }
    }
  }
  const operatingMode: AccountObservation["operatingMode"] = available.length === 0 ? "stopped" : (failed.length ? "degraded" : "full");
  return { accountId: plan.accountId, items, providersAvailable: available, providersFailed: failed, routesAttempted, operatingMode };
}
