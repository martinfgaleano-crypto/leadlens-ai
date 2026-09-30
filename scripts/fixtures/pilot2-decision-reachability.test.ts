import assert from "node:assert/strict";
import { canonicalCaseForLead, decisionCriticalQuestionsForLead, enforceCanonicalAdvancedTierReadiness } from "../../lib/intelligence/productive-spine";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✅ ${name}`); };

const eventDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
function lead(opts: { date?: string | null; question?: string | null; fit?: number; access?: boolean; currentAccess?: boolean; counter?: boolean; source?: string | null; industry?: string }) {
  const date = opts.date ?? null;
  return {
    id: "acct-1",
    candidate: {
      id: "acct-1", company: "US Specialty Retailer", domain: "retailer.example", country: "United States",
      industry: opts.industry ?? "Natural grocery retailer", source: "public_signal", confidence_score: .9,
      source_url: opts.source === undefined ? "https://retailer.example/news/expansion" : opts.source,
      signal_date: date, signal_type: date ? "corporate_event" : null,
      opportunity_kind: opts.access ? "channel_fit" : undefined,
      channel_evidence_grade: opts.access ? "moderate" : undefined,
      access_verified: opts.access,
      current_actionability_verified: opts.currentAccess,
      actionability_source_url: opts.currentAccess ? "https://retailer.example/new-item-submission" : undefined,
    },
    enrichment: {
      candidate: {}, company_summary: "A US natural grocery retailer carrying third-party brands.",
      timing_signals: date ? ["Announced a current store expansion"] : [], evidence: [], missing_data: [], research_confidence: .88,
      next_best_question: opts.question ?? null,
      opportunity_risks: opts.counter ? ["The expansion was cancelled"] : [],
      account_research: {
        validated_events: date ? [{ event_type: "corporate_event", event_date: date, materiality_valid: true }] : [],
        corroboration_attempted: true, corroborating_domains: 1, counterevidence_material_found: opts.counter === true,
      },
    },
    qualification: { fit_score: opts.fit ?? 9, category: "HOT", fit_reasons: ["Strong objective fit"] },
    outreach: { qc_status: "APPROVED" },
    learning: {},
  } as any;
}

test("execution diligence is not automatically decision-critical", () => {
  const l = lead({ date: eventDate(20), question: "Identify the relevant category buyer and prepare a concise supplier-fit brief." });
  assert.deepEqual(decisionCriticalQuestionsForLead(l), []);
  assert.equal(canonicalCaseForLead(l)?.decision, "prioritize");
});
test("an open commercial window remains decision-critical and caps at Validate", () => {
  const l = lead({ date: eventDate(20), question: "Confirm whether the vendor submission window remains open." });
  assert.equal(decisionCriticalQuestionsForLead(l).length, 1);
  assert.equal(canonicalCaseForLead(l)?.decision, "validate");
});
test("verified channel access without a dated event reaches Validate, never Prioritize", () => {
  assert.equal(canonicalCaseForLead(lead({ access: true, source: "https://retailer.example/vendors", question: "Identify the category buyer." }))?.decision, "validate");
});
test("live official supplier submission is a Prioritize-quality actionability basis", () => {
  const l = lead({ access: true, currentAccess: true, source: "https://retailer.example/new-item-submission", question: "Identify the category buyer and prepare the submission." });
  assert.deepEqual(decisionCriticalQuestionsForLead(l), []);
  const c = canonicalCaseForLead(l);
  assert.equal(c?.decision, "prioritize");
  assert.ok(c?.reasons.includes("ongoing_access_not_buying_intent"));
});
test("current access fails closed when its own provenance is missing", () => {
  const l = lead({ access: true, currentAccess: true, source: "https://retailer.example/news/earnings" });
  delete l.candidate.actionability_source_url;
  assert.equal(canonicalCaseForLead(l)?.decision, "hold");
});
test("verified access does not suppress a separately validated current material event", () => {
  assert.equal(canonicalCaseForLead(lead({ access: true, date: eventDate(10), question: "Identify the category buyer." }))?.decision, "prioritize");
});
test("strong fit alone remains Hold", () => {
  assert.equal(canonicalCaseForLead(lead({ source: null, industry: "Consumer products", question: "Identify the category buyer." }))?.decision, "hold");
});
test("a real aging event reaches Monitor", () => {
  assert.equal(canonicalCaseForLead(lead({ date: eventDate(120), question: "Identify the relevant category buyer." }))?.decision, "monitor");
});
test("material counterevidence blocks Prioritize", () => {
  assert.equal(canonicalCaseForLead(lead({ date: eventDate(20), question: "Identify the relevant category buyer.", counter: true }))?.decision, "validate");
});
test("advanced delivery uses the final canonical decision, not a pre-synthesis actionability proxy", () => {
  const l = lead({ access: true, currentAccess: true, question: "Confirm whether the vendor submission window remains open." });
  l.learning.evidence_quality = "medium";
  const canonical = canonicalCaseForLead(l)!;
  assert.equal(canonical.decision, "validate");
  const report = {
    processed_leads: [l], canonical_cases: [canonical],
    delivery_readiness: { status: "ready", reasons: [], required_actions: [] },
  } as any;
  assert.equal(enforceCanonicalAdvancedTierReadiness(report, "standard"), 0);
  assert.equal(report.delivery_readiness.status, "blocked");
  assert.ok(report.delivery_readiness.required_actions.some((x: string) => x.includes("ACTIONABILITY_RESEARCH_REQUIRED")));
});
test("canonical Prioritize with verified live provenance satisfies advanced actionability", () => {
  const l = lead({ access: true, currentAccess: true, question: "Identify the category buyer and prepare the submission." });
  l.learning.evidence_quality = "medium";
  const canonical = canonicalCaseForLead(l)!;
  const report = {
    processed_leads: [l], canonical_cases: [canonical],
    delivery_readiness: { status: "blocked", reasons: ["portfolio delivery requires at least one evidence-qualified Prioritize account."], required_actions: ["ACTIONABILITY_RESEARCH_REQUIRED: deepen research"] },
  } as any;
  assert.equal(enforceCanonicalAdvancedTierReadiness(report, "standard"), 1);
  assert.equal(report.delivery_readiness.status, "ready");
});

console.log(`\n${passed} passed, 0 failed`);
