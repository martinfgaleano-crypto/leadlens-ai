import { issueConfirmationToken, verifyConfirmationToken } from "@/lib/interpretation/confirmation-token";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { ADV_INVESTORS } from "@/lib/interpretation/fixtures/adversarial";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { InMemoryLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import type { DiscoveryRunner, RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { InMemoryIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { intelligenceRunId, startIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import type { LeadCandidate, LeadLensReport, PipelineInput, ProcessedLead } from "@/types";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const clock = () => new Date("2026-08-26T12:00:00.000Z");
process.env.CONFIRMATION_TOKEN_SECRET = "test-only-confirmation-secret-32-characters";

const fixture = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
const signed = issueConfirmationToken("owner-a", fixture, clock().getTime());
t("confirmation: authenticated Stage-A draft receives an opaque token", Boolean(signed));
t("confirmation: token is owner-bound", Boolean(signed && verifyConfirmationToken(signed, "owner-a", clock().getTime())) && verifyConfirmationToken(signed!, "owner-b", clock().getTime()) === null);
const tampered = signed ? `${signed.slice(0, -2)}xx` : "";
t("confirmation: browser tampering is rejected", verifyConfirmationToken(tampered, "owner-a", clock().getTime()) === null);
const confirmRoute = readFileSync("app/api/customer/contexts/confirm/route.ts", "utf8");
const runRoute = readFileSync("app/api/customer/intelligence-runs/route.ts", "utf8");
const oldDiscoveryRoute = readFileSync("app/api/customer/discovery/route.ts", "utf8");
t("route: confirmation requires auth and calls the canonical persistence gate", /auth\.getUser/.test(confirmRoute) && /persistConfirmedContext/.test(confirmRoute));
t("route: confirmation accepts a signed token, not browser Evidence/Fit/Decision", /confirmation_token/.test(confirmRoute) && !/\bevidence\s*:|\bfit\s*:|\bdecision\s*:/.test(confirmRoute));
t("route: run accepts context references and no candidate list", /context_id/.test(runRoute) && /version/.test(runRoute) && !/candidates\s*:/.test(runRoute));
t("route: legacy customer discovery converges on the productive spine", /startProductiveIntelligenceRun/.test(oldDiscoveryRoute) && !/runLeadLensPipeline/.test(oldDiscoveryRoute));

const run = async () => {
const contextStore = new InMemoryConfirmedContextStore();
const confirmed = await persistConfirmedContext(contextStore, fixture, { userId: "owner-a", contextId: "shared", now: clock });
t("confirmation: explicit action persists immutable Context V1", confirmed.ok && confirmed.created && confirmed.record.version === 1);
const unsupported = await persistConfirmedContext(contextStore, ADV_INVESTORS, { userId: "owner-a", contextId: "bad", now: clock });
t("confirmation: unsupported objective cannot persist", !unsupported.ok);

const org = (i: number): RawDiscoveredOrg => ({
  name: `Verified Manufacturer ${i}`, domain: `verified-${i}.example`, country: "United States",
  organizationType: "Manufacturer", industry: "Manufacturing", origin: "dynamic_enumeration",
  provider: "test_provider", route: "industry_category", sourceUrl: `https://directory.example/${i}`, confidence: "verified",
});
const discovery: DiscoveryRunner = async () => ({
  orgs: [...Array.from({ length: 7 }, (_, i) => org(i + 1)), {
    name: "Ambiguous", origin: "dynamic_enumeration", provider: "test_provider",
    route: "industry_category", confidence: "plausible",
  }],
  providersAvailable: ["test_provider"], providersFailed: [], operatingMode: "full_discovery",
});

let pipelineCalls = 0;
let researchedInput = 0;
let provenanceContaminatedEvidence = false;
const processed = (candidate: LeadCandidate, i: number): ProcessedLead => ({
  id: candidate.id,
  candidate: { ...candidate, source_url: `https://${candidate.domain}/news/event`, signal_date: "2026-08-20", signal_type: "new_facility" },
  enrichment: {
    candidate, timing_signals: ["Opened a new production facility"], evidence: ["Corporate newsroom independently recovered by Research"], missing_data: [], research_confidence: 0.9,
    evidence_discipline: [{ claim: "Opened a new production facility", type: "verified_public_signal", date: "2026-08-20" }],
    next_best_question: i === 0 ? undefined : "Confirm whether the new facility is operated directly.",
  },
  qualification: {
    enrichment: {} as never, fit_score: 8 - i, category: i === 0 ? "HOT" : "WARM", fit_reasons: ["Manufacturing operation matches the confirmed context"],
    disqualification_reasons: [], qualification_confidence: 0.85,
    score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1.5, timing_signal: 1.5, reachability: 0.5, strategic_relevance: 0.5 },
  },
  outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "", qc_status: "APPROVED", qc_notes: [] },
});

const pipeline = async (input: PipelineInput): Promise<LeadLensReport> => {
  pipelineCalls++;
  researchedInput = Math.min(input.candidatesOverride?.length ?? 0, input.researchCandidateLimit ?? 0);
  provenanceContaminatedEvidence = (input.candidatesOverride ?? []).some((c) => Boolean(c.source_url));
  const researched = (input.candidatesOverride ?? []).slice(0, researchedInput).map(processed);
  const delivered = researched.slice(0, input.deliveryLimit ?? researched.length);
  return {
    job_id: input.jobId!, plan: input.plan, total_leads: delivered.length,
    hot_count: 1, warm_count: Math.max(0, delivered.length - 1), cold_count: 0, discard_count: 0, avg_score: 7.5,
    executive_summary: "Deterministic integration acceptance", patterns_observed: [], recommendations: [],
    processed_leads: delivered, created_at: clock().toISOString(),
    ranked_opportunities: delivered.map((lead, i) => ({ lead_id: lead.id, company: lead.candidate.company, rank: i + 1, fit_score: lead.qualification.fit_score, category: lead.qualification.category, top_priority_reason: "Validated event", ranking_explanation: "Bounded deterministic test", opportunity_tier_reason: "Evidence", recommended_action: "validate_source_first" })),
    report_intelligence: { companies_considered: input.candidatesOverride?.length ?? 0, companies_selected: delivered.length, companies_rejected: researched.length - delivered.length, rejection_reasons: {} },
  };
};

const leadHunterStore = new InMemoryLeadHunterRunStore();
const runStore = new InMemoryIntelligenceRunStore();
const base = { userId: "owner-a", context: { contextId: "shared", version: 1 }, plan: "sample" as const, deliveryLimit: 2, researchLimit: 6 };
const first = await startIntelligenceRun(base, { contextStore, leadHunterStore, runStore, discoveryRunner: discovery, pipeline, now: clock });
t("spine: confirmed reference creates a durable completed run", first.ok && first.run.status === "completed");
t("spine: Lead Hunter universe persisted and linked", first.ok && Boolean(first.run.leadHunterRunId) && Boolean(await leadHunterStore.load(first.run.leadHunterRunId!, "owner-a")));
t("spine: Research receives persisted eligible subset, ambiguous candidate held", researchedInput === 6 && first.ok && first.run.report?.report_intelligence?.companies_considered === 7);
t("spine: research breadth exceeds delivery count", researchedInput === 6 && first.ok && first.run.report?.processed_leads.length === 2);
t("spine: discovery provenance is not passed as source Evidence", provenanceContaminatedEvidence === false);
t("spine: full canonical synthesis produces customer Case decisions", first.ok && first.run.report?.canonical_cases?.length === 2 && first.run.report.canonical_cases.every((c) => c.first_review));
t("spine: first review has no predecessor semantics", Boolean(first.ok && first.run.report?.canonical_cases?.every((c) => c.first_review === true)));
const customerReport = first.ok && first.run.report ? assembleInstitutionalReport(first.run.report as never, { job_id: first.run.runId, plan: first.run.plan, search_id: null, customer_ref: null, created_at: first.run.createdAt }) : null;
const expectedAction = first.ok ? ({ prioritize: "act_now", validate: "validate_first", monitor: "monitor", hold: "exclude" } as const)[first.run.report?.canonical_cases?.[0]?.decision ?? "hold"] : null;
t("report: customer dossier consumes canonical Case decision", Boolean(customerReport && customerReport.account_dossiers[0]?.actionability_status === expectedAction));

const retry = await startIntelligenceRun(base, { contextStore, leadHunterStore, runStore, discoveryRunner: discovery, pipeline, now: clock });
t("retry: completed run reloads without Research rerun", retry.ok && retry.reused && pipelineCalls === 1);
t("durability: owner can reload completed report", first.ok && (await runStore.load(first.run.runId, "owner-a"))?.report?.job_id === first.run.runId);
t("security: wrong owner cannot reload run", first.ok && await runStore.load(first.run.runId, "owner-b") === null);

const ownerBStore = new InMemoryConfirmedContextStore();
await persistConfirmedContext(ownerBStore, fixture, { userId: "owner-b", contextId: "shared", now: clock });
const idA = intelligenceRunId(base);
const idB = intelligenceRunId({ ...base, userId: "owner-b" });
t("tenant collision: same context/version/date yields different global run ids", idA !== idB);
const [ca, cb] = await Promise.all([
  startIntelligenceRun({ ...base, idempotencyKey: "parallel" }, { contextStore, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(), discoveryRunner: discovery, pipeline, now: clock }),
  startIntelligenceRun({ ...base, userId: "owner-b", idempotencyKey: "parallel" }, { contextStore: ownerBStore, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(), discoveryRunner: discovery, pipeline, now: clock }),
]);
t("concurrency: two tenant runs complete without shared mutable state", ca.ok && cb.ok && ca.run.runId !== cb.run.runId && ca.run.leadHunterRunId !== cb.run.leadHunterRunId);

const retryRuns = new InMemoryIntelligenceRunStore();
const retryUniverses = new InMemoryLeadHunterRunStore();
let failOnce = true;
const partialFailurePipeline = async (input: PipelineInput) => {
  if (failOnce) { failOnce = false; throw new Error("research_transient_failure"); }
  return pipeline(input);
};
const retryInput = { ...base, idempotencyKey: "partial-failure" };
const partial = await startIntelligenceRun(retryInput, { contextStore, leadHunterStore: retryUniverses, runStore: retryRuns, discoveryRunner: discovery, pipeline: partialFailurePipeline, now: clock });
const failedRecord = await retryRuns.load(intelligenceRunId(retryInput), "owner-a");
const recovered = await startIntelligenceRun(retryInput, { contextStore, leadHunterStore: retryUniverses, runStore: retryRuns, discoveryRunner: discovery, pipeline: partialFailurePipeline, now: clock });
t("failure: Research failure leaves durable failed state and retained universe", !partial.ok && failedRecord?.status === "failed" && Boolean(failedRecord.leadHunterRunId));
t("partial retry: retained universe is reused and one completed report is produced", recovered.ok && recovered.run.status === "completed" && recovered.run.leadHunterRunId === failedRecord?.leadHunterRunId && recovered.run.attempt === 2);

const v2 = structuredClone(fixture);
(v2.commercialObjective as { description: string }).description += " Updated.";
await persistConfirmedContext(contextStore, v2, { userId: "owner-a", contextId: "shared", now: clock });
t("lineage: V1 durable run remains attached to V1 after V2", first.ok && (await runStore.load(first.run.runId, "owner-a"))?.contextRef.version === 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
};
run().catch((error) => { console.error(error); process.exit(1); });
