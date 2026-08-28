// Reproducible runtime-observability artifact builder (INSTRUMENTATION V1 §22).
// Turns run traces into a validation artifact with honest aggregates and explicit
// provenance. This demo builds a CONTROLLED sample (no live run, no fake LIVE flag);
// the SAME summarizer consumes real LIVE traces when a live sample exists.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/build-runtime-observability-artifact.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RunTraceRecorder, type ProviderOpTrace } from "@/lib/intelligence/run-trace";
import { summarizeRunTraces, runtimeControlPlaneContract } from "@/lib/intelligence/run-trace-artifact";

function clock() { let ms = 1_000_000; return { now: () => ms, advance: (by: number) => { ms += by; } }; }
const op = (o: Partial<ProviderOpTrace> = {}): ProviderOpTrace => ({
  provider: "tavily", operation: "search", duration_ms: 150, ok: true, timeout: false,
  circuit_state: "ok", retries: 0, results: 6, cost_usd: null, input_tokens: null, output_tokens: null, ...o,
});

// A small CONTROLLED sample spanning success / early-stop / provider-failure so the
// aggregate exercises the distributions the live sample will populate.
function build(id: string, ms: number, opts: { completed?: boolean; intervention?: boolean; useful?: boolean; stop?: Parameters<RunTraceRecorder["setStopReason"]>[0]; fail?: Parameters<RunTraceRecorder["setFailureClass"]>[0] } = {}) {
  const c = clock();
  const r = new RunTraceRecorder({ run_id: id, account_id: id, context_id_safe_reference: "ctx:industrial-automation-us-v1", provenance: "controlled", now: c.now });
  const s1 = r.stage("candidate_qualification"); c.advance(Math.round(ms * 0.1)); s1();
  const s2 = r.stage("search_retrieval", { wait_ms: Math.round(ms * 0.4) }); c.advance(Math.round(ms * 0.6)); s2({ calls: 2 });
  r.recordProviderOp(op({ operation: "search", duration_ms: Math.round(ms * 0.4) }));
  r.recordProviderOp(op({ operation: "llm", provider: "anthropic", input_tokens: 1500, output_tokens: 400, cost_usd: 0.03 }));
  const s3 = r.stage("case_synthesis"); c.advance(Math.round(ms * 0.3)); s3();
  r.recordEvidence(3, 1); r.addDepth("identity_verification"); r.addDepth("targeted_event_search");
  r.setCompletion(opts.completed === false ? "failed" : "completed");
  r.setStopReason(opts.stop ?? "decision_sufficient");
  r.setFailureClass(opts.fail ?? "none");
  r.setAutonomy({ runtime_intervention_required: opts.intervention ?? false, post_run_qa: true });
  r.setDecision(opts.completed === false ? null : "validate");
  r.setCommercialUsefulnessEvaluable(opts.useful ?? true);
  return r.finalize();
}

const traces = [
  build("controlled-run:conagra", 12000),
  build("controlled-run:quad", 9000),
  build("controlled-run:hitachi", 15000),
  build("controlled-run:john-deere", 7000, { useful: true, stop: "evidence_sufficient" }),
  build("controlled-run:nestle", 21000, { intervention: true }),
  build("controlled-run:mondi", 30000, { completed: false, stop: "provider_degraded", fail: "provider", useful: false }),
];

const summary = summarizeRunTraces(traces);
const contract = runtimeControlPlaneContract(summary);

const outDir = join(process.cwd(), "ml/data/acceptance");
mkdirSync(outDir, { recursive: true });
const outputPath = join(outDir, "runtime-observability-artifact-controlled-v1.json");
writeFileSync(outputPath, `${JSON.stringify({ summary, control_plane_contract: contract }, null, 2)}\n`);

console.log(JSON.stringify({ outputPath, provenance: summary.provenance, eligible_runs: summary.eligible_runs, runtime_ms: summary.runtime_ms, per_run: summary.per_run, autonomy: summary.autonomy, stop_reason_distribution: summary.stop_reason_distribution, failure_distribution: summary.failure_distribution, commercial_usefulness: summary.commercial_usefulness, cost: summary.cost, control_plane_ready: contract.ready }, null, 2));
