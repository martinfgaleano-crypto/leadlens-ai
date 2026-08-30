// MEMORY→CHANGE→PORTFOLIO V1 — Phase 4: failure honesty.
// A run with no delivered opportunities must distinguish a HEALTHY abstention (sufficient
// coverage, genuinely no strong opportunity) from INSUFFICIENT coverage (provider/enrichment
// degradation). Provider failure is never a commercial conclusion by itself.

import assert from "node:assert/strict";
import { classifyRunCoverage, type AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };

const tel = (over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry => ({
  version: "v", account: "a", domain: "a.com", planned_queries: 3, executed_queries: 3, provider_calls: 3, provider_failures: 0,
  results_seen: 6, evidence_accepted: 1, evidence_rejected: 1, pages_extracted: 1, extraction_failures: 0, structured_extraction_calls: 1,
  dated_evidence: 1, independent_domains: 1, corroboration_attempted: true, corroborating_domains: 1, claims_recovered: 1,
  counterevidence_checked: true, early_stop_reason: "sufficient_evidence", query_audit: [], extraction_audit: [], ...over,
});
const degraded = () => tel({ enrichment_failed: { provider: "anthropic", reason: "provider_degraded" }, early_stop_reason: "providers_unavailable" });
const providerDead = () => tel({ provider_calls: 4, provider_failures: 4, early_stop_reason: "providers_unavailable" });

// Healthy: all accounts researched cleanly, just no strong opportunity → sufficient.
t("healthy no-opportunity run classifies as sufficient", classifyRunCoverage([tel(), tel(), tel()]) === "sufficient");
// A minority degraded → partial (some valid coverage remains).
t("minority degraded → partial", classifyRunCoverage([tel(), tel(), degraded()]) === "partial");
// Half-or-more degraded → insufficient.
t("half-or-more degraded → insufficient", classifyRunCoverage([tel(), degraded(), providerDead()]) === "insufficient");
t("all degraded → insufficient", classifyRunCoverage([degraded(), providerDead()]) === "insufficient");
// No telemetry at all → insufficient (cannot claim a healthy abstention).
t("no telemetry → insufficient (not a healthy abstention)", classifyRunCoverage([]) === "insufficient" && classifyRunCoverage([null, null]) === "insufficient");
// Provider failure alone (all calls failed) is coverage-insufficient, NOT a commercial Hold.
t("provider-dead account counts toward insufficient coverage, not opportunity truth", classifyRunCoverage([providerDead()]) === "insufficient");

// Outcome mapping (mirrors productive-spine-store metadata + spine):
const outcome = (delivered: number, coverage: "sufficient" | "partial" | "insufficient") =>
  delivered > 0 ? "completed_with_opportunities" : coverage === "insufficient" ? "completed_insufficient_coverage" : "completed_no_strong_opportunity";
t("0 delivered + sufficient → completed_no_strong_opportunity (genuine abstention)", outcome(0, "sufficient") === "completed_no_strong_opportunity");
t("0 delivered + insufficient → completed_insufficient_coverage (NOT masqueraded as abstention)", outcome(0, "insufficient") === "completed_insufficient_coverage");
t("delivered>0 → completed_with_opportunities regardless of coverage", outcome(2, "partial") === "completed_with_opportunities");

console.log(`\n${passed} passed, 0 failed`);
