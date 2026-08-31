import { strict as assert } from "node:assert";
import { confirmInterpretation } from "@/lib/interpretation/confirmed-commercial-context";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { hunt, planDiscovery, type RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { orderResearchCandidatesForBudget, toResearchCandidates } from "@/lib/lead-hunter/hunt-and-persist";
import { deepenAccountResearch } from "@/lib/intelligence/account-deep-research";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import type { LeadSearchCriteria } from "@/types";
import { runDiscoveryLanes } from "@/lib/lead-hunter/discovery-runner";
import { intelligenceRunMetadata } from "@/lib/intelligence/productive-spine-store";

let passed = 0;
const test = (name: string, ok: boolean) => { assert.equal(ok, true, name); passed++; console.log(`ok - ${name}`); };
const now = "2026-08-30T12:00:00.000Z";
const confirmed = confirmInterpretation(GOLDEN_FIXTURES.software_manufacturing, { contextId: "event-parity" });
if (!confirmed.ok) throw new Error(confirmed.reason);
const plan = planDiscovery(confirmed.context);
const eventHint = {
  eventTypeHint: "facility",
  eventDateHint: "2026-08-10",
  sourceUrlHint: "https://mapei.com/co/news/new-plant",
  headline: "Mapei opens a new manufacturing plant in Colombia",
  sourceExcerpt: "The company opened the plant in August 2026.",
  provider: "fixture",
};
const org = (input: Partial<RawDiscoveredOrg> & { name: string }): RawDiscoveredOrg => ({
  origin: "dynamic_enumeration", provider: "fixture", route: "industry_category", confidence: "verified", ...input,
});

async function main() {
  const laneOrder: string[] = [];
  const lanes = await runDiscoveryLanes(
    async () => { laneOrder.push("event:start"); await Promise.resolve(); laneOrder.push("event:end"); return "event"; },
    async () => { laneOrder.push("account:start"); await Promise.resolve(); laneOrder.push("account:end"); return "account"; },
  );
  test("productive discovery completes Event-First before Account-First", laneOrder.join(",") === "event:start,event:end,account:start,account:end" && lanes.eventResult === "event" && lanes.accountResult === "account");

  const universe = await hunt(plan, async () => ({
    orgs: [
      org({ name: "Mapei Colombia", domain: "mapei.com", country: "Colombia", organizationType: "manufacturer" }),
      org({ name: "Mapei", domain: "mapei.com", country: "Colombia", organizationType: "manufacturer", origin: "event_first", route: "event_first:facility", sourceUrl: eventHint.sourceUrlHint, researchHint: eventHint }),
      org({ name: "Structural One", domain: "structural-one.com", country: "Colombia", organizationType: "manufacturer" }),
      org({ name: "Structural Two", domain: "structural-two.com", country: "Colombia", organizationType: "manufacturer" }),
      org({ name: "Structural Three", domain: "structural-three.com", country: "Colombia", organizationType: "manufacturer" }),
    ],
    providersAvailable: ["fixture"], providersFailed: [], operatingMode: "full_discovery",
  }), { now: () => new Date(now) });
  const mapei = universe.candidates.find((c) => c.identity.domain === "mapei.com")!;
  test("same-domain Account-First + Event-First merges once", universe.candidates.filter((c) => c.identity.domain === "mapei.com").length === 1);
  test("merged candidate preserves union provenance", mapei.provenance.some((p) => p.origin === "event_first") && mapei.provenance.some((p) => p.origin === "dynamic_enumeration"));
  test("merged candidate preserves the research hint", mapei.researchHints?.[0]?.sourceUrlHint === eventHint.sourceUrlHint);
  test("merged candidate records BOTH origins without treating them as corroboration", mapei.originFlags?.includes("BOTH") === true);

  const research = toResearchCandidates(universe);
  test("event-led candidate is selected within a cap of three", research.slice(0, 3).some((c) => c.domain === "mapei.com"));
  const balanced = orderResearchCandidatesForBudget([
    ...research.filter((c) => c.domain === "mapei.com"),
    { ...research.find((c) => c.domain === "mapei.com")!, id: "event-two", company: "Event Two", domain: "event-two.com" },
    { ...research.find((c) => c.domain === "mapei.com")!, id: "event-three", company: "Event Three", domain: "event-three.com" },
    ...research.filter((c) => c.domain !== "mapei.com"),
  ], 3);
  test("cap=3 balances two event-led candidates with one structural candidate", balanced.slice(0, 3).filter((c) => (c.research_hints?.length ?? 0) > 0).length === 2 && balanced.slice(0, 3).some((c) => !c.research_hints?.length));
  const mapped = research.find((c) => c.domain === "mapei.com")!;
  test("handoff retains hint but does not leak it into source_url Evidence", mapped.research_hints?.[0]?.source_url_hint === eventHint.sourceUrlHint && mapped.source_url === undefined);

  const reused = await hunt(plan, async () => ({ orgs: [], providersAvailable: [], providersFailed: ["fixture"], operatingMode: "stopped" }), {
    now: () => new Date("2026-08-31T12:00:00.000Z"), previousUniverse: universe,
  });
  const reusedResearch = toResearchCandidates(reused);
  test("Context Memory keeps Event-First priority and hint", reusedResearch[0]?.domain === "mapei.com" && reusedResearch[0]?.research_hints?.length === 1);

  const emptyProvider: SearchProvider = {
    id: "fixture", capabilities: () => ({ search: true, extract: false, regions: "global", supports_dates: true }),
    health: async () => ({ provider: "fixture", status: "available", reason: null, credentials_present: true }),
    search: async (query) => ({ ok: true, provider: "fixture", query, results: [], latency_ms: 1, cost_estimate_usd: 0, error: null }),
  };
  const criteria: LeadSearchCriteria = {
    offer_summary: "industrial automation software", value_proposition: "automate plant operations",
    target_industries: ["manufacturing"], target_company_size: ["mid-market"], target_job_titles: [],
    target_geography: ["Colombia"], excluded_industries: [], buying_signals: ["new plant"],
    disqualification_criteria: [], tone: "consultative", plan: "sample", lead_count: 2, output_language: "en",
  };
  const deep = await deepenAccountResearch(mapped, criteria, {
    providers: [emptyProvider], now: () => new Date(now), maxQueries: 4, maxExtractions: 2,
    extract: async () => ({ ok: true, content: "Mapei opened a new manufacturing plant in Colombia on August 10, 2026, adding production capacity." }),
  });
  test("Deep Research fetches the hinted source before generic search", deep.telemetry.event_hints_received === 1 && deep.telemetry.event_hints_fetched === 1);
  test("hint becomes a canonical event only after fresh fetch and validation", deep.telemetry.event_hints_validated === 1 && deep.validated_events[0]?.stage === "event_hint" && deep.eventDate === "2026-08-10");
  test("counterevidence remains mandatory after fast-path validation", deep.telemetry.counterevidence_checked);

  const originConversion = { event_first_candidates: 1, event_first_selected: 1, event_first_researched: 1, event_first_cases: 1 };
  const durableMetadata = intelligenceRunMetadata({
    runId: "event-origin-durability", contextRef: "context", status: "completed", stage: "report",
    failureCode: null, attempt: 1, createdAt: now, updatedAt: now, deliveryLimit: 2, researchLimit: 3,
    report: { _intelligence_run: { commercialOutcome: "natural_validate", originConversion } } as never,
  } as never);
  test("durable run metadata preserves Event-First origin conversion", JSON.stringify(durableMetadata.originConversion) === JSON.stringify(originConversion));

  console.log(`\n${passed} passed, 0 failed`);
}
main().catch((error) => { console.error(error); process.exit(1); });
