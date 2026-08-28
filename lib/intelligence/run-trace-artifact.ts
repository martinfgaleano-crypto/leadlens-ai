// Runtime observability artifact (RUNTIME + LIVE VALIDATION INSTRUMENTATION V1 §22).
//
// Turns a bounded set of per-account run traces into a reproducible validation
// artifact with honest aggregate metrics. 0/0 = NOT_MEASURED (never 0). Provenance is
// carried through verbatim — there is no fake LIVE flag; a controlled sample stays
// controlled. A sample fingerprint lets a later optimized run be compared to a
// baseline WITHOUT conflating two different account sets (§23).
//
// It also declares the Control Plane CONTRACT (§21): which canonical capabilities a
// FUTURE live run summary could move. It does NOT ingest anything into the evaluator
// now — no live run exists, so nothing moves. The contract is ready.

import { createHash } from "node:crypto";
import type { IntelligenceRunTrace, RunStopReason, RunFailureClass } from "@/lib/intelligence/run-trace";

export const RUNTIME_OBSERVABILITY_VERSION = "runtime-observability-artifact-v1";

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : null);
const rate = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export interface RuntimeObservabilitySummary {
  version: typeof RUNTIME_OBSERVABILITY_VERSION;
  provenance: "live" | "controlled" | "mixed";
  sample_fingerprint: string;          // identity of THIS account set (§23)
  eligible_runs: number;
  runtime_ms: { median: number | null; p75: number | null; p90: number | null; p95: number | null; max: number | null };
  per_run: {
    provider_calls: number | null;
    search_calls: number | null;
    full_text_calls: number | null;
    llm_calls: number | null;
    queries_deduplicated: number | null;
    queries_reused: number | null;
  };
  autonomy: {
    automatic_completion_rate: number | null;   // completed AND no runtime intervention / completed
    runtime_intervention_rate: number | null;
    post_run_qa_rate: number | null;
  };
  stop_reason_distribution: Partial<Record<RunStopReason, number>>;
  failure_distribution: Partial<Record<RunFailureClass, number>>;
  commercial_usefulness: { evaluable_runs: number; evaluable_rate: number | null };  // rate only where evaluated (§13)
  cost: { runs_with_known_cost: number; total_known_cost_usd: number | null; cost_fully_known: boolean };  // §15
}

/** A sample's identity is the sorted set of its account ids — same accounts ⇒ same fingerprint. */
export function sampleFingerprint(traces: IntelligenceRunTrace[]): string {
  const ids = Array.from(new Set(traces.map((t) => t.account_id))).sort();
  return createHash("sha256").update(ids.join("|")).digest("hex").slice(0, 16);
}

export function summarizeRunTraces(traces: IntelligenceRunTrace[]): RuntimeObservabilitySummary {
  const provs = new Set(traces.map((t) => t.provenance));
  const provenance: RuntimeObservabilitySummary["provenance"] = provs.size === 0 ? "controlled" : provs.size > 1 ? "mixed" : Array.from(provs)[0];

  const wall = traces.map((t) => t.wall_clock_ms).sort((a, b) => a - b);
  const completed = traces.filter((t) => t.completion_state === "completed");
  const automatic = completed.filter((t) => !t.autonomy.runtime_intervention_required);

  const stopDist: Partial<Record<RunStopReason, number>> = {};
  const failDist: Partial<Record<RunFailureClass, number>> = {};
  for (const t of traces) {
    stopDist[t.stop_reason] = (stopDist[t.stop_reason] ?? 0) + 1;
    failDist[t.failure_class] = (failDist[t.failure_class] ?? 0) + 1;
  }

  const evaluable = traces.filter((t) => t.commercial_usefulness_evaluable);
  const knownCostRuns = traces.filter((t) => t.cost.cost_known);
  const totalKnown = knownCostRuns.reduce((n, t) => n + (t.cost.known_cost_usd ?? 0), 0);

  return {
    version: RUNTIME_OBSERVABILITY_VERSION,
    provenance,
    sample_fingerprint: sampleFingerprint(traces),
    eligible_runs: traces.length,
    runtime_ms: {
      median: percentile(wall, 50), p75: percentile(wall, 75),
      p90: percentile(wall, 90), p95: percentile(wall, 95),
      max: wall.length ? wall[wall.length - 1] : null,
    },
    per_run: {
      provider_calls: mean(traces.map((t) => t.counts.provider_calls)),
      search_calls: mean(traces.map((t) => t.counts.search_calls)),
      full_text_calls: mean(traces.map((t) => t.counts.full_text_calls)),
      llm_calls: mean(traces.map((t) => t.counts.llm_calls)),
      queries_deduplicated: mean(traces.map((t) => t.counts.queries_deduplicated)),
      queries_reused: mean(traces.map((t) => t.counts.queries_reused)),
    },
    autonomy: {
      // Automatic completion is over COMPLETED runs; a run that failed cannot be
      // "automatically completed". A completed run later QA-reviewed is still automatic.
      automatic_completion_rate: rate(automatic.length, completed.length),
      runtime_intervention_rate: rate(traces.filter((t) => t.autonomy.runtime_intervention_required).length, traces.length),
      post_run_qa_rate: rate(traces.filter((t) => t.autonomy.post_run_qa).length, traces.length),
    },
    stop_reason_distribution: stopDist,
    failure_distribution: failDist,
    commercial_usefulness: { evaluable_runs: evaluable.length, evaluable_rate: rate(evaluable.length, traces.length) },
    cost: { runs_with_known_cost: knownCostRuns.length, total_known_cost_usd: knownCostRuns.length ? totalKnown : null, cost_fully_known: knownCostRuns.length === traces.length && traces.length > 0 },
  };
}

// ── Control Plane CONTRACT (§21) — READY, NOT INGESTED ────────────────────────
// Declares which canonical capabilities a FUTURE LIVE run summary could move, and
// with what metric, so a later sprint can wire ingestion through the EXISTING
// ControlPlaneValidationEvidenceV1 mechanism. Returns a description only; it does not
// touch the evaluator and moves nothing today.
export interface RuntimeControlPlaneContract {
  ready: boolean;
  requires_live: true;
  mappings: Array<{ capability_id: string; metric: string; dimension: "real_world_validation" | "reliability" | "economics" | "autonomy" | "observability"; note: string }>;
}

export function runtimeControlPlaneContract(summary: RuntimeObservabilitySummary): RuntimeControlPlaneContract {
  return {
    // Only a LIVE, measured sample is eligible to move canonical capabilities.
    ready: summary.eligible_runs > 0,
    requires_live: true,
    mappings: [
      { capability_id: "runtime_latency", metric: "runtime_ms.p95", dimension: "reliability", note: "p95 wall-clock vs the 300000ms operating ceiling" },
      { capability_id: "runtime_latency", metric: "runtime_ms.median", dimension: "observability", note: "median wall-clock per account" },
      { capability_id: "cogs_instrumentation", metric: "cost.total_known_cost_usd", dimension: "economics", note: "known provider+LLM cost per sample; unknown stays unknown" },
      { capability_id: "provider_routing", metric: "per_run.provider_calls", dimension: "economics", note: "provider calls per completed account" },
      { capability_id: "initial_research", metric: "commercial_usefulness.evaluable_rate", dimension: "real_world_validation", note: "share of runs whose Case can be QA-evaluated" },
      { capability_id: "launch_readiness", metric: "autonomy.automatic_completion_rate", dimension: "autonomy", note: "self-serve automatic completion over completed runs" },
    ],
  };
}
