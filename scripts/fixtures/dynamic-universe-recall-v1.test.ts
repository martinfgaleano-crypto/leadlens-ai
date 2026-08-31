import { enumerationRouteQueries, companyNameGroundedInPages, isMediaOrDirectoryName, inferEnumeratedCountry, inferEnumeratedDomain } from "@/lib/discovery/company-universe";
import { planDiscovery, hunt, type DiscoveryRunner, type RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { criteriaFromPlan, icpFromPlan } from "@/lib/lead-hunter/discovery-runner";
import { confirmInterpretation } from "@/lib/interpretation/confirmed-commercial-context";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import type { NeedsMap } from "@/lib/discovery/needs-map";
import { matchVerticalPack } from "@/lib/discovery/vertical-packs";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";

let passed = 0, failed = 0;
const test = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
async function run() {
const confirmed = confirmInterpretation(GOLDEN_FIXTURES.software_manufacturing, { contextId: "dynamic-v1" });
if (!confirmed.ok) throw new Error(confirmed.reason);
const plan = planDiscovery(confirmed.context);
const criteria = criteriaFromPlan(plan);
const icp = icpFromPlan(plan);
const needs = { target_company_profile: "US manufacturers operating their own plants", expected_need: "plant operations coordination", relevant_signal_families: ["new_facility"], buyer_problem: "fragmented operations", operational_trigger: "new plant", observable_signal: "opened plant", disqualifiers: [], supporting_evidence_required: [], counterevidence: [], possible_commercial_action: "validate plant ownership", product_or_service: "industrial automation software" } as unknown as NeedsMap;
const queries = enumerationRouteQueries(icp, "United States", needs, false);

test("confirmed manufacturer family survives plan → criteria", criteria.target_industries.some(x => /manufactur/i.test(x)));
test("confirmed manufacturer family survives plan → ICP", icp.target_industries.some(x => /manufactur/i.test(x)));
test("category enumeration route exists", queries.some(x => x.route === "industry_category"));
test("source ecosystem route exists", queries.some(x => x.route === "source_ecosystem" && /association|exhibitor/i.test(x.query)));
test("every organization-enumeration query retains geography", queries.every(x => /United States/i.test(x.query)));
test("every organization-enumeration query retains target family", queries.every(x => /manufactur/i.test(x.query)));
test("organization enumeration does not depend on event discovery", queries.every(x => !/expanded|opened|investment|modernized/i.test(x.query)));
test("grounded organization accepted only when all distinctive tokens occur", companyNameGroundedInPages("Acme Industrial Systems", [{ title: "Members: Acme Industrial Systems", snippet: "US manufacturer" }]));
test("LLM-style invented organization is rejected by grounding guard", !companyNameGroundedInPages("Invented Dynamics", [{ title: "US manufacturing members", snippet: "Acme and Beta" }]));
test("publisher is not mistaken for a listed company", isMediaOrDirectoryName("Revista Industria"));

const orgs: RawDiscoveredOrg[] = [
  { name: "Acme Manufacturing", domain: "acme.example", country: "United States", organizationType: "Manufacturer", industry: "Manufacturing", origin: "dynamic_enumeration", provider: "brave", route: "industry_category", confidence: "verified" },
  { name: "Acme Mfg", domain: "acme.example", country: "United States", organizationType: "Manufacturer", industry: "Manufacturing", origin: "dynamic_enumeration", provider: "tavily", route: "source_ecosystem", confidence: "verified" },
];
const runner: DiscoveryRunner = async () => ({ orgs, providersAvailable: ["brave", "tavily"], providersFailed: ["serper"], operatingMode: "full_discovery", routeMetrics: [
  { route: "industry_category", queries: 2, resultPages: 8, groundedNames: 4, acceptedCompanies: 2 },
  { route: "source_ecosystem", queries: 2, resultPages: 6, groundedNames: 3, acceptedCompanies: 1 },
] });
const universe = await hunt(plan, runner, { now: () => new Date("2026-08-27T00:00:00Z") });
test("duplicate organization collapses by corporate domain", universe.candidates.length === 1 && universe.candidates[0].provenance.length === 2);
test("route yield is inspectable in coverage", universe.coverage.routeYield.length === 2 && universe.coverage.routeYield[0].acceptedCompanies === 2);
test("provider degradation is visible without stopping discovery", universe.ok && universe.coverage.providersFailed.includes("serper"));
test("discovery provenance is not Evidence", !/evidence/i.test(JSON.stringify(universe.candidates[0])));
test("bounded provider budget remains <= 24", plan.budget.maxProviderCalls <= 24);
const warehouseFoodCriteria = { ...criteria, target_industries: ["food and beverage manufacturers and distributors"], offer_summary: "warehouse automation and WMS integration", value_proposition: "orchestrate inventory in owned distribution centers" };
const warehouseFoodIcp = { ...icp, target_industries: warehouseFoodCriteria.target_industries };
test("warehouse software objective cannot select wellness channel pack", !/^wellness_channels_/.test(matchVerticalPack(warehouseFoodIcp, warehouseFoodCriteria)?.id ?? ""));
test("generic industry token cannot assign another packaging company's domain", inferEnumeratedDomain("American Packaging Corporation", [{ title: "American Packaging Corporation profile", snippet: "packaging manufacturer", url: "https://ibexpackaging.com/profile" }]).domain === null);
test("distinctive company token resolves its own corporate domain", inferEnumeratedDomain("American Packaging Corporation", [{ title: "American Packaging Corporation", snippet: "official site", url: "https://americanpackaging.com/" }]).domain === "americanpackaging.com");
test("full normalized corporate name resolves International Paper", inferEnumeratedDomain("International Paper", [{ title: "International Paper", snippet: "official company", url: "https://internationalpaper.com/" }]).domain === "internationalpaper.com");
test("four-character distinctive brand resolves its official corporate domain", inferEnumeratedDomain("Lear Corporation", [{ title: "Global Automotive Tech Leader | Lear Corporation", snippet: "official company website", url: "https://www.lear.com/" }]).domain === "lear.com");
test("four-character brand cannot appropriate an unrelated mentioned host", inferEnumeratedDomain("Lear Corporation", [{ title: "Lear Corporation company profile", snippet: "automotive manufacturer", url: "https://industryweek.com/lear-corporation" }]).domain === null);
test("explicit UK company cannot inherit United States from search-query prose", inferEnumeratedCountry("Omni-Pac UK", [{ title: "US packaging manufacturers including Omni-Pac UK", snippet: "United States packaging query", url: "https://www.omnipacgroup.co.uk/" }], "United States").country === null);
test("foreign ccTLD dominates incidental target-country wording", inferEnumeratedCountry("Omni-Pac", [{ title: "Omni-Pac packaging", snippet: "United States results", url: "https://www.omnipacgroup.co.uk/" }], "United States").country === null);
test("unrelated food domain cannot resolve Massimo Zanetti", inferEnumeratedDomain("Massimo Zanetti Beverage USA", [{ title: "Massimo Zanetti Beverage USA", snippet: "food company", url: "https://americasfoodandbeverage.com/" }]).domain === null);
test("unverified AI company profile cannot become Timing by repeating expansion", classifySignalKind("This page summarizes recurring themes identified from responses generated by popular LLMs and has not been reviewed or approved by Pratt Industries. Multiple recent facility expansion projects.").kind === "reference_information");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
}
run();
