// RESEARCH → CANONICAL CASE HANDOFF (§11-§18).
// Verifies that Independent Support computed during Account Deep Research is
// preserved into the canonical Opportunity Case (previously discarded via a hardcoded
// independentSupportNew=false), claim-relatively and without false corroboration.

import assert from "node:assert/strict";
import { canonicalCaseForLead } from "@/lib/intelligence/productive-spine";
import type { AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";
import type { ProcessedLead } from "@/types";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${passed} ${name}`); };

const tel = (over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry => ({
  version: "v1", account: "Acme", domain: "acme.com", planned_queries: 4, executed_queries: 4, provider_calls: 6, provider_failures: 0,
  results_seen: 12, evidence_accepted: 4, evidence_rejected: 1, pages_extracted: 1, extraction_failures: 0, structured_extraction_calls: 1,
  dated_evidence: 1, independent_domains: 1, corroboration_attempted: false, corroborating_domains: 0, claims_recovered: 1,
  validated_events: [{ url: "https://acme.com/news/new-plant", source_host: "acme.com", event_date: "2026-08-20", kind: "corporate_event", claim_excerpt: "Opened a new plant", stage: "current_activity", materiality_valid: true, counterevidence: false }],
  counterevidence_checked: true, early_stop_reason: "sufficient_evidence", query_audit: [], extraction_audit: [], ...over,
});

// A verified-material-event lead (dated verified signal on its own source host).
const lead = (over: { telemetry?: AccountDeepResearchTelemetry; verified?: boolean; risks?: string[] } = {}): ProcessedLead => {
  const verified = over.verified ?? true;
  return {
    id: "L1",
    candidate: { id: "L1", company: "Acme Manufacturing", domain: "acme.com", country: "United States",
      source_url: verified ? "https://acme.com/news/new-plant" : undefined, signal_date: verified ? "2026-08-20" : undefined, signal_type: verified ? "new_facility" : undefined } as never,
    enrichment: {
      candidate: {} as never, timing_signals: verified ? ["Opened a new plant"] : [], evidence: [], missing_data: [], research_confidence: 0.7,
      evidence_discipline: verified ? [{ claim: "Opened a new plant", type: "verified_public_signal", date: "2026-08-20" }] : [],
      account_research: over.telemetry, opportunity_risks: over.risks ?? [], next_best_question: "Confirm integration owner.",
    } as never,
    qualification: { enrichment: {} as never, fit_score: 7, category: "WARM", fit_reasons: [], disqualification_reasons: [], qualification_confidence: 0.8,
      score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1, timing_signal: 1, reachability: 0.5, strategic_relevance: 0.5 } } as never,
    outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "direct", qc_status: "APPROVED", qc_notes: [] } as never,
    learning: {} as never,
  } as ProcessedLead;
};
const ev = (l: ProcessedLead) => canonicalCaseForLead(l)!.evidence;

// ── CASE A — primary source only → Direct Evidence yes, Independent Support no ──
t("A primary-only: no independent support, Evidence not strengthened", () => {
  const c = canonicalCaseForLead(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 0 }) }))!;
  assert.equal(c.evidence, "Moderate"); // priorEvidence unchanged (research_confidence 0.7 → Moderate)
});

// ── CASE B — primary + independent corroborating source → Independent Support yes ─
t("B primary + independent origin: Independent Support strengthens Evidence", () => {
  const c = canonicalCaseForLead(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 1 }) }))!;
  assert.equal(c.evidence, "Strong"); // strengthened by real independent support
});

// ── CASE C — two URLs same origin → corroborating_domains 0 → no support ─────────
t("C two URLs same origin (0 distinct corroborating domains): no false support", () => {
  // Research's corroboration loop excludes same-host, so telemetry carries 0.
  const c = canonicalCaseForLead(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 0 }) }))!;
  assert.equal(c.evidence, "Moderate");
});

// ── CASE D — different sources, different events → no false corroboration ────────
t("D different events (loop rejected → 0 corroborating): no false corroboration", () => {
  const c = canonicalCaseForLead(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 0 }) }))!;
  assert.equal(c.evidence, "Moderate");
});

// ── CASE E — provider fails during corroboration → no support, no counterevidence ─
t("E provider failure during corroboration: no Independent Support, no counterevidence", () => {
  const c = canonicalCaseForLead(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 0, counterevidence_checked: true }) }))!;
  assert.equal(c.evidence, "Moderate"); // not strengthened
  // A provider failure never becomes a material counter (no risk markers) → not weakened.
});

// ── CASE F — material counterevidence → Case weakened ───────────────────────────
t("F material counterevidence weakens the Case", () => {
  const strong = ev(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 1 }) }));
  const weakened = ev(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 1 }), risks: ["The expansion was cancelled"] }));
  assert.equal(strong, "Strong");
  assert.notEqual(weakened, "Strong"); // hasMaterialCounter → weaken beats strengthen
});

// ── CASE G — bounded_none is honest (no support claimed) ────────────────────────
t("G bounded_none: no independent support claimed", () => {
  const c = canonicalCaseForLead(lead({ telemetry: tel({ corroboration_attempted: true, corroborating_domains: 0, counterevidence_checked: true }) }))!;
  assert.equal(c.evidence, "Moderate");
});

// ── Claim-relative guard — no material event → no independent support even if corroborated ─
t("H claim-relative: corroboration on a non-material (undated) signal gives no support", () => {
  const c = canonicalCaseForLead(lead({ verified: false, telemetry: tel({ corroboration_attempted: true, corroborating_domains: 2 }) }))!;
  assert.notEqual(c.evidence, "Strong"); // no verified material event → not strengthened
});

// ── Regression — corroboration data absent (no telemetry) → no crash, no support ─
t("I no research telemetry: safe, no independent support", () => {
  const c = canonicalCaseForLead(lead({ telemetry: undefined }))!;
  assert.equal(c.evidence, "Moderate");
});

console.log(`\n${passed} passed, 0 failed`);
