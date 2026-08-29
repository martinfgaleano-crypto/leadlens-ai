// LIVE EXECUTION TRACE V1 — persistence sink, deep timing, preflight (§22/§5/§6/§24/§33/§34).
//
// Runs the REAL Productive Spine orchestration (the seam the production route invokes)
// with an in-memory sink wired exactly as the route wires it, and proves the sink and
// preflight contracts. No live providers.

import assert from "node:assert/strict";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { InMemoryLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import type { DiscoveryRunner, RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { InMemoryIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { startIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { InMemoryRunTraceSink, runTraceKey } from "@/lib/intelligence/run-trace-sink";
import { buildAccountRunTrace } from "@/lib/intelligence/run-trace-wiring";
import { providerPreflight, liveSampleGoNoGo, liveSampleFingerprint } from "@/lib/intelligence/live-sample-preflight";
import type { AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";
import type { LeadCandidate, LeadLensReport, PipelineInput, ProcessedLead } from "@/types";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };
const clock = () => new Date("2026-08-26T12:00:00.000Z");
process.env.CONFIRMATION_TOKEN_SECRET = "test-only-confirmation-secret-32-characters";
const fixture = structuredClone(GOLDEN_FIXTURES.software_manufacturing);

const tel = (over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry => ({
  version: "v1", account: "a", domain: "a.example", planned_queries: 4, executed_queries: 3, provider_calls: 3, provider_failures: 0,
  results_seen: 12, evidence_accepted: 2, evidence_rejected: 1, pages_extracted: 1, extraction_failures: 0, structured_extraction_calls: 1,
  dated_evidence: 1, independent_domains: 2, corroboration_attempted: true, corroborating_domains: 2, claims_recovered: 1, counterevidence_checked: true,
  early_stop_reason: "sufficient_evidence", query_audit: [{ query_id: "q1", stage: "event", provider: "tavily", results: 4, accepted: 2 }], extraction_audit: [], ...over,
});

const org = (i: number): RawDiscoveredOrg => ({ name: `M ${i}`, domain: `v-${i}.example`, country: "United States", organizationType: "Manufacturer", industry: "Manufacturing", origin: "dynamic_enumeration", provider: "test_provider", route: "industry_category", sourceUrl: `https://d.example/${i}`, confidence: "verified" });
const discovery: DiscoveryRunner = async () => ({ orgs: Array.from({ length: 4 }, (_, i) => org(i + 1)), providersAvailable: ["test_provider"], providersFailed: [], operatingMode: "full_discovery" });
const leadFor = (candidate: LeadCandidate, i: number): ProcessedLead => ({
  id: candidate.id,
  candidate: { ...candidate, domain: `acct-${i}.example`, company: `acct-${i}`, source_url: `https://acct-${i}.example/news`, signal_date: "2026-08-20", signal_type: "new_facility" },
  enrichment: { candidate, timing_signals: ["Opened a new production facility"], evidence: [], missing_data: [], research_confidence: 0.9, evidence_discipline: [{ claim: "Opened a new production facility", type: "verified_public_signal", date: "2026-08-20" }], account_research: tel({ account: `acct-${i}` }), next_best_question: "Confirm." },
  qualification: { enrichment: {} as never, fit_score: 8, category: "HOT", fit_reasons: [], disqualification_reasons: [], qualification_confidence: 0.85, score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1, timing_signal: 1, reachability: 1, strategic_relevance: 1 } },
  outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "", qc_status: "APPROVED", qc_notes: [] },
});

const runSpine = async (owner: string, sink: InMemoryRunTraceSink, opts: { provenance?: "live" | "controlled"; throwPipeline?: boolean } = {}) => {
  const contextStore = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(contextStore, fixture, { userId: owner, contextId: "shared", now: clock });
  const pipeline = async (input: PipelineInput): Promise<LeadLensReport> => {
    if (opts.throwPipeline) throw new Error("provider_exploded");
    const researched = (input.candidatesOverride ?? []).slice(0, 4).map(leadFor);
    input.onResearchComplete?.(researched);
    return { job_id: input.jobId!, plan: input.plan, total_leads: researched.length, hot_count: researched.length, warm_count: 0, cold_count: 0, discard_count: 0, avg_score: 7, executive_summary: "x", patterns_observed: [], recommendations: [], processed_leads: researched, ranked_opportunities: [], created_at: clock().toISOString() };
  };
  return startIntelligenceRun(
    { userId: owner, context: { contextId: "shared", version: 1 }, plan: "sample", deliveryLimit: 4, researchLimit: 4 },
    { contextStore, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(), discoveryRunner: discovery, pipeline, now: clock,
      traceProvenance: opts.provenance ?? "controlled",
      onAccountTrace: (tr) => { void sink.persist(tr); } },
  );
};

const run = async () => {
  // A / E — normal run persists one trace per researched account.
  const sinkA = new InMemoryRunTraceSink();
  const resA = await runSpine("owner-a", sinkA);
  t("A: run completed", resA.ok && resA.run.status === "completed");
  t("E: one persisted trace per researched account", sinkA.all().length === 4);
  // G — controlled provenance is never persisted as LIVE.
  t("G: controlled run persists controlled provenance (never live)", sinkA.all().every((x) => x.provenance === "controlled"));

  // B — idempotent by (run_id, account_id): re-persisting the same trace is a no-op.
  const one = sinkA.all()[0];
  const dup = await sinkA.persist(one);
  t("B: re-persisting the same trace identity is a duplicate, not a second row", dup.duplicate && !dup.persisted && sinkA.all().length === 4);
  t("B: trace key is run+account scoped", runTraceKey(one) === `${one.run_id}::${one.account_id}`);

  // C / §5 — persistence failure cannot fail the customer run.
  const sinkC = new InMemoryRunTraceSink();
  sinkC.failNextPersist();
  const resC = await runSpine("owner-c", sinkC);
  t("C: run still completes when a trace persist fails", resC.ok && resC.run.status === "completed");
  t("C: the failed trace was dropped, the rest persisted (failure isolated)", sinkC.all().length === 3);

  // D — a run failing before account research persists ONE bounded failure trace.
  const sinkD = new InMemoryRunTraceSink();
  const resD = await runSpine("owner-d", sinkD, { throwPipeline: true });
  t("D: failed run returns failure", !resD.ok);
  t("D: one failure trace persisted", sinkD.all().length === 1 && sinkD.all()[0].completion_state === "failed");

  // F — cross-tenant executions never mix traces.
  const shared = new InMemoryRunTraceSink();
  await runSpine("owner-1", shared);
  await runSpine("owner-2", shared);
  const runIds = new Set(shared.all().map((x) => x.run_id));
  t("F: two tenants produce two distinct run scopes, no trace mixing", runIds.size === 2 && shared.all().length === 8);

  // Deep timing (§8/§9/§15): real per-op durations map into the trace + stage work.
  const timed = buildAccountRunTrace({
    runId: "r", accountId: "acct.example", contextRefSafe: "ctx",
    telemetry: tel({ provider_ops: [
      { provider: "tavily", operation: "search", stage: "event", duration_ms: 1800, ok: true, timeout: false, results: 5 },
      { provider: "full_text", operation: "full_text", stage: "event", duration_ms: 2600, ok: true, timeout: false, results: 1 },
      { provider: "anthropic", operation: "llm", stage: "event", duration_ms: 900, ok: true, timeout: false, results: 1 },
    ] }),
    decision: "validate", caseCompleted: true, wall_clock_ms: 4000, research_stage_ms: 0, case_synthesis_ms: 50,
  });
  const searchOp = timed.provider_ops.find((o) => o.operation === "search")!;
  t("deep timing: real provider-op durations carried into the trace", searchOp.duration_ms === 1800);
  t("deep timing: full-text + LLM durations present", timed.provider_ops.some((o) => o.operation === "full_text" && o.duration_ms === 2600) && timed.provider_ops.some((o) => o.operation === "llm" && o.duration_ms === 900));
  t("deep timing: stage_work reflects summed real op durations, wall_clock is measured", timed.stage_work_ms >= 1800 + 2600 + 900 && timed.wall_clock_ms === 4000);

  // §23 — the existing aggregate builder consumes traces loaded back from the sink.
  const { summarizeRunTraces } = await import("@/lib/intelligence/run-trace-artifact");
  const loaded = await sinkA.load(resA.ok ? resA.run.runId : "");
  const agg = summarizeRunTraces(loaded);
  t("§23: artifact aggregate builds from persisted (loaded) traces", loaded.length === 4 && agg.eligible_runs === 4 && agg.runtime_ms.p95 !== null);

  // Preflight + GO/NO-GO (§33/§34) — credential presence only, quota unknown.
  const fullEnv = { ANTHROPIC_API_KEY: "x", NEXT_PUBLIC_SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "x", FIRECRAWL_API_KEY: "x", TAVILY_API_KEY: "x", SERPER_API_KEY: "x" } as unknown as NodeJS.ProcessEnv;
  const ready = liveSampleGoNoGo(fullEnv);
  t("preflight: all criticals + 2 search providers present -> READY (no Brave required §34)", ready.verdict === "READY");
  t("preflight: quota is never inferred from key presence", providerPreflight(fullEnv).every((p) => p.quota === "unknown"));

  const noAnthropic = liveSampleGoNoGo({ ...fullEnv, ANTHROPIC_API_KEY: undefined } as NodeJS.ProcessEnv);
  t("preflight: missing extraction LLM -> BLOCKED", noAnthropic.verdict === "BLOCKED");
  const oneSearch = liveSampleGoNoGo({ ANTHROPIC_API_KEY: "x", NEXT_PUBLIC_SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "x", FIRECRAWL_API_KEY: "x", TAVILY_API_KEY: "x" } as unknown as NodeJS.ProcessEnv);
  t("preflight: single search provider -> DEGRADED", oneSearch.verdict === "DEGRADED");
  const exhausted = liveSampleGoNoGo(fullEnv, { anthropic: "exhausted" });
  t("preflight: a known-exhausted required provider -> BLOCKED (real health signal honored)", exhausted.verdict === "BLOCKED");

  // Live sample identity (§24) — not timestamp-based; revision distinguishes supersession.
  const a = liveSampleFingerprint({ account_ids: ["x", "y", "z"], context_id: "ctx", revision: 1 });
  const aReorder = liveSampleFingerprint({ account_ids: ["z", "y", "x"], context_id: "ctx", revision: 1 });
  const aRev2 = liveSampleFingerprint({ account_ids: ["x", "y", "z"], context_id: "ctx", revision: 2 });
  t("§24: same accounts+context+revision -> same fingerprint", a === aReorder);
  t("§24: a corrected/superseding revision differs", a !== aRev2);

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
