#!/usr/bin/env node
/** Reproducible Pilot 2 Track-A validation. Converts only live, official supplier
 * intake pages discovered by the bounded search into pipeline candidates; the
 * canonical pipeline remains the sole Decision authority. */
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
const { runLeadLensPipeline } = await import("@/lib/pipeline");
const { canonicalCaseForLead } = await import("@/lib/intelligence/productive-spine");

const inputPath = process.env.PILOT2_TRACK_A_INPUT ?? "output/pilot2/2026-09-30-actionability-v1/track-a-search.json";
const outputPath = process.env.PILOT2_TRACK_A_OUTPUT ?? "output/pilot2/2026-09-30-actionability-v1/track-a-validation.json";
const search = JSON.parse(readFileSync(inputPath, "utf8"));
const candidates: any[] = [];
const extractionAudit: any[] = [];
for (const observation of search.observations.filter((o: any) => o.family === "supplier_access")) {
  const domain = observation.account.domain;
  const result = observation.results.find((r: any) => {
    try { const host = new URL(r.url).hostname.replace(/^www\./, ""); return (host === domain || host.endsWith(`.${domain}`)) && /supplier|vendor|submission|new item/i.test(`${r.title ?? ""} ${r.snippet ?? ""} ${r.url}`); }
    catch { return false; }
  });
  if (!result) { extractionAudit.push({ company: observation.account.company, status: "no_official_intake_result" }); continue; }
  try {
    const response = await fetch(result.url, { headers: { "user-agent": "LeadLens/1.0 public-source-verification" }, signal: AbortSignal.timeout(15_000) });
    const html = response.ok ? await response.text() : "";
    const active = response.ok && /\b(submit|submission|apply|application|new item|new vendor|become a (?:new )?vendor)\b/i.test(html)
      && !/\b(not accepting|no longer accepting|submissions? (?:are )?closed|program (?:is )?paused)\b/i.test(html);
    extractionAudit.push({ company: observation.account.company, url: result.url, http_status: response.status, active_intake: active, observed_at: new Date().toISOString() });
    if (!active) continue;
    candidates.push({
      id: `track_a_${observation.account.company.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      company: observation.account.company, domain, country: "United States", location: "United States",
      industry: "Natural and organic grocery", source: "public_signal", source_url: result.url,
      raw_context: `${result.title ?? "Official supplier intake"}\n${result.snippet ?? ""}`,
      confidence_score: .9, signal_date: null, signal_type: null,
      opportunity_kind: "channel_fit", opportunity_kind_reason: "Official supplier/new-item intake fetched live.",
      channel_evidence_grade: "strong", channel_proof_type: "supplier_intake", channel_category_alignment: "plausible",
      channel_limitations: ["A public submission path is not buying intent and does not guarantee acceptance."],
      current_actionability_verified: true, current_actionability_basis: "active_supplier_submission",
      commercial_mechanism: "supplier_intake", access_path_identified: true, access_verified: true,
      actionability_source_url: result.url, actionability_observed_at: new Date().toISOString(),
      account_visibility: "established", discovery_value: "high", discovery_value_reason: "Live official commercial entry mechanism.",
      discovery_origin: "dynamic_enumeration", country_confidence: "high",
    });
  } catch (error) { extractionAudit.push({ company: observation.account.company, url: result.url, status: "fetch_failed", error: error instanceof Error ? error.message : String(error) }); }
}
const onboardingData: any = { company_name: "Amor de Gea", company_description: "Colombian maker of premium botanical wellness beverages in glass bottles.", offer_description: "Premium botanical wellness beverages in glass, for US retail/hospitality/gifting channels.", value_proposition: "Premium natural positioning; small-batch; glass presentation.", target_customer_description: "US premium natural/specialty F&B retailers, wellness hotels/spas, premium gifting companies, and specialty importers of premium natural brands.", tone: "consultative", contact_email: "founder@example.com", output_language: "en", target_market_region: "north_america", target_countries: ["United States"], product_code: "premium_launch_v0" };
const targetIndustries = ["Specialty food and beverage retail", "Natural and organic grocery", "Specialty food importer and distributor", "Wellness hospitality and spa", "Premium gifting"];
const icp: any = { target_industries: targetIndustries, target_titles: [], company_size_range: "", pain_points: [], disqualifiers: ["mass-market discount retailer", "pharmacy", "medical channel", "online marketplace"], ideal_signals: [], exclusions_explicit: [], icp_clarity_score: 80 };
const criteria: any = { target_industries: targetIndustries, target_company_size: [], target_job_titles: [], target_geography: ["United States"], excluded_industries: ["mass retail", "pharmacy", "marketplace"], buying_signals: [], disqualification_criteria: icp.disqualifiers, offer_summary: onboardingData.offer_description, value_proposition: onboardingData.value_proposition, tone: "consultative", plan: "pro", lead_count: candidates.length, require_real_discovery: true, output_language: "en", target_market_region: "north_america" };
let cases: any[] = [];
let processed: any[] = [];
if (candidates.length) {
  const report: any = await runLeadLensPipeline({ onboardingData, plan: "pro", icpOverride: icp, criteriaOverride: criteria, candidatesOverride: candidates, decisionOnly: true, researchCandidateLimit: candidates.length, deliveryLimit: candidates.length, researchConcurrency: 2 });
  processed = report.processed_leads ?? [];
  cases = processed.map((lead: any) => canonicalCaseForLead(lead)).filter(Boolean);
}
writeFileSync(outputPath, JSON.stringify({ version: "pilot2-actionability-track-a-validation-v1", created_at: new Date().toISOString(), input: inputPath, extractionAudit, candidates: candidates.map((c) => ({ company: c.company, domain: c.domain, source_url: c.source_url, actionability_observed_at: c.actionability_observed_at })), cases, processed_leads: processed }, null, 2));
console.log(JSON.stringify({ output: outputPath, live_official_candidates: candidates.length, decisions: cases.reduce((a: any, c: any) => { a[c.decision] = (a[c.decision] ?? 0) + 1; return a; }, {}) }));
