import assert from "node:assert/strict";
import { classifyEventResult, extractEventSubjects, normalizeLatamCompanyName, planEventFirstQueries, runEventFirstDiscovery } from "../../lib/lead-hunter/event-first-discovery";
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

const item = (title: string, url: string, snippet = "United States food manufacturer", published: string | null = "2026-08-20"): SearchResultItem => ({
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

await test("long Colombia ICP descriptions compress into searchable buyer families", () => {
  const rows = planEventFirstQueries(plan({ geographies: ["Colombia"], organizationTypes: ["Fabricantes industriales medianos con planta propia en Colombia", "Empresas manufactureras con expansión reciente de capacidad productiva en Colombia"], industries: ["manufactura industrial"] }), 2);
  assert.ok(rows.every(x => x.query.includes("fabricante") && x.query.includes("empresa industrial")));
  assert.ok(rows.every(x => !x.query.includes("Fabricantes industriales medianos con planta propia")));
});

await test("extracts the governing event subject, not article suffix", () => {
  assert.deepEqual(extractEventSubjects("Acme Foods opens new Ohio plant | Industry Today"), ["Acme Foods"]);
});

await test("represents both subjects of a joint announcement", () => {
  assert.deepEqual(extractEventSubjects("Acme Foods and Beta Logistics announce operational partnership"), ["Acme Foods", "Beta Logistics"]);
});

await test("separates comma-delimited event actors and drops the generic others tail", () => {
  assert.deepEqual(extractEventSubjects("Siemens, Diageo, Oxbo and others open US facilities in April"), ["Siemens", "Diageo", "Oxbo"]);
});

await test("extracts accented Spanish event verbs", () => {
  assert.deepEqual(extractEventSubjects("Nutresa amplió su capacidad de producción en Colombia"), ["Nutresa"]);
  assert.deepEqual(extractEventSubjects("Alpina inauguró una nueva planta en Cundinamarca"), ["Alpina"]);
  assert.deepEqual(extractEventSubjects("Inauguración del Centro de Distribución - P.A.N. COLOMBIA"), ["P.A.N."]);
});

await test("normalizes Colombian corporate descriptors and legal suffixes", () => {
  assert.equal(normalizeLatamCompanyName("La empresa colombiana Alimentos del Valle S.A.S."), "Alimentos del Valle");
  assert.deepEqual(extractEventSubjects("La compañía caleña Alimentos del Valle S.A.S. inauguró una planta"), ["Alimentos del Valle"]);
});

await test("extracts Spanish object-first and snippet event subjects conservatively", () => {
  assert.deepEqual(extractEventSubjects("Nueva planta de Alpina en Cundinamarca"), ["Alpina"]);
  assert.deepEqual(extractEventSubjects("Industria amplía capacidad", "Nutresa anunció una inversión industrial en Colombia."), ["Nutresa"]);
  assert.deepEqual(extractEventSubjects("Industria amplía capacidad", "La compañía anunció una inversión industrial."), []);
  assert.deepEqual(extractEventSubjects("Mapei impulsa su expansión desde Colombia con una nueva planta"), ["Mapei"]);
  assert.deepEqual(extractEventSubjects("WEG fortalece su expansión en Colombia con nuevo centro en Bogotá"), ["WEG"]);
  assert.deepEqual(extractEventSubjects("MIDA noticias", "Ver Más » 05 NOV 2024 ### Ballester Hermanos se expande"), []);
});

await test("classifies Colombia discovery result surfaces", () => {
  assert.equal(classifyEventResult(item("Post", "https://instagram.com/p/abc")), "social");
  assert.equal(classifyEventResult(item("Informe", "https://operaciones.colombiacompra.gov.co/doc.pdf")), "government");
  assert.equal(classifyEventResult(item("Noticia", "https://larepublica.co/empresas/noticia")), "news_article");
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

await test("Colombia corporate subdomain can resolve its actual brand host", async () => {
  const p = provider(() => [item("Inauguración del Centro de Distribución - P.A.N. COLOMBIA", "https://co.allofpan.com/news/inauguracion", "Fabricante de alimentos en Colombia")]);
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"], organizationTypes: ["fabricante"], industries: ["alimentos"] }), [p], { maxQueries: 1, maxIdentityQueries: 0 });
  assert.equal(result.orgs[0]?.domain, "co.allofpan.com");
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

await test("fallback provider runs when the first provider returns volume without event subjects", async () => {
  const noisy = { ...provider(() => [item("Directorio de empresas", "https://directory.example/list")]), id: "noisy" };
  const useful = { ...provider(q => q.query_type === "official_domain"
    ? [item("Alpina empresa Colombia", "https://alpina.com/nosotros", "Fabricante en Colombia")]
    : [item("Alpina inauguró una nueva planta en Colombia", "https://news.example/alpina", "Fabricante de alimentos en Colombia")]), id: "useful" };
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"], organizationTypes: ["fabricante"], industries: ["alimentos"] }), [noisy, useful], { maxQueries: 1, maxIdentityQueries: 2 });
  assert.equal(result.orgs[0]?.domain, "alpina.com");
  assert.ok((result.metrics.provider_calls.useful ?? 0) >= 1);
});

await test("fallback provider runs when the first provider has only foreign event subjects", async () => {
  const foreign = { ...provider(() => [
    item("Munters abre nueva planta en Nuevo León", "https://trade.example/munters-mexico", "Fabricante industrial en México"),
    item("HENN inaugura planta en Guanajuato", "https://trade.example/henn-mexico", "Fabricante automotriz en México"),
  ]), id: "foreign" };
  const colombia = { ...provider(q => q.query_type === "official_domain"
    ? [item("WEG Colombia | sitio oficial", "https://weg.net/co", "Fabricante industrial con operación en Bogotá, Colombia")]
    : [item("WEG fortalece su expansión en Colombia con nuevo centro en Bogotá", "https://trade.example/weg-colombia", "Fabricante industrial en Colombia")]), id: "colombia" };
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"], organizationTypes: ["fabricante"], industries: ["manufactura industrial"] }), [foreign, colombia], { maxQueries: 1, maxIdentityQueries: 2 });
  assert.equal(result.orgs[0]?.domain, "weg.net");
  assert.ok((result.metrics.provider_calls.colombia ?? 0) >= 1);
});

await test("a target-country news hint does not stop fallback before corporate identity is found", async () => {
  const news = { ...provider(() => [item("Mapei abre nueva planta en Colombia", "https://news.example/mapei-colombia", "Fabricante industrial en Colombia")]), id: "news" };
  const corporate = { ...provider(() => [item("WEG fortalece su expansión en Colombia", "https://weg.net/co/noticias/expansion", "Fabricante industrial con operación en Bogotá, Colombia")]), id: "corporate" };
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"], organizationTypes: ["fabricante"], industries: ["manufactura industrial"] }), [news, corporate], { maxQueries: 1, maxIdentityQueries: 0 });
  assert.ok((result.metrics.provider_calls.corporate ?? 0) >= 1);
  assert.equal(result.orgs[0]?.domain, "weg.net");
});

await test("uppercase Colombian corporate initialism resolves through an official domain query", async () => {
  const p = provider(q => q.query_type === "official_domain"
    ? [item("WEG Colombia | sitio oficial", "https://weg.net/co", "Fabricante industrial con operación en Bogotá, Colombia")]
    : [item("WEG fortalece su expansión en Colombia con nuevo centro en Bogotá", "https://trade.example/weg-bogota", "Fabricante industrial en Colombia")]);
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"], organizationTypes: ["fabricante"], industries: ["manufactura industrial"] }), [p], { maxQueries: 1, maxIdentityQueries: 1 });
  assert.equal(result.orgs[0]?.domain, "weg.net");
});

await test("bounded identity budget prioritizes target-geography event subjects", async () => {
  const p = provider(q => q.query_type === "official_domain"
    ? (q.query.includes("WEG") ? [item("WEG Colombia | sitio oficial", "https://weg.net/co", "Fabricante industrial en Bogotá, Colombia")] : [])
    : [
      item("Munters expande su manufactura industrial en Nuevo León", "https://trade.example/munters", "Fabricante en México"),
      item("WEG fortalece su expansión en Colombia con nuevo centro en Bogotá", "https://trade.example/weg", "Fabricante industrial en Colombia"),
    ]);
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"], organizationTypes: ["fabricante"], industries: ["manufactura industrial"] }), [p], { maxQueries: 1, maxIdentityQueries: 1 });
  assert.deepEqual(result.orgs.map(x => x.name), ["WEG"]);
});

await test("bounded identity budget prioritizes the confirmed vertical inside one geography", async () => {
  const p = provider(q => q.query_type === "official_domain"
    ? (q.query.includes("Nestlé") ? [item("Nestlé USA | official", "https://nestle.com/about", "Food and beverage manufacturer with a plant in Arizona")] : [])
    : [
      item("Siemens opens US manufacturing facility", "https://trade.example/siemens", "Industrial equipment manufacturer in Texas"),
      item("Nestlé opens food manufacturing facility in Arizona", "https://trade.example/nestle", "Food and beverage manufacturer in Arizona"),
    ]);
  const result = await runEventFirstDiscovery(plan(), [p], { maxQueries: 1, maxIdentityQueries: 1 });
  assert.deepEqual(result.orgs.map(x => x.name), ["Nestlé"]);
});

await test("rejects stale event hints even when provider freshness leaks them", async () => {
  const p = provider(() => [item("PepsiCo opens new manufacturing plant", "https://pepsico.com/news/plant", "United States manufacturer", "2012-06-01")]);
  const result = await runEventFirstDiscovery(plan(), [p], { maxQueries: 1, maxIdentityQueries: 0, now: () => new Date("2026-08-31T00:00:00Z") });
  assert.equal(result.hints.length, 0);
  assert.equal(result.metrics.rejected.stale_hint, 1);
});

await test("rejects old year embedded in URL when provider omits the date", async () => {
  const p = provider(() => [item("SunOpta opens manufacturing facility", "https://news.example/2023/02/sunopta", "United States manufacturer", null)]);
  const result = await runEventFirstDiscovery(plan(), [p], { maxQueries: 1, maxIdentityQueries: 0, now: () => new Date("2026-08-31T00:00:00Z") });
  assert.equal(result.hints.length, 0);
  assert.equal(result.metrics.rejected.stale_hint, 1);
});

await test("rejects media domains that merely contain a generic company token", async () => {
  const p = provider(q => q.query_type === "official_domain"
    ? [item("XPO Logistics company profile", "https://logistics-buyer.com/xpo", "United States logistics company")]
    : [item("XPO Logistics awarded Tesco contract", "https://logistics-buyer.com/xpo-contract")]);
  const result = await runEventFirstDiscovery(plan({ organizationTypes: ["logistics operator"], industries: ["logistics"] }), [p], { maxQueries: 1, maxIdentityQueries: 1 });
  assert.equal(result.orgs.length, 0);
  assert.equal(result.metrics.rejected.identity_domain_mismatch, 1);
});

await test("rejects investment firms surfaced for an operational SaaS target", async () => {
  const p = provider(() => [item("Vista Equity announces strategic partnership", "https://vistaequitypartners.com/news", "Private equity investment firm in the United States")]);
  const result = await runEventFirstDiscovery(plan({ organizationTypes: ["software company"], industries: ["B2B operational software"], watchSignalFamilies: ["partnership"] }), [p], { maxQueries: 1, maxIdentityQueries: 0 });
  assert.equal(result.orgs.length, 0);
  assert.equal(result.metrics.rejected.wrong_target_type, 1);
});

await test("manufacturer identity cannot substitute for the requested food industry", async () => {
  const p = provider(() => [item("Mapei impulsa su expansión con una nueva planta en Colombia", "https://mapei.com/co/noticias/planta", "Fabricante de materiales de construcción en Colombia")]);
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"], organizationTypes: ["fabricante"], industries: ["manufactura de alimentos y bebidas"] }), [p], { maxQueries: 1, maxIdentityQueries: 0 });
  assert.equal(result.orgs.length, 0);
  assert.equal(result.metrics.rejected.wrong_target_type, 1);
});

await test("query geography alone cannot establish company geography", async () => {
  const p = provider(() => [item("Acme Foods inaugura nueva planta", "https://acmefoods.com/news/plant", "Food manufacturer")]);
  const result = await runEventFirstDiscovery(plan({ geographies: ["Colombia"] }), [p], { maxQueries: 1, maxIdentityQueries: 0 });
  assert.equal(result.orgs.length, 0);
  assert.equal(result.metrics.rejected.geography_unresolved, 1);
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
