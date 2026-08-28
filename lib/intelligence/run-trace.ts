// Per-account Intelligence run trace (RUNTIME + LIVE VALIDATION INSTRUMENTATION V1).
//
// One bounded, structured execution trace per researched account, so the NEXT real
// 15–25 account validation run automatically answers the runtime / cost / autonomy /
// research-depth / usefulness questions (§2). It EXTENDS the existing telemetry
// vocabulary (account-deep-research early_stop_reason, research-economics WasteReason,
// provider-health ProviderState) rather than starting a second observability system.
//
// Safety invariants (§4, §7, §8, §16):
//  - No secrets, no raw customer prose, no chain-of-thought. Queries are stored as a
//    category + a stable hash, never raw text.
//  - The recorder is OFFLINE-SAFE: it only accumulates what a caller reports; a run
//    that fails, times out, or hits a circuit-open provider still produces a complete
//    trace. Telemetry never depends on successful external execution.
//  - The trace is diagnostic. It never changes a Decision and holds no score.

import { createHash } from "node:crypto";
import type { ProviderState } from "@/lib/ops/provider-health";
import type { WasteReason } from "@/lib/monitor/research-economics";
import type { DecisionState } from "@/lib/deliverable/deliverable-view-model";

export const RUN_TRACE_VERSION = "intelligence-run-trace-v1";

// Canonical bounded stop reasons (§10). Superset that maps the existing
// account-deep-research early_stop_reason into one vocabulary.
export type RunStopReason =
  | "identity_failed"
  | "structural_disqualifier"
  | "evidence_insufficient"
  | "evidence_sufficient"
  | "decision_sufficient"
  | "corroboration_not_required"
  | "corroboration_exhausted"
  | "provider_degraded"
  | "budget_exhausted"
  | "timeout"
  | "research_complete";

export function fromEarlyStopReason(r: "sufficient_evidence" | "no_material_event" | "budget_exhausted" | "providers_unavailable"): RunStopReason {
  switch (r) {
    case "sufficient_evidence": return "evidence_sufficient";
    case "no_material_event": return "evidence_insufficient";
    case "budget_exhausted": return "budget_exhausted";
    case "providers_unavailable": return "provider_degraded";
  }
}

// Bounded failure taxonomy (§12) — enough to count recurring classes next sample.
export type RunFailureClass =
  | "none"
  | "discovery"
  | "identity"
  | "provider"
  | "retrieval"
  | "extraction"
  | "temporal"
  | "materiality"
  | "source_association"
  | "corroboration"
  | "counterevidence"
  | "context_relevance"
  | "case_synthesis"
  | "timeout"
  | "insufficient_public_evidence";

// Actual productive stages (§5) — not invented; separable timing anchors.
export type RunStage =
  | "candidate_qualification"
  | "account_deepening_planning"
  | "search_retrieval"
  | "source_filtering"
  | "full_text"
  | "structured_extraction"
  | "temporal_validation"
  | "corroboration"
  | "counterevidence"
  | "evidence_assembly"
  | "case_synthesis"
  | "persistence"
  | "report_assembly";

// Observed research-depth dimensions (§9) — how far this account went, and why.
export type ResearchDepthDimension =
  | "identity_verification"
  | "targeted_event_search"
  | "full_text_validation"
  | "corroboration"
  | "counterevidence"
  | "gap_search";

export type ProviderOperation = "search" | "full_text" | "extract" | "llm";

export interface ProviderOpTrace {
  provider: string;
  operation: ProviderOperation;
  duration_ms: number;
  ok: boolean;
  timeout: boolean;
  circuit_state: ProviderState;
  retries: number;
  results: number | null;          // null when not applicable / unknown
  cost_usd: number | null;         // null when provider pricing is not known (§15)
  input_tokens: number | null;
  output_tokens: number | null;
}

export type QueryState = "executed" | "deduplicated" | "reused" | "skipped";

export interface QueryTrace {
  category: string;                // e.g. "identity" | "event" | "corroboration" — never raw text
  hash: string;                    // stable hash of the normalized query (§8) — no secrets
  state: QueryState;
  skipped_reason: WasteReason | "already_sufficient" | "not_required" | null;
}

export interface StageTrace {
  stage: RunStage;
  calls: number;
  total_ms: number;
  wait_ms: number | null;          // provider wait where knowable (§7)
  ok: boolean;
  skip_reason: string | null;      // bounded reason, null when the stage ran
}

export interface RunAutonomy {
  // Did a human need to intervene for the run to FINISH? (§11)
  runtime_intervention_required: boolean;
  // Was a human review done AFTER completion, for QA only? These never conflate.
  post_run_qa: boolean;
}

export interface IntelligenceRunTrace {
  version: typeof RUN_TRACE_VERSION;
  run_id: string;
  account_id: string;
  context_id_safe_reference: string;   // safe ref only — never raw context prose
  provenance: "live" | "controlled";

  started_at: string;
  completed_at: string;
  wall_clock_ms: number;               // true elapsed (§6)
  stage_work_ms: number;               // Σ stage durations — may exceed wall clock when concurrent (§6)

  final_decision: DecisionState | null;
  completion_state: "completed" | "failed" | "aborted";
  stop_reason: RunStopReason;
  failure_class: RunFailureClass;

  research_depth: ResearchDepthDimension[];

  stages: StageTrace[];
  provider_ops: ProviderOpTrace[];
  queries: QueryTrace[];

  counts: {
    provider_calls: number;
    search_calls: number;
    full_text_calls: number;
    llm_calls: number;
    queries_generated: number;
    queries_executed: number;
    queries_deduplicated: number;
    queries_reused: number;
    queries_skipped: number;
    input_tokens: number | null;
    output_tokens: number | null;
  };

  corroboration: { warranted: boolean; attempted: boolean; found: boolean; materially_affected_case: boolean };
  counterevidence: { warranted: boolean; attempted: boolean; result: "material_found" | "weak_found" | "bounded_none" | "not_searched"; materially_affected_case: boolean };
  evidence: { accepted: number; rejected: number };

  autonomy: RunAutonomy;
  commercial_usefulness_evaluable: boolean;   // can this completed Case feed the QA contract? (§13)

  cost: { known_cost_usd: number | null; cost_known: boolean };   // §15 — honest known/unknown
}

/** Stable, non-reversible query hash — a normalized query becomes a category+hash, never raw text. */
export function hashQuery(normalized: string): string {
  return createHash("sha256").update(normalized.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export interface RunTraceInput {
  run_id: string;
  account_id: string;
  context_id_safe_reference: string;
  provenance?: "live" | "controlled";
  now?: () => number;
}

/**
 * Offline-safe accumulator. Callers report what happened; a failed/aborted run still
 * finalizes into a complete trace. It performs no I/O and calls no providers.
 */
export class RunTraceRecorder {
  private readonly startedMs: number;
  private readonly now: () => number;
  private readonly base: RunTraceInput;
  private readonly stages: StageTrace[] = [];
  private readonly provider_ops: ProviderOpTrace[] = [];
  private readonly queries: QueryTrace[] = [];
  private readonly depth = new Set<ResearchDepthDimension>();
  private decision: DecisionState | null = null;
  private completion: IntelligenceRunTrace["completion_state"] = "completed";
  private stopReason: RunStopReason = "research_complete";
  private failureClass: RunFailureClass = "none";
  private autonomy: RunAutonomy = { runtime_intervention_required: false, post_run_qa: false };
  private corroboration = { warranted: false, attempted: false, found: false, materially_affected_case: false };
  private counterevidence: IntelligenceRunTrace["counterevidence"] = { warranted: false, attempted: false, result: "not_searched", materially_affected_case: false };
  private evidence = { accepted: 0, rejected: 0 };
  private usefulnessEvaluable = false;

  constructor(input: RunTraceInput) {
    this.base = input;
    this.now = input.now ?? (() => Date.now());
    this.startedMs = this.now();
  }

  /** Open a stage timer; returns a stop fn. Concurrent stages are allowed — each is
   *  timed independently, so Σ stage durations can exceed wall clock (§6). */
  stage(stage: RunStage, opts: { wait_ms?: number } = {}): (result?: { ok?: boolean; calls?: number }) => void {
    const start = this.now();
    return (result = {}) => {
      this.stages.push({
        stage, calls: result.calls ?? 1, total_ms: Math.max(0, this.now() - start),
        wait_ms: opts.wait_ms ?? null, ok: result.ok ?? true, skip_reason: null,
      });
    };
  }

  /** Record a stage that was skipped (e.g. corroboration not required) — 0 ms, no work. */
  skipStage(stage: RunStage, skip_reason: string): void {
    this.stages.push({ stage, calls: 0, total_ms: 0, wait_ms: null, ok: true, skip_reason });
  }

  recordProviderOp(op: ProviderOpTrace): void { this.provider_ops.push(op); }
  recordQuery(q: QueryTrace): void { this.queries.push(q); }
  addDepth(dim: ResearchDepthDimension): void { this.depth.add(dim); }
  setDecision(d: DecisionState | null): void { this.decision = d; }
  setStopReason(r: RunStopReason): void { this.stopReason = r; }
  setFailureClass(c: RunFailureClass): void { this.failureClass = c; }
  setCompletion(state: IntelligenceRunTrace["completion_state"]): void { this.completion = state; }
  setAutonomy(a: Partial<RunAutonomy>): void { this.autonomy = { ...this.autonomy, ...a }; }
  setCorroboration(c: Partial<IntelligenceRunTrace["corroboration"]>): void { this.corroboration = { ...this.corroboration, ...c }; }
  setCounterevidence(c: Partial<IntelligenceRunTrace["counterevidence"]>): void { this.counterevidence = { ...this.counterevidence, ...c }; }
  recordEvidence(accepted: number, rejected: number): void { this.evidence = { accepted, rejected }; }
  setCommercialUsefulnessEvaluable(v: boolean): void { this.usefulnessEvaluable = v; }

  finalize(): IntelligenceRunTrace {
    const endMs = this.now();
    const sum = (pred: (o: ProviderOpTrace) => boolean) => this.provider_ops.filter(pred).length;
    const tokenSum = (pick: (o: ProviderOpTrace) => number | null) => {
      const vals = this.provider_ops.map(pick).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };
    const costs = this.provider_ops.map((o) => o.cost_usd);
    const anyUnknownCost = costs.some((c) => c === null);
    const knownSum = costs.filter((c): c is number => c !== null).reduce((a, b) => a + b, 0);
    const q = (state: QueryState) => this.queries.filter((x) => x.state === state).length;

    return {
      version: RUN_TRACE_VERSION,
      run_id: this.base.run_id, account_id: this.base.account_id,
      context_id_safe_reference: this.base.context_id_safe_reference,
      provenance: this.base.provenance ?? "controlled",
      started_at: new Date(this.startedMs).toISOString(),
      completed_at: new Date(endMs).toISOString(),
      wall_clock_ms: Math.max(0, endMs - this.startedMs),
      stage_work_ms: this.stages.reduce((n, s) => n + s.total_ms, 0),
      final_decision: this.decision,
      completion_state: this.completion,
      stop_reason: this.stopReason,
      failure_class: this.failureClass,
      research_depth: Array.from(this.depth),
      stages: this.stages,
      provider_ops: this.provider_ops,
      queries: this.queries,
      counts: {
        provider_calls: this.provider_ops.length,
        search_calls: sum((o) => o.operation === "search"),
        full_text_calls: sum((o) => o.operation === "full_text"),
        llm_calls: sum((o) => o.operation === "llm"),
        queries_generated: this.queries.length,
        queries_executed: q("executed"),
        queries_deduplicated: q("deduplicated"),
        queries_reused: q("reused"),
        queries_skipped: q("skipped"),
        input_tokens: tokenSum((o) => o.input_tokens),
        output_tokens: tokenSum((o) => o.output_tokens),
      },
      corroboration: this.corroboration,
      counterevidence: this.counterevidence,
      evidence: this.evidence,
      autonomy: this.autonomy,
      commercial_usefulness_evaluable: this.usefulnessEvaluable,
      cost: { known_cost_usd: anyUnknownCost ? null : knownSum, cost_known: !anyUnknownCost },
    };
  }
}
