// DEGRADED-RUN TELEMETRY INTEGRITY (§13-§16) — partial telemetry survives failure,
// provider failure is classified as provider/provider_degraded (never structural),
// and no Evidence/Decision is fabricated.

import assert from "node:assert/strict";
import { buildAccountRunTrace } from "@/lib/intelligence/run-trace-wiring";
import { isProviderDegradedError, minimalFailedTelemetry, type AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${passed} ${name}`); };

const tel = (over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry => ({
  version: "v1", account: "a", domain: "a.example", planned_queries: 4, executed_queries: 4, provider_calls: 6, provider_failures: 0,
  results_seen: 20, evidence_accepted: 0, evidence_rejected: 3, pages_extracted: 0, extraction_failures: 0, structured_extraction_calls: 0,
  dated_evidence: 0, independent_domains: 1, corroboration_attempted: false, corroborating_domains: 0, claims_recovered: 0, counterevidence_checked: false,
  early_stop_reason: "no_material_event",
  query_audit: [{ query_id: "q1", stage: "event", provider: "tavily", results: 5, accepted: 0 }],
  extraction_audit: [],
  provider_ops: [
    { provider: "tavily", operation: "search", stage: "event", duration_ms: 1200, ok: true, timeout: false, results: 5 },
    { provider: "tavily", operation: "search", stage: "current_activity", duration_ms: 1500, ok: true, timeout: false, results: 4 },
  ],
  ...over,
});

const build = (over: Parameters<typeof buildAccountRunTrace>[0]["telemetry"] extends never ? never : Partial<Parameters<typeof buildAccountRunTrace>[0]>) =>
  buildAccountRunTrace({ runId: "r", accountId: "acct.example", contextRefSafe: "ctx", telemetry: null, decision: null, caseCompleted: false, wall_clock_ms: 53000, research_stage_ms: 0, case_synthesis_ms: 10, ...over });

// ── §13 — the exact canary class: search ran, Anthropic enrichment failed ─────
t("13 canary class: partial search telemetry preserved; provider failure classified", () => {
  const tr = build({ telemetry: tel({ enrichment_failed: { provider: "anthropic", reason: "provider_degraded" } }), caseCompleted: false });
  assert.equal(tr.counts.search_calls, 2, "the 2 real search ops survive the failure");
  assert.equal(tr.failure_class, "provider");
  assert.equal(tr.stop_reason, "provider_degraded");
  assert.notEqual(tr.stop_reason, "structural_disqualifier");
  assert.equal(tr.evidence.accepted, 0);              // no fabricated Evidence
  assert.equal(tr.counterevidence.result, "not_searched");
  assert.equal(tr.final_decision, null);              // no fabricated Decision
  assert.equal(tr.completion_state, "failed");
  assert.ok(tr.wall_clock_ms > 0 && tr.stages.length > 0, "trace complete");
});

// ── §14 A — search provider failure ──────────────────────────────────────────
t("14A search provider failure -> provider class", () => {
  const tr = build({ telemetry: tel({ provider_calls: 3, provider_failures: 3, early_stop_reason: "providers_unavailable", provider_ops: [{ provider: "brave", operation: "search", stage: "event", duration_ms: 800, ok: false, timeout: false, results: null }] }), caseCompleted: false });
  assert.equal(tr.failure_class, "provider");
  assert.equal(tr.stop_reason, "provider_degraded");
  assert.ok(tr.provider_ops.some((o) => !o.ok), "the failed op is preserved");
});

// ── §14 B — LLM quota exhaustion, partial search preserved ────────────────────
t("14B LLM quota exhaustion preserves prior search telemetry", () => {
  const tr = build({ telemetry: tel({ enrichment_failed: { provider: "anthropic", reason: "provider_degraded" } }) });
  assert.equal(tr.provider_ops.filter((o) => o.operation === "search").length, 2);
  assert.equal(tr.failure_class, "provider");
});

// ── §14 C — full-text failure, prior telemetry preserved ─────────────────────
t("14C full-text failure preserved as a failed op, search still present", () => {
  const tr = build({ telemetry: tel({ pages_extracted: 0, provider_ops: [
    { provider: "tavily", operation: "search", stage: "event", duration_ms: 900, ok: true, timeout: false, results: 3 },
    { provider: "full_text", operation: "full_text", stage: "event", duration_ms: 4000, ok: false, timeout: false, results: 0 },
  ] }), caseCompleted: false });
  assert.ok(tr.provider_ops.some((o) => o.operation === "full_text" && !o.ok));
  assert.ok(tr.provider_ops.some((o) => o.operation === "search" && o.ok));
  assert.notEqual(tr.stop_reason, "structural_disqualifier");
});

// ── §14 D — extraction failure after full-text: all prior ops preserved ──────
t("14D extraction failure after full-text preserves all prior ops", () => {
  const tr = build({ telemetry: tel({ structured_extraction_calls: 1, pages_extracted: 1, provider_ops: [
    { provider: "tavily", operation: "search", stage: "event", duration_ms: 700, ok: true, timeout: false, results: 4 },
    { provider: "full_text", operation: "full_text", stage: "event", duration_ms: 3000, ok: true, timeout: false, results: 1 },
    { provider: "anthropic", operation: "llm", stage: "event", duration_ms: 500, ok: false, timeout: false, results: null },
  ] }) });
  assert.equal(tr.counts.search_calls, 1);
  assert.equal(tr.counts.full_text_calls, 1);
  assert.equal(tr.counts.llm_calls, 1);
  assert.ok(tr.provider_ops.some((o) => o.operation === "llm" && !o.ok), "failed LLM attempt is observable, not erased");
});

// ── §14 E — a TRUE structural disqualifier still classifies correctly ─────────
t("14E true structural disqualifier -> structural_disqualifier", () => {
  const tr = build({ telemetry: null, caseCompleted: false, structural_disqualifier: true });
  assert.equal(tr.stop_reason, "structural_disqualifier");
  assert.equal(tr.failure_class, "identity");
});

t("14E' provider failure with structural flag still classified provider (§7 precedence)", () => {
  const tr = build({ telemetry: tel({ enrichment_failed: { provider: "anthropic", reason: "provider_degraded" } }), structural_disqualifier: true, caseCompleted: false });
  assert.equal(tr.failure_class, "provider", "a provider failure never becomes a structural/commercial outcome");
});

// ── §15 — no double counting of provider ops ─────────────────────────────────
t("15 provider ops are not duplicated", () => {
  const tr = build({ telemetry: tel() });
  assert.equal(tr.counts.provider_calls, tr.provider_ops.length);
  assert.equal(tr.provider_ops.length, 2);
});

// ── §16-adjacent — a successful account still classifies as none ─────────────
t("16 a completed account with a Case classifies none / real stop", () => {
  const tr = build({ telemetry: tel({ evidence_accepted: 3, early_stop_reason: "sufficient_evidence" }), decision: "validate", caseCompleted: true });
  assert.equal(tr.failure_class, "none");
  assert.equal(tr.stop_reason, "evidence_sufficient");
  assert.equal(tr.completion_state, "completed");
});

// ── null-telemetry, non-structural failure is NOT structural_disqualifier (§6) ─
t("17 researched-but-empty non-structural failure -> insufficient_public_evidence", () => {
  const tr = build({ telemetry: null, caseCompleted: false, structural_disqualifier: false });
  assert.notEqual(tr.stop_reason, "structural_disqualifier");
  assert.equal(tr.failure_class, "insufficient_public_evidence");
});

// ── helpers ──────────────────────────────────────────────────────────────────
t("18 isProviderDegradedError recognizes real quota/circuit messages", () => {
  assert.equal(isProviderDegradedError("[anthropic] CIRCUIT_OPEN: credits_exhausted"), true);
  assert.equal(isProviderDegradedError("Your credit balance is too low"), true);
  assert.equal(isProviderDegradedError("429 rate limit"), true);
  assert.equal(isProviderDegradedError("TypeError: undefined is not a function"), false);
});

t("19 minimalFailedTelemetry records a provider-degraded enrichment failure only", () => {
  const m = minimalFailedTelemetry("Acme", "acme.co", "provider_degraded");
  assert.equal(m.enrichment_failed?.reason, "provider_degraded");
  assert.equal(m.provider_calls, 0);
  const tr = build({ telemetry: m, caseCompleted: false });
  assert.equal(tr.failure_class, "provider");
  assert.equal(tr.stop_reason, "provider_degraded");
});

console.log(`\n${passed} passed, 0 failed`);
