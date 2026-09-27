#!/usr/bin/env node
/**
 * V2.4 TERMINAL REAL ACCEPTANCE — one-time credit path + real Intelligence + real V2.4 delivery.
 *
 * Disposable customer granted EXACTLY the tier one-time entitlement via the canonical grant primitive
 * (addCredits), runs the REAL Intelligence pipeline (interpret→confirm→start→process), then the report
 * is delivered through the EXACT production viewer path (deliverableForViewer → fromInstitutionalReport
 * → fromDeliverableViewModel → TierComposer) and rendered with the canonical V2.4 renderer. Proves in
 * ONE flow: (A) real full-order generation + qualification + canonical decisions, and (B) one-time
 * entitlement / one-credit-per-valid-delivery / exactly-once charge / reopen=free / regenerate=free.
 *
 * No reimplemented charging, no mocked ledger, no manual balance edits, no fake charge rows. All
 * disposable rows + auth users removed in finally. Never prints secret values. Reuses ONLY production
 * server-side seams. PDFs + a REDACTED validity summary are written to an OUT dir OUTSIDE the repo
 * (scratchpad) so real research is never committed or made a public sample.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"])
  if (!has(env, key)) { console.error(`BLOCKED: ${key} missing`); process.exit(3); }

const OUT = process.env.LEADLENS_RENDER_OUT || "/private/tmp/v2_4-real";
mkdirSync(OUT, { recursive: true });

const { createClient } = await import("@supabase/supabase-js");
const { createServerClient } = await import("@/lib/supabase/server");
const { POST: interpret } = await import("@/app/api/interpret/route");
const { POST: confirm } = await import("@/app/api/customer/contexts/confirm/route");
const { POST: startRun } = await import("@/app/api/customer/intelligence-runs/route");
const { POST: processRun } = await import("@/app/api/internal/intelligence-runs/[runId]/process/route");
const { GET: loadRun } = await import("@/app/api/customer/intelligence-runs/[runId]/route");
const { addCredits } = await import("@/lib/credits/add-credits");
const { getUsage } = await import("@/lib/ops/usage-ledger");
// Production delivery seams (identical to the customer viewer + Admin preview):
const { deliverableForViewer } = await import("@/lib/delivery-system/server/deliverable-for-viewer");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");

const db = createServerClient();
if (!db) { console.error("BLOCKED: server Supabase unavailable"); process.exit(3); }
const stamp = Date.now();
const emailA = `ll-v24-a-${stamp}@example.com`;
const emailB = `ll-v24-b-${stamp}@example.com`;
const password = `V24-${stamp}-Aa!`;
const contextId = `v24_context_${stamp}`;
const contextText = process.env.LEADLENS_ACCEPTANCE_CONTEXT ?? "Vendemos automatización de bodegas, integración WMS y orquestación de inventarios a fabricantes y distribuidores medianos y grandes en Colombia. Buscamos empresas que operen directamente centros de distribución, bodegas o plantas y que hayan abierto, ampliado, automatizado o invertido recientemente en infraestructura logística. Excluir entidades públicas, medios, consultoras, empresas de software puro, retailers sin operación logística propia y operaciones totalmente tercerizadas.";
const locale = process.env.LEADLENS_ACCEPTANCE_LOCALE ?? "es";
const PLAN = (["sample", "starter", "standard", "pro"].includes(process.env.LEADLENS_ACCEPTANCE_PLAN ?? "") ? process.env.LEADLENS_ACCEPTANCE_PLAN : "sample") as "sample" | "starter" | "standard" | "pro";
const PLAN_LABEL = { sample: "Preview", starter: "Brief", standard: "Portfolio", pro: "Premium" }[PLAN];
const GRANT = ({ sample: 2, starter: 6, standard: 12, pro: 18 } as const)[PLAN]; // grant = opportunity_target

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
const internalSecret = process.env.INTERNAL_RUN_SECRET || `accept-${stamp}-internal-only`;
process.env.INTERNAL_RUN_SECRET = internalSecret;
const procReq = () => new NextRequest(`http://localhost/api/internal/intelligence-runs/${runId}/process`, {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${internalSecret}` }, body: JSON.stringify({ user_id: userA }),
});

try {
  const a = await createDisposable(emailA); userA = a.id; tokenA = a.token;
  const b = await createDisposable(emailB); userB = b.id; tokenB = b.token;
  check("disposable purchaser + second tenant created", Boolean(userA && userB));

  const profA = await db.from("profiles").insert({ id: userA!, email: emailA, plan: PLAN }).select("id,plan");
  await db.from("profiles").insert({ id: userB!, email: emailB, plan: "free" }).then(() => {}, () => {});
  check(`purchaser profile established (plan=${PLAN})`, !profA.error && profA.data?.[0]?.plan === PLAN, profA.error?.message);

  // ── (B) Canonical one-time entitlement grant — exactly the tier allowance ──
  ledger.before_grant = await balanceOf(userA!);
  await addCredits(db, userA!, GRANT, `acceptance ${PLAN_LABEL} grant ${stamp}`, "grant");
  ledger.after_grant = await balanceOf(userA!);
  check(`${PLAN_LABEL} grant = exactly ${GRANT} one-time credits`, ledger.before_grant === 0 && ledger.after_grant === GRANT, `balance=${ledger.after_grant}`);

  // ── (A) Real Intelligence generation ──
  const interpreted = await interpret(req("/api/interpret", tokenA, { input: contextText, locale }));
  const iBody = await interpreted.json() as { interpretation?: { status?: string }; confirmation_token?: string };
  check("Stage A confirmable", interpreted.status === 200 && Boolean(iBody.confirmation_token), `HTTP ${interpreted.status}`);
  if (!iBody.confirmation_token) throw new Error("stage_a_no_token");
  const confirmed = await confirm(req("/api/customer/contexts/confirm", tokenA, { confirmation_token: iBody.confirmation_token, context_id: contextId, client_id: `customer_${stamp}` }));
  const cBody = await confirmed.json() as { context?: { context_id: string; version: number } };
  check("context confirmed", [200, 201].includes(confirmed.status) && cBody.context?.context_id === contextId);
  if (!cBody.context) throw new Error("confirm_failed");

  const started = await startRun(req("/api/customer/intelligence-runs", tokenA, {
    context_id: contextId, version: cBody.context.version, plan: PLAN, idempotency_key: `v24_${stamp}`, delivery_limit: GRANT,
  }));
  const sBody = await started.json() as { run_id?: string; status?: string; error?: string };
  runId = sBody.run_id ?? "";
  check("run accepted", [200, 202].includes(started.status) && Boolean(runId), sBody.error ?? `HTTP ${started.status}`);
  if (!runId) throw new Error(`start_failed:${sBody.error ?? started.status}`);

  const tRun = Date.now();
  const processed = await processRun(procReq(), { params: { runId } });
  const runMs = Date.now() - tRun;
  const pBody = await processed.json() as { status?: string; error?: string };
  check("bounded processor completed durably", pBody.status === "completed", pBody.error ?? `HTTP ${processed.status}`);

  // ── (B) Ledger reconciliation against delivered evaluations ──
  const loadedA = await loadRun(req(`/api/customer/intelligence-runs/${runId}`, tokenA), { params: { runId } });
  const lBody = await loadedA.json() as { status?: string; report?: { canonical_cases?: Array<{ account_id: string }> } };
  const delivered = lBody.report?.canonical_cases ?? [];
  const deliveredCount = delivered.length;
  ledger.after_run = await balanceOf(userA!);
  const charges = await chargesOf(userA!);
  ledger.charges = charges.length;
  check(`delivered the full purchased scope (${GRANT})`, deliveredCount === GRANT, `delivered=${deliveredCount}`);
  check("exactly one credit consumed per delivered evaluation", charges.length === deliveredCount, `charges=${charges.length}, delivered=${deliveredCount}`);
  check("remaining balance = grant − delivered (never negative)", ledger.after_run === GRANT - deliveredCount && (ledger.after_run as number) >= 0, `balance=${ledger.after_run}`);
  check("every charge keyed to THIS run (exactly-once identity)", charges.every((c: any) => c.run_id === runId));
  check("charges attributed only to the purchaser (tenant isolation)", (await chargesOf(userB!)).length === 0);

  // ── Tenant isolation on the result ──
  const loadedB = await loadRun(req(`/api/customer/intelligence-runs/${runId}`, tokenB), { params: { runId } });
  check("other tenant cannot load the purchased result (404)", loadedB.status === 404);

  // ── Recovery/replay → no extra debit ──
  const replay = await processRun(procReq(), { params: { runId } });
  await replay.json().catch(() => ({}));
  const balAfterReplay = await balanceOf(userA!);
  check("recovery/replay → no additional debit", balAfterReplay === ledger.after_run && (await chargesOf(userA!)).length === charges.length);

  // ── (V2.4 DELIVERY) Render through the EXACT production viewer path ──
  const viewer = await deliverableForViewer(runId, tokenA);
  check("production deliverable resolves for the owner", viewer.ok === true, viewer.ok ? undefined : `status=${(viewer as any).status}`);
  const balBeforeRender = await balanceOf(userA!);
  let pdfBytes = 0, pageEstimate = 0, renderedTier = "";
  const validity: any[] = [];
  if (viewer.ok) {
    renderedTier = viewer.tier;
    const pm = toPresentationModel(viewer.document, viewer.tier, "pdf");
    const buf = renderPdfBuffer(pm); // production-parity (compressed)
    pdfBytes = buf.length;
    const pdfPath = `${OUT}/LeadLens_${PLAN_LABEL}_V2_4_REAL_Final.pdf`;
    writeFileSync(pdfPath, buf);
    console.log(`REAL PDF :: ${pdfPath} (${pdfBytes} bytes, tier=${renderedTier}, accounts=${pm.document.accounts.length})`);
    check(`real V2.4 ${PLAN_LABEL} PDF rendered (%PDF, non-trivial)`, buf.subarray(0, 5).toString("latin1") === "%PDF-" && pdfBytes > 5000);
    check(`rendered account count = delivered (${deliveredCount})`, pm.document.accounts.length === deliveredCount, `rendered=${pm.document.accounts.length}`);
    // REDACTED validity summary (no full evidence text dumped) for §17/§25 review.
    for (const acc of pm.document.accounts) {
      validity.push({
        company: acc.company, geography: acc.geography ?? null, segment: acc.segment ?? null,
        decision: acc.decision, opportunityType: acc.opportunityType ?? null,
        fit: acc.dimensions?.find((d: any) => /fit/i.test(d.label))?.value ?? null,
        timing: acc.dimensions?.find((d: any) => /timing/i.test(d.label))?.value ?? null,
        evidence: acc.evidence?.strength ?? null, sourceCount: acc.sources?.length ?? 0,
        datedCount: acc.evidence?.datedCount ?? 0, corroborated: acc.evidence?.corroborated ?? null,
        hasCounter: (acc.counterSignals?.length ?? 0) > 0, hasNextStep: Boolean(acc.nextStep),
      });
    }
  }
  const balAfterRender = await balanceOf(userA!);
  check("PDF render consumed NO credit (delivery is free)", balAfterRender === balBeforeRender && (await chargesOf(userA!)).length === charges.length);

  const usageAfter = getUsage();
  const usageDelta = Object.fromEntries(Object.entries(usageAfter).map(([p, after]) => {
    const before = usageBefore[p];
    return [p, { calls: after.calls_today - (before?.calls_today ?? 0), errors: after.errors_today - (before?.errors_today ?? 0), cost_usd: Number(((after.calculated_cost_usd_today ?? 0) - (before?.calculated_cost_usd_today ?? 0)).toFixed(6)) }];
  }).filter(([, v]) => (v as { calls: number }).calls > 0));
  const totalCost = Object.values(usageDelta).reduce((s, v: any) => s + (v.cost_usd ?? 0), 0);

  const decisionDist = validity.reduce((m: any, a) => { m[a.decision] = (m[a.decision] ?? 0) + 1; return m; }, {});
  const geoOffTarget = validity.filter((a) => a.geography && !/colombia/i.test(String(a.geography))).map((a) => a.company);
  const dupes = validity.length - new Set(validity.map((a) => (a.company || "").toLowerCase().trim())).size;

  const artifact = {
    acceptance: "one-time-deliverable-v2_4", product: PLAN_LABEL, model: "B (1 credit / valid company evaluation)",
    ran_at: new Date().toISOString(), run_id: runId, grant: GRANT, delivered_count: deliveredCount,
    rendered_tier: renderedTier, pdf_bytes: pdfBytes, run_ms: runMs,
    ledger, decision_distribution: decisionDist, off_target_geo: geoOffTarget, duplicate_count: dupes,
    usage_delta: usageDelta, total_provider_cost_usd: Number(totalCost.toFixed(6)),
    validity, checks,
  };
  const path = `${OUT}/one-time-deliverable-${PLAN_LABEL}-${stamp}.json`;
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(`artifact :: ${path}`);
  console.log(`ledger :: ${JSON.stringify(ledger)}`);
  console.log(`cost :: $${totalCost.toFixed(4)} across providers :: ${JSON.stringify(usageDelta)}`);
  console.log(`decisions :: ${JSON.stringify(decisionDist)} :: off_target_geo=${geoOffTarget.length} dupes=${dupes}`);
} finally {
  for (const id of [userA, userB].filter((x): x is string => Boolean(x))) {
    await db.from("account_intelligence_charges").delete().eq("user_id", id);
    await db.from("credit_transactions").delete().eq("user_id", id);
    await db.from("customer_credits").delete().eq("user_id", id);
    await db.from("account_review_snapshots").delete().eq("owner_user_id", id);
    await db.from("snapshot_reports").delete().eq("user_id", id);
    await db.from("confirmed_commercial_contexts").delete().eq("user_id", id);
    await db.from("lead_searches").delete().eq("user_id", id);
    await db.from("profiles").delete().eq("id", id);
    await db.auth.admin.deleteUser(id).catch(() => undefined);
  }
  console.log("cleanup :: disposable tenant rows and auth users deleted");
}

const failures = checks.filter((c) => !c.ok);
console.log(`\nACCEPTANCE :: ${checks.length - failures.length}/${checks.length} checks passed`);
process.exit(failures.length ? 2 : 0);
