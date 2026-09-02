// Product Operability V1 — stale intelligence-run recovery policy + orchestrator.
// The execution_generation CAS (double-execution safety, dead-worker fencing) is covered by
// the run-lease / productive-spine suites; here we prove the RECOVERY OWNER's policy:
// only stale processing runs are actioned, healthy/terminal runs are left alone, re-dispatch
// is bounded by generation (poison-job → terminal fail), and terminal failure is fenced.

import {
  isStaleProcessing, classifyRecovery, planRecoveries, recoverStaleRuns,
  STALE_PROCESSING_MS, MAX_RECOVERY_GENERATION, type StaleRunCandidate,
} from "../../lib/intelligence/run-recovery";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${name}`); };

const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const run = (o: Partial<StaleRunCandidate>): StaleRunCandidate => ({
  runId: "intel_" + "a".repeat(32), userId: "u1", status: "processing",
  createdAt: ago(STALE_PROCESSING_MS + 60_000), updatedAt: ago(STALE_PROCESSING_MS + 60_000), executionGeneration: 1, ...o,
});

// ── isStaleProcessing ──
t("fresh processing (updated 1m ago) is NOT stale", !isStaleProcessing(run({ updatedAt: ago(60_000) }), NOW));
t("processing 16m ago IS stale", isStaleProcessing(run({ updatedAt: ago(16 * 60_000) }), NOW));
t("completed run is never stale", !isStaleProcessing(run({ status: "completed", updatedAt: ago(60 * 60_000) }), NOW));
t("failed run is never stale", !isStaleProcessing(run({ status: "failed", updatedAt: ago(60 * 60_000) }), NOW));
t("falls back to createdAt when updatedAt null", isStaleProcessing(run({ updatedAt: null, createdAt: ago(20 * 60_000) }), NOW));

// ── classifyRecovery ──
t("fresh → skip", classifyRecovery(run({ updatedAt: ago(60_000) }), NOW) === "skip");
t("stale, low gen → redispatch", classifyRecovery(run({ executionGeneration: 2 }), NOW) === "redispatch");
t("stale, at max gen → terminal_fail", classifyRecovery(run({ executionGeneration: MAX_RECOVERY_GENERATION }), NOW) === "terminal_fail");
t("stale, above max gen → terminal_fail", classifyRecovery(run({ executionGeneration: MAX_RECOVERY_GENERATION + 3 }), NOW) === "terminal_fail");
t("completed → skip", classifyRecovery(run({ status: "completed" }), NOW) === "skip");

// ── planRecoveries: filters to actionable only ──
const plan = planRecoveries([
  run({ runId: "intel_" + "1".repeat(32), updatedAt: ago(60_000) }),       // fresh → skip
  run({ runId: "intel_" + "2".repeat(32), executionGeneration: 1 }),       // stale → redispatch
  run({ runId: "intel_" + "3".repeat(32), executionGeneration: 9 }),       // poison → terminal_fail
  run({ runId: "intel_" + "4".repeat(32), status: "completed" }),          // completed → skip
], NOW);
t("plan actions only the two stale runs", plan.length === 2);
t("plan marks redispatch + terminal_fail correctly", plan.some(p => p.action === "redispatch") && plan.some(p => p.action === "terminal_fail"));

// ── recoverStaleRuns orchestrator ──
async function orchestrate() {
  const redispatched: string[] = [], failed_: string[] = [];
  const candidates = [
    run({ runId: "intel_" + "a".repeat(32), updatedAt: ago(60_000) }),        // fresh → skip
    run({ runId: "intel_" + "b".repeat(32), executionGeneration: 2 }),        // stale → redispatch
    run({ runId: "intel_" + "c".repeat(32), executionGeneration: 8 }),        // poison → terminal_fail
    run({ runId: "intel_" + "d".repeat(32), status: "completed" }),           // completed → skip
  ];
  const s = await recoverStaleRuns({
    now: () => NOW,
    listRecoverable: async () => candidates,
    redispatch: async (id) => { redispatched.push(id); },
    failTerminal: async (c) => { failed_.push(c.runId); return true; },
  });
  t("orchestrator: exactly one redispatch (the stale, in-bound run)", s.redispatched === 1 && redispatched.length === 1);
  t("orchestrator: exactly one terminal fail (the poison run)", s.failedTerminal === 1 && failed_.length === 1);
  t("orchestrator: skipped counts fresh + completed", s.skipped === 2);
  t("orchestrator: considered = all", s.considered === 4);

  // CASE: healthy-only backlog → zero actions (normal completed/fresh runs untouched).
  const s2 = await recoverStaleRuns({
    now: () => NOW,
    listRecoverable: async () => [run({ status: "completed" }), run({ updatedAt: ago(120_000) })],
    redispatch: async () => { throw new Error("should not dispatch a healthy run"); },
    failTerminal: async () => { throw new Error("should not fail a healthy run"); },
  });
  t("orchestrator: no healthy run is touched", s2.redispatched === 0 && s2.failedTerminal === 0 && s2.errors === 0);

  // CASE: fenced terminal write no-op (concurrent reclaim) is not counted as a fail.
  const s3 = await recoverStaleRuns({
    now: () => NOW,
    listRecoverable: async () => [run({ executionGeneration: 9 })],
    redispatch: async () => {},
    failTerminal: async () => false, // fence didn't match → someone else reclaimed
  });
  t("orchestrator: fenced-out terminal write is a safe no-op", s3.failedTerminal === 0);

  // CASE: maxPerWake caps the batch (backlog drains across wakes).
  const many = Array.from({ length: 10 }, (_, i) => run({ runId: "intel_" + String(i).padStart(32, "0"), executionGeneration: 1 }));
  const s4 = await recoverStaleRuns({ now: () => NOW, listRecoverable: async () => many, redispatch: async () => {}, failTerminal: async () => true, maxPerWake: 3 });
  t("orchestrator: maxPerWake caps redispatches at 3", s4.redispatched === 3);
}

orchestrate().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}).catch((e) => { console.error(e); process.exit(1); });
