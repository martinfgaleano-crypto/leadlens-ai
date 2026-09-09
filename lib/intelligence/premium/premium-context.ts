// ─── Premium Differentiation V1 — Phase B contextual-Intelligence CONTRACTS + doctrine gating ────
//
// This module owns the TRUTH-ENFORCEMENT layer for Premium's research-backed context (Commercial
// Benchmark, Competitor/Alternative Context, Additional Opportunity Discovery, embedded Ecosystem).
// It is deliberately split from live research: a `PremiumContextResearcher` (Phase B live wiring,
// injected — providers + LLM extraction) PRODUCES raw candidates; `assemblePremiumContext` GATES
// them against the LeadLens doctrine — hard caps, relevance+evidence inclusion tests, staleness
// (a dated signal is not "current"), and fail-closed unknown states. The gating is pure and fully
// testable WITHOUT any network/LLM: it guarantees Premium never fabricates or over-claims, whatever
// research returns. Live research truth + COGS/latency are proven in a separate funded acceptance.
//
// Boundaries (never crossed here): no market share / TAM-SAM-SOM / full competitor map / category
// consulting; no lead lists; no opaque score; portfolio ≠ market; nothing feeds the canonical Decision.

import type { UnknownState } from "@/lib/intelligence/premium/premium-decision-architecture";

export const PREMIUM_BUDGETS = {
  benchmarkEntities: 5,        // max contextual entities in the benchmark
  competitors: 5,              // max total competitors/alternatives
  discoverySurfaced: 8,        // max additional-opportunity candidates surfaced
  discoveryDeep: 3,            // max deep-researched candidates
  ecosystem: 4,                // max ecosystem actors
  decisionBriefs: 5,           // (selection lives in premium-decision-architecture)
  /** A public signal older than this is retained but flagged stale — never presented as "current". */
  freshnessDays: 180,
} as const;

export interface EvidenceRef {
  sourceId: string;            // distinct origin id (independence needs ≥2 distinct origins)
  url: string | null;
  observedDate: string | null; // ISO; null = undated
  claim: string;               // what the source establishes (observed, not inferred)
}
export type Basis = "fact" | "signal" | "inference";   // never collapse signal/inference → fact
export type Confidence = "Strong" | "Moderate" | "Limited";

/** Shared grounded assertion — an object only exists if it carries real evidence or is an explicit unknown. */
export interface GroundedNote {
  statement: string;
  basis: Basis;
  evidence: EvidenceRef[];
  confidence: Confidence;
  stale: boolean;              // true = evidence older than freshnessDays (not current)
}

// ── Commercial Benchmark (central) ──
export interface CommercialBenchmarkV1 {
  state: "PRESENT" | UnknownState;
  recurringNeeds: GroundedNote[];
  offerPositioning: GroundedNote[];   // how the customer's offer appears vs relevant alternatives
  differentiatedWhere: GroundedNote[];
  notEstablishedWhere: string[];      // where differentiation is NOT established (explicit)
  currentMovements: GroundedNote[];   // observed movements materially affecting relevance
  scopeNote: string;                  // benchmark ≠ full market
}
// ── Competitor / alternative context (feeds the benchmark / a decision) ──
export interface CompetitorContextV1 {
  entity: string;
  role: "competitor" | "alternative";
  whyRelevant: string;                // must answer: why it matters to THIS decision/context
  affects: "benchmark" | "opportunity";
  positioning: GroundedNote[];
  counterevidence: string[];
  unknowns: string[];
  confidence: Confidence;
}
// ── Additional opportunity discovery (bounded; NOT Lead Hunter) ──
export type DiscoveryRole = "potential_customer" | "adjacent_segment" | "partner" | "distributor" | "platform" | "supplier" | "complementary_business" | "competitor" | "ecosystem_actor";
export interface AdditionalOpportunityV1 {
  entity: string;
  role: DiscoveryRole;
  whyDiscovered: string;
  connectionToObjective: string;      // must tie to the customer's stated objective/portfolio
  evidence: EvidenceRef[];
  worthInvestigatingBecause: string;
  unknowns: string[];
  deepResearched: boolean;
}
// ── Embedded ecosystem actor (material-only) ──
export interface EcosystemActorV1 {
  entity: string;
  role: Exclude<DiscoveryRole, "potential_customer" | "adjacent_segment">;
  materialTo: "opportunity" | "route" | "access" | "competition" | "validation" | "positioning";
  why: string;
  evidence: EvidenceRef[];
}

export interface PremiumContextCost {
  providerCalls: number; llmCalls: number; deepResearchEscalations: number;
  estimatedUsd: number | null;        // null = unknown/unmeasured (never fabricated)
  measured: boolean;                  // false = estimate; true = provider-reported
  elapsedMs: number;
}
export interface PremiumContextV1 {
  benchmark: CommercialBenchmarkV1;
  competitors: CompetitorContextV1[];
  additionalOpportunities: AdditionalOpportunityV1[];
  ecosystem: EcosystemActorV1[];
  cost: PremiumContextCost;
}

/** What a live researcher yields BEFORE gating (Phase B injected implementation produces this). */
export interface RawPremiumResearch {
  benchmark?: Partial<CommercialBenchmarkV1>;
  competitors?: CompetitorContextV1[];
  additionalOpportunities?: AdditionalOpportunityV1[];
  ecosystem?: EcosystemActorV1[];
  cost?: Partial<PremiumContextCost>;
}
/** The Phase-B live seam (providers + LLM). Injected — never called from the gating layer or tests. */
export interface PremiumContextResearcher {
  research(input: { objective: string; portfolioCompanies: string[]; offer: string | null }): Promise<RawPremiumResearch>;
}

const asOf = () => Date.now();
function isStale(dates: (string | null)[], now: number): boolean {
  const ds = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime()).filter((n) => Number.isFinite(n));
  if (!ds.length) return true;                                   // undated → cannot claim current
  return (now - Math.max(...ds)) > PREMIUM_BUDGETS.freshnessDays * 86_400_000;
}
function noteHasEvidence(n: GroundedNote): boolean { return n.evidence.length > 0 && !!n.statement.trim(); }
function gateNote(n: GroundedNote, now: number): GroundedNote { return { ...n, stale: isStale(n.evidence.map((e) => e.observedDate), now) }; }

/** PURE doctrine gate. Applies caps, relevance+evidence inclusion, staleness and fail-closed states to
 *  raw research. Never adds content; only filters/annotates. Deterministic (stable order preserved). */
export function assemblePremiumContext(raw: RawPremiumResearch, now: number = asOf()): PremiumContextV1 {
  // Benchmark: keep only evidence-backed notes; cap entities; fail closed when nothing survives.
  const b = raw.benchmark ?? {};
  const recurringNeeds = (b.recurringNeeds ?? []).filter(noteHasEvidence).slice(0, PREMIUM_BUDGETS.benchmarkEntities).map((n) => gateNote(n, now));
  const offerPositioning = (b.offerPositioning ?? []).filter(noteHasEvidence).map((n) => gateNote(n, now));
  const differentiatedWhere = (b.differentiatedWhere ?? []).filter(noteHasEvidence).map((n) => gateNote(n, now));
  const currentMovements = (b.currentMovements ?? []).filter((n) => noteHasEvidence(n) && !isStale(n.evidence.map((e) => e.observedDate), now)).map((n) => gateNote(n, now));
  const benchmarkHasSubstance = recurringNeeds.length + offerPositioning.length + differentiatedWhere.length + currentMovements.length > 0;
  const benchmark: CommercialBenchmarkV1 = {
    state: benchmarkHasSubstance ? "PRESENT" : "NOT_ESTABLISHED",
    recurringNeeds, offerPositioning, differentiatedWhere,
    notEstablishedWhere: b.notEstablishedWhere ?? [],
    currentMovements,
    scopeNote: "Reflects only the observed commercial context around the evaluated companies — not the whole market.",
  };

  // Competitors: relevance (whyRelevant) + evidence required; cap 5.
  const competitors = (raw.competitors ?? [])
    .filter((c) => c.whyRelevant?.trim() && c.positioning.some(noteHasEvidence))
    .slice(0, PREMIUM_BUDGETS.competitors)
    .map((c) => ({ ...c, positioning: c.positioning.filter(noteHasEvidence).map((n) => gateNote(n, now)) }));

  // Discovery: objective-tie + evidence required; cap surfaced 8; at most `discoveryDeep` deep-researched.
  let deepCount = 0;
  const additionalOpportunities = (raw.additionalOpportunities ?? [])
    .filter((o) => o.connectionToObjective?.trim() && o.evidence.length > 0 && o.worthInvestigatingBecause?.trim())
    .slice(0, PREMIUM_BUDGETS.discoverySurfaced)
    .map((o) => { const deep = o.deepResearched && deepCount < PREMIUM_BUDGETS.discoveryDeep; if (deep) deepCount++; return { ...o, deepResearched: deep }; });

  // Ecosystem: materiality + evidence required; cap 4.
  const ecosystem = (raw.ecosystem ?? [])
    .filter((e) => e.why?.trim() && e.evidence.length > 0)
    .slice(0, PREMIUM_BUDGETS.ecosystem);

  const cost: PremiumContextCost = {
    providerCalls: raw.cost?.providerCalls ?? 0, llmCalls: raw.cost?.llmCalls ?? 0,
    deepResearchEscalations: raw.cost?.deepResearchEscalations ?? deepCount,
    estimatedUsd: raw.cost?.estimatedUsd ?? null, measured: raw.cost?.measured ?? false,
    elapsedMs: raw.cost?.elapsedMs ?? 0,
  };
  return { benchmark, competitors, additionalOpportunities, ecosystem, cost };
}

/** Empty (fail-closed) context — the correct Premium result when no context research is available/supported. */
export function emptyPremiumContext(): PremiumContextV1 {
  return assemblePremiumContext({});
}
