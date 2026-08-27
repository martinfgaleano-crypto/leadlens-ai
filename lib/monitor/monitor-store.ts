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
import type { AccountObservation, MonitorReviewPlan } from "./delta-research";
import type { MonitorRun } from "./monitor-cycle";
import type { SearchCandidate, PageFetcher } from "./full-text-extraction";
import type { ExtractDeps } from "./claim-event-extractor";

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
  const searchId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(run.scope.clientKey)
    ? run.scope.clientKey : null;
  const { error } = await db.from("snapshot_reports").insert({
    job_id: run.runId,
    user_id: run.scope.ownerUserId,
    search_id: searchId,
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

export function buildMonitorQuery(plan: MonitorReviewPlan, theme: string): string {
  const i = plan.identity;
  const event = theme.replace(/^(resolve|change):/, "").replace(/_/g, " ");
  const domain = i.domain ? ` "${i.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}"` : "";
  const geography = i.country ? ` ${i.country}` : "";
  return `"${i.canonicalName}"${geography} ${event}${domain}`.replace(/\s+/g, " ").trim();
}

export function resultMatchesIdentity(plan: MonitorReviewPlan, candidate: SearchCandidate): boolean {
  const i = plan.identity;
  let host = candidate.sourceHost.toLowerCase();
  const domain = i.domain?.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase() ?? null;
  if (domain && (host === domain || host.endsWith(`.${domain}`))) return true;
  const hay = `${candidate.title ?? ""} ${candidate.snippet ?? ""}`.toLowerCase();
  const names = [i.canonicalName, ...i.aliases].map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 3);
  return names.some((name) => new RegExp(`(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(hay));
}

/** Shared productive post-search path, exported for controlled integration
 * acceptance. This is the exact path used by `defaultReobserver`. */
export async function processMonitorSearchCandidates(
  plan: MonitorReviewPlan,
  candidates: SearchCandidate[],
  fetchPage: PageFetcher,
  structured: ExtractDeps = {},
): Promise<{ items: AccountObservation["items"]; metrics: NonNullable<AccountObservation["metrics"]> }> {
  const unique = Array.from(new Map(candidates.filter((c) => resultMatchesIdentity(plan, c)).map((c) => [c.sourceUrl, c])).values());
  const { escalateAndExtract } = await import("./full-text-extraction");
  const escalated = await escalateAndExtract(unique, fetchPage, plan.watchSignalFamilies, { structured });
  return {
    items: escalated.items,
    metrics: {
      searchResultsConsidered: unique.length, pagesEscalated: escalated.metrics.fetched, pagesFetched: escalated.metrics.fetched - escalated.metrics.fetchFailures,
      fetchFailures: escalated.metrics.fetchFailures, llmExtractionCalls: escalated.metrics.llmExtractionCalls, claimsProposed: escalated.metrics.claimsProposed,
      eventsProposed: escalated.metrics.eventsProposed, eventsAccepted: escalated.metrics.eventsAccepted,
      temporalRejects: escalated.items.filter((i) => !i.eventDate).length, materialityRejects: escalated.metrics.materialityRejected,
    },
  };
}

export async function defaultReobserver(plan: MonitorReviewPlan): Promise<AccountObservation> {
  if (plan.identityRequiresValidation) {
    return { accountId: plan.accountId, items: [], providersAvailable: [], providersFailed: [], routesAttempted: 0, operatingMode: "stopped", queryIdentities: [], metrics: emptyResearchMetrics() };
  }
  const { braveProvider, tavilyProvider, serperProvider } = await import("@/lib/sources/access/providers");
  const { planRoute } = await import("./provider-routing");
  // Task-aware, health-aware routing: a monitor_delta review prefers recent-event
  // routes and skips unavailable providers up front (no wasted latency).
  const byId = { brave: braveProvider, tavily: tavilyProvider, serper: serperProvider };
  const health = Object.fromEntries(await Promise.all(
    (Object.keys(byId) as Array<keyof typeof byId>).map(async (id) => {
      const h = await byId[id].health().catch(() => null);
      return [id, h?.status === "available" ? "available" : "unavailable"] as const;
    }),
  )) as Record<string, "available" | "unavailable">;
  const route = planRoute({ task: "monitor_delta", accountKnown: true, temporal: true, needsFullText: false }, health);
  const orderedIds = [...route.primary, ...route.fallback].map((s) => s.provider).filter((id): id is keyof typeof byId => id in byId);
  const providers = (orderedIds.length ? orderedIds : (["brave", "tavily"] as Array<keyof typeof byId>)).map((id) => byId[id]);
  const available: string[] = [];
  const failed: string[] = [];
  const candidates: SearchCandidate[] = [];
  const queryIdentities: string[] = [];
  const themes = plan.routeThemes.slice(0, 3); // bounded
  let routesAttempted = 0;

  for (const theme of themes) {
    routesAttempted++;
    const query = buildMonitorQuery(plan, theme);
    queryIdentities.push(query);
    for (const p of providers) {
      try {
        const res = await p.search({ query, max_results: 5, freshness_days: 90, query_type: "company_specific" });
        if (res.ok) {
          if (!available.includes(p.id)) available.push(p.id);
          for (const r of res.results) {
            let host = "";
            try { host = new URL(r.url).host.replace(/^www\./, "").toLowerCase(); } catch { host = ""; }
            if (!host) continue;
            const candidate: SearchCandidate = {
              accountId: plan.identity.canonicalName, sourceHost: host, sourceUrl: r.url,
              title: r.title ?? null, snippet: r.snippet ?? null,
              publishedDate: r.published_date ?? null, retrievedAt: r.retrieved_at,
            };
            candidates.push(candidate);
          }
        } else if (!failed.includes(p.id)) failed.push(p.id);
      } catch { if (!failed.includes(p.id)) failed.push(p.id); }
    }
  }
  const { extractWithFallback } = await import("@/lib/sources/access/extractors");
  const processed = await processMonitorSearchCandidates(plan, candidates, async (url) => {
    const r = await extractWithFallback(url);
    return { ok: r.ok, content: r.ok ? r.content : null };
  });
  const operatingMode: AccountObservation["operatingMode"] = available.length === 0 ? "stopped" : (failed.length ? "degraded" : "full");
  return {
    accountId: plan.accountId, items: processed.items, providersAvailable: available, providersFailed: failed, routesAttempted, operatingMode, queryIdentities,
    metrics: processed.metrics,
  };
}

function emptyResearchMetrics(): NonNullable<AccountObservation["metrics"]> {
  return { searchResultsConsidered: 0, pagesEscalated: 0, pagesFetched: 0, fetchFailures: 0, llmExtractionCalls: 0, claimsProposed: 0, eventsProposed: 0, eventsAccepted: 0, temporalRejects: 0, materialityRejects: 0 };
}
