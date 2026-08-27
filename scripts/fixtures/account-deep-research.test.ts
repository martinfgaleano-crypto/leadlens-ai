import { strict as assert } from "node:assert";
import { deepenAccountResearch, relevantContentWindow } from "@/lib/intelligence/account-deep-research";
import { scrapeEventDatePhrase } from "@/lib/monitor/full-text-extraction";
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
  extract: async (url) => ({ ok: true, content: `${url} Acme opened a new production plant in August 2026 and increased capacity.` }),
});
test("account plan executes company-specific queries", result.telemetry.executed_queries >= 4);
test("counterevidence stage is mandatory before early stop", result.telemetry.counterevidence_checked);
test("official and independent evidence are retained", result.telemetry.independent_domains === 2);
test("dated evidence is measured", result.telemetry.dated_evidence >= 2);
test("full text is bounded", result.telemetry.pages_extracted > 0 && result.telemetry.pages_extracted <= 2);
test("best source favors official company domain", result.sourceUrl === "https://acme.com/news/new-plant");
test("research context contains source provenance", result.context.includes("source: https://acme.com/news/new-plant"));
test("full text must produce a dated material event before it can be a trigger", result.validated_events.length > 0 && !!result.eventDate);
test("telemetry never claims unavailable cost", !("cost" in result.telemetry));
test("long-page window skips boilerplate and retains event", relevantContentWindow(`${"cookie navigation ".repeat(1000)}Acme Manufacturing opened a new plant on August 10, 2026.`, ["Acme Manufacturing", "new plant"], 1200).includes("opened a new plant"));
test("full date phrase with day is recovered", scrapeEventDatePhrase("Acme opened the plant on August 10, 2026 after construction.") === "August 10, 2026");
test("explicit today event phrase is recoverable for publication anchoring", scrapeEventDatePhrase("Acme today opened its largest distribution center.") === "today");

const noEventProvider: SearchProvider = { ...provider, search: async (q) => ({ ok: true, provider: "fixture", query: q, latency_ms: 1, cost_estimate_usd: 0, error: null, results: [] }) };
const noEvent = await deepenAccountResearch(candidate, criteria, { providers: [noEventProvider], now: () => new Date(now), maxQueries: 5 });
test("weak account stops after bounded counterevidence without client/dossier depth", noEvent.telemetry.early_stop_reason === "no_material_event" && noEvent.telemetry.executed_queries === 4);
console.log(`\n${passed} passed, 0 failed`);
}
main().catch((error) => { console.error(error); process.exit(1); });
