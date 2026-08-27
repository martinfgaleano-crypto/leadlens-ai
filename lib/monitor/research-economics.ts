// ─── Research economics: normalized yield / waste / cost metrics ──────────────
//
// Structured, Observatory-ready metrics for what a route actually produced and
// what it wasted. Costs are recorded ONLY where reliably known (provider $ is
// often null and is never fabricated); usage (calls/tokens/latency) is always
// recorded. No raw prose / source bodies / secrets.

import type { ProviderId } from "./provider-routing";

export type WasteReason =
  | "duplicate_result"
  | "wrong_company"
  | "irrelevant"
  | "static_only"
  | "historical"
  | "undated"
  | "low_quality"
  | "source_fetch_failed"
  | "materiality_rejected"
  | "temporal_rejected"
  | "already_sufficient"
  | "provider_unavailable";

export interface ProviderRouteObservation {
  provider: ProviderId;
  calls: number;
  successes: number;
  failures: number;
  latencyMsTotal: number;
  costUsd: number | null;         // null when provider pricing is not reliably known
  candidates: number;
  uniqueCandidates: number;
  acceptedSources: number;
  claims: number;
  events: number;
  materialEvents: number;
  waste: Partial<Record<WasteReason, number>>;
}

export function emptyObservation(provider: ProviderId): ProviderRouteObservation {
  return { provider, calls: 0, successes: 0, failures: 0, latencyMsTotal: 0, costUsd: null, candidates: 0, uniqueCandidates: 0, acceptedSources: 0, claims: 0, events: 0, materialEvents: 0, waste: {} };
}

export function recordWaste(obs: ProviderRouteObservation, reason: WasteReason, n = 1): void {
  obs.waste[reason] = (obs.waste[reason] ?? 0) + n;
}

export interface CostBasis { totalCostUsd: number | null; costKnown: boolean }

/** Sum only KNOWN provider costs; costKnown is false when any contributing provider
 *  cost is null (so downstream never treats a partial sum as the true total). */
export function totalCost(observations: ProviderRouteObservation[], llmCostUsd: number | null = null): CostBasis {
  let sum = 0; let anyUnknown = false;
  for (const o of observations) { if (o.costUsd === null) anyUnknown = true; else sum += o.costUsd; }
  if (llmCostUsd === null) anyUnknown = true; else sum += llmCostUsd;
  return { totalCostUsd: anyUnknown ? null : sum, costKnown: !anyUnknown };
}

const per = (cost: number | null, denom: number): number | null => cost === null || denom <= 0 ? null : Math.round((cost / denom) * 1e6) / 1e6;

export interface NormalizedEconomics {
  providerCalls: number;
  totalLatencyMs: number;
  cost: CostBasis;
  candidates: number;
  uniqueCandidates: number;
  acceptedSources: number;
  acceptedEvents: number;
  materialEvents: number;
  wasteByReason: Partial<Record<WasteReason, number>>;
  wasteRate: number;             // wasted results / total results (0..1)
  // cost-per metrics — null when cost is unknown or denominator is 0.
  costPerUniqueCandidate: number | null;
  costPerAcceptedSource: number | null;
  costPerAcceptedEvent: number | null;
  costPerMaterialEvent: number | null;
}

export function normalizeEconomics(observations: ProviderRouteObservation[], llmCostUsd: number | null = null): NormalizedEconomics {
  const providerCalls = observations.reduce((n, o) => n + o.calls, 0);
  const totalLatencyMs = observations.reduce((n, o) => n + o.latencyMsTotal, 0);
  const candidates = observations.reduce((n, o) => n + o.candidates, 0);
  const uniqueCandidates = observations.reduce((n, o) => n + o.uniqueCandidates, 0);
  const acceptedSources = observations.reduce((n, o) => n + o.acceptedSources, 0);
  const acceptedEvents = observations.reduce((n, o) => n + o.events, 0);
  const materialEvents = observations.reduce((n, o) => n + o.materialEvents, 0);
  const wasteByReason: Partial<Record<WasteReason, number>> = {};
  for (const o of observations) for (const k of Object.keys(o.waste) as WasteReason[]) wasteByReason[k] = (wasteByReason[k] ?? 0) + (o.waste[k] ?? 0);
  const wasted = Object.values(wasteByReason).reduce((n, v) => n + (v ?? 0), 0);
  const cost = totalCost(observations, llmCostUsd);

  return {
    providerCalls, totalLatencyMs, cost, candidates, uniqueCandidates, acceptedSources, acceptedEvents, materialEvents,
    wasteByReason,
    wasteRate: candidates > 0 ? Math.round((wasted / candidates) * 100) / 100 : 0,
    costPerUniqueCandidate: per(cost.totalCostUsd, uniqueCandidates),
    costPerAcceptedSource: per(cost.totalCostUsd, acceptedSources),
    costPerAcceptedEvent: per(cost.totalCostUsd, acceptedEvents),
    costPerMaterialEvent: per(cost.totalCostUsd, materialEvents),
  };
}
