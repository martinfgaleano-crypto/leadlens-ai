// ─── Provider usage ledger (observed_by_leadlens) ────────────────────────────
// In-process counters for every provider call LeadLens makes: calls, errors,
// latency, last success/failure. Persisted best-effort to .leadlens/usage.json
// so local ops survive restarts; on serverless the file is ephemeral — the
// console labels this data "observed_by_leadlens" with that limitation. Never
// invents numbers: only what this process actually observed.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

export interface ProviderUsage {
  calls_today: number; calls_month: number; errors_today: number;
  last_success: string | null; last_failure: string | null; last_error: string | null;
  latency_avg_ms: number; latency_n: number;
  day: string; month: string;      // rollover keys
  input_tokens_today?: number; output_tokens_today?: number;
  input_tokens_month?: number; output_tokens_month?: number;
  calculated_cost_usd_today?: number; calculated_cost_usd_month?: number;
  pricing_source?: string; pricing_model?: string;
}

type Ledger = Record<string, ProviderUsage>;
const FILE = ".leadlens/usage.json";
let ledger: Ledger | null = null;

function today(): string { return new Date().toISOString().slice(0, 10); }
function thisMonth(): string { return new Date().toISOString().slice(0, 7); }

function load(): Ledger {
  if (ledger) return ledger;
  try { ledger = JSON.parse(readFileSync(FILE, "utf8")) as Ledger; } catch { ledger = {}; }
  return ledger;
}
function persist(): void {
  try { mkdirSync(".leadlens", { recursive: true }); writeFileSync(FILE, JSON.stringify(ledger ?? {})); } catch { /* serverless: ephemeral */ }
}

export function recordProviderCall(provider: string, ok: boolean, latencyMs: number, error?: string | null): void {
  const L = load();
  const u = (L[provider] ??= { calls_today: 0, calls_month: 0, errors_today: 0, last_success: null, last_failure: null, last_error: null, latency_avg_ms: 0, latency_n: 0, day: today(), month: thisMonth() });
  if (u.day !== today()) { u.calls_today = 0; u.errors_today = 0; u.day = today(); }
  if (u.month !== thisMonth()) { u.calls_month = 0; u.month = thisMonth(); }
  u.calls_today++; u.calls_month++;
  if (ok) u.last_success = new Date().toISOString();
  else { u.errors_today++; u.last_failure = new Date().toISOString(); u.last_error = (error ?? "unknown").slice(0, 200); }
  if (Number.isFinite(latencyMs) && latencyMs >= 0) { u.latency_avg_ms = Math.round((u.latency_avg_ms * u.latency_n + latencyMs) / (u.latency_n + 1)); u.latency_n++; }
  persist();
}

export function recordLLMUsage(input: {
  provider: string; model: string; inputTokens: number; outputTokens: number;
  calculatedCostUsd: number | null; pricingSource: string;
}): void {
  const L = load();
  const u = (L[input.provider] ??= { calls_today: 0, calls_month: 0, errors_today: 0, last_success: null, last_failure: null, last_error: null, latency_avg_ms: 0, latency_n: 0, day: today(), month: thisMonth() });
  if (u.day !== today()) {
    u.calls_today = 0; u.errors_today = 0; u.input_tokens_today = 0; u.output_tokens_today = 0; u.calculated_cost_usd_today = 0; u.day = today();
  }
  if (u.month !== thisMonth()) {
    u.calls_month = 0; u.input_tokens_month = 0; u.output_tokens_month = 0; u.calculated_cost_usd_month = 0; u.month = thisMonth();
  }
  u.input_tokens_today = (u.input_tokens_today ?? 0) + input.inputTokens;
  u.output_tokens_today = (u.output_tokens_today ?? 0) + input.outputTokens;
  u.input_tokens_month = (u.input_tokens_month ?? 0) + input.inputTokens;
  u.output_tokens_month = (u.output_tokens_month ?? 0) + input.outputTokens;
  if (input.calculatedCostUsd !== null) {
    u.calculated_cost_usd_today = Number(((u.calculated_cost_usd_today ?? 0) + input.calculatedCostUsd).toFixed(8));
    u.calculated_cost_usd_month = Number(((u.calculated_cost_usd_month ?? 0) + input.calculatedCostUsd).toFixed(8));
  }
  u.pricing_model = input.model;
  u.pricing_source = input.pricingSource;
  persist();
}

export function getUsage(): Ledger { return { ...load() }; }
