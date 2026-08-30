// RESEARCH MATERIALITY & TEMPORAL INTEGRITY V1 — controlled matrix (§6/§7/§9/§21).
// Proves: a VERIFIED static company fact is NOT a material event and does NOT create
// Timing in the canonical Case; a real material event still does; and event/materiality
// are separate from corroboration.

import assert from "node:assert/strict";
import { isMaterialEventClaim } from "@/lib/intelligence/evidence-materiality";
import { canonicalCaseForLead } from "@/lib/intelligence/productive-spine";
import type { LeadCandidate, ProcessedLead } from "@/types";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };

// ── §21 matrix on the shared deterministic predicate ────────────────────────────
const STATIC_FACTS = [
  "Company operates 25 manufacturing facilities",
  "Kroger serves nearly 11 million customers daily",
  "Albertsons operates 22 dedicated distribution centers and 19 manufacturing facilities",
  "Headquartered in Bloomfield, Connecticut",
  "Is the world's leading provider of fuzes and safe-and-arm devices",
  "Is in an active digital and supply chain transformation phase",
];
const MATERIAL_EVENTS = [
  "Opened a new plant in Ohio",
  "Acquired a rival supplier",
  "Broke ground on a new distribution center",
  "Invested $50M in a new warehouse",
  "Launched a new product line",
];

t("A/G static verified facts are NOT material events (even corroborated)", STATIC_FACTS.every((c) => !isMaterialEventClaim(c)));
t("B recent + C old material events ARE material events", MATERIAL_EVENTS.every((c) => isMaterialEventClaim(c)));
t("empty/whitespace claim is not a material event", !isMaterialEventClaim("") && !isMaterialEventClaim("   "));

// ── Case-level: a static fact with an attached date must not become Timing ───────
const baseCandidate = (over: Partial<LeadCandidate> = {}): LeadCandidate => ({
  id: "lead_1", company: "Globex", domain: "globex.com", source: "public_signal",
  source_url: "https://news.example/x", confidence_score: 0.9, country: "United States", ...over,
});
const leadWith = (candidate: LeadCandidate, evidence: Array<{ claim: string; type: string; date?: string }>): ProcessedLead => ({
  id: candidate.id,
  candidate,
  enrichment: { candidate, timing_signals: [], evidence: [], missing_data: [], research_confidence: 0.8, evidence_discipline: evidence, next_best_question: "Confirm." } as never,
  qualification: { enrichment: {} as never, fit_score: 7, category: "WARM", fit_reasons: [], disqualification_reasons: [], qualification_confidence: 0.7, score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1, timing_signal: 0, reachability: 1, strategic_relevance: 1 } } as never,
  outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "direct", qc_status: "APPROVED", qc_notes: [] } as never,
} as ProcessedLead);

// D/E — static fact tagged verified_public_signal WITH an LLM date, but NO validated
// event date on the candidate → must NOT be treated as a material dated signal.
const staticCase = canonicalCaseForLead(leadWith(baseCandidate({ signal_date: null }), [
  { claim: "Company operates 25 manufacturing facilities", type: "verified_public_signal", date: "2026-08-05" },
]))!;
t("D/E static fact + date does NOT become a verified material signal (timing not Strong)", staticCase.timing !== "Strong");
t("D/E static-fact Case is not prioritized on a fabricated event", staticCase.decision === "hold" || staticCase.decision === "monitor" || staticCase.decision === "validate");

// A real material event claim (verified_public_signal + date) IS credited.
const eventCase = canonicalCaseForLead(leadWith(baseCandidate({ signal_date: null }), [
  { claim: "Opened a new automated distribution center in Texas", type: "verified_public_signal", date: "2026-07-01" },
]))!;
t("recent material event claim is credited as a verified signal", eventCase.timing === "Moderate" || eventCase.timing === "Strong");

// A deterministically validated event date on the candidate is trusted independently
// even if the evidence_discipline claim wording is terse/low-materiality.
const validatedCase = canonicalCaseForLead(leadWith(baseCandidate({ signal_date: "2026-06-15", signal_type: "expansion" }), [
  { claim: "Expanded operations", type: "verified_public_signal", date: "2026-06-15" },
]))!;
t("a deterministically validated candidate.signal_date is trusted (recall preserved)", validatedCase.timing === "Moderate" || validatedCase.timing === "Strong");

console.log(`\n${passed} passed, 0 failed`);
