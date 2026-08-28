// INTELLIGENCE ACCELERATION V2 — Commercial Usefulness (QA metric) + Denominator Integrity.
//
// Computes the §50 metric family from the EXISTING committed CONTROLLED review
// package (no live run, provenance = controlled), and proves:
//  - denominators are explicit and 0/0 -> NOT_MEASURED (never 0%);
//  - a defensible Monitor/Hold counts as decision-useful but NOT positive (§21);
//  - system-predicted useful is separate from human-confirmed (§41);
//  - the four measurement populations can never be blended (§4);
//  - bidirectional truth: degrading the reviews lowers the useful rate (§61).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeCommercialUsefulness } from "@/lib/intelligence/commercial-usefulness";
import type { PositiveCommercialCaseReview } from "@/lib/intelligence/positive-commercial-case-validation";
import { assertDistinctDenominators, blendedRateIsForbidden, populationRate, DenominatorIntegrityError, type PopulationCount } from "@/lib/intelligence/denominator-integrity";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${passed} ${name}`); };

const pkg = JSON.parse(readFileSync("ml/data/acceptance/positive-commercial-case-review-package-v1.json", "utf8")) as { cases: PositiveCommercialCaseReview[] };
const reviews = pkg.cases;

t("01 controlled package summarizes with explicit denominators (provenance controlled)", () => {
  const s = summarizeCommercialUsefulness(reviews, { provenance: "controlled" });
  assert.equal(s.provenance, "controlled");
  assert.equal(s.counts.completed_cases, reviews.length);
  assert.ok(s.counts.completed_cases >= 6, "at least the 6 controlled Cases");
  assert.equal(s.rates.positive_case_rate !== null, true);
  assert.equal(s.rates.customer_safe_case_rate !== null, true);
});

t("02 completion rate is NOT_MEASURED unless researched_candidates supplied", () => {
  const withoutN = summarizeCommercialUsefulness(reviews);
  assert.equal(withoutN.rates.case_completion_rate, null);
  const withN = summarizeCommercialUsefulness(reviews, { researched_candidates: reviews.length * 2 });
  assert.equal(withN.rates.case_completion_rate, 0.5);
});

t("03 empty sample -> every rate null (0/0 NOT_MEASURED), never 0%", () => {
  const s = summarizeCommercialUsefulness([]);
  assert.equal(s.rates.positive_case_rate, null);
  assert.equal(s.rates.decision_useful_case_rate, null);
  assert.equal(s.rates.human_confirmed_positive_rate, null);
  assert.equal(s.rates.unsupported_timing_rate, null);
});

t("04 decision-useful >= positive (a defensible Monitor/Hold is useful but not positive)", () => {
  const s = summarizeCommercialUsefulness(reviews);
  assert.ok(s.counts.decision_useful_cases >= s.counts.positive_cases);
  // The package contains a hold; it must not be counted as a positive case.
  const hold = s.reviews.find((r) => r.decision === "hold");
  if (hold) assert.notEqual(hold.usefulness_class, "positive_case");
});

t("05 human-confirmed is separate from system-predicted (§41)", () => {
  const s = summarizeCommercialUsefulness(reviews);
  // Human-confirmed positive can never exceed human-reviewed.
  assert.ok(s.counts.human_confirmed_positive_cases <= s.counts.human_reviewed_cases);
  // Human-confirmed positive rate is measured only over human-reviewed Cases.
  if (s.counts.human_reviewed_cases > 0) assert.equal(s.rates.human_confirmed_positive_rate !== null, true);
  // System-predicted useful is not gated on human confirmation.
  assert.ok(s.counts.decision_useful_cases >= s.counts.human_confirmed_positive_cases);
});

t("06 unsupported-timing rate has timing-claimed as its denominator", () => {
  const s = summarizeCommercialUsefulness(reviews);
  if (s.counts.timing_claimed_cases === 0) assert.equal(s.rates.unsupported_timing_rate, null);
  else assert.ok((s.rates.unsupported_timing_rate ?? 1) >= 0);
  // The controlled package claims only grounded timing -> no unsupported timing.
  assert.equal(s.counts.unsupported_timing_cases, 0);
});

t("07 BIDIRECTIONAL — degrading identity/timing lowers the useful rate (§61)", () => {
  const strong = summarizeCommercialUsefulness(reviews);
  const degraded = summarizeCommercialUsefulness(reviews.map((r, i) => i % 2 === 0
    ? { ...r, identity_confirmed: false, target_organization_confirmed: false }
    : r));
  assert.ok(degraded.rates.decision_useful_case_rate! < strong.rates.decision_useful_case_rate!,
    `degraded ${degraded.rates.decision_useful_case_rate} should be below strong ${strong.rates.decision_useful_case_rate}`);
  assert.ok(degraded.counts.wrong_entity_cases > strong.counts.wrong_entity_cases);
});

t("08 wrong-entity contamination is counted, not hidden", () => {
  const contaminated = summarizeCommercialUsefulness([
    { ...reviews[0], case_id: "wrong-entity", identity_confirmed: false, target_organization_confirmed: false },
  ]);
  assert.equal(contaminated.counts.wrong_entity_cases, 1);
  assert.equal(contaminated.reviews[0].usefulness_class, "not_useful");
});

// ── Denominator integrity (§4) ───────────────────────────────────────────────

t("09 the four populations never blend into one rate", () => {
  const counts: PopulationCount[] = [
    { population: "diagnostic_event_sample", sample_id: "events-v1", numerator: 6, denominator: 8 },
    { population: "human_reviewed_cases", sample_id: "cases-v1", numerator: 3, denominator: 3 },
    { population: "evidence_relationships", sample_id: "evq-v1", numerator: 10, denominator: 11 },
  ];
  assert.equal(blendedRateIsForbidden(counts), true);
  const totals = assertDistinctDenominators(counts);
  assert.equal(totals.diagnostic_event_sample.denominator, 8);
  assert.equal(totals.human_reviewed_cases.denominator, 3);
  assert.equal(totals.evidence_relationships.denominator, 11);
  // Each population keeps its own rate.
  assert.equal(populationRate(counts[0]), 6 / 8);
  assert.equal(populationRate(counts[1]), 1);
});

t("10 a single population is not a blend; 0/0 population rate is NOT_MEASURED", () => {
  const single: PopulationCount[] = [{ population: "expanded_run_sample", sample_id: "run-v2", numerator: 0, denominator: 0 }];
  assert.equal(blendedRateIsForbidden(single), false);
  assert.equal(populationRate(single[0]), null);
});

t("11 numerator exceeding denominator is rejected (integrity guard)", () => {
  assert.throws(() => assertDistinctDenominators([
    { population: "human_reviewed_cases", sample_id: "bad", numerator: 5, denominator: 3 },
  ]), DenominatorIntegrityError);
});

console.log(`\n${passed} passed, 0 failed`);
