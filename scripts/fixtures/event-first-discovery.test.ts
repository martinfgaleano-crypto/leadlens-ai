import assert from "node:assert/strict";
import { extractEventSubjects, planEventFirstQueries, runEventFirstDiscovery } from "../../lib/lead-hunter/event-first-discovery";
import type { DiscoveryPlan } from "../../lib/lead-hunter/candidate-universe";
import { hunt } from "../../lib/lead-hunter/candidate-universe";
import { prioritizeResearch } from "../../lib/lead-hunter/research-readiness";
import { toResearchCandidates } from "../../lib/lead-hunter/hunt-and-persist";
import type { SearchProvider, SearchQuery, SearchResultItem } from "../../lib/sources/access/provider-contract";

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
};

const plan = (overrides: Partial<DiscoveryPlan> = {}): DiscoveryPlan => ({
  contextRef: { contextId: "ctx_event", version: 1 }, objectiveType: "sales_opportunities",
  targetRelationship: "buyer", organizationTypes: ["manufacturer"], industries: ["food manufacturing"],
  geographies: ["United States"], routes: [], exclusions: [], namedAccountSeeds: [],
  watchSignalFamilies: ["new_facility", "capacity"],
  budget: { maxRoutes: 4, maxProviderCalls: 20, maxCandidatesPerRoute: 10, maxExtractions: 8, maxRetries: 0, timeoutMs: 60_000 },
  planGaps: [], ...overrides,
});

const item = (title: string, url: string, snippet = "United States food manufacturer", published = "2026-08-20"): SearchResultItem => ({
  title, url, canonical_url: url, snippet, published_date: published, retrieved_at: "2026-08-31T00:00:00Z",
  source_type: "news", provider: "fixture", rank: 1, locale: "en-US",
});

function provider(search: (q: SearchQuery) => SearchResultItem[]): SearchProvider {
  return {
    id: "fixture", capabilities: () => ({ search: true, extract: false, regions: "global", supports_dates: true }),
    health: async () => ({ provider: "fixture", status: "available", reason: null, credentials_present: true }),
    search: async query => ({ ok: true, provider: "fixture", query, results: search(query), latency_ms: 1, cost_estimate_usd: 0, error: null }),
  };
}

async function main() {
await test("planner is objective-specific, geographic and bounded", () => {
  const rows = planEventFirstQueries(plan(), 3);
  assert.equal(rows.length, 3);
  assert.ok(rows.every(x => x.query.includes("manufacturer") && x.query.includes("United States")));
  assert.ok(rows.some(x => x.family === "facility"));
});

await test("Spanish geography produces Spanish event queries", () => {
  const rows = planEventFirstQueries(plan({ geographies: ["Colombia"] }), 4);
  assert.ok(rows.every(x => x.language === "es"));
  assert.ok(rows.some(x => /planta|capacidad/.test(x.query)));
});

await test("extracts the governing event subject, not article suffix", () => {
  assert.deepEqual(extractEventSubjects("Acme Foods opens new Ohio plant | Industry Today"), ["Acme Foods"]);
});

await test("represents both subjects of a joint announcement", () => {
  assert.deepEqual(extractEventSubjects("Acme Foods and Beta Logistics announce operational partnership"), ["Acme Foods", "Beta Logistics"]);
});

await test("does not treat an editorial category as a company", () => {
  assert.deepEqual(extractEventSubjects("Manufacturers expand capacity despite inflation"), []);
});

await test("event-first admits an out-of-universe company only after identity and geography resolution", async () => {
  const p = provider(q => q.query_type === "official_domain"
    ? [item("Acme Foods | United States manufacturer", "https://acmefoods.com/about")]
    : [item("Acme Foods opens new Ohio plant", "https://industrytoday.example/acme-plant")]);
  const result = await runEventFirstDiscovery(plan(), [p], { maxQueries: 1, maxIdentityQueries: 1, now: () => new Date("2026-08-31T00:00:00Z") });
  assert.equal(result.orgs.length, 1);
  assert.equal(result.orgs[0].name, "Acme Foods");
  assert.equal(result.orgs[0].domain, "acmefoods.com");
  assert.equal(result.orgs[0].origin, "event_first");
  assert.equal(result.orgs[0].sourceUrl, "https://industrytoday.example/acme-plant");
});

await test("discovery URL remains provenance and is not asserted as corporate domain", async () => {
  const p = provider(q => q.query_type === "official_domain" ? [] : [item("Acme Foods opens new plant", "https://reuters.com/acme")]);
  const result = await runEventFirstDiscovery(plan(), [p], { maxQueries: 1, maxIdentityQueries: 0 });
  assert.equal(result.orgs.length, 0);
  assert.equal(result.metrics.rejected.identity_unresolved, 1);
});

await test("deduplicates the same event returned by repeated queries", async () => {
  const p = provider(q => q.query_type === "official_domain"
    ? [item("Acme Foods United States", "https://acmefoods.com/about")]
    : [item("Acme Foods opens new plant", "https://news.example/acme-plant")]);
  const result = await runEventFirstDiscovery(plan(), [p], { maxQueries: 2, maxIdentityQueries: 2 });
  assert.equal(result.hints.length, 1);
  assert.ok((result.metrics.rejected.duplicate ?? 0) >= 1);
});

await test("a publication date stays a hint and never becomes canonical Evidence", async () => {
  const p = provider(() => [item("Acme Foods opens new plant", "https://acmefoods.com/news/plant")]);
  const result = await runEventFirstDiscovery(plan(), [p], { maxQueries: 1, maxIdentityQueries: 0 });
  assert.equal(result.hints[0].event_date_hint, "2026-08-20");
  assert.ok(!("evidence" in result.hints[0]) && !("decision" in result.hints[0]) && !("timing" in result.hints[0]));
});

await test("provider failure is telemetry, not a commercial rejection", async () => {
  const failing: SearchProvider = { ...provider(() => []), id: "down", search: async query => ({ ok: false, provider: "down", query, results: [], latency_ms: 1, cost_estimate_usd: null, error: "rate_limited" }) };
  const result = await runEventFirstDiscovery(plan(), [failing], { maxQueries: 1 });
  assert.equal(result.metrics.provider_failures.down, "rate_limited");
  assert.equal(result.orgs.length, 0);
});

await test("account-first and event-first identities fuse by canonical domain", async () => {
  const universe = await hunt(plan(), async () => ({
    providersAvailable: ["fixture"], providersFailed: [], operatingMode: "full_discovery",
    orgs: [
      { name: "Acme Foods", domain: "acmefoods.com", country: "United States", organizationType: "manufacturer", industry: "food manufacturing", origin: "dynamic_enumeration", provider: "fixture", route: "industry_category", confidence: "verified" },
      { name: "Acme Foods", domain: "acmefoods.com", country: "United States", organizationType: "manufacturer", industry: "food manufacturing", origin: "event_first", provider: "fixture", route: "event_first:facility", sourceUrl: "https://news.example/acme-plant", confidence: "verified" },
    ],
  }), { now: () => new Date("2026-08-31T00:00:00Z") });
  assert.equal(universe.candidates.length, 1);
  assert.equal(universe.candidates[0].provenance.length, 2);
});

await test("event-first affects Research priority but cannot leak its URL into Evidence", async () => {
  const universe = await hunt(plan(), async () => ({
    providersAvailable: ["fixture"], providersFailed: [], operatingMode: "full_discovery",
    orgs: [
      { name: "Structural Foods", domain: "structuralfoods.com", country: "United States", organizationType: "manufacturer", industry: "food manufacturing", origin: "dynamic_enumeration", provider: "fixture", route: "industry_category", confidence: "verified" },
      { name: "Event Foods", domain: "eventfoods.com", country: "United States", organizationType: "manufacturer", industry: "food manufacturing", origin: "event_first", provider: "fixture", route: "event_first:facility", sourceUrl: "https://news.example/event-foods", confidence: "verified" },
    ],
  }), { now: () => new Date("2026-08-31T00:00:00Z") });
  assert.equal(prioritizeResearch(universe.candidates, universe.plan)[0].identity.canonicalName, "Event Foods");
  const handoff = toResearchCandidates(universe);
  assert.equal(handoff[0].company, "Event Foods");
  assert.equal(handoff[0].source_url, undefined);
  assert.ok(!("evidence" in handoff[0]) && !("decision" in handoff[0]) && !("timing" in handoff[0]));
});

console.log(`\n${passed}/${passed} event-first discovery checks passed`);
}

main().catch((error) => { console.error(error); process.exit(1); });
