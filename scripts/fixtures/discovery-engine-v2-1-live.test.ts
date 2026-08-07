// Discovery Engine V2.1 — live validation tests. Deterministic over the captured
// real observations; verifies live/fixture separation and honesty invariants.
import assert from "node:assert/strict";
import {
  buildLiveBenchmark, LIVE_COTELCO_SAMPLE, LIVE_ACCESSIBILITY, ACCESSIBILITY_STATES,
  DEPTH_LEVELS, validDepthTransition, confidenceAfterOneLiveRun, DEPTH_COST,
} from "../../lib/discovery/source-intelligence/live";
import { runBenchmark } from "../../lib/discovery/source-intelligence/benchmark";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };
const b = buildLiveBenchmark();
const fx = runBenchmark();

// 1–3. Live vs fixture metadata cannot be confused.
t("1 live artifact is live_source + live_execution", b.data_basis === "live_source" && b.live_execution === true);
t("2 fixture artifact stays deterministic_fixture + 0 providers", fx.data_basis === "deterministic_fixture" && fx.live_execution === false && fx.provider_calls === 0);
t("3 different artifact ids (never merged)", b.id === "discovery-v2-colombia-hospitality-live-001" && fx.id === "discovery-v2-colombia-hospitality-001" && String(b.id) !== String(fx.id));

// 4–6. Live requires real observations; cohorts honest.
t("4 real company-level sample present (no people data)", LIVE_COTELCO_SAMPLE.length === 4 && LIVE_COTELCO_SAMPLE.every((e) => e.official_domain && !("email" in e) && !("phone" in e)));
t("5 structured cohort executed live; search/hybrid not_executed with reason", (() => {
  const s = b.cohorts.find((c) => c.cohort === "structured")!; const se = b.cohorts.find((c) => c.cohort === "search")!;
  return s.status === "executed" && s.live_execution === true && se.status === "not_executed" && (se.reason?.length ?? 0) > 10;
})());
t("6 total provider calls = 0 (browser access, honest)", b.total_provider_calls === 0);

// 7–9. Operational accessibility is first-class + honest states.
t("7 accessibility states valid", LIVE_ACCESSIBILITY.every((a) => a.states.every((s) => (ACCESSIBILITY_STATES as readonly string[]).includes(s))));
t("8 Cotelco = direct_access + JS/pagination complexity recorded", (() => { const a = LIVE_ACCESSIBILITY.find((x) => x.source_id === "co_cotelco")!; return a.states.includes("direct_access") && a.states.includes("javascript_heavy") && a.states.includes("pagination_complex"); })());
t("9 search source records operational limitation (no creds)", (() => { const a = LIVE_ACCESSIBILITY.find((x) => x.source_id === "search_engine")!; return a.states.includes("operationally_unsuitable") && /credentials/i.test(a.failure_reason ?? ""); })());

// 10–12. Research depth model.
t("10 depth levels L0–L5", DEPTH_LEVELS.length === 6 && DEPTH_LEVELS[0] === "L0_discovery" && DEPTH_LEVELS[5] === "L5_deep_opportunity");
t("11 valid depth transition = +1 only", validDepthTransition("L0_discovery", "L1_identity") && !validDepthTransition("L0_discovery", "L2_business_model"));
t("12 evidence costs more than discovery", DEPTH_COST.L4_evidence > DEPTH_COST.L0_discovery && DEPTH_COST.L5_deep_opportunity >= DEPTH_COST.L4_evidence);

// 13–15. Verification economics + domain-directly-provided finding.
const s = b.cohorts.find((c) => c.cohort === "structured")!;
t("13 verification economics computed, provider cost estimated (not actual)", s.verification!.provider_calls === 0 && s.verification!.actual_provider_cost === null && s.verification!.estimated_provider_cost > 0 && s.verification!.cost_per_verified_account !== null);
t("14 domains directly provided (4/4) — verified domain yield 100%", s.funnel!.official_domains_verified === 4 && s.funnel!.direct_domains === 4 && s.funnel!.search_resolved_domains === 0);
t("15 fixture-vs-live records the wrong domain assumption", b.fixture_vs_live.some((x) => /lack official domains/i.test(x.assumption) && /directly/i.test(x.live)));

// 16–18. Novelty + funnel + no fabrication.
t("16 all live entities genuinely new (none in Amor memory)", s.funnel!.genuinely_new === 4);
t("17 funnel monotonic + no late rejections in sample", s.funnel!.raw_candidates >= s.funnel!.evidence_sufficient && b.rejection_analysis[0].count === 0);
t("18 opportunity classified plausible (not strong — spa unverified)", b.review_sample.every((r) => /plausible/i.test(r.decision)));

// 19–21. Confidence discipline.
t("19 one valid live run ⇒ benchmarked at most", confidenceAfterOneLiveRun("hypothesized", true) === "benchmarked");
t("20 invalid/small sample cannot promote", confidenceAfterOneLiveRun("hypothesized", false) === "hypothesized");
t("21 no source promoted to historically_effective", b.source_confidence_changes.every((c) => c.to !== "historically_effective") && b.source_confidence_changes[0].to === "benchmarked");

// 22–24. Learning approval-gated + small-sample honesty + INSUFFICIENT LIVE EVIDENCE.
t("22 recommendations approval-gated, not auto-applied, sample-sized", b.recommendations.every((r) => r.human_approval_required === true && r.auto_applied === false && typeof r.sample_size === "number"));
t("23 warnings mark small sample + awaiting outcomes", /SMALL sample/i.test(b.warnings.join(" ")) && /awaiting_real_outcomes/.test(b.warnings.join(" ")));
t("24 strategy ranking honestly INSUFFICIENT LIVE EVIDENCE", /INSUFFICIENT LIVE EVIDENCE/i.test(b.founder_decisions.preferred_strategy) && /NOT YET/i.test(b.founder_decisions.ready_for_manufacturing));

// 25. Research queue prioritizes real bottlenecks.
t("25 research queue targets JS parser + search creds", b.research_queue.some((q) => /parser/i.test(q.task)) && b.research_queue.some((q) => /provider|creds|search/i.test(q.task)));

console.log(`\n${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
