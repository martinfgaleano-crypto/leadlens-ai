import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { InMemoryLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { InMemoryIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { enqueueIntelligenceRun, executeIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { assessResearchReadiness, prioritizeResearch } from "@/lib/lead-hunter/research-readiness";
import type { CandidateAccount, DiscoveryPlan } from "@/lib/lead-hunter/candidate-universe";
import type { LeadLensReport, PipelineInput } from "@/types";
import { filterAccountResearchResults } from "@/lib/providers/tavily-lead-provider";
import { matchVerticalPack } from "@/lib/discovery/vertical-packs";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok - ${name}`); };
const context = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
const plan: DiscoveryPlan = {
  contextRef: { contextId: "ctx", version: 1 }, objectiveType: "find_accounts", targetRelationship: "buyer",
  organizationTypes: ["manufacturers", "distributors"], industries: ["manufacturing"], geographies: ["United States"],
  routes: [], exclusions: [], namedAccountSeeds: [], watchSignalFamilies: [],
  budget: { maxRoutes: 1, maxProviderCalls: 1, maxCandidatesPerRoute: 5, maxExtractions: 1, maxRetries: 0, timeoutMs: 1000 }, planGaps: [],
};
const candidate = (name: string, type: string, domain?: string): CandidateAccount => ({
  identity: { canonicalName: name, domain, country: "United States", organizationType: type, confidence: domain ? "verified" : "plausible" },
  status: domain ? "eligible" : "likely_eligible", statusReason: "fixture", provenance: [], opportunityConditionIds: [], watchSignalFamilies: [], openQualificationQuestions: [],
});

t("manufacturer is research-ready for confirmed manufacturing context", () => assert.equal(assessResearchReadiness(candidate("Acme", "Industrial manufacturer", "acme.example"), plan).status, "research_ready"));
t("retailer does not silently broaden manufacturer/distributor scope", () => assert.equal(assessResearchReadiness(candidate("Sprouts", "Grocery retailer", "sprouts.example"), plan).status, "wrong_target_type"));
t("vertical-seed provenance cannot bypass an explicit target-family mismatch", () => {
  const retailer = candidate("Sprouts", "Grocery retailer", "sprouts.example");
  retailer.provenance = [{ route: "fixture", origin: "vertical_seed", discoveredName: "Sprouts", discoveredAt: new Date(0).toISOString() }];
  assert.equal(assessResearchReadiness(retailer, plan).status, "wrong_target_type");
});
t("domainless organization requires identity validation before expensive Research", () => assert.equal(assessResearchReadiness(candidate("ALAC", "Manufacturer"), plan).status, "needs_identity_validation"));
t("priority handoff contains only inspectable research-ready candidates", () => assert.deepEqual(prioritizeResearch([candidate("Sprouts", "Retailer", "sprouts.example"), candidate("Acme", "Manufacturer", "acme.example")], plan).map(x => x.identity.canonicalName), ["Acme"]));
t("Research refuses social/reference pages and other-company results before LLM spend", () => assert.deepEqual(filterAccountResearchResults("Cementos Argos", [
  { title: "Cementos Argos update", url: "https://instagram.com/p/x", content: "Cementos Argos", score: 1 },
  { title: "Other company", url: "https://news.example/other", content: "Unrelated event", score: 1 },
  { title: "Cementos Argos expands", url: "https://news.example/argos", content: "Cementos Argos expanded capacity", score: 1 },
]).map(x => x.url), ["https://news.example/argos"]));
t("Research rejects a generic professional-services article for First Professional Services", () => assert.equal(filterAccountResearchResults("First Professional Services LLC", [
  { title: "The professional services ownership dilemma", url: "https://example.com/article", content: "Grant Thornton and other firms completed transactions.", score: 1 },
]).length, 0));
t("US manufacturing cannot select Colombia packs or generic beverage wellness", () => assert.equal(matchVerticalPack({
  target_industries: ["Industrial manufacturing", "Food and beverage production"], disqualifiers: [],
} as any, {
  target_geography: ["United States"], offer_summary: "industrial automation and plant operations software", value_proposition: "modernize production capacity",
} as any), null));

const run = async () => {
  const contexts = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(contexts, context, { userId: "owner", contextId: "ctx" });
  const runs = new InMemoryIntelligenceRunStore();
  const universes = new InMemoryLeadHunterRunStore();
  let pipelineCalls = 0;
  const input = { userId: "owner", context: { contextId: "ctx", version: 1 }, plan: "sample" as const, deliveryLimit: 2, researchLimit: 4, idempotencyKey: "bounded" };
  const queued = await enqueueIntelligenceRun(input, { contextStore: contexts, runStore: runs });
  t("start persists queued stage without executing Research", () => assert(queued.ok && queued.run.status === "processing" && queued.run.stage === "queued" && pipelineCalls === 0));
  const duplicate = await enqueueIntelligenceRun(input, { contextStore: contexts, runStore: runs });
  t("duplicate start reuses durable run", () => assert(duplicate.ok && duplicate.reused && duplicate.run.runId === (queued.ok && queued.run.runId)));
  if (!queued.ok) throw new Error("queue failed");
  const report: LeadLensReport = { job_id: queued.run.runId, plan: "sample", total_leads: 0, hot_count: 0, warm_count: 0, cold_count: 0, discard_count: 0, avg_score: 0, executive_summary: "No strong opportunity", patterns_observed: [], recommendations: [], processed_leads: [], ranked_opportunities: [], created_at: new Date().toISOString() };
  const executed = await executeIntelligenceRun(queued.run.runId, "owner", {
    contextStore: contexts, runStore: runs, leadHunterStore: universes,
    discoveryRunner: async () => ({ orgs: [{ name: "Acme", domain: "acme.example", country: "United States", organizationType: "Manufacturer", industry: "Manufacturing", origin: "fixture", provider: "fixture", route: "industry_category", confidence: "verified" }], providersAvailable: ["fixture"], providersFailed: [], operatingMode: "full_discovery" }),
    pipeline: async (_input: PipelineInput) => { pipelineCalls++; return report; },
  });
  t("background execution persists completed-no-strong-opportunity result", () => assert(executed.ok && executed.run.status === "completed" && executed.run.report?.processed_leads.length === 0));
  t("execution ran exactly once", () => assert.equal(pipelineCalls, 1));
  const second = await executeIntelligenceRun(queued.run.runId, "owner", { contextStore: contexts, runStore: runs, leadHunterStore: universes, discoveryRunner: async () => { throw new Error("must not run"); }, pipeline: async () => { throw new Error("must not run"); } });
  t("completed retry does not duplicate expensive execution", () => assert(second.ok && second.reused && pipelineCalls === 1));

  const route = readFileSync("app/api/customer/intelligence-runs/route.ts", "utf8");
  const discovery = readFileSync("lib/discovery/company-first-discovery.ts", "utf8");
  t("customer POST enqueues and returns 202 instead of awaiting full spine", () => assert(/enqueueIntelligenceRun/.test(route) && /status: result\.reused \? 200 : 202/.test(route)));
  t("provider fan-out is sequential and budget-authoritative", () => assert(!/Promise\.all\(\[\s*braveProvider\.search/.test(discovery) && /maxProviderCallsPerCompany/.test(discovery) && /provider_cooldowns/.test(discovery)));
  console.log(`\n${n} passed`);
};
run().catch(error => { console.error(error); process.exit(1); });
