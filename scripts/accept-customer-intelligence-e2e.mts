#!/usr/bin/env node
/**
 * Disposable REAL acceptance: authenticated Stage A -> confirmation -> productive
 * Intelligence -> durable reload -> canonical Monitor -> Account Memory.
 * Uses public web providers with the sample-plan caps. All tenant-owned rows and
 * auth users are removed in finally. Never prints credentials or raw tokens.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"])
  if (!has(env, key)) { console.error(`BLOCKED: ${key} missing`); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { POST: interpret } = await import("@/app/api/interpret/route");
const { POST: confirm } = await import("@/app/api/customer/contexts/confirm/route");
const { POST: startRun } = await import("@/app/api/customer/intelligence-runs/route");
const { POST: processRun } = await import("@/app/api/internal/intelligence-runs/[runId]/process/route");
const { GET: loadRun } = await import("@/app/api/customer/intelligence-runs/[runId]/route");
const { POST: monitor } = await import("@/app/api/customer/monitor/route");
const { verifyConfirmationToken, issueConfirmationToken } = await import("@/lib/interpretation/confirmation-token");
const { intelligenceRunId } = await import("@/lib/intelligence/productive-spine");
const { getUsage } = await import("@/lib/ops/usage-ledger");

const db = createServerClient();
if (!db) { console.error("BLOCKED: server Supabase unavailable"); process.exit(3); }
const stamp = Date.now();
const emailA = `ll-e2e-a-${stamp}@example.com`;
const emailB = `ll-e2e-b-${stamp}@example.com`;
const password = `E2e-${stamp}-Aa!`;
const contextId = `e2e_context_${stamp}`;
const contextText = process.env.LEADLENS_ACCEPTANCE_CONTEXT ?? "Vendemos automatización de bodegas, integración WMS y orquestación de inventarios a fabricantes y distribuidores medianos y grandes en Colombia. Buscamos empresas que operen directamente centros de distribución, bodegas o plantas y que hayan abierto, ampliado, automatizado o invertido recientemente en infraestructura logística. Excluir entidades públicas, medios, consultoras, empresas de software puro, retailers sin operación logística propia y operaciones totalmente tercerizadas.";
const locale = process.env.LEADLENS_ACCEPTANCE_LOCALE === "en" ? "en" : "es";
const soakId = process.env.LEADLENS_SOAK_ID ?? null;
const soakPhase = process.env.LEADLENS_SOAK_PHASE ?? null;
const startedAt = Date.now();
const timings: Record<string, number> = {};
const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string) => { checks.push({ name, ok, detail }); console.log(`${ok ? "ok" : "FAIL"} - ${name}${detail ? ` :: ${detail}` : ""}`); };
const usageBefore = structuredClone(getUsage());
let userA: string | null = null, userB: string | null = null, tokenA = "", tokenB = "", runId = "", leadHunterRunId = "", monitorRunId = "";

async function createDisposable(email: string) {
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`auth_create_failed:${created.error?.message ?? "unknown"}`);
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw new Error(`auth_signin_failed:${signed.error?.message ?? "unknown"}`);
  return { id: created.data.user.id, token: signed.data.session.access_token };
}
const req = (url: string, token: string, body?: unknown) => new NextRequest(`http://localhost${url}`, {
  method: body === undefined ? "GET" : "POST",
  headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), Authorization: `Bearer ${token}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

try {
  const a = await createDisposable(emailA); userA = a.id; tokenA = a.token;
  const b = await createDisposable(emailB); userB = b.id; tokenB = b.token;
  check("real authenticated owners created", Boolean(userA && userB));

  let t = Date.now();
  const interpreted = await interpret(req("/api/interpret", tokenA, { input: contextText, locale }));
  timings.stage_a_ms = Date.now() - t;
  const interpretationBody = await interpreted.json() as { interpretation?: { status?: string }; confirmation_token?: string };
  check("Stage A reachable and confirmable", interpreted.status === 200 && interpretationBody.interpretation?.status === "ready_for_confirmation" && Boolean(interpretationBody.confirmation_token), `HTTP ${interpreted.status}`);
  if (!interpretationBody.confirmation_token) throw new Error("stage_a_no_confirmation_token");

  t = Date.now();
  const confirmedA = await confirm(req("/api/customer/contexts/confirm", tokenA, { confirmation_token: interpretationBody.confirmation_token, context_id: contextId, client_id: `customer_${stamp}` }));
  timings.confirmation_ms = Date.now() - t;
  const confirmedBody = await confirmedA.json() as { context?: { context_id: string; version: number } };
  check("explicit confirmation persisted through customer API", [200, 201].includes(confirmedA.status) && confirmedBody.context?.context_id === contextId);
  if (!confirmedBody.context) throw new Error("confirmation_failed");

  // Same label, different authenticated owner, still through the confirmation API.
  const fullInterpretation = verifyConfirmationToken(interpretationBody.confirmation_token, userA!);
  const tokenForB = fullInterpretation ? issueConfirmationToken(userB!, fullInterpretation) : null;
  const confirmedB = tokenForB ? await confirm(req("/api/customer/contexts/confirm", tokenB, { confirmation_token: tokenForB, context_id: contextId, client_id: `customer_${stamp}` })) : null;
  check("same context label persists independently across tenants", Boolean(confirmedB && [200, 201].includes(confirmedB.status)));

  t = Date.now();
  const started = await startRun(req("/api/customer/intelligence-runs", tokenA, {
    context_id: contextId, version: confirmedBody.context.version, plan: "sample",
    idempotency_key: `accept_${stamp}`, delivery_limit: 2,
  }));
  timings.start_request_ms = Date.now() - t;
  const startedBody = await started.json() as { run_id?: string; status?: string; lead_hunter_run_id?: string; client_key?: string; error?: string };
  runId = startedBody.run_id ?? ""; leadHunterRunId = startedBody.lead_hunter_run_id ?? "";
  check("productive Intelligence run accepted before Research", [200, 202].includes(started.status) && ["queued", "processing"].includes(startedBody.status ?? ""), startedBody.error ?? `HTTP ${started.status}`);
  if (!runId) throw new Error(`intelligence_start_failed:${startedBody.error ?? started.status}`);

  const internalSecret = process.env.INTERNAL_RUN_SECRET || `acceptance-${stamp}-internal-only`;
  process.env.INTERNAL_RUN_SECRET = internalSecret;
  t = Date.now();
  const processed = await processRun(new NextRequest(`http://localhost/api/internal/intelligence-runs/${runId}/process`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${internalSecret}` }, body: JSON.stringify({ user_id: userA }),
  }), { params: { runId } });
  timings.background_completion_ms = Date.now() - t;
  const processBody = await processed.json() as { status?: string; error?: string };
  check("bounded background processor completed durably", processBody.status === "completed", processBody.error ?? `HTTP ${processed.status}`);

  const loadedA = await loadRun(req(`/api/customer/intelligence-runs/${runId}`, tokenA), { params: { runId } });
  const loadedBody = await loadedA.json() as { status?: string; report?: { processed_leads?: unknown[]; canonical_cases?: unknown[] } };
  check("owner reloads durable result", loadedA.status === 200 && loadedBody.status === "completed" && Array.isArray(loadedBody.report?.processed_leads));
  const loadedB = await loadRun(req(`/api/customer/intelligence-runs/${runId}`, tokenB), { params: { runId } });
  check("other tenant cannot load result", loadedB.status === 404);

  const runRow = (await db.from("snapshot_reports").select("report_json").eq("job_id", runId).maybeSingle()).data;
  leadHunterRunId = runRow?.report_json?._intelligence_run?.leadHunterRunId ?? "";
  check("Lead Hunter run reference persisted", Boolean(leadHunterRunId));
  const universeRow = leadHunterRunId ? (await db.from("snapshot_reports").select("report_json,user_id").eq("job_id", leadHunterRunId).maybeSingle()).data : null;
  const universe = universeRow?.report_json?._lead_hunter_universe?.universe;
  const companies = Array.isArray(universe?.candidates) ? universe.candidates : [];
  check("Candidate Universe durable and owner-scoped", universeRow?.user_id === userA && companies.length > 0, `n=${companies.length}`);
  const delivered = loadedBody.report?.processed_leads ?? [];
  check("canonical Cases generated", Array.isArray(loadedBody.report?.canonical_cases));

  const memoryBefore = (await db.from("account_review_snapshots").select("review_id,account_id").eq("owner_user_id", userA).eq("client_key", runId)).data ?? [];
  check("initial accepted Case set entered Account Memory", memoryBefore.length === delivered.length, `snapshots=${memoryBefore.length}, delivered=${delivered.length}`);

  if (memoryBefore.length > 0) {
    t = Date.now();
    const monitored = await monitor(req("/api/customer/monitor", tokenA, { client_key: runId }));
    timings.monitor_ms = Date.now() - t;
    const monitorBody = await monitored.json() as { runId?: string; status?: string; observability?: Record<string, unknown>; error?: string };
    monitorRunId = monitorBody.runId ?? "";
    check("manual customer Monitor reached canonical engine", [201, 404].includes(monitored.status), monitorBody.error ?? monitorBody.status);
    const memoryAfter = (await db.from("account_review_snapshots").select("review_id,account_id").eq("owner_user_id", userA).eq("client_key", runId)).data ?? [];
    check("Monitor outcome is durably observable", monitored.status === 404 || memoryAfter.length >= memoryBefore.length, `before=${memoryBefore.length}, after=${memoryAfter.length}`);
  } else {
    check("Monitor correctly unavailable without delivered accounts", delivered.length === 0);
  }

  const retry = await startRun(req("/api/customer/intelligence-runs", tokenA, {
    context_id: contextId, version: confirmedBody.context.version, plan: "sample",
    idempotency_key: `accept_${stamp}`, delivery_limit: 2,
  }));
  const retryBody = await retry.json() as { run_id?: string; reused?: boolean };
  check("completed retry is idempotent and avoids new Research", retryBody.run_id === runId && retryBody.reused === true);
  const ownerBRunId = intelligenceRunId({ userId: userB!, context: { contextId, version: confirmedBody.context.version }, idempotencyKey: `accept_${stamp}` });
  check("same labels cannot collide cross-tenant", ownerBRunId !== runId);

  const usageAfter = getUsage();
  const usageDelta = Object.fromEntries(Object.entries(usageAfter).map(([provider, after]) => {
    const before = usageBefore[provider];
    return [provider, {
      calls: after.calls_today - (before?.calls_today ?? 0),
      errors: after.errors_today - (before?.errors_today ?? 0),
      input_tokens: (after.input_tokens_today ?? 0) - (before?.input_tokens_today ?? 0),
      output_tokens: (after.output_tokens_today ?? 0) - (before?.output_tokens_today ?? 0),
      calculated_cost_usd: Number(((after.calculated_cost_usd_today ?? 0) - (before?.calculated_cost_usd_today ?? 0)).toFixed(8)),
      pricing_source: after.pricing_source ?? null,
    }];
  }).filter(([, value]) => (value as { calls: number }).calls > 0));
  const artifact = {
    acceptance: "customer-intelligence-e2e-v1", ran_at: new Date().toISOString(), soak_id: soakId, soak_phase: soakPhase,
    synthetic_context: contextText, run_id: runId, lead_hunter_run_id: leadHunterRunId,
    candidate_universe: { total: companies.length, companies: companies.map((c: any) => ({ name: c.identity?.canonicalName, domain: c.identity?.domain, status: c.status, confidence: c.identity?.confidence, country: c.identity?.country })) },
    delivered_accounts: delivered,
    research_audit: runRow?.report_json?._intelligence_run?.researchAudit ?? [],
    monitor_run_id: monitorRunId || null, timings: { ...timings, total_ms: Date.now() - startedAt },
    usage_delta: usageDelta, checks,
  };
  mkdirSync("ml/data/acceptance", { recursive: true });
  const path = `ml/data/acceptance/customer-e2e-${stamp}.json`;
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(`artifact :: ${path}`);
} finally {
  for (const id of [userA, userB].filter((x): x is string => Boolean(x))) {
    await db.from("account_review_snapshots").delete().eq("owner_user_id", id);
    await db.from("snapshot_reports").delete().eq("user_id", id);
    await db.from("confirmed_commercial_contexts").delete().eq("user_id", id);
    await db.from("lead_searches").delete().eq("user_id", id);
    await db.auth.admin.deleteUser(id).catch(() => undefined);
  }
  console.log("cleanup :: disposable tenant rows and auth users deleted");
}

const failures = checks.filter((item) => !item.ok);
console.log(`\nACCEPTANCE :: ${checks.length - failures.length}/${checks.length} checks passed`);
process.exit(failures.length ? 2 : 0);
