// Runtime-observability artifact FROM real Productive Spine execution (§35).
// Runs the ACTUAL startIntelligenceRun orchestration with controlled doubles (no live
// providers), collects the traces the spine emits, and writes a CONTROLLED artifact.
// The traces are NOT hand-crafted — they are produced by the real spine execution path.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/build-spine-runtime-artifact.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { InMemoryLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import type { DiscoveryRunner, RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { InMemoryIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { startIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { summarizeRunTraces, runtimeControlPlaneContract } from "@/lib/intelligence/run-trace-artifact";
import type { AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";
import type { IntelligenceRunTrace } from "@/lib/intelligence/run-trace";
import type { LeadCandidate, LeadLensReport, PipelineInput, ProcessedLead } from "@/types";

const clock = () => new Date("2026-08-26T12:00:00.000Z");
process.env.CONFIRMATION_TOKEN_SECRET = "test-only-confirmation-secret-32-characters";
const fixture = structuredClone(GOLDEN_FIXTURES.software_manufacturing);

const tel = (over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry => ({
  version: "account-deep-research-v1", account: "acct", domain: "acct.example",
  planned_queries: 6, executed_queries: 4, provider_calls: 4, provider_failures: 0, results_seen: 20,
  evidence_accepted: 3, evidence_rejected: 2, pages_extracted: 2, extraction_failures: 0, structured_extraction_calls: 2,
  dated_evidence: 2, independent_domains: 2, corroboration_attempted: true, corroborating_domains: 2, claims_recovered: 2,
  counterevidence_checked: true, early_stop_reason: "sufficient_evidence",
  query_audit: [{ query_id: "q1", stage: "event", provider: "tavily", results: 5, accepted: 2 }], extraction_audit: [],
  ...over,
});
const scenarios = [
  tel(), tel({ provider_calls: 3, provider_failures: 3, early_stop_reason: "providers_unavailable" }),
  tel({ evidence_accepted: 0, corroboration_attempted: false, counterevidence_checked: false, early_stop_reason: "no_material_event" }),
  tel({ pages_extracted: 4, structured_extraction_calls: 3 }),
];

const org = (i: number): RawDiscoveredOrg => ({ name: `Manufacturer ${i}`, domain: `verified-${i}.example`, country: "United States", organizationType: "Manufacturer", industry: "Manufacturing", origin: "dynamic_enumeration", provider: "test_provider", route: "industry_category", sourceUrl: `https://directory.example/${i}`, confidence: "verified" });
const discovery: DiscoveryRunner = async () => ({ orgs: Array.from({ length: 5 }, (_, i) => org(i + 1)), providersAvailable: ["test_provider"], providersFailed: [], operatingMode: "full_discovery" });
const leadFor = (candidate: LeadCandidate, i: number): ProcessedLead => ({
  id: candidate.id,
  candidate: { ...candidate, domain: `acct-${i}.example`, company: `acct-${i}`, source_url: `https://acct-${i}.example/news`, signal_date: "2026-08-20", signal_type: "new_facility" },
  enrichment: { candidate, timing_signals: ["Opened a new production facility"], evidence: [], missing_data: [], research_confidence: 0.9, evidence_discipline: [{ claim: "Opened a new production facility", type: "verified_public_signal", date: "2026-08-20" }], account_research: scenarios[i % scenarios.length], next_best_question: "Confirm operation is direct." },
  qualification: { enrichment: {} as never, fit_score: 8, category: "HOT", fit_reasons: [], disqualification_reasons: [], qualification_confidence: 0.85, score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1, timing_signal: 1, reachability: 1, strategic_relevance: 1 } },
  outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "", qc_status: "APPROVED", qc_notes: [] },
});

const main = async () => {
  const traces: IntelligenceRunTrace[] = [];
  const contextStore = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(contextStore, fixture, { userId: "owner-a", contextId: "shared", now: clock });
  const pipeline = async (input: PipelineInput): Promise<LeadLensReport> => {
    const researched = (input.candidatesOverride ?? []).slice(0, 5).map(leadFor);
    input.onResearchComplete?.(researched);
    return { job_id: input.jobId!, plan: input.plan, total_leads: researched.length, hot_count: researched.length, warm_count: 0, cold_count: 0, discard_count: 0, avg_score: 7, executive_summary: "spine runtime artifact", patterns_observed: [], recommendations: [], processed_leads: researched, ranked_opportunities: [], created_at: clock().toISOString() };
  };
  await startIntelligenceRun(
    { userId: "owner-a", context: { contextId: "shared", version: 1 }, plan: "sample", deliveryLimit: 5, researchLimit: 5 },
    { contextStore, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(), discoveryRunner: discovery, pipeline, now: clock, onAccountTrace: (tr) => traces.push(tr) },
  );

  const summary = summarizeRunTraces(traces);
  const contract = runtimeControlPlaneContract(summary);
  const outDir = join(process.cwd(), "ml/data/acceptance");
  mkdirSync(outDir, { recursive: true });
  const outputPath = join(outDir, "runtime-observability-spine-controlled-v1.json");
  writeFileSync(outputPath, `${JSON.stringify({ generated_from: "real_productive_spine_execution", provenance: "controlled", summary, control_plane_contract: contract }, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, traces_from_real_spine: traces.length, provenance: summary.provenance, sample_fingerprint: summary.sample_fingerprint, runtime_ms: summary.runtime_ms, per_run: summary.per_run, autonomy: summary.autonomy, stop_reason_distribution: summary.stop_reason_distribution, failure_distribution: summary.failure_distribution, cost: summary.cost }, null, 2));
};
main().catch((e) => { console.error(e); process.exit(1); });
