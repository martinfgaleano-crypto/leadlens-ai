#!/usr/bin/env node
/** Controlled secondary proof of the real provider-backed Monitor path.
 * Distinct from the customer journey acceptance: seeds one synthetic historical
 * snapshot for a real public company, triggers the authenticated customer route,
 * records sanitized observability, and cleans every row. */
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { loadEnv, has } from "./lib/load-env.mjs";
import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";

const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!has(env, key)) { console.error(`BLOCKED: ${key} missing`); process.exit(3); }
const { createServerClient } = await import("@/lib/supabase/server");
const { SupabaseAccountMemoryRepo, toRow } = await import("@/lib/deliverable/account-memory-store");
const { POST: monitor } = await import("@/app/api/customer/monitor/route");
const db = createServerClient();
if (!db) process.exit(3);
const stamp = Date.now();
const email = `ll-monitor-live-${stamp}@example.com`, password = `Monitor-${stamp}-Aa!`, clientKey = `controlled_monitor_${stamp}`;
let userId = "", runId = "";
try {
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("auth_create_failed");
  userId = created.data.user.id;
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (!signed.data.session) throw new Error("auth_signin_failed");
  const accountId = "rockwell-automation-controlled";
  const prior: AccountReviewSnapshot = {
    reviewId: `baseline_${stamp}`, reviewedAt: "2026-05-01T00:00:00.000Z", contextVersion: "controlled-v1", accountId,
    accountIdentity: { stableAccountKey: accountId, canonicalName: "Rockwell Automation", domain: "rockwellautomation.com", aliases: [], country: "United States", organizationType: "public_company", confidence: "strong", fromUniverse: true, lineage: "candidate_universe" },
    decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Moderate", changeKeys: [], hasVerifiedChange: false,
    evidenceOrigins: ["rockwellautomation.com"], independentSupport: false, counterCount: 0, hasMaterialCounter: false,
    validationThemeKeys: ["new_material_event"], decisionCriticalThemeKeys: ["new_material_event"], hasRevisitTrigger: false,
  };
  await new SupabaseAccountMemoryRepo(db).persist([toRow(prior, { ownerUserId: userId, clientKey })]);
  const response = await monitor(new NextRequest("http://localhost/api/customer/monitor", {
    method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${signed.data.session.access_token}` },
    body: JSON.stringify({ client_key: clientKey }),
  }));
  const body = await response.json() as { runId?: string; status?: string; observability?: Record<string, number>; error?: string };
  runId = body.runId ?? "";
  const obs = body.observability ?? {};
  console.log(JSON.stringify({
    mode: "CONTROLLED", status: response.status, outcome: body.status ?? body.error,
    account: "Rockwell Automation", query_identity: "canonical name + United States + corporate domain",
    attempted: obs.attempted ?? 0, provider_failures: obs.providerFailuresSeen ?? 0,
    search_results: obs.searchResultsConsidered ?? 0, pages_escalated: obs.pagesEscalated ?? 0,
    pages_fetched: obs.pagesFetched ?? 0, llm_extractions: obs.llmExtractionCalls ?? 0,
    events_accepted: obs.eventsAccepted ?? 0, no_change: obs.completedNoChange ?? 0,
    changed: obs.completedChanged ?? 0, insufficient: obs.insufficient ?? 0,
    duration_ms: obs.durationMs ?? null,
  }, null, 2));
  if (response.status !== 201 || (obs.attempted ?? 0) !== 1 || (obs.searchResultsConsidered ?? 0) < 1) process.exitCode = 2;
} finally {
  if (userId) {
    await db.from("account_review_snapshots").delete().eq("owner_user_id", userId).eq("client_key", clientKey);
    if (runId) await db.from("snapshot_reports").delete().eq("job_id", runId);
    await db.auth.admin.deleteUser(userId).catch(() => undefined);
  }
  console.log("cleanup :: controlled Monitor rows and auth user deleted");
}
