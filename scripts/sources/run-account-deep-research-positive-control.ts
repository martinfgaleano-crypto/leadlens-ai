/** Diagnostic-only bounded acceptance. Named accounts are evaluation references,
 * never production candidate seeds and never a market-recall estimate. */
import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { deepenAccountResearch } from "@/lib/intelligence/account-deep-research";
import { braveProvider, tavilyProvider } from "@/lib/sources/access/providers";
import type { LeadCandidate, LeadSearchCriteria } from "@/types";

loadEnvConfig(process.cwd());
const allReferences = [
  { company: "Nestlé USA", domain: "nestleusa.com", expected: ["Arvin", "distribution center"] },
  { company: "Conagra Brands", domain: "conagrabrands.com", expected: ["Fayetteville", "expansion"] },
  { company: "Quad", domain: "quad.com", expected: ["Salt Lake", "packaging facility"] },
  { company: "voestalpine", domain: "voestalpine.com", expected: ["Indiana", "production facility"] },
  { company: "Hitachi Energy", domain: "hitachienergy.com", expected: ["South Boston", "expansion"] },
  { company: "John Deere", domain: "deere.com", expected: ["factory", "distribution center"] },
  { company: "UFP", domain: "ufpi.com", expected: ["South Carolina", "packaging facility"] },
  { company: "Mondi", domain: "mondigroup.com", expected: ["Pittsburgh", "automated packaging"] },
] as const;
const filter = process.env.ACCOUNT_DIAGNOSTIC_FILTER?.trim().toLowerCase() ?? "";
const references = filter ? allReferences.filter((ref) => ref.company.toLowerCase().includes(filter)) : allReferences;
const criteria: LeadSearchCriteria = {
  offer_summary: "industrial automation integration and plant operations software",
  value_proposition: "automate and integrate plant operations",
  target_industries: ["manufacturing", "packaging", "industrial operations"],
  target_company_size: ["mid-market", "enterprise"], target_job_titles: [], target_geography: ["United States"],
  excluded_industries: [], disqualification_criteria: [], buying_signals: ["new facility", "capacity expansion", "automation investment"],
  tone: "consultative", plan: "sample", lead_count: 2, output_language: "en",
};

async function main() {
  const health = await Promise.all([braveProvider, tavilyProvider].map(async (provider) => ({ provider, health: await provider.health() })));
  const providers = health.filter((x) => x.health.status === "available").map((x) => x.provider);
  if (!providers.length) throw new Error("no_search_provider_available_for_diagnostic");
  const started = Date.now();
  const accounts = [];
  for (let index = 0; index < references.length; index++) {
    const ref = references[index];
    const candidate: LeadCandidate = {
      id: `diagnostic-positive-control-${index + 1}`, company: ref.company, domain: ref.domain,
      country: "United States", industry: "manufacturing", source: "public_signal",
      confidence_score: .95, account_identity: { canonicalName: ref.company, domain: ref.domain, country: "United States", aliases: [], confidence: "verified", fromUniverse: true },
    };
    const result = await deepenAccountResearch(candidate, criteria, { providers, maxQueries: 4, maxResultsPerQuery: 5, maxExtractions: 2 });
    const expectedTerms = Array.from(ref.expected) as string[];
    const matchingEvents = result.validated_events.filter((event) => expectedTerms.some((term) => event.title_and_content.toLowerCase().includes(term.toLowerCase())));
    const matched = expectedTerms.filter((term) => matchingEvents.some((event) => event.title_and_content.toLowerCase().includes(term.toLowerCase())));
    accounts.push({
      reference: `${ref.company} — ${ref.expected.join(" / ")}`, company: ref.company, domain: ref.domain,
      expected_terms: expectedTerms, matched_terms: matched,
      captured_defensibly: matchingEvents.length > 0,
      strongest_source_url: result.sourceUrl, strongest_publication_date: result.publishedDate,
      validated_events: result.validated_events.map((event) => ({ url: event.url, source_host: event.source_host, kind: event.kind, event_date: event.event_date, matched_expected_terms: expectedTerms.filter((term) => event.title_and_content.toLowerCase().includes(term.toLowerCase())) })),
      telemetry: result.telemetry,
      accepted_evidence: result.decisions.filter((d) => d.accepted).map((d) => ({ url: d.candidate.url, title: d.candidate.title, publication_date: d.candidate.publication_date, source_tier: d.source_tier, entity_state: d.entity_state, commercial_relevance: d.commercial_relevance })),
      rejection_reasons: Array.from(new Set(result.decisions.filter((d) => !d.accepted).flatMap((d) => d.reason_codes))),
    });
    console.log(`${index + 1}/8 ${ref.company}: captured=${accounts.at(-1)?.captured_defensibly} accepted=${result.telemetry.evidence_accepted} dated=${result.telemetry.dated_evidence}`);
  }
  const captured = accounts.filter((a) => a.captured_defensibly).length;
  const artifact = {
    audit: "account-deep-research-positive-control-v1", generated_at: new Date().toISOString(),
    diagnostic_only: true, production_seeded: false,
    interpretation_limit: "Named accounts are a bounded retrieval control, not a production universe and not a global recall estimate.",
    providers: health.map((x) => ({ id: x.provider.id, status: x.health.status, reason: x.health.reason })),
    budget: { accounts: 8, max_queries_per_account: 4, max_results_per_query: 5, max_extractions_per_account: 2, retries: 0 },
    summary: { references: accounts.length, captured_defensibly: captured, bounded_capture_rate: captured / accounts.length, duration_ms: Date.now() - started, provider_calls: accounts.reduce((n, a) => n + a.telemetry.provider_calls, 0), extractions: accounts.reduce((n, a) => n + a.telemetry.pages_extracted, 0), observed_cost_usd: null },
    accounts,
  };
  const suffix = filter ? `-${filter.replace(/[^a-z0-9]+/g, "-")}` : "";
  const path = join(process.cwd(), `ml/data/acceptance/account-deep-research-positive-control-v1${suffix}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({ path, ...artifact.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
