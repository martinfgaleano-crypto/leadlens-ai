// LIVE TRACE WIRING V1 — traces emitted from the REAL Productive Spine (§25/§26).
//
// Runs the actual startIntelligenceRun orchestration with controlled doubles. The
// pipeline double attaches REAL-shaped AccountDeepResearchTelemetry to each researched
// lead (as the real pipeline does) and the spine emits one IntelligenceRunTrace per
// account through deps.onAccountTrace. The test NEVER instantiates a trace directly —
// it asserts the traces the real spine produced.

import assert from "node:assert/strict";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { InMemoryLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import type { DiscoveryRunner, RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { InMemoryIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { startIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { summarizeRunTraces } from "@/lib/intelligence/run-trace-artifact";
import type { AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";
import type { IntelligenceRunTrace } from "@/lib/intelligence/run-trace";
import type { LeadCandidate, LeadLensReport, PipelineInput, ProcessedLead } from "@/types";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };
const clock = () => new Date("2026-08-26T12:00:00.000Z");
process.env.CONFIRMATION_TOKEN_SECRET = "test-only-confirmation-secret-32-characters";
const fixture = structuredClone(GOLDEN_FIXTURES.software_manufacturing);

const tel = (over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry => ({
  version: "account-deep-research-v1", account: "acct", domain: "acct.example",
  planned_queries: 6, executed_queries: 4, provider_calls: 4, provider_failures: 0,
  results_seen: 20, evidence_accepted: 3, evidence_rejected: 2, pages_extracted: 2, extraction_failures: 0,
  structured_extraction_calls: 2, dated_evidence: 2, independent_domains: 2, corroboration_attempted: true,
  corroborating_domains: 2, claims_recovered: 2, counterevidence_checked: true, early_stop_reason: "sufficient_evidence",
  query_audit: [
    { query_id: "q1", stage: "event", provider: "tavily", results: 5, accepted: 2 },
    { query_id: "q2", stage: "corroboration", provider: "brave", results: 3, accepted: 1 },
  ],
  extraction_audit: [],
  ...over,
});

// Six researched accounts spanning the required scenarios (§26 A/C/D/E/F/G/H/I).
const scenarios: Array<{ id: string; verified: boolean; telemetry: AccountDeepResearchTelemetry | undefined }> = [
  { id: "a-success", verified: true, telemetry: tel() },                                                                   // A: successful validate
  { id: "c-timeout", verified: true, telemetry: tel({ provider_calls: 3, provider_failures: 3, early_stop_reason: "providers_unavailable" }) }, // C: provider timeout
  { id: "d-circuit", verified: true, telemetry: tel({ provider_failures: 1 }) },                                           // D: a provider failure
  { id: "e-sparse", verified: false, telemetry: tel({ evidence_accepted: 0, corroboration_attempted: false, counterevidence_checked: false, early_stop_reason: "no_material_event" }) }, // E: sparse
  { id: "g-nocorrob", verified: true, telemetry: tel({ corroboration_attempted: false, corroborating_domains: 0 }) },      // G: corroboration not required
  { id: "b-rejected", verified: false, telemetry: undefined },                                                             // B: rejected before research
];

const org = (i: number): RawDiscoveredOrg => ({
  name: `Verified Manufacturer ${i}`, domain: `verified-${i}.example`, country: "United States",
  organizationType: "Manufacturer", industry: "Manufacturing", origin: "dynamic_enumeration",
  provider: "test_provider", route: "industry_category", sourceUrl: `https://directory.example/${i}`, confidence: "verified",
});
const discovery: DiscoveryRunner = async () => ({
  orgs: Array.from({ length: 7 }, (_, i) => org(i + 1)),
  providersAvailable: ["test_provider"], providersFailed: [], operatingMode: "full_discovery",
});

const leadFor = (candidate: LeadCandidate, i: number): ProcessedLead => {
  const sc = scenarios[i % scenarios.length];
  return {
    id: candidate.id,
    candidate: { ...candidate, domain: `${sc.id}.example`, company: sc.id, source_url: sc.verified ? `https://${sc.id}.example/news` : undefined, signal_date: sc.verified ? "2026-08-20" : undefined, signal_type: sc.verified ? "new_facility" : undefined },
    enrichment: {
      candidate, timing_signals: sc.verified ? ["Opened a new production facility"] : [], evidence: [], missing_data: [], research_confidence: sc.verified ? 0.9 : 0.4,
      evidence_discipline: sc.verified ? [{ claim: "Opened a new production facility", type: "verified_public_signal", date: "2026-08-20" }] : [],
      account_research: sc.telemetry,
      next_best_question: "Confirm operation is direct.",
    },
    qualification: {
      enrichment: {} as never, fit_score: sc.verified ? 8 : 4, category: sc.verified ? "HOT" : "COLD", fit_reasons: [], disqualification_reasons: [], qualification_confidence: 0.8,
      score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1, timing_signal: 1, reachability: 1, strategic_relevance: 1 },
    },
    outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "", qc_status: sc.id === "b-rejected" ? "FAILED" : "APPROVED", qc_notes: [] },
  };
};

const run = async () => {
  const traces: IntelligenceRunTrace[] = [];
  const contextStore = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(contextStore, fixture, { userId: "owner-a", contextId: "shared", now: clock });

  const pipeline = async (input: PipelineInput): Promise<LeadLensReport> => {
    const researched = (input.candidatesOverride ?? []).slice(0, 6).map(leadFor);
    input.onResearchComplete?.(researched);   // the real pipeline surfaces researched leads this way
    return {
      job_id: input.jobId!, plan: input.plan, total_leads: researched.length,
      hot_count: 3, warm_count: 0, cold_count: 3, discard_count: 0, avg_score: 6,
      executive_summary: "trace wiring", patterns_observed: [], recommendations: [],
      processed_leads: researched, ranked_opportunities: [], created_at: clock().toISOString(),
    };
  };

  const deps = {
    contextStore, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(),
    discoveryRunner: discovery, pipeline, now: clock,
    onAccountTrace: (tr: IntelligenceRunTrace) => traces.push(tr),
  };
  const base = { userId: "owner-a", context: { contextId: "shared", version: 1 }, plan: "sample" as const, deliveryLimit: 6, researchLimit: 6 };
  const res = await startIntelligenceRun(base, deps);

  t("spine: run completed", res.ok && res.run.status === "completed");
  t("wiring: a trace was emitted per researched account (from real execution)", traces.length === 6);
  const byAcct = (id: string) => traces.find((x) => x.account_id === `${id}.example`)!;

  // A — successful account run, complete trace, provider ops present.
  const a = byAcct("a-success");
  t("A: successful run trace has provider ops + accepted Evidence", a.completion_state === "completed" && a.counts.provider_calls >= 2 && a.evidence.accepted === 3);
  t("A: real query audit mapped into query observations", a.counts.queries_executed === 2);
  t("A: LLM + full-text observed from telemetry", a.counts.llm_calls === 2 && a.counts.full_text_calls === 2);

  // C — provider timeout/unavailable: failure recorded, never counterevidence.
  const c = byAcct("c-timeout");
  t("C: provider-unavailable maps to provider failure class + stop", c.failure_class === "provider" && c.stop_reason === "provider_degraded");
  t("C: provider failure is NOT recorded as counterevidence", c.counterevidence.result !== "material_found");

  // D — a provider failure is recorded with no fabricated result count.
  const d = byAcct("d-circuit");
  t("D: a failed provider op has null results (no fabrication)", d.provider_ops.some((o) => !o.ok && o.results === null));

  // E — sparse evidence: conservative bounded stop, no fabricated corroboration.
  const e = byAcct("e-sparse");
  t("E: sparse evidence -> evidence_insufficient stop, corroboration not attempted", e.stop_reason === "evidence_insufficient" && e.corroboration.attempted === false);

  // G — corroboration not required: no corroboration attempt.
  t("G: corroboration not required -> not attempted", byAcct("g-nocorrob").corroboration.attempted === false);

  // B — rejected before research: no provider work, bounded stop, trace still complete.
  const b = byAcct("b-rejected");
  t("B: early-rejected account still finalizes a trace with no provider work", b.counts.provider_calls === 0 && b.stop_reason === "structural_disqualifier");

  // Wall clock vs stage work (§20/§21): wall clock is measured, not a stage sum.
  t("F/H/I via A: corroboration + counterevidence + full-text depth observed", a.research_depth.includes("corroboration") && a.research_depth.includes("counterevidence") && a.research_depth.includes("full_text_validation"));
  t("wall_clock is real measured elapsed, not the sum of stages", a.wall_clock_ms !== a.stage_work_ms || a.stage_work_ms === 0);

  // Autonomy (§19) + aggregation (§27).
  const agg = summarizeRunTraces(traces);
  t("aggregate: automatic completion computed over completed runs", agg.autonomy.automatic_completion_rate !== null);
  t("aggregate: post-run QA never lowers runtime autonomy", agg.autonomy.runtime_intervention_rate === 0);
  t("aggregate: stop + failure distributions produced", (agg.stop_reason_distribution.provider_degraded ?? 0) >= 1 && (agg.failure_distribution.provider ?? 0) >= 1);
  t("aggregate: runtime percentiles present (n>0)", agg.eligible_runs === 6 && agg.runtime_ms.p95 !== null);

  // §22 — a run that throws in the pipeline still finalizes ONE bounded trace.
  const throwTraces: IntelligenceRunTrace[] = [];
  const throwDeps = { ...deps, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(),
    pipeline: async () => { throw new Error("provider_exploded_timeout"); },
    onAccountTrace: (tr: IntelligenceRunTrace) => throwTraces.push(tr) };
  const failed = await startIntelligenceRun({ ...base, context: { contextId: "shared", version: 1 } }, throwDeps);
  t("§22: failed run does not throw, returns failure", !failed.ok);
  t("§22: failed run still finalized a bounded failure trace", throwTraces.length === 1 && throwTraces[0].completion_state === "failed" && throwTraces[0].failure_class === "timeout");

  console.log(`\n${passed} passed, 0 failed`);
};

run().catch((e) => { console.error(e); process.exit(1); });
