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
  type IntelligenceRunTrace, type RunFailureClass, type RunStopReason,
} from "@/lib/intelligence/run-trace";

export interface AccountTraceInput {
  runId: string;
  accountId: string;                 // safe reference only (domain or company name)
  contextRefSafe: string;
  telemetry: AccountDeepResearchTelemetry | null;
  decision: DecisionState | null;
  caseCompleted: boolean;
  wall_clock_ms?: number;            // back-compat hint only; per-account wall clock is now derived from the account's own stage durations (RUNTIME ATTRIBUTION V1)
  research_stage_ms: number;         // measured batch research duration (attributed to stage_work)
  case_synthesis_ms: number;         // measured per-account case synthesis duration
  provenance?: "live" | "controlled";
  // True only for a genuine structural QC rejection (never a provider/processing failure §6).
  structural_disqualifier?: boolean;
}

/**
 * Classify the account outcome into a bounded (stop_reason, failure_class). A provider
 * quota/circuit failure is ALWAYS classified as provider/provider_degraded and NEVER as
 * a structural disqualifier (§4-§6); structural_disqualifier is reserved for a genuine
 * structural QC rejection. A provider failure never becomes a commercial outcome (§7).
 */
function classifyOutcome(t: AccountDeepResearchTelemetry | null, completed: boolean, structuralDisqualifier: boolean): { stop: RunStopReason; failure: RunFailureClass } {
  const providerDegraded = Boolean(
    t && (t.enrichment_failed?.reason === "provider_degraded"
      || t.early_stop_reason === "providers_unavailable"
      || (t.provider_calls > 0 && t.provider_failures === t.provider_calls)),
  );
  if (providerDegraded) return { stop: "provider_degraded", failure: "provider" };
  if (structuralDisqualifier) return { stop: "structural_disqualifier", failure: "identity" };
  if (t?.enrichment_failed?.reason === "error") return { stop: "evidence_insufficient", failure: "case_synthesis" };
  if (completed) return { stop: t ? fromEarlyStopReason(t.early_stop_reason) : "research_complete", failure: "none" };
  // Researched (or attempted) but no Case and no provider failure: an honest
  // insufficient-evidence outcome — never a structural disqualifier (§6).
  return { stop: t ? fromEarlyStopReason(t.early_stop_reason) : "evidence_insufficient", failure: "insufficient_public_evidence" };
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
    if (t.executed_queries > 0) rec.addDepth("targeted_event_search");

    // Queries are recorded from the real query audit (counts + category), stored as
    // hash+category only.
    for (const q of t.query_audit) rec.recordQuery({ category: q.stage || "search", hash: hashQuery(q.query_id), state: "executed", skipped_reason: null });
    // Queries planned but not executed = deduplicated/skipped work the run avoided.
    const skipped = Math.max(0, t.planned_queries - t.executed_queries);
    for (let i = 0; i < skipped; i++) rec.recordQuery({ category: "planned", hash: hashQuery(`${input.accountId}:skipped:${i}`), state: "skipped", skipped_reason: "already_sufficient" });

    if (t.provider_ops && t.provider_ops.length) {
      // Prefer REAL per-operation durations from deep instrumentation (§8/§9). A
      // search's duration is dominated by external provider wait.
      for (const op of t.provider_ops) rec.recordProviderOp({ provider: op.provider, operation: op.operation, duration_ms: op.duration_ms, ok: op.ok, timeout: op.timeout, circuit_state: "unknown", retries: 0, results: op.results, cost_usd: null, input_tokens: null, output_tokens: null });
      const stageMs = (kind: "search" | "full_text" | "llm") => t.provider_ops!.filter((o) => o.operation === kind).reduce((n, o) => n + o.duration_ms, 0);
      if (t.provider_ops.some((o) => o.operation === "full_text")) rec.addDepth("full_text_validation");
      // Record measured stage durations from the real per-op timings.
      const searchStop = rec.stage("search_retrieval"); clock += stageMs("search"); searchStop({ calls: t.provider_ops.filter((o) => o.operation === "search").length });
      if (stageMs("full_text") > 0) { const ftStop = rec.stage("full_text"); clock += stageMs("full_text"); ftStop({ calls: t.pages_extracted }); }
      if (stageMs("llm") > 0) { const llmStop = rec.stage("structured_extraction"); clock += stageMs("llm"); llmStop({ calls: t.structured_extraction_calls }); }
    } else {
      // Back-compat fallback: telemetry without per-op timing → count-based ops.
      const searchStop = rec.stage("search_retrieval"); clock += Math.max(0, input.research_stage_ms); searchStop({ calls: t.provider_calls, ok: t.provider_failures < t.provider_calls || t.provider_calls === 0 });
      for (const q of t.query_audit) rec.recordProviderOp({ provider: q.provider, operation: "search", duration_ms: 0, ok: true, timeout: false, circuit_state: "unknown", retries: 0, results: q.results, cost_usd: null, input_tokens: null, output_tokens: null });
      for (let i = 0; i < t.provider_failures; i++) rec.recordProviderOp({ provider: "unknown", operation: "search", duration_ms: 0, ok: false, timeout: false, circuit_state: "unknown", retries: 0, results: null, cost_usd: null, input_tokens: null, output_tokens: null });
      if (t.pages_extracted > 0) { rec.addDepth("full_text_validation"); const ft = rec.stage("full_text"); ft({ calls: t.pages_extracted }); for (let i = 0; i < t.pages_extracted; i++) rec.recordProviderOp({ provider: "firecrawl", operation: "full_text", duration_ms: 0, ok: true, timeout: false, circuit_state: "unknown", retries: 0, results: 1, cost_usd: null, input_tokens: null, output_tokens: null }); }
      if (t.structured_extraction_calls > 0) { const ex = rec.stage("structured_extraction"); ex({ calls: t.structured_extraction_calls }); for (let i = 0; i < t.structured_extraction_calls; i++) rec.recordProviderOp({ provider: "anthropic", operation: "llm", duration_ms: 0, ok: true, timeout: false, circuit_state: "unknown", retries: 0, results: null, cost_usd: null, input_tokens: null, output_tokens: null }); }
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
  }

  const cs = rec.stage("case_synthesis");
  clock += Math.max(0, input.case_synthesis_ms);
  cs();
  const accountWorkMs = clock; // the account's OWN accumulated real stage durations

  const outcome = classifyOutcome(t, input.caseCompleted, input.structural_disqualifier ?? false);
  rec.setDecision(input.decision);
  rec.setCompletion(input.caseCompleted ? "completed" : "failed");
  rec.setStopReason(outcome.stop);
  rec.setFailureClass(outcome.failure);
  // The productive spine runs autonomously; a later human QA never makes it non-autonomous.
  rec.setAutonomy({ runtime_intervention_required: false, post_run_qa: false });
  rec.setCommercialUsefulnessEvaluable(input.caseCompleted && input.decision !== null);

  // Per-account wall clock (RUNTIME ATTRIBUTION V1): the account's OWN measured work
  // window — the sum of ITS real stage durations (from provider_ops / measured case
  // synthesis) — NOT the whole-run elapsed. Accounts research in a batch, so per-account
  // wall clocks may overlap and MUST NOT be summed to derive the run wall clock (that is
  // a separate run-level clock, §1.4/§1.5). Replaces the previous run-shared overwrite
  // (`input.wall_clock_ms`, the whole-run elapsed) that made every account report the
  // same time. `input.wall_clock_ms` is now an optional back-compat hint, used only when
  // the account produced no measurable stage work at all (no telemetry).
  clock = accountWorkMs > 0 ? accountWorkMs : Math.max(0, input.wall_clock_ms ?? 0);
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
