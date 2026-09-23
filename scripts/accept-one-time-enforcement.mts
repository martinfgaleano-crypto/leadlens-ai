#!/usr/bin/env node
/**
 * One-Time Credit Enforcement V1 — LIVE paid-equivalent Preview acceptance (Model B).
 * A disposable customer is granted EXACTLY a Preview one-time entitlement (2 credits) through the
 * canonical grant primitive, then runs the REAL Intelligence pipeline. Proves: exactly two credits
 * consumed (one per materialized company), remaining balance 0, no unauthorized third run, tenant
 * isolation, and recovery/reopen never double-charge. No real payment, no Lemon webhook, no real
 * customer balances. All disposable rows + auth users are removed in finally.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"])
  if (!has(env, key)) { console.error(`BLOCKED: ${key} missing`); process.exit(3); }

const { createClient } = await import("@supabase/supabase-js");
const { createServerClient } = await import("@/lib/supabase/server");
const { POST: interpret } = await import("@/app/api/interpret/route");
const { POST: confirm } = await import("@/app/api/customer/contexts/confirm/route");
const { POST: startRun } = await import("@/app/api/customer/intelligence-runs/route");
const { POST: processRun } = await import("@/app/api/internal/intelligence-runs/[runId]/process/route");
const { GET: loadRun } = await import("@/app/api/customer/intelligence-runs/[runId]/route");
const { addCredits } = await import("@/lib/credits/add-credits");
const { getUsage } = await import("@/lib/ops/usage-ledger");

const db = createServerClient();
if (!db) { console.error("BLOCKED: server Supabase unavailable"); process.exit(3); }
const stamp = Date.now();
const emailA = `ll-otc-a-${stamp}@example.com`;
const emailB = `ll-otc-b-${stamp}@example.com`;
const password = `Otc-${stamp}-Aa!`;
const contextId = `otc_context_${stamp}`;
const contextText = process.env.LEADLENS_ACCEPTANCE_CONTEXT ?? "Vendemos automatización de bodegas, integración WMS y orquestación de inventarios a fabricantes y distribuidores medianos y grandes en Colombia. Buscamos empresas que operen directamente centros de distribución, bodegas o plantas y que hayan abierto, ampliado, automatizado o invertido recientemente en infraestructura logística. Excluir entidades públicas, medios, consultoras, empresas de software puro, retailers sin operación logística propia y operaciones totalmente tercerizadas.";
const locale = process.env.LEADLENS_ACCEPTANCE_LOCALE ?? "es";
const PREVIEW_CREDITS = 2;

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string) => { checks.push({ name, ok, detail }); console.log(`${ok ? "ok" : "FAIL"} - ${name}${detail ? ` :: ${detail}` : ""}`); };
const usageBefore = structuredClone(getUsage());
const ledger: Record<string, unknown> = {};
let userA: string | null = null, userB: string | null = null, tokenA = "", tokenB = "", runId = "";

const balanceOf = async (uid: string) => {
  const { data } = await db.from("customer_credits").select("credit_balance").eq("user_id", uid).maybeSingle();
  return data?.credit_balance != null ? Number(data.credit_balance) : 0;
};
const chargesOf = async (uid: string) => (await db.from("account_intelligence_charges").select("account_key,analysis_key,run_id").eq("user_id", uid)).data ?? [];

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
  check("disposable purchaser + second tenant created", Boolean(userA && userB));

  // A disposable admin.createUser makes only the auth.users row; the profiles row (which the real
  // signup flow creates, and which customer_credits FK-references) must exist before a grant. Model
  // the purchaser: profiles.plan = "sample" so the customer resolves as one_time (gate enforces
  // exhaustion). The second tenant is a plain free profile.
  const profA = await db.from("profiles").insert({ id: userA!, email: emailA, plan: "sample" }).select("id,plan");
  await db.from("profiles").insert({ id: userB!, email: emailB, plan: "free" }).then(() => {}, () => {});
  check("purchaser profile established (plan=sample)", !profA.error && profA.data?.[0]?.plan === "sample", profA.error?.message);

  // The profiles INSERT fires the legacy migration-010 trigger that grants 100 "welcome credits".
  // That legacy pool commingles with purchase credits in customer_credits (a PRODUCTION blocker to
  // Model B, documented separately). To prove the ENFORCEMENT MECHANISM against a clean purchase-only
  // ledger, reset the disposable balance to exactly the Preview entitlement, then grant via the
  // canonical primitive so the grant path is still exercised. No real customer balances touched.
  ledger.welcome_credits_seen = await balanceOf(userA!);
  await db.from("customer_credits").update({ credit_balance: 0, lifetime_credits: 0 }).eq("user_id", userA!);
  ledger.before_grant = await balanceOf(userA!);
  await addCredits(db, userA!, PREVIEW_CREDITS, `acceptance one-time preview grant ${stamp}`, "grant");
  ledger.after_grant = await balanceOf(userA!);
  check("legacy welcome-credit pool observed (production blocker)", ledger.welcome_credits_seen === 100, `welcome=${ledger.welcome_credits_seen}`);
  check("Preview grant = exactly 2 one-time credits (clean ledger)", ledger.before_grant === 0 && ledger.after_grant === PREVIEW_CREDITS, `balance=${ledger.after_grant}`);

  // ── Interpret → confirm → start (plan sample = Preview) ──
  const interpreted = await interpret(req("/api/interpret", tokenA, { input: contextText, locale }));
  const iBody = await interpreted.json() as { interpretation?: { status?: string }; confirmation_token?: string };
  check("Stage A confirmable", interpreted.status === 200 && Boolean(iBody.confirmation_token));
  if (!iBody.confirmation_token) throw new Error("stage_a_no_token");
  const confirmed = await confirm(req("/api/customer/contexts/confirm", tokenA, { confirmation_token: iBody.confirmation_token, context_id: contextId, client_id: `otc_${stamp}` }));
  const cBody = await confirmed.json() as { context?: { context_id: string; version: number } };
  check("context confirmed", [200, 201].includes(confirmed.status) && Boolean(cBody.context));
  if (!cBody.context) throw new Error("confirm_failed");

  ledger.before_run = await balanceOf(userA!);
  const started = await startRun(req("/api/customer/intelligence-runs", tokenA, {
    context_id: contextId, version: cBody.context.version, plan: "sample", idempotency_key: `otc_${stamp}`, delivery_limit: PREVIEW_CREDITS,
  }));
  const sBody = await started.json() as { run_id?: string; status?: string; error?: string };
  runId = sBody.run_id ?? "";
  check("Preview run accepted (balance intact at start — charge is at materialization)", [200, 202].includes(started.status) && Boolean(runId) && ledger.before_run === PREVIEW_CREDITS, sBody.error ?? `HTTP ${started.status}`);
  if (!runId) throw new Error(`start_failed:${sBody.error ?? started.status}`);

  const internalSecret = process.env.INTERNAL_RUN_SECRET || `acceptance-${stamp}-internal-only`;
  process.env.INTERNAL_RUN_SECRET = internalSecret;
  const procReq = () => new NextRequest(`http://localhost/api/internal/intelligence-runs/${runId}/process`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${internalSecret}` }, body: JSON.stringify({ user_id: userA }),
  });
  const processed = await processRun(procReq(), { params: { runId } });
  const pBody = await processed.json() as { status?: string; error?: string };
  check("bounded processor completed durably", pBody.status === "completed", pBody.error ?? `HTTP ${processed.status}`);

  // ── Reconcile the ledger against the delivered evaluations ──
  const loadedA = await loadRun(req(`/api/customer/intelligence-runs/${runId}`, tokenA), { params: { runId } });
  const lBody = await loadedA.json() as { status?: string; report?: { canonical_cases?: Array<{ account_id: string }>; processed_leads?: unknown[] } };
  const deliveredCases = lBody.report?.canonical_cases ?? [];
  const deliveredCount = deliveredCases.length;
  ledger.after_run = await balanceOf(userA!);
  const charges = await chargesOf(userA!);
  ledger.charges = charges.length;
  ledger.charge_run_ids = Array.from(new Set(charges.map((c: any) => c.run_id)));

  check("owner reloads durable completed result", loadedA.status === 200 && lBody.status === "completed");
  check("delivered evaluations ≤ Preview cap (2)", deliveredCount <= PREVIEW_CREDITS, `delivered=${deliveredCount}`);
  check("exactly one credit consumed per delivered evaluation", charges.length === deliveredCount, `charges=${charges.length}, delivered=${deliveredCount}`);
  check("remaining balance = grant − delivered (never negative)", ledger.after_run === PREVIEW_CREDITS - deliveredCount && (ledger.after_run as number) >= 0, `balance=${ledger.after_run}`);
  check("every charge keyed to THIS run (idempotency identity)", charges.every((c: any) => c.run_id === runId));
  check("charges attributed only to the purchaser (tenant isolation)", (await chargesOf(userB!)).length === 0);
  // Full Preview supply expectation: a healthy CO Preview delivers the full 2-cap.
  check("Preview delivered the full purchased scope (2)", deliveredCount === PREVIEW_CREDITS, `delivered=${deliveredCount}`);

  // ── Tenant isolation on the result ──
  const loadedB = await loadRun(req(`/api/customer/intelligence-runs/${runId}`, tokenB), { params: { runId } });
  check("other tenant cannot load the purchased result (404)", loadedB.status === 404);

  // ── Recovery / duplicate completion → no extra debit ──
  const replay = await processRun(procReq(), { params: { runId } });
  await replay.json().catch(() => ({}));
  const balAfterReplay = await balanceOf(userA!);
  const chargesAfterReplay = await chargesOf(userA!);
  ledger.after_replay = balAfterReplay;
  check("recovery/replay of the same run → no additional debit", balAfterReplay === ledger.after_run && chargesAfterReplay.length === charges.length);

  // ── Report reopen at 0 balance → allowed, no debit ──
  const reopen = await loadRun(req(`/api/customer/intelligence-runs/${runId}`, tokenA), { params: { runId } });
  check("reopening the acquired report is allowed and free", reopen.status === 200 && (await balanceOf(userA!)) === ledger.after_run);

  // ── Negative: a THIRD billable run when the balance is exhausted → gate blocks, no research ──
  if ((ledger.after_run as number) <= 0) {
    const usagePre = structuredClone(getUsage());
    const third = await startRun(req("/api/customer/intelligence-runs", tokenA, {
      context_id: contextId, version: cBody.context.version, plan: "sample", idempotency_key: `otc_third_${stamp}`, delivery_limit: PREVIEW_CREDITS,
    }));
    const tBody = await third.json() as { code?: string; error?: string };
    check("exhausted one-time customer is blocked from a new billable run (402)", third.status === 402 && tBody.code === "usage_limit_reached", `HTTP ${third.status} ${tBody.code ?? ""}`);
    const usagePost = getUsage();
    const anthPre = usagePre["anthropic"]?.calls_today ?? 0, anthPost = usagePost["anthropic"]?.calls_today ?? 0;
    check("blocked run performed no provider research", anthPost === anthPre, `anthropic_calls_delta=${anthPost - anthPre}`);
    check("no negative balance after the blocked attempt", (await balanceOf(userA!)) === ledger.after_run && (ledger.after_run as number) >= 0);
  } else {
    check("balance not exhausted — third-run negative test skipped", true, `balance=${ledger.after_run}`);
  }

  const usageAfter = getUsage();
  const usageDelta = Object.fromEntries(Object.entries(usageAfter).map(([p, after]) => {
    const before = usageBefore[p];
    return [p, { calls: after.calls_today - (before?.calls_today ?? 0), errors: after.errors_today - (before?.errors_today ?? 0), cost_usd: Number(((after.calculated_cost_usd_today ?? 0) - (before?.calculated_cost_usd_today ?? 0)).toFixed(6)) }];
  }).filter(([, v]) => (v as { calls: number }).calls > 0));

  const artifact = {
    acceptance: "one-time-credit-enforcement-v1", model: "B (1 credit / valid company evaluation)",
    ran_at: new Date().toISOString(), run_id: runId, product: "preview", grant: PREVIEW_CREDITS,
    delivered_count: deliveredCount, delivered_accounts: deliveredCases.map((c) => c.account_id),
    ledger, usage_delta: usageDelta, checks,
  };
  mkdirSync("ml/data/acceptance", { recursive: true });
  const path = `ml/data/acceptance/one-time-enforcement-${stamp}.json`;
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(`artifact :: ${path}`);
  console.log(`ledger :: ${JSON.stringify(ledger)}`);
} finally {
  for (const id of [userA, userB].filter((x): x is string => Boolean(x))) {
    await db.from("account_intelligence_charges").delete().eq("user_id", id);
    await db.from("credit_transactions").delete().eq("user_id", id);
    await db.from("customer_credits").delete().eq("user_id", id);
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
