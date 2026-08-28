// RUNTIME + LIVE VALIDATION INSTRUMENTATION V1 — controlled behavioral matrix (§24).
//
// Proves the per-account run trace + aggregate artifact are operational and offline-
// safe, WITHOUT any live provider run. Cases 1–16 are the required scenarios; the
// tail proves denominator isolation (§14), autonomy separation (§11), 0/0 (§14/§22),
// and paired before/after fingerprints (§23).

import assert from "node:assert/strict";
import { RunTraceRecorder, hashQuery, type IntelligenceRunTrace, type ProviderOpTrace } from "@/lib/intelligence/run-trace";
import { summarizeRunTraces, sampleFingerprint } from "@/lib/intelligence/run-trace-artifact";
import { assertDistinctDenominators, blendedRateIsForbidden, type PopulationCount } from "@/lib/intelligence/denominator-integrity";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${passed} ${name}`); };

// A controllable clock so wall-clock timing is deterministic.
function clock() { let ms = 1_000_000; return { now: () => ms, advance: (by: number) => { ms += by; } }; }
const op = (over: Partial<ProviderOpTrace> = {}): ProviderOpTrace => ({
  provider: "tavily", operation: "search", duration_ms: 100, ok: true, timeout: false,
  circuit_state: "ok", retries: 0, results: 5, cost_usd: null, input_tokens: null, output_tokens: null, ...over,
});

// ── CASE 1 — successful run, complete trace ──────────────────────────────────
t("01 successful account run produces a complete trace", () => {
  const c = clock();
  const r = new RunTraceRecorder({ run_id: "run-1", account_id: "acct-1", context_id_safe_reference: "ctx:ia-us", now: c.now });
  const s1 = r.stage("candidate_qualification"); c.advance(50); s1();
  r.addDepth("identity_verification");
  const s2 = r.stage("search_retrieval", { wait_ms: 200 }); c.advance(300); s2({ calls: 2 });
  r.recordProviderOp(op({ operation: "search", duration_ms: 200 }));
  r.recordQuery({ category: "event", hash: hashQuery("acct-1 new plant"), state: "executed", skipped_reason: null });
  const s3 = r.stage("case_synthesis"); c.advance(40); s3();
  r.setDecision("validate"); r.setStopReason("decision_sufficient"); r.recordEvidence(3, 1);
  r.setCommercialUsefulnessEvaluable(true);
  const trace = r.finalize();
  assert.equal(trace.completion_state, "completed");
  assert.equal(trace.final_decision, "validate");
  assert.equal(trace.counts.provider_calls, 1);
  assert.equal(trace.wall_clock_ms, 390);
  assert.ok(trace.research_depth.includes("identity_verification"));
});

// ── CASE 2 — provider timeout, trace still complete with failure class ───────
t("02 provider timeout still yields a complete trace + failure class", () => {
  const c = clock();
  const r = new RunTraceRecorder({ run_id: "run-2", account_id: "acct-2", context_id_safe_reference: "ctx", now: c.now });
  const s = r.stage("search_retrieval"); c.advance(30000); s({ ok: false });
  r.recordProviderOp(op({ ok: false, timeout: true, duration_ms: 30000, results: null }));
  r.setCompletion("failed"); r.setStopReason("timeout"); r.setFailureClass("timeout");
  const trace = r.finalize();
  assert.equal(trace.completion_state, "failed");
  assert.equal(trace.failure_class, "timeout");
  assert.equal(trace.provider_ops[0].timeout, true);
});

// ── CASE 3 — circuit-open provider, no fake attempt ──────────────────────────
t("03 circuit-open provider is recorded without a fabricated call result", () => {
  const r = new RunTraceRecorder({ run_id: "run-3", account_id: "acct-3", context_id_safe_reference: "ctx", now: clock().now });
  r.recordProviderOp(op({ ok: false, circuit_state: "rate_limited", results: null, duration_ms: 0 }));
  r.setStopReason("provider_degraded"); r.setFailureClass("provider"); r.setCompletion("failed");
  const trace = r.finalize();
  assert.equal(trace.provider_ops[0].circuit_state, "rate_limited");
  assert.equal(trace.provider_ops[0].results, null, "no fabricated result count for a blocked provider");
});

// ── CASE 4 — early structural rejection, no expensive stages ─────────────────
t("04 early structural rejection skips expensive stages", () => {
  const c = clock();
  const r = new RunTraceRecorder({ run_id: "run-4", account_id: "acct-4", context_id_safe_reference: "ctx", now: c.now });
  const s = r.stage("candidate_qualification"); c.advance(10); s();
  r.setStopReason("structural_disqualifier"); r.setFailureClass("identity"); r.setDecision("hold");
  const trace = r.finalize();
  assert.equal(trace.counts.full_text_calls, 0);
  assert.equal(trace.counts.llm_calls, 0);
  assert.equal(trace.stop_reason, "structural_disqualifier");
});

// ── CASE 5 — evidence sufficient early, further work skipped ──────────────────
t("05 evidence sufficient early: later stages explicitly skipped", () => {
  const r = new RunTraceRecorder({ run_id: "run-5", account_id: "acct-5", context_id_safe_reference: "ctx", now: clock().now });
  r.skipStage("corroboration", "evidence_sufficient");
  r.skipStage("counterevidence", "evidence_sufficient");
  r.setStopReason("evidence_sufficient");
  const trace = r.finalize();
  const skipped = trace.stages.filter((s) => s.skip_reason === "evidence_sufficient");
  assert.equal(skipped.length, 2);
  assert.equal(trace.stop_reason, "evidence_sufficient");
});

// ── CASE 6 — corroboration not required, no corroboration call ───────────────
t("06 corroboration not required: no corroboration provider op", () => {
  const r = new RunTraceRecorder({ run_id: "run-6", account_id: "acct-6", context_id_safe_reference: "ctx", now: clock().now });
  r.setCorroboration({ warranted: false, attempted: false });
  r.skipStage("corroboration", "not_required");
  const trace = r.finalize();
  assert.equal(trace.corroboration.attempted, false);
  assert.equal(trace.provider_ops.filter((o) => o.operation === "search").length, 0);
});

// ── CASE 7 — corroboration required, attempt observable ──────────────────────
t("07 corroboration required: attempt is observable", () => {
  const c = clock();
  const r = new RunTraceRecorder({ run_id: "run-7", account_id: "acct-7", context_id_safe_reference: "ctx", now: c.now });
  r.setCorroboration({ warranted: true, attempted: true, found: true, materially_affected_case: true });
  const s = r.stage("corroboration"); c.advance(120); s();
  r.recordProviderOp(op({ operation: "search", provider: "brave" }));
  r.addDepth("corroboration");
  const trace = r.finalize();
  assert.equal(trace.corroboration.attempted, true);
  assert.equal(trace.corroboration.materially_affected_case, true);
  assert.ok(trace.research_depth.includes("corroboration"));
});

// ── CASE 8 — counterevidence required, attempt/result observable ─────────────
t("08 counterevidence required: attempt and result observable", () => {
  const r = new RunTraceRecorder({ run_id: "run-8", account_id: "acct-8", context_id_safe_reference: "ctx", now: clock().now });
  r.setCounterevidence({ warranted: true, attempted: true, result: "bounded_none", materially_affected_case: false });
  r.addDepth("counterevidence");
  const trace = r.finalize();
  assert.equal(trace.counterevidence.attempted, true);
  assert.equal(trace.counterevidence.result, "bounded_none");
});

// ── CASE 9 — full-text reused within run, no duplicate fetch ──────────────────
t("09 full-text reused within run: recorded as reuse, not a second fetch", () => {
  const r = new RunTraceRecorder({ run_id: "run-9", account_id: "acct-9", context_id_safe_reference: "ctx", now: clock().now });
  r.recordProviderOp(op({ operation: "full_text", provider: "firecrawl" }));
  r.recordQuery({ category: "full_text", hash: hashQuery("https://acct9.example/news"), state: "reused", skipped_reason: "duplicate_result" });
  const trace = r.finalize();
  assert.equal(trace.counts.full_text_calls, 1, "only one real fetch");
  assert.equal(trace.counts.queries_reused, 1);
});

// ── CASE 10 — same source extraction requested twice, safe reuse ─────────────
t("10 duplicate extraction is deduplicated, LLM not called twice", () => {
  const r = new RunTraceRecorder({ run_id: "run-10", account_id: "acct-10", context_id_safe_reference: "ctx", now: clock().now });
  r.recordProviderOp(op({ operation: "llm", provider: "anthropic", input_tokens: 1200, output_tokens: 300, cost_usd: 0.02 }));
  r.recordQuery({ category: "extraction", hash: hashQuery("extract:src-1"), state: "executed", skipped_reason: null });
  r.recordQuery({ category: "extraction", hash: hashQuery("extract:src-1"), state: "deduplicated", skipped_reason: "duplicate_result" });
  const trace = r.finalize();
  assert.equal(trace.counts.llm_calls, 1);
  assert.equal(trace.counts.queries_deduplicated, 1);
  assert.equal(trace.counts.input_tokens, 1200);
});

// ── CASE 11 — concurrent stage timing: wall clock != naive sum ────────────────
t("11 concurrent stages: stage_work_ms exceeds wall_clock_ms", () => {
  const c = clock();
  const r = new RunTraceRecorder({ run_id: "run-11", account_id: "acct-11", context_id_safe_reference: "ctx", now: c.now });
  const a = r.stage("search_retrieval");   // both start at t0
  const b = r.stage("full_text");
  c.advance(500);                          // they overlap for 500ms
  a(); b();
  const trace = r.finalize();
  assert.equal(trace.wall_clock_ms, 500);
  assert.equal(trace.stage_work_ms, 1000, "two concurrent 500ms stages = 1000ms of work over 500ms wall clock");
  assert.ok(trace.stage_work_ms > trace.wall_clock_ms);
});

// ── CASE 12 — human QA after auto completion: still autonomous ───────────────
t("12 post-run QA after automatic completion is still automatic", () => {
  const r = new RunTraceRecorder({ run_id: "run-12", account_id: "acct-12", context_id_safe_reference: "ctx", now: clock().now });
  r.setCompletion("completed"); r.setAutonomy({ runtime_intervention_required: false, post_run_qa: true });
  const trace = r.finalize();
  const s = summarizeRunTraces([trace]);
  assert.equal(s.autonomy.automatic_completion_rate, 1, "post-run QA does not reduce automatic completion");
  assert.equal(s.autonomy.post_run_qa_rate, 1);
});

// ── CASE 13 — human runtime intervention: autonomy decreases ─────────────────
t("13 runtime intervention lowers automatic completion", () => {
  const r = new RunTraceRecorder({ run_id: "run-13", account_id: "acct-13", context_id_safe_reference: "ctx", now: clock().now });
  r.setCompletion("completed"); r.setAutonomy({ runtime_intervention_required: true });
  const s = summarizeRunTraces([r.finalize()]);
  assert.equal(s.autonomy.automatic_completion_rate, 0);
  assert.equal(s.autonomy.runtime_intervention_rate, 1);
});

// ── CASE 14 — zero eligible runs: NOT_MEASURED ───────────────────────────────
t("14 zero eligible runs -> aggregate rates are NOT_MEASURED (null), not zero", () => {
  const s = summarizeRunTraces([]);
  assert.equal(s.eligible_runs, 0);
  assert.equal(s.runtime_ms.p95, null);
  assert.equal(s.autonomy.automatic_completion_rate, null);
  assert.equal(s.commercial_usefulness.evaluable_rate, null);
  assert.equal(s.cost.total_known_cost_usd, null);
});

// ── CASE 15 — mixed success/failure sample: correct distributions ────────────
t("15 mixed sample yields correct runtime + failure distributions", () => {
  const mk = (id: string, ms: number, completed: boolean, fail: "none" | "provider") => {
    const c = clock();
    const r = new RunTraceRecorder({ run_id: id, account_id: id, context_id_safe_reference: "ctx", now: c.now });
    const s = r.stage("search_retrieval"); c.advance(ms); s({ ok: completed });
    r.setCompletion(completed ? "completed" : "failed");
    r.setStopReason(completed ? "research_complete" : "provider_degraded");
    r.setFailureClass(fail);
    return r.finalize();
  };
  const s = summarizeRunTraces([mk("a", 100, true, "none"), mk("b", 300, false, "provider"), mk("c", 500, true, "none")]);
  assert.equal(s.eligible_runs, 3);
  assert.equal(s.runtime_ms.median, 300);
  assert.equal(s.failure_distribution.provider, 1);
  assert.equal(s.failure_distribution.none, 2);
  assert.equal(s.autonomy.automatic_completion_rate, 1); // 2 completed, both automatic
});

// ── CASE 16 — commercial usefulness absent: no fabricated result ─────────────
t("16 commercial usefulness absent: telemetry does not fabricate a usefulness rate", () => {
  const r = new RunTraceRecorder({ run_id: "run-16", account_id: "acct-16", context_id_safe_reference: "ctx", now: clock().now });
  r.setCompletion("completed"); r.setCommercialUsefulnessEvaluable(false);
  const s = summarizeRunTraces([r.finalize()]);
  assert.equal(s.commercial_usefulness.evaluable_runs, 0);
  assert.equal(s.commercial_usefulness.evaluable_rate, 0); // 0 evaluable of 1 run — measured, honest
});

// ── Denominator isolation (§14) ──────────────────────────────────────────────
t("17 run-account population never blends with provider-ops or usefulness reviews", () => {
  const counts: PopulationCount[] = [
    { population: "live_researched_accounts", sample_id: "run-sample-v1", numerator: 3, denominator: 5 },
    { population: "provider_operations", sample_id: "run-sample-v1", numerator: 40, denominator: 42 },
    { population: "commercial_usefulness_reviews", sample_id: "cu-v1", numerator: 3, denominator: 6 },
  ];
  assert.equal(blendedRateIsForbidden(counts), true);
  const totals = assertDistinctDenominators(counts);
  assert.equal(totals.live_researched_accounts.denominator, 5);
  assert.equal(totals.provider_operations.denominator, 42);
  assert.equal(totals.commercial_usefulness_reviews.denominator, 6);
});

// ── Paired before/after (§23) ────────────────────────────────────────────────
t("18 same account set -> same fingerprint (paired comparison); different set differs", () => {
  const mk = (id: string) => new RunTraceRecorder({ run_id: id, account_id: id, context_id_safe_reference: "ctx", now: clock().now }).finalize();
  const baseline = [mk("x"), mk("y"), mk("z")];
  const optimized = [mk("z"), mk("y"), mk("x")]; // same accounts, reordered
  const different = [mk("x"), mk("y"), mk("w")];
  assert.equal(sampleFingerprint(baseline), sampleFingerprint(optimized));
  assert.notEqual(sampleFingerprint(baseline), sampleFingerprint(different));
});

// ── Offline-safe (§16) ───────────────────────────────────────────────────────
t("19 a fully failed run (no providers) still finalizes a usable trace", () => {
  const r = new RunTraceRecorder({ run_id: "off", account_id: "off", context_id_safe_reference: "ctx", now: clock().now });
  r.setCompletion("failed"); r.setStopReason("provider_degraded"); r.setFailureClass("provider");
  const trace: IntelligenceRunTrace = r.finalize();
  assert.equal(trace.provider_ops.length, 0);
  assert.equal(trace.cost.cost_known, true);   // no ops -> no unknown cost
  assert.equal(trace.completion_state, "failed");
});

console.log(`\n${passed} passed, 0 failed`);
