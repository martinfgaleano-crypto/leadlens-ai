import { loadEnv } from "./lib/load-env.mjs";
for (const [key, value] of Object.entries(loadEnv())) if (typeof value === "string") process.env[key] = value;
const { deepenAccountResearch } = await import("@/lib/intelligence/account-deep-research");

const url = process.env.LEADLENS_EVENT_CANARY_URL;
const company = process.env.LEADLENS_EVENT_CANARY_COMPANY;
const domain = process.env.LEADLENS_EVENT_CANARY_DOMAIN;
const headline = process.env.LEADLENS_EVENT_CANARY_HEADLINE;
if (!url || !company || !domain || !headline) throw new Error("LEADLENS_EVENT_CANARY_URL, COMPANY, DOMAIN and HEADLINE are required");

const result = await deepenAccountResearch({
  id: "productive-event-hint-canary", company, domain, country: "United States", location: "United States",
  industry: "Logistics and supply chain", confidence_score: 0.95,
  source: "public_signal", source_url: url, raw_context: "",
  research_hints: [{ event_type_hint: "expansion", event_date_hint: null, source_url_hint: url, headline, source_excerpt: headline, provider: "brave" }],
} as never, {
  offer_summary: "Warehouse automation, WMS integration and inventory orchestration",
  value_proposition: "Improve warehouse operations and inventory orchestration",
  target_industries: ["Logistics and supply chain"], target_company_size: [], target_job_titles: [], target_geography: ["United States"],
  excluded_industries: [], buying_signals: ["expansion", "capacity", "operational_transformation"], disqualification_criteria: [],
  tone: "consultative", plan: "sample", lead_count: 1, output_language: "en", require_real_discovery: true,
}, { providers: [], maxQueries: 1, maxExtractions: 1 });

console.log(JSON.stringify({
  event_hints_received: result.telemetry.event_hints_received,
  event_hints_fetched: result.telemetry.event_hints_fetched,
  event_hints_validated: result.telemetry.event_hints_validated,
  extraction_audit: result.telemetry.extraction_audit,
  validated_events: result.validated_events,
  early_stop_reason: result.telemetry.early_stop_reason,
}, null, 2));
