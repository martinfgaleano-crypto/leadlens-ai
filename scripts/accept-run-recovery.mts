#!/usr/bin/env node
/**
 * Disposable REAL dead-executor recovery acceptance (Product Operability V1).
 * Simulates a killed mid-flight executor (a run left in "processing" with no live worker,
 * NOT by mutating status — by claiming the run then never completing it) and proves the
 * server-owned recovery reclaims + re-executes it to completion with no DB surgery.
 *
 * Faithful to production: recovery uses the exact recoverStaleRuns orchestrator with
 * redispatch = executeIntelligenceRun (the same function the cron's re-dispatch reaches),
 * relying on the real execution_generation CAS to fence the dead worker. A test-time
 * INTELLIGENCE_STALE_MS shrinks only the 15-minute stale window — the SAME reclaim logic.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }
process.env.INTERNAL_RUN_SECRET = process.env.INTERNAL_RUN_SECRET || "dev-acceptance-internal-only";
process.env.INTELLIGENCE_STALE_MS = "1500";                  // test-only: 1.5s stale window (same logic)
if (!process.env.INTELLIGENCE_RESEARCH_CONCURRENCY) process.env.INTELLIGENCE_RESEARCH_CONCURRENCY = "2";

const { createServerClient } = await import("@/lib/supabase/server");
const { POST: interpret } = await import("@/app/api/interpret/route");
const { POST: confirm } = await import("@/app/api/customer/contexts/confirm/route");
const { POST: startRun } = await import("@/app/api/customer/intelligence-runs/route");
const { SupabaseConfirmedContextStore } = await import("@/lib/interpretation/confirmed-context-store");
const { SupabaseLeadHunterRunStore } = await import("@/lib/lead-hunter/run-store");
const { SupabaseIntelligenceRunStore } = await import("@/lib/intelligence/productive-spine-store");
const { executeIntelligenceRun } = await import("@/lib/intelligence/productive-spine");
const { recoverStaleRuns } = await import("@/lib/intelligence/run-recovery");

const db = createServerClient();
if (!db) { console.error("BLOCKED"); process.exit(3); }
const stamp = Date.now();
const email = `ll-rec-${stamp}@example.com`, password = `Rc-${stamp}-Aa!`, contextId = `rec_ctx_${stamp}`;
const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };
let userId: string | null = null, token = "";
const req = (u: string, tk: string, b?: unknown) => new NextRequest(`http://localhost${u}`, { method: b === undefined ? "GET" : "POST", headers: { ...(b === undefined ? {} : { "content-type": "application/json" }), Authorization: `Bearer ${tk}` }, ...(b === undefined ? {} : { body: JSON.stringify(b) }) });

const store = new SupabaseIntelligenceRunStore(db);
const prodDeps = {
  contextStore: new SupabaseConfirmedContextStore(db as never),
  leadHunterStore: new SupabaseLeadHunterRunStore(db as never),
  runStore: store,
  discoveryRunner: (await import("@/lib/lead-hunter/discovery-runner")).defaultDiscoveryRunner,
  pipeline: (await import("@/lib/pipeline")).runLeadLensPipeline,
  traceProvenance: "live" as const,
  researchConcurrency: 2,
};
const rowsFor = async () => (await db.from("snapshot_reports").select("job_id,status,execution_generation,report_json").eq("user_id", userId!)).data ?? [];

try {
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  userId = created.data.user!.id;
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  token = (await anon.auth.signInWithPassword({ email, password })).data.session!.access_token;
  await db.from("profiles").upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });

  // Create a real run (no execution — harness has no server, so auto-dispatch is a no-op).
  const ib = await (await interpret(req("/api/interpret", token, { input: "We sell factory automation and packaging equipment to large US food and beverage manufacturers with owned plants that recently expanded or retooled.", locale: "en" }))).json() as { confirmation_token?: string };
  const cb = await (await confirm(req("/api/customer/contexts/confirm", token, { confirmation_token: ib.confirmation_token, context_id: contextId }))).json() as { context?: { version: number } };
  const sb = await (await startRun(req("/api/customer/intelligence-runs", token, { context_id: contextId, version: cb.context!.version, plan: "sample" }))).json() as { run_id?: string };
  const runId = sb.run_id!;
  check("real run created (processing, not executed)", Boolean(runId), runId);

  // Simulate a killed mid-flight executor: claim the run (→ processing/lead_hunter, gen advances)
  // then NEVER complete it. No status mutation; this is exactly what a live-then-dead worker leaves.
  const gen = await store.claim(runId, userId!, ["processing"]);
  check("simulated executor claimed the run then 'died' (no completion)", gen !== null, `gen=${gen}`);
  const stuck = (await rowsFor()).find((r: any) => r.job_id === runId);
  check("run is stranded in processing with no live worker", stuck?.status === "processing");

  await new Promise((r) => setTimeout(r, 2600)); // exceed the 1.5s test stale window

  // Server-owned recovery: exact orchestrator, redispatch = production executeIntelligenceRun.
  const before = await rowsFor();
  const summary = await recoverStaleRuns({
    listRecoverable: async () => before.filter((r: any) => /^intel_[a-f0-9]{32}$/.test(r.job_id)).map((r: any) => ({ runId: r.job_id, userId: userId!, status: r.status, createdAt: r.report_json?._intelligence_run?.createdAt ?? new Date(0).toISOString(), updatedAt: r.report_json?._intelligence_run?.updatedAt ?? null, executionGeneration: r.execution_generation ?? 0 })),
    redispatch: async (id, uid) => { await executeIntelligenceRun(id, uid, prodDeps); },
    failTerminal: async (c) => { const { data } = await db.from("snapshot_reports").update({ status: "failed" }).eq("job_id", c.runId).eq("user_id", c.userId).eq("status", "processing").eq("execution_generation", c.executionGeneration).select("job_id"); return Boolean(data?.length); },
  });
  check("recovery re-dispatched the stale run (1)", summary.redispatched === 1, JSON.stringify(summary));

  const after = await rowsFor();
  const recovered = after.find((r: any) => r.job_id === runId);
  check("PRODUCTIVE run RESUMED and COMPLETED via recovery", recovered?.status === "completed", `status=${recovered?.status}`);
  check("higher generation after reclaim (dead worker fenced)", (recovered?.execution_generation ?? 0) > (gen ?? 0), `gen ${gen}→${recovered?.execution_generation}`);
  check("exactly ONE report row for the run (no duplicate)", after.filter((r: any) => r.job_id === runId).length === 1);
  check("completed report is customer-loadable (has processed_leads)", Array.isArray(recovered?.report_json?.processed_leads));

  // Idempotency: a second recovery wake does nothing (run is completed → not stale/processing).
  const summary2 = await recoverStaleRuns({
    listRecoverable: async () => (await rowsFor()).filter((r: any) => /^intel_/.test(r.job_id)).map((r: any) => ({ runId: r.job_id, userId: userId!, status: r.status, createdAt: r.report_json?._intelligence_run?.createdAt ?? new Date(0).toISOString(), updatedAt: r.report_json?._intelligence_run?.updatedAt ?? null, executionGeneration: r.execution_generation ?? 0 })),
    redispatch: async () => { throw new Error("must not re-run a completed run"); },
    failTerminal: async () => { throw new Error("must not fail a completed run"); },
  });
  check("second recovery wake is a no-op (completed run untouched)", summary2.redispatched === 0 && summary2.failedTerminal === 0 && summary2.errors === 0);
  check("still exactly ONE report row after second wake (exactly-once)", (await rowsFor()).filter((r: any) => r.job_id === runId).length === 1);

  const failures = checks.filter((c) => !c.ok);
  console.log(`\nRUN-RECOVERY :: ${checks.length - failures.length}/${checks.length} checks passed`);
} catch (e) {
  check("harness completed without throw", false, e instanceof Error ? e.message : String(e));
} finally {
  if (userId) {
    await db.from("account_review_snapshots").delete().eq("owner_user_id", userId);
    await db.from("snapshot_reports").delete().eq("user_id", userId);
    await db.from("confirmed_commercial_contexts").delete().eq("user_id", userId);
    await db.from("lead_searches").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);
    await db.auth.admin.deleteUser(userId).catch(() => {});
  }
  console.log("cleanup :: disposable tenant removed");
}
process.exit(checks.some((c) => !c.ok) ? 2 : 0);
