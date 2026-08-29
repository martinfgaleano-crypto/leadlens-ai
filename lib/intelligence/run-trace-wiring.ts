// Productive-spine → run-trace wiring (LIVE TRACE WIRING V1).
//
// Maps the REAL per-account deep-research telemetry the productive pipeline already
// emits (AccountDeepResearchTelemetry, surfaced on lead.enrichment.account_research)
// plus the REAL stage wall-clock durations the spine measures, into the existing
// IntelligenceRunTrace via RunTraceRecorder. This is NOT a fixture and NOT a synthetic
// reconstruction — every operational count comes from what the real execution did.
//
// It changes no Decision and holds no score; it only records what happened.
//
// Honest granularity note: the productive pipeline researches a batch of accounts in
// one call, so per-account RESEARCH wall-clock is not separable here. The measured
// research duration is attributed as stage_work; the per-account wall_clock covers what
// is individually measurable (case synthesis). Per-account research-time decomposition
// requires provider-boundary timing inside the pipeline (reported as the remaining gap).

import type { AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";
import type { DecisionState } from "@/lib/deliverable/deliverable-view-model";
import {
  RunTraceRecorder, fromEarlyStopReason, hashQuery,
  type IntelligenceRunTrace, type RunFailureClass,
} from "@/lib/intelligence/run-trace";

export interface AccountTraceInput {
  runId: string;
  accountId: string;                 // safe reference only (domain or company name)
  contextRefSafe: string;
  telemetry: AccountDeepResearchTelemetry | null;
  decision: DecisionState | null;
  caseCompleted: boolean;
  wall_clock_ms: number;             // REAL measured elapsed (§20) — never a sum of stages
  research_stage_ms: number;         // measured batch research duration (attributed to stage_work)
  case_synthesis_ms: number;         // measured per-account case synthesis duration
  provenance?: "live" | "controlled";
}

function failureClassFor(t: AccountDeepResearchTelemetry | null, completed: boolean): RunFailureClass {
  if (!t) return completed ? "none" : "discovery";
  if (t.provider_calls > 0 && t.provider_failures === t.provider_calls) return "provider";
  if (t.early_stop_reason === "providers_unavailable") return "provider";
  return "none";
}

/**
 * Build one account trace from real telemetry + real measured durations. A synthetic
 * monotonic clock encodes the ALREADY-MEASURED spine durations deterministically (so
 * the trace reflects real time without re-measuring inside this pure mapper).
 */
export function buildAccountRunTrace(input: AccountTraceInput): IntelligenceRunTrace {
  let clock = 0;
  const rec = new RunTraceRecorder({
    run_id: input.runId, account_id: input.accountId,
    context_id_safe_reference: input.contextRefSafe,
    provenance: input.provenance ?? "controlled",
    now: () => clock,
  });
  const t = input.telemetry;

  // ── Stage waterfall (real measured durations) ──────────────────────────────
  const qual = rec.stage("candidate_qualification"); qual();
  rec.addDepth("identity_verification");

  if (t) {
    // Search / retrieval — attributed batch research duration (§ granularity note).
    const search = rec.stage("search_retrieval");
    clock += Math.max(0, input.research_stage_ms);
    search({ calls: t.provider_calls, ok: t.provider_failures < t.provider_calls || t.provider_calls === 0 });
    if (t.executed_queries > 0) rec.addDepth("targeted_event_search");

    // Provider operations, derived from the real query/extraction audit.
    for (const q of t.query_audit) {
      rec.recordProviderOp({ provider: q.provider, operation: "search", duration_ms: 0, ok: true, timeout: false, circuit_state: "unknown", retries: 0, results: q.results, cost_usd: null, input_tokens: null, output_tokens: null });
      rec.recordQuery({ category: q.stage || "search", hash: hashQuery(q.query_id), state: "executed", skipped_reason: null });
    }
    // Provider failures the real run observed (no fabricated result count).
    for (let i = 0; i < t.provider_failures; i++) {
      rec.recordProviderOp({ provider: "unknown", operation: "search", duration_ms: 0, ok: false, timeout: false, circuit_state: "unknown", retries: 0, results: null, cost_usd: null, input_tokens: null, output_tokens: null });
    }
    // Queries planned but not executed = deduplicated/skipped work the run avoided.
    const skipped = Math.max(0, t.planned_queries - t.executed_queries);
    for (let i = 0; i < skipped; i++) rec.recordQuery({ category: "planned", hash: hashQuery(`${input.accountId}:skipped:${i}`), state: "skipped", skipped_reason: "already_sufficient" });

    if (t.pages_extracted > 0) {
      const ft = rec.stage("full_text"); ft({ calls: t.pages_extracted });
      rec.addDepth("full_text_validation");
      for (let i = 0; i < t.pages_extracted; i++) rec.recordProviderOp({ provider: "firecrawl", operation: "full_text", duration_ms: 0, ok: true, timeout: false, circuit_state: "unknown", retries: 0, results: 1, cost_usd: null, input_tokens: null, output_tokens: null });
    }
    if (t.structured_extraction_calls > 0) {
      const ex = rec.stage("structured_extraction"); ex({ calls: t.structured_extraction_calls });
      for (let i = 0; i < t.structured_extraction_calls; i++) rec.recordProviderOp({ provider: "anthropic", operation: "llm", duration_ms: 0, ok: true, timeout: false, circuit_state: "unknown", retries: 0, results: null, cost_usd: null, input_tokens: null, output_tokens: null });
    }

    // Corroboration / counterevidence — real observed state, no fabrication (§12/§13).
    if (t.corroboration_attempted) { rec.addDepth("corroboration"); const s = rec.stage("corroboration"); s(); }
    rec.setCorroboration({
      warranted: t.corroboration_attempted, attempted: t.corroboration_attempted,
      found: t.corroborating_domains >= 2, materially_affected_case: false,
    });
    if (t.counterevidence_checked) { rec.addDepth("counterevidence"); const s = rec.stage("counterevidence"); s(); }
    rec.setCounterevidence({
      warranted: t.counterevidence_checked, attempted: t.counterevidence_checked,
      result: t.counterevidence_checked ? "bounded_none" : "not_searched", materially_affected_case: false,
    });

    rec.recordEvidence(t.evidence_accepted, t.evidence_rejected);
    rec.setStopReason(fromEarlyStopReason(t.early_stop_reason));
  } else {
    // No research telemetry → the account was rejected/failed before research (§5).
    rec.setStopReason(input.caseCompleted ? "research_complete" : "structural_disqualifier");
  }

  const cs = rec.stage("case_synthesis");
  clock += Math.max(0, input.case_synthesis_ms);
  cs();

  rec.setDecision(input.decision);
  rec.setCompletion(input.caseCompleted ? "completed" : "failed");
  rec.setFailureClass(failureClassFor(t, input.caseCompleted));
  // The productive spine runs autonomously; a later human QA never makes it non-autonomous.
  rec.setAutonomy({ runtime_intervention_required: false, post_run_qa: false });
  rec.setCommercialUsefulnessEvaluable(input.caseCompleted && input.decision !== null);

  // Wall clock is the REAL measured elapsed (§20), set independently of the summed
  // stage durations, so stage_work_ms may legitimately exceed wall_clock_ms (§21).
  clock = Math.max(0, input.wall_clock_ms);
  return rec.finalize();
}

/** A run that failed before any account research still finalizes one bounded trace. */
export function buildRunFailureTrace(input: { runId: string; contextRefSafe: string; failure_class: RunFailureClass; provenance?: "live" | "controlled" }): IntelligenceRunTrace {
  const rec = new RunTraceRecorder({ run_id: input.runId, account_id: `run:${input.runId}`, context_id_safe_reference: input.contextRefSafe, provenance: input.provenance ?? "controlled", now: () => 0 });
  rec.setCompletion("failed");
  rec.setStopReason(input.failure_class === "timeout" ? "timeout" : input.failure_class === "provider" ? "provider_degraded" : "structural_disqualifier");
  rec.setFailureClass(input.failure_class);
  rec.setAutonomy({ runtime_intervention_required: false, post_run_qa: false });
  return rec.finalize();
}
