import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { SupabaseConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";
import { SupabaseLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { SupabaseIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { executeIntelligenceRun, RecoverableChargeError } from "@/lib/intelligence/productive-spine";
import { SupabaseRunTraceSink } from "@/lib/intelligence/run-trace-sink";
import { resolveResearchConcurrency } from "@/lib/intelligence/research-concurrency";

export const maxDuration = 300;
const bodySchema = z.object({ user_id: z.string().uuid() }).strict();

function authorized(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_RUN_SECRET;
  const actual = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function POST(req: NextRequest, { params }: { params: { runId: string } }) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^intel_[a-f0-9]{32}$/.test(params.runId)) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });
  // This is real runtime execution against real providers → LIVE provenance. It is
  // fixed server-side and can never be set by the request body/params (§6). Trace
  // persistence is failure-isolated: a sink error is swallowed and never fails the
  // customer Intelligence run (§5).
  // Resolve entitlement ONCE for metered per-account usage (matrix §5/§6/§9). Best-effort: any
  // failure leaves the run uncapped/unmetered rather than blocking Intelligence.
  const { resolveEntitlements } = await import("@/lib/entitlements/entitlements-v1");
  const { remainingAllowanceForRun, chargeMaterializedAccounts } = await import("@/lib/billing/account-metering");
  const entitlement = await resolveEntitlements(db, parsed.data.user_id).catch(() => null);

  // Hybrid Candidate Universe: wrap the productive discovery runner with the neutral
  // Vault identity-reuse fallback. Gated by the reversible VAULT_REUSE_MODE flag + measured
  // fresh-coverage sufficiency; OFF (default) → gate closed → no Vault read, original behavior.
  const { defaultDiscoveryRunner } = await import("@/lib/lead-hunter/discovery-runner");
  const { withVaultReuse } = await import("@/lib/lead-hunter/vault-identity-reuse");
  const { createVaultReuseDeps } = await import("@/lib/lead-hunter/vault-reuse-deps");
  const { resolveVaultReuseConfig, makeVaultReuseGate } = await import("@/lib/lead-hunter/vault-reuse-config");
  const vaultReuseConfig = resolveVaultReuseConfig();
  const discoveryRunner = withVaultReuse(
    defaultDiscoveryRunner,
    createVaultReuseDeps(db as never),
    undefined,
    {
      gate: makeVaultReuseGate(vaultReuseConfig),
      onTelemetry: (t) => console.log(`[analytics] ${JSON.stringify({ event: "vault_reuse", surface: "intelligence_run", run_id: params.runId, ...t })}`),
    },
  );
  // Reused-identity Research qualification: only wired when reuse is enabled (OFF → undefined →
  // no qualification, no cost). Lets qualified reused operators reach Research; wrong-target/
  // non-company identities are rejected. Fail-closed inside the spine.
  const { createReuseQualificationDeps } = await import("@/lib/lead-hunter/vault-reuse-qualification-deps");
  const reuseQualifier = vaultReuseConfig.mode === "OFF" ? undefined : createReuseQualificationDeps();

  const traceSink = new SupabaseRunTraceSink(db);
  // Trace persistence must survive serverless termination (RUNTIME ATTRIBUTION V1 §1.14):
  // collect the persist promises and await them (bounded, failure-isolated) after the run
  // completes, so a fire-and-forget promise is not dropped when the response returns. A
  // sink failure is swallowed and never affects the customer Intelligence run (§1.15).
  const tracePersists: Array<Promise<unknown>> = [];
  const result = await executeIntelligenceRun(params.runId, parsed.data.user_id, {
    contextStore: new SupabaseConfirmedContextStore(db as never),
    leadHunterStore: new SupabaseLeadHunterRunStore(db as never),
    runStore: new SupabaseIntelligenceRunStore(db),
    discoveryRunner,
    reuseQualifier,
    pipeline: (await import("@/lib/pipeline")).runLeadLensPipeline,
    traceProvenance: "live",
    // Bounded account-research concurrency. c=2 is the validated production default;
    // env=1 is the immediate rollback switch and values above 2 are never accepted.
    researchConcurrency: resolveResearchConcurrency(),
    // Metered PRODUCTION cap (matrix §9): a subscription/beta run never paid-materializes more
    // accounts than the remaining allowance (own prior charges added back so recovery re-runs are
    // not starved). Unmetered/one-time → null → uncapped. Best-effort; never breaks a run.
    accountBudget: entitlement ? (() => remainingAllowanceForRun(db, entitlement, Date.now(), params.runId)) : undefined,
    // Per-account CHARGE-commit at materialization (matrix §6): one credit per account, idempotent
    // per (user, runId, account). AWAITED within this invocation (before the fenced finalize) and
    // RETURNS the accounts AUTHORIZED for delivery (charged or already-charged) so the spine drops
    // any the allowance could not cover — closing the concurrent-run free-delivery race. Unmetered
    // (internal) → all authorized. FAIL-CLOSED on ledger unavailability: if the credit ledger cannot
    // confirm authorization (throw, or any `unavailable` account), raise RecoverableChargeError so the
    // run stays "processing" for the recovery cron and NO unpaid evaluation is ever delivered. A
    // genuinely-exhausted account (a concurrent run spent the last credit) is simply not returned.
    onRunMaterialized: entitlement ? (async (runId, accountIds) => {
      let r;
      try { r = await chargeMaterializedAccounts(db, entitlement, { runId }, accountIds); }
      catch { throw new RecoverableChargeError(); }
      if (!r.metered) return accountIds;
      if (r.unavailable.length) throw new RecoverableChargeError();
      return [...r.charged, ...r.already];
    }) : undefined,
    onAccountTrace: (trace) => { tracePersists.push(traceSink.persist(trace).catch(() => { /* telemetry never fails a run */ })); },
    // Accrete valid discovered companies into the durable, customer-independent Vault
    // registry (best-effort; universal facts only). Never blocks or alters the run.
    onDiscoveredCompanies: (companies) => {
      void (async () => {
        try {
          const { accreteDiscoveredCompanies, productionVaultAccretionDeps } = await import("@/lib/vault/vault-accretion");
          await accreteDiscoveredCompanies(companies, "customer_run", await productionVaultAccretionDeps());
        } catch { /* Vault accretion is best-effort and never affects the run */ }
      })();
    },
    // Accrete validated research EVENTS + SOURCES into the durable Vault (best-effort;
    // universal facts only; over all researched accounts regardless of Case outcome).
    onResearchedAccounts: (accounts) => {
      void (async () => {
        try {
          const { accreteResearchedAccounts, productionResearchAccretionDeps } = await import("@/lib/vault/vault-research-accretion");
          await accreteResearchedAccounts(accounts, "customer_run", await productionResearchAccretionDeps());
        } catch { /* Vault accretion is best-effort and never affects the run */ }
      })();
    },
  });
  // Bounded await so account traces are durably persisted before the function returns
  // (never throws — allSettled; a trace failure cannot fail the run).
  if (tracePersists.length) await Promise.allSettled(tracePersists);
  if (!result.ok) return NextResponse.json({ run_id: params.runId, status: "failed", error: result.reason }, { status: 422 });
  if (result.run.status === "completed" && result.run.report) {
    const { initializeProductiveAccountMemory } = await import("@/lib/intelligence/initialize-account-memory");
    await initializeProductiveAccountMemory(db, { report: result.run.report, runId: result.run.runId, userId: parsed.data.user_id, contextRef: result.run.contextRef })
      .catch((error) => console.error("[productive-memory]", error instanceof Error ? error.message : "unavailable"));
  }
  return NextResponse.json({ run_id: result.run.runId, status: result.run.status, stage: result.run.stage });
}
