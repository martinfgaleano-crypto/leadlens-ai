#!/usr/bin/env node
// Disposable live Supabase acceptance for canonical Monitor persistence.
// Uses reserved example identity + controlled no-change observation; no customer
// history or provider call. All namespaced rows are removed in finally.
import { loadEnv, has } from "./lib/load-env.mjs";
import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";

const env = loadEnv();
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (env[k]) process.env[k] = env[k];
if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "SUPABASE_SERVICE_ROLE_KEY")) { console.log("SUPABASE_NOT_CONFIGURED"); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { SupabaseAccountMemoryRepo, toRow } = await import("@/lib/deliverable/account-memory-store");
const { monitoredStateFromSnapshot } = await import("@/lib/monitor/monitor-eligibility");
const { planMonitorReview } = await import("@/lib/monitor/delta-research");
const { buildMonitorQuery, persistMonitorRun } = await import("@/lib/monitor/monitor-store");
const { runCanonicalMonitor } = await import("@/lib/monitor/canonical-monitor-service");

const db = createServerClient();
if (!db) { console.log("NO_DB"); process.exit(3); }
const stamp = Date.now();
const scope = { ownerUserId: null, clientKey: `monitor_accept_${stamp}` };
const accountId = `acct_accept_${stamp}`;
const prior: AccountReviewSnapshot = {
  reviewId: `baseline_${stamp}`, reviewedAt: "2026-07-01T00:00:00.000Z", contextVersion: "ctx-accept-v1", accountId,
  accountIdentity: { stableAccountKey: accountId, canonicalName: "Acme Monitor Acceptance", domain: "acme.example", aliases: ["Acme Acceptance"], country: "United States", organizationType: "private_company", confidence: "verified", fromUniverse: true, lineage: "candidate_universe" },
  decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Moderate", changeKeys: [], hasVerifiedChange: false,
  evidenceOrigins: ["acme.example"], independentSupport: false, counterCount: 0, hasMaterialCounter: false,
  validationThemeKeys: [], decisionCriticalThemeKeys: [], hasRevisitTrigger: false,
};
let runId = "";
let failures = 0;
const check = (name: string, ok: boolean) => { if (!ok) failures++; console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

try {
  const repo = new SupabaseAccountMemoryRepo(db);
  await repo.persist([toRow(prior, scope)]);
  const state = monitoredStateFromSnapshot(prior, scope);
  const plan = planMonitorReview(state, prior);
  const query = buildMonitorQuery(plan, "case_freshness");
  check("identity query uses canonical name", query.includes("Acme Monitor Acceptance"));
  check("identity query does not use opaque slug", !query.includes(accountId));

  const run = await runCanonicalMonitor({ scope, states: [state], priorById: { [accountId]: prior } }, { cycleKey: `accept-${stamp}`, origin: "customer" }, {
    reobserve: async () => ({ accountId, items: [], providersAvailable: ["controlled-fixture"], providersFailed: [], routesAttempted: 2, operatingMode: "full", queryIdentities: [query] }),
    memoryRepo: repo,
    persistRun: (r) => persistMonitorRun(db, r),
    now: () => new Date("2026-08-26T12:00:00.000Z"),
  });
  runId = run.runId;
  check("canonical Monitor completes without fabricating change", run.status === "completed" && run.observability.completedNoChange === 1 && run.observability.completedChanged === 0);
  check("accepted Review2 persisted", (await db.from("account_review_snapshots").select("review_id").eq("client_key", scope.clientKey)).data?.length === 2);
  check("durable run summary persisted", Boolean((await db.from("snapshot_reports").select("job_id").eq("job_id", runId).maybeSingle()).data));
} finally {
  await db.from("account_review_snapshots").delete().eq("client_key", scope.clientKey);
  if (runId) await db.from("snapshot_reports").delete().eq("job_id", runId);
  console.log("cleanup :: disposable Monitor rows deleted");
}

console.log(failures ? `\n${failures} acceptance check(s) failed.` : "\nACCEPTANCE :: canonical Monitor persistence path is live and clean.");
process.exit(failures ? 2 : 0);
