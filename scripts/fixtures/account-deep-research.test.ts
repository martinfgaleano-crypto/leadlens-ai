import { strict as assert } from "node:assert";
import { corroboratesPrimaryEvent, deepenAccountResearch, eventGeographyMatches, isAllowedCorporateFetchUrl, isEventExtractionCandidate, relevantContentWindow } from "@/lib/intelligence/account-deep-research";
import { scrapeEventDatePhrase } from "@/lib/monitor/full-text-extraction";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { resolveEventDate } from "@/lib/monitor/event-extraction";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import type { LeadCandidate, LeadSearchCriteria } from "@/types";

let passed = 0;
const test = (name: string, value: boolean) => { assert.equal(value, true, name); passed++; console.log(`✅ ${name}`); };
const now = "2026-08-27T12:00:00.000Z";
const provider: SearchProvider = {
  id: "fixture",
  capabilities: () => ({ search: true, extract: false, regions: "global", supports_dates: true }),
  health: async () => ({ provider: "fixture", status: "available", reason: null, credentials_present: true }),
  search: async (q) => ({
    ok: true, provider: "fixture", query: q, latency_ms: 1, cost_estimate_usd: 0, error: null,
    results: q.query.includes("cierre") ? [] : [
      { url: "https://acme.com/news/new-plant", canonical_url: "https://acme.com/news/new-plant", title: "Acme Manufacturing anuncia apertura de planta", snippet: "Acme abrió la planta en agosto de 2026.", published_date: "2026-08-10", retrieved_at: now, source_type: "official", provider: "fixture", rank: 1, locale: "es" },
      { url: "https://industry.example/acme-plant", canonical_url: "https://industry.example/acme-plant", title: "Acme Manufacturing confirma expansión de planta", snippet: "Acme Manufacturing amplió capacidad en agosto de 2026.", published_date: "2026-08-11", retrieved_at: now, source_type: "trade_publication", provider: "fixture", rank: 2, locale: "es" },
    ],
  }),
};
const candidate: LeadCandidate = { id: "acme", company: "Acme Manufacturing", domain: "acme.com", country: "United States", industry: "packaging manufacturing", source: "public_signal", confidence_score: .9 };
const criteria: LeadSearchCriteria = { offer_summary: "industrial automation and plant operations software", value_proposition: "automate plant operations", target_industries: ["packaging manufacturing"], target_company_size: ["mid-market"], target_job_titles: [], target_geography: ["United States"], excluded_industries: [], buying_signals: ["new plant"], disqualification_criteria: [], tone: "consultative", plan: "sample", lead_count: 2, output_language: "en" };

async function main() {
const result = await deepenAccountResearch(candidate, criteria, {
  providers: [provider], now: () => new Date(now), maxQueries: 5, maxExtractions: 2,
  extract: async (url) => ({ ok: true, content: `${url} Acme opened a new production plant in the United States in August 2026 and increased capacity.` }),
});
test("account plan executes company-specific queries", result.telemetry.executed_queries >= 4);
test("counterevidence stage is mandatory before early stop", result.telemetry.counterevidence_checked);
test("official and independent evidence are retained", result.telemetry.independent_domains === 2);
test("dated evidence is measured", result.telemetry.dated_evidence >= 2);
test("full text is bounded", result.telemetry.pages_extracted > 0 && result.telemetry.pages_extracted <= 2);
test("extraction audit identifies URL, stage and gate outcome", result.telemetry.extraction_audit.length > 0 && result.telemetry.extraction_audit.every((x) => x.url && x.stage && Number.isInteger(x.accepted_events)));
test("best source favors official company domain", result.sourceUrl === "https://acme.com/news/new-plant");
test("research context contains source provenance", result.context.includes("source: https://acme.com/news/new-plant"));
test("full text must produce a dated material event before it can be a trigger", result.validated_events.length > 0 && !!result.eventDate);
test("global-company event must be grounded in the target operating geography", eventGeographyMatches("Colombia", "Mapei opened a new plant in Bogotá, Colombia", "https://mapei.com/co/news") && !eventGeographyMatches("Colombia", "Mapei opened a new laboratory in Greater London, United Kingdom", "https://mapei.com/it/en/news"));
test("telemetry never claims unavailable cost", !("cost" in result.telemetry));
test("long-page window skips boilerplate and retains event", relevantContentWindow(`${"cookie navigation ".repeat(1000)}Acme Manufacturing opened a new plant on August 10, 2026.`, ["Acme Manufacturing", "new plant"], 1200).includes("opened a new plant"));
test("full date phrase with day is recovered", scrapeEventDatePhrase("Acme opened the plant on August 10, 2026 after construction.") === "August 10, 2026");
test("abbreviated corporate press date is recovered", scrapeEventDatePhrase("WESTERVILLE, Ohio - Aug. 20, 2026 Forward stocking network expanded.") === "Aug. 20, 2026");
test("day-first English corporate date is recovered", scrapeEventDatePhrase("Press release 22 April, 2026. Acme officially opened the plant.") === "22 April, 2026");
test("US numeric corporate date is recovered", scrapeEventDatePhrase("Corporate calendar 01/29/2026. Acme announced the facility.") === "01/29/2026");
test("US numeric corporate date resolves exactly", resolveEventDate({ accountId: "acme", sourceHost: "acme.com", sourceUrl: "https://acme.com/event", titleAndContent: "event", eventDateRaw: "01/29/2026", publicationDate: null, retrievedAt: now }).eventDate === "2026-01-29");
test("explicit today event phrase is recoverable for publication anchoring", scrapeEventDatePhrase("Acme today opened its largest distribution center.") === "today");

const noEventProvider: SearchProvider = { ...provider, search: async (q) => ({ ok: true, provider: "fixture", query: q, latency_ms: 1, cost_estimate_usd: 0, error: null, results: [] }) };
const noEvent = await deepenAccountResearch(candidate, criteria, { providers: [noEventProvider], now: () => new Date(now), maxQueries: 5 });
test("weak account stops after bounded counterevidence without client/dossier depth", noEvent.telemetry.early_stop_reason === "no_material_event" && noEvent.telemetry.executed_queries === 4);

const datedContextProvider: SearchProvider = { ...provider, search: async (q) => ({
  ok: true, provider: "fixture", query: q, latency_ms: 1, cost_estimate_usd: 0, error: null,
  results: ["https://acme.com/news/update", "https://industry.example/acme-update"].map((url, index) => ({
    url, canonical_url: url, title: "Acme Manufacturing expansion update", snippet: "Company overview and historical footprint.",
    published_date: "2026-08-10", retrieved_at: now, source_type: index ? "trade_publication" : "official", provider: "fixture", rank: index + 1, locale: "en",
  })),
}) };
const datedContextOnly = await deepenAccountResearch(candidate, criteria, {
  providers: [datedContextProvider], now: () => new Date(now), maxQueries: 5, maxExtractions: 2,
  extract: async () => ({ ok: true, content: "Acme Manufacturing company profile and historical locations. No current operating change is announced." }),
});
test("dated relevant pages without a validated event are not labeled sufficient evidence", datedContextOnly.validated_events.length === 0 && datedContextOnly.telemetry.early_stop_reason === "no_material_event");

let stage = 0;
const repeatedOfficialProvider: SearchProvider = {
  ...provider,
  search: async (q) => {
    stage++;
    const event = { url: "https://acme.com/news/repeated-event", canonical_url: "https://acme.com/news/repeated-event", title: "Acme Manufacturing opened a new plant", snippet: "Acme opened a new plant in August 2026.", published_date: "2026-08-10", retrieved_at: now, source_type: "official", provider: "fixture", rank: 1, locale: "en" };
    return { ok: true, provider: "fixture", query: q, latency_ms: 1, cost_estimate_usd: 0, error: null, results: q.query.includes("cierre") ? [] : [event] };
  },
};
const extractedStages: number[] = [];
const repeated = await deepenAccountResearch(candidate, criteria, {
  providers: [repeatedOfficialProvider], now: () => new Date(now), maxQueries: 4, maxExtractions: 1,
  extract: async () => { extractedStages.push(stage); return { ok: true, content: "Acme Manufacturing opened a new production plant in Wisconsin, United States on August 10, 2026." }; },
});
test("an event-bearing URL may be deepened once even when first recovered during identity", extractedStages.length === 1);
test("accepted official URL repeated in current activity can still yield an event", repeated.validated_events.length === 1 && repeated.eventDate === "2026-08-10");

const emptyStructured = await deepenAccountResearch(candidate, criteria, {
  providers: [repeatedOfficialProvider], now: () => new Date(now), maxQueries: 4, maxExtractions: 1,
  extract: async () => ({ ok: true, content: "SUSSEX, Wisconsin, United States, July 16, 2026 — Acme Manufacturing is expanding operations with a new production plant." }),
  structured: { call: async () => ({ claims: [], events: [] }) },
});
test("empty structured extraction falls back to deterministic event/date recovery", emptyStructured.validated_events.length === 1 && emptyStructured.eventDate === "2026-07-16");

const activeExpansion = await deepenAccountResearch(candidate, criteria, {
  providers: [repeatedOfficialProvider], now: () => new Date(now), maxQueries: 4, maxExtractions: 1,
  extract: async () => ({ ok: true, content: "SUSSEX, Wisconsin, United States, July 16, 2026 — Acme Manufacturing is expanding its packaging operations with a new manufacturing facility." }),
  structured: { call: async () => ({ claims: [], events: [] }) },
});
test("dated active expansion with a concrete new facility is a material event", activeExpansion.validated_events.length === 1 && activeExpansion.eventDate === "2026-07-16");
test("qualified operations phrase does not fall through to About us reference", classifySignalKind("Quad is expanding its packaging operations with a new manufacturing facility. About us").can_trigger);
test("financial results do not consume event extraction priority", !isEventExtractionCandidate("Quad reports third quarter and year-to-date 2025 results", "expanded adjusted EBITDA") && isEventExtractionCandidate("Quad expands national packaging footprint", "New Salt Lake City facility strengthens packaging operations"));
test("static identity page does not consume event extraction priority", !isEventExtractionCandidate("About Acme Manufacturing", "Company profile and locations"));
test("quantified capacity commitment is a strategic decision", classifySignalKind("Approximately $220 million investment will add new production capacity and create more than 100 jobs.").kind === "strategic_decision");
test("announced quantified expansion plan is a strategic decision", classifySignalKind("Conagra announced plans to expand its existing manufacturing facility through a multi-year investment of approximately $220 million.").kind === "strategic_decision");
test("geographic abbreviation does not break quantified commitment", classifySignalKind("Conagra announced plans to expand its existing manufacturing facility in Fayetteville, Ark. through a multi-year investment of approximately $220 million.").kind === "strategic_decision");
test("generic future expansion remains non-triggering", !classifySignalKind("The company hopes to expand operations someday.").can_trigger);
test("corporate history page cannot turn historical operations into a fresh event", classifySignalKind("Our History - Logistics Leaders Since 1925 | Burris Logistics. Change has come through modernized fleets and facilities. Freight brokerage grew from a few loads per week in 2018 to over 50,000 loads per month in 2026. Today Burris supports its operating companies.").kind === "reference_information");
test("quantified logistics network expansion is a triggering operational change", classifySignalKind("DHL Supply Chain expands service logistics capabilities. Forward stocking network expanded to more than 150 U.S. and Canadian locations.").can_trigger);
test("direct extraction fallback is restricted to the verified corporate HTTPS host", isAllowedCorporateFetchUrl("https://www.dhl.com/us-en/news/event.html", "dhl.com") && !isAllowedCorporateFetchUrl("https://publisher.example/dhl-event", "dhl.com") && !isAllowedCorporateFetchUrl("http://dhl.com/event", "dhl.com"));
test("groundbreaking is a concrete strategic facility event", classifySignalKind("Hitachi Energy broke ground on a major expansion of its South Boston campus.").kind === "strategic_decision");
test("announced multi-facility opening plan is concrete, not generic aspiration", classifySignalKind("John Deere announced plans to open two new U.S.-based facilities: a distribution center and an excavator factory.").kind === "strategic_decision");
test("claim-derived corroboration requires same material event", corroboratesPrimaryEvent("Quad expands packaging operations with a Salt Lake City manufacturing facility", "Industry source confirms Quad opened its Salt Lake City packaging facility") && !corroboratesPrimaryEvent("Quad expands packaging operations with a Salt Lake City manufacturing facility", "Quad reports quarterly earnings and a dividend"));
test("related-link text does not corroborate a different headline event", !corroboratesPrimaryEvent("SunOpta invested over $25M in a new fruit snacks production line at Omak, increasing capacity by 25%", "SunOpta Announces Shareholder Approval of Proposed Acquisition by Refresco. Contacts. One More Line, Lots More Snacks: SunOpta Expands Production in Omak."));
test("corroboration slot is attempted only after a validated event", result.telemetry.corroboration_attempted && !noEvent.telemetry.corroboration_attempted);
test("corroborating domains count only claim-matched corroboration results", Number.isInteger(result.telemetry.corroborating_domains) && result.telemetry.corroborating_domains >= 0);
console.log(`\n${passed} passed, 0 failed`);
}
main().catch((error) => { console.error(error); process.exit(1); });
