import assert from "node:assert/strict";
import { promotePrimarySourceEvent } from "../../lib/intelligence/primary-source-event-promotion";
import type { ProcessedLead } from "../../types";

function lead(raw: string, url = "https://retailer.example/news/opening"): ProcessedLead {
  return {
    id: "x", candidate: { id: "x", company: "Example Market", domain: "retailer.example", source: "public_signal", source_url: url, raw_context: raw, confidence_score: .9, country: "United States" },
    enrichment: { candidate: {} as never, timing_signals: [], evidence: [], missing_data: [], research_confidence: .8, evidence_discipline: [], account_research: { version: "v", account: "Example Market", domain: "retailer.example", planned_queries: 0, executed_queries: 0, provider_calls: 0, provider_failures: 0, results_seen: 0, evidence_accepted: 0, evidence_rejected: 0, pages_extracted: 0, extraction_failures: 0, structured_extraction_calls: 0, dated_evidence: 0, independent_domains: 0, corroboration_attempted: false, corroborating_domains: 0, claims_recovered: 0, counterevidence_checked: false, early_stop_reason: "no_material_event", query_audit: [], extraction_audit: [], validated_events: [] } } as never,
    qualification: { enrichment: {} as never, fit_score: 8, category: "WARM", fit_reasons: [], disqualification_reasons: [], qualification_confidence: .8, score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1, timing_signal: 1, reachability: 1, strategic_relevance: 1 } } as never,
    outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "direct", qc_status: "APPROVED", qc_notes: [] } as never,
  } as ProcessedLead;
}

const event = lead("[2026-05-13T00:00:00] Example Market announced it will open three new stores in Boston. Austin, Texas (May 13, 2026). (source: https://retailer.example/news/opening)");
const promoted = promotePrimarySourceEvent(event);
assert.equal(promoted?.eventDate, "2026-05-13");
assert.equal(event.candidate.signal_date, "2026-05-13");
assert.equal(event.enrichment.account_research?.validated_events?.[0]?.stage, "primary_source_recovery");

const staticPage = lead("Example Market operates three stores and serves premium shoppers. About us.", "https://retailer.example/about");
assert.equal(promotePrimarySourceEvent(staticPage), null);
assert.equal(staticPage.candidate.signal_date, undefined);

const wrongEntity = lead("Other Market announced it will open three new stores. May 13, 2026.");
assert.equal(promotePrimarySourceEvent(wrongEntity), null);

const namedClub = lead("[2026-05-04T00:00:00] Example Market opens Ocotillo athletic country club in Gilbert. May 4, 2026.");
assert.equal(promotePrimarySourceEvent(namedClub)?.eventDate, "2026-05-04");

console.log("4 passed, 0 failed");
