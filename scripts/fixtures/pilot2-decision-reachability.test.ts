import assert from "node:assert/strict";
import { canonicalCaseForLead, decisionCriticalQuestionsForLead } from "../../lib/intelligence/productive-spine";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✅ ${name}`); };

const eventDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
function lead(opts: { date?: string | null; question?: string | null; fit?: number; access?: boolean; counter?: boolean; source?: string | null; industry?: string }) {
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

console.log(`\n${passed} passed, 0 failed`);
