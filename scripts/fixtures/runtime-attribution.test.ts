// OVERNIGHT MASTER SPRINT — PHASE 1: runtime attribution truth (§1.17 matrix).
// Per-account wall clock comes from the account's OWN provider_ops durations, never the
// whole-run elapsed. Distinct accounts → distinct wall clocks; no-Case & failure accounts
// still finalize complete traces; no negative/epoch-zero timestamps.

import assert from "node:assert/strict";
import { buildAccountRunTrace } from "@/lib/intelligence/run-trace-wiring";
import type { AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };

function telemetry(over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry {
  return {
    version: "adr-test", account: "Acme", domain: "acme.com",
    planned_queries: 2, executed_queries: 2, provider_calls: 2, provider_failures: 0, results_seen: 5,
    evidence_accepted: 2, evidence_rejected: 1, pages_extracted: 1, extraction_failures: 0, structured_extraction_calls: 1,
    dated_evidence: 1, independent_domains: 2, corroboration_attempted: true, corroborating_domains: 1, claims_recovered: 1,
    counterevidence_checked: true, early_stop_reason: "sufficient_evidence",
    query_audit: [{ query_id: "q1", stage: "search", provider: "brave", results: 3, accepted: 1 }],
    extraction_audit: [], provider_ops: [], ...over,
  };
}
const ops = (search: number, ft: number, llm: number) => [
  { provider: "brave", operation: "search" as const, stage: "search", duration_ms: search, ok: true, timeout: false, results: 3 },
  { provider: "firecrawl", operation: "full_text" as const, stage: "full_text", duration_ms: ft, ok: true, timeout: false, results: 1 },
  { provider: "anthropic", operation: "llm" as const, stage: "extract", duration_ms: llm, ok: true, timeout: false, results: null },
];

// A — two accounts with DIFFERENT provider_op durations get DISTINCT wall clocks.
const fast = buildAccountRunTrace({ runId: "intel_x", accountId: "fast.com", contextRefSafe: "ctx", telemetry: telemetry({ provider_ops: ops(300, 200, 500) }), decision: "validate", caseCompleted: true, research_stage_ms: 0, case_synthesis_ms: 1, provenance: "controlled" });
const slow = buildAccountRunTrace({ runId: "intel_x", accountId: "slow.com", contextRefSafe: "ctx", telemetry: telemetry({ provider_ops: ops(1500, 1200, 1300) }), decision: "hold", caseCompleted: true, research_stage_ms: 0, case_synthesis_ms: 1, provenance: "controlled" });
t("A: distinct per-account provider work -> distinct wall clocks", fast.wall_clock_ms !== slow.wall_clock_ms);
t("A: wall clock reflects the account's OWN work (slow > fast)", slow.wall_clock_ms > fast.wall_clock_ms);
t("A: fast account wall clock ~= its own stage sum (~1001ms)", fast.wall_clock_ms >= 1000 && fast.wall_clock_ms <= 1010);
t("A: slow account wall clock ~= its own stage sum (~4001ms)", slow.wall_clock_ms >= 4000 && slow.wall_clock_ms <= 4010);

// N — the per-account wall clock is NOT the whole-run elapsed (no run-shared value).
t("N: two accounts in the same run do not share one wall clock", fast.wall_clock_ms < slow.wall_clock_ms && fast.wall_clock_ms > 0);

// F — a no-Case account still produces a complete trace with real timing.
const noCase = buildAccountRunTrace({ runId: "intel_x", accountId: "nocase.com", contextRefSafe: "ctx", telemetry: telemetry({ provider_ops: ops(400, 0, 0), early_stop_reason: "no_material_event" }), decision: null, caseCompleted: false, research_stage_ms: 0, case_synthesis_ms: 0, provenance: "controlled" });
t("F: no-Case account finalizes a complete trace", noCase.completion_state === "failed" && noCase.wall_clock_ms >= 400 && noCase.account_id === "nocase.com");

// G — a provider-failure account produces a complete partial trace, classified provider.
const failed = buildAccountRunTrace({ runId: "intel_x", accountId: "down.com", contextRefSafe: "ctx", telemetry: telemetry({ provider_calls: 2, provider_failures: 2, early_stop_reason: "providers_unavailable", provider_ops: [{ provider: "brave", operation: "search", stage: "search", duration_ms: 120, ok: false, timeout: true, results: null }] }), decision: null, caseCompleted: false, research_stage_ms: 0, case_synthesis_ms: 0, provenance: "controlled" });
t("G: provider-failure account -> provider_degraded stop, failure=provider", failed.stop_reason === "provider_degraded" && failed.failure_class === "provider");
t("G: provider-failure trace is complete (wall clock present)", failed.wall_clock_ms >= 120);

// J/K/M — no negative durations, no 1970 epoch, monotonic (relative clock ≥ 0).
for (const tr of [fast, slow, noCase, failed]) {
  t(`J/K ${tr.account_id}: wall_clock >= 0 and stage_work >= 0 (no negatives / epoch-zero)`, tr.wall_clock_ms >= 0 && tr.stage_work_ms >= 0);
}

console.log(`\n${passed} passed, 0 failed`);
