// ─── Premium Differentiation V1 — Phase B LIVE contextual researcher (the injected seam) ──────────
//
// This is the live implementation of `PremiumContextResearcher`: providers PRODUCE real search
// evidence, an LLM PROPOSES structured context grounded in that evidence, and this module maps
// proposals → RawPremiumResearch. It NEVER decides truth or over-claims — that is the deterministic
// `assemblePremiumContext` gate downstream. Two safety layers live here BEFORE the gate:
//   1. Anti-hallucination: every proposed note must cite ≥1 evidence index that resolves to a REAL
//      retrieved result. Proposals citing nothing real are dropped; evidence is built only from the
//      actual retrieved items (never from model-invented URLs/dates).
//   2. Hard budgets: a bounded query plan (sized to PREMIUM_BUDGETS), a provider-call cap, an LLM-call
//      cap, and a COGS ceiling that STOPS (throws) rather than silently overspend.
//
// Cost is MEASURED, never fabricated: LLM list-price cost is read from the usage ledger delta;
// provider search cost is provider-reported (Brave/Serper report null → that component is unmeasured,
// reflected in `measured:false`). estimatedUsd is a list-price estimate, not a provider invoice.
//
// Deterministic by construction under injected seams (providers + llm + cost probe) so the researcher
// LOGIC is provable at ZERO spend; the live wiring is exercised only by the funded acceptance run.

import type { SearchProvider, SearchQuery, SearchResultItem } from "@/lib/sources/access/provider-contract";
import { REAL_PROVIDERS } from "@/lib/sources/access/providers";
import {
  PREMIUM_BUDGETS,
  type PremiumContextResearcher,
  type RawPremiumResearch,
  type EvidenceRef,
  type GroundedNote,
  type Basis,
  type Confidence,
  type CommercialBenchmarkV1,
  type CompetitorContextV1,
  type AdditionalOpportunityV1,
  type EcosystemActorV1,
  type DiscoveryRole,
  type PremiumContextCost,
} from "@/lib/intelligence/premium/premium-context";

/** The live researcher ALWAYS produces a measured cost record (never omits it), so it returns this
 *  stricter shape — narrower than the injected `PremiumContextResearcher` seam (whose `cost` is optional). */
export type ResearchedRaw = RawPremiumResearch & { cost: PremiumContextCost };
export interface LivePremiumContextResearcher extends PremiumContextResearcher {
  research(input: { objective: string; portfolioCompanies: string[]; offer: string | null }): Promise<ResearchedRaw>;
}

// ── Hard operational envelope (defaults; overridable for the acceptance run) ──
export interface LiveResearcherLimits {
  maxProviderSearches: number;  // total search() calls across the whole run
  maxLlmCalls: number;          // total LLM extraction calls
  cogsCeilingUsd: number;       // hard STOP — throws PREMIUM_COGS_CEILING if exceeded
  cogsTargetUsd: number;        // soft — surfaced in cost for the founder, never a hard stop
  perQueryResults: number;      // max_results per search
  freshnessDays: number;        // ceiling for TIME-SENSITIVE queries only (see doctrine)
}
export const DEFAULT_LIVE_LIMITS: LiveResearcherLimits = {
  maxProviderSearches: 8,
  maxLlmCalls: 1,
  cogsCeilingUsd: 8,   // >$8 = STOP per HQ
  cogsTargetUsd: 4,    // <$4 = target per HQ
  perQueryResults: 6,
  freshnessDays: PREMIUM_BUDGETS.freshnessDays,
};

export interface LiveResearcherDeps {
  providers?: SearchProvider[];                                     // default: health-available REAL_PROVIDERS
  /** LLM extraction seam. Default wraps callClaudeJSON. Injected as a pure stub in tests. */
  extract?: (system: string, user: string, maxTokens: number) => Promise<LlmProposal>;
  /** Reads cumulative Anthropic list-cost (USD). Default: usage-ledger. Snapshotted before/after. */
  readAnthropicCostUsd?: () => number;
  /** Clock (injectable for deterministic tests). */
  now?: () => number;
  limits?: Partial<LiveResearcherLimits>;
}

// ── What the LLM proposes (grounded in the indexed evidence pool; code decides) ──
export interface ProposedNote { statement: string; sources: number[]; basis?: Basis; confidence?: Confidence; timeSensitive?: boolean }
export interface ProposedCompetitor { entity: string; role?: "competitor" | "alternative"; whyRelevant: string; affects?: "benchmark" | "opportunity"; positioning: ProposedNote[]; counterevidence?: string[]; unknowns?: string[] }
export interface ProposedDiscovery { entity: string; role?: DiscoveryRole; whyDiscovered?: string; connectionToObjective: string; worthInvestigatingBecause: string; sources: number[]; unknowns?: string[] }
export interface ProposedEcosystem { entity: string; role?: EcosystemActorV1["role"]; materialTo?: EcosystemActorV1["materialTo"]; why: string; sources: number[] }
export interface LlmProposal {
  benchmark?: { recurringNeeds?: ProposedNote[]; offerPositioning?: ProposedNote[]; differentiatedWhere?: ProposedNote[]; notEstablishedWhere?: string[]; currentMovements?: ProposedNote[] };
  competitors?: ProposedCompetitor[];
  additionalOpportunities?: ProposedDiscovery[];
  ecosystem?: ProposedEcosystem[];
}

interface PoolItem { idx: number; item: SearchResultItem }

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.trunc(n)));

/** Build a bounded, capability-targeted query plan. Each query is tagged time-sensitive or durable so
 *  freshness is applied ONLY to time-sensitive queries (movements/news) — durable structural context is
 *  not date-filtered (180d is a ceiling for time-sensitive claims, not a universal evidence-expiry rule). */
export function planQueries(input: { objective: string; portfolioCompanies: string[]; offer: string | null }, limits: LiveResearcherLimits): Array<{ q: string; timeSensitive: boolean; type: SearchQuery["query_type"] }> {
  const seg = input.objective.trim();
  const offer = (input.offer ?? "").trim();
  const anchor = input.portfolioCompanies.slice(0, 3).join(", ");
  const plan: Array<{ q: string; timeSensitive: boolean; type: SearchQuery["query_type"] }> = [
    { q: `${seg} recurring operational needs challenges`, timeSensitive: false, type: "industry_discovery" },
    ...(offer ? [{ q: `${offer} providers for ${seg} how positioned`, timeSensitive: false, type: "industry_discovery" as const }] : []),
    { q: `${offer || seg} competitors alternatives comparison`, timeSensitive: false, type: "industry_discovery" },
    { q: `companies like ${anchor} ${seg} adjacent segment`, timeSensitive: false, type: "regional_discovery" },
    { q: `${seg} ${offer} recent developments announcement`, timeSensitive: true, type: "news" },
    { q: `${seg} key suppliers partners distributors ecosystem`, timeSensitive: false, type: "industry_discovery" },
  ];
  return plan.slice(0, limits.maxProviderSearches);
}

const EXTRACT_SYSTEM = `You are a grounded commercial-context extractor for LeadLens (Account Opportunity Intelligence).
You are given a research OBJECTIVE, the evaluated PORTFOLIO companies, the customer's OFFER, and an indexed EVIDENCE pool (real search results: title, snippet, url, date, provider).
Propose ONLY structured context that the cited evidence actually supports. Absolute rules:
- Every note MUST cite one or more evidence indices ("sources") from the pool. NEVER invent a source, url, date, statistic, or entity not present in the evidence.
- If the evidence does not support a category, return an EMPTY array for it. Zero results is a valid, correct answer.
- Do NOT produce market share, TAM/SAM/SOM, a full competitor map, or a lead list. This is bounded context, not a market study.
- The portfolio is NOT the whole market. Distinguish durable structural facts from time-sensitive movements (set "timeSensitive": true only for recent/dated developments).
- Never restate a company's own marketing as independent fact; positioning claims are "signal" unless multiple independent sources corroborate.
Output JSON: { "benchmark": { "recurringNeeds": Note[], "offerPositioning": Note[], "differentiatedWhere": Note[], "notEstablishedWhere": string[], "currentMovements": Note[] }, "competitors": Competitor[], "additionalOpportunities": Discovery[], "ecosystem": Ecosystem[] }
Note = { "statement": string, "sources": number[], "basis": "fact"|"signal"|"inference", "confidence": "Strong"|"Moderate"|"Limited", "timeSensitive": boolean }
Competitor = { "entity": string, "role": "competitor"|"alternative", "whyRelevant": string, "affects": "benchmark"|"opportunity", "positioning": Note[], "counterevidence": string[], "unknowns": string[] }
Discovery = { "entity": string, "role": string, "whyDiscovered": string, "connectionToObjective": string, "worthInvestigatingBecause": string, "sources": number[], "unknowns": string[] }
Ecosystem = { "entity": string, "role": string, "materialTo": string, "why": string, "sources": number[] }`;

function buildEvidenceBlock(pool: PoolItem[]): string {
  return pool.map(({ idx, item }) =>
    `[${idx}] ${item.title ?? "(no title)"} | ${item.published_date ?? "undated"} | ${item.provider} | ${item.url}\n    ${item.snippet ?? "(no snippet)"}`
  ).join("\n");
}

/** Resolve proposed evidence indices → real EvidenceRefs. Returns [] when NONE resolve (drop signal). */
function resolveEvidence(sources: number[] | undefined, pool: PoolItem[]): EvidenceRef[] {
  const byIdx = new Map(pool.map((p) => [p.idx, p.item]));
  const refs: EvidenceRef[] = [];
  for (const s of sources ?? []) {
    const item = byIdx.get(s);
    if (!item) continue;                        // model cited a non-existent index → ignore (never fabricate)
    refs.push({ sourceId: item.canonical_url || item.url, url: item.url, observedDate: item.published_date, claim: (item.title ?? item.snippet ?? "").slice(0, 240) });
  }
  // De-dup by origin id so two URLs from the same canonical origin don't inflate independence.
  const seen = new Set<string>();
  return refs.filter((r) => (seen.has(r.sourceId) ? false : (seen.add(r.sourceId), true)));
}

function toGroundedNote(p: ProposedNote, pool: PoolItem[]): GroundedNote | null {
  const evidence = resolveEvidence(p.sources, pool);
  if (evidence.length === 0 || !p.statement?.trim()) return null;   // ungrounded → drop (gate would too, but fail early)
  const basis: Basis = p.basis === "fact" || p.basis === "inference" ? p.basis : "signal";
  const confidence: Confidence = p.confidence === "Strong" || p.confidence === "Limited" ? p.confidence : "Moderate";
  return { statement: p.statement.trim(), basis, evidence, confidence, stale: false };  // `stale` is finalized by the gate
}

/** Map an LLM proposal + evidence pool → RawPremiumResearch (pre-gate). Pure. */
export function mapProposalToRaw(proposal: LlmProposal, pool: PoolItem[]): Omit<RawPremiumResearch, "cost"> {
  const notes = (arr?: ProposedNote[]) => (arr ?? []).map((n) => toGroundedNote(n, pool)).filter((n): n is GroundedNote => n !== null);

  const benchmark: Partial<CommercialBenchmarkV1> = {
    recurringNeeds: notes(proposal.benchmark?.recurringNeeds),
    offerPositioning: notes(proposal.benchmark?.offerPositioning),
    differentiatedWhere: notes(proposal.benchmark?.differentiatedWhere),
    notEstablishedWhere: (proposal.benchmark?.notEstablishedWhere ?? []).filter((s) => s?.trim()),
    currentMovements: notes(proposal.benchmark?.currentMovements),
  };

  const competitors: CompetitorContextV1[] = (proposal.competitors ?? [])
    .map((c) => ({
      entity: c.entity?.trim(),
      role: c.role === "alternative" ? "alternative" as const : "competitor" as const,
      whyRelevant: c.whyRelevant?.trim() ?? "",
      affects: c.affects === "opportunity" ? "opportunity" as const : "benchmark" as const,
      positioning: notes(c.positioning),
      counterevidence: (c.counterevidence ?? []).filter((s) => s?.trim()),
      unknowns: (c.unknowns ?? []).filter((s) => s?.trim()),
      confidence: "Moderate" as Confidence,
    }))
    .filter((c) => c.entity);

  const additionalOpportunities: AdditionalOpportunityV1[] = (proposal.additionalOpportunities ?? [])
    .map((o) => ({
      entity: o.entity?.trim(),
      role: (o.role ?? "adjacent_segment") as DiscoveryRole,
      whyDiscovered: o.whyDiscovered?.trim() ?? "Surfaced adjacent to the evaluated portfolio.",
      connectionToObjective: o.connectionToObjective?.trim() ?? "",
      evidence: resolveEvidence(o.sources, pool),
      worthInvestigatingBecause: o.worthInvestigatingBecause?.trim() ?? "",
      unknowns: (o.unknowns ?? []).filter((s) => s?.trim()),
      deepResearched: false,                    // V1 live cut does no deep fetch — honest false
    }))
    .filter((o) => o.entity);

  const ecosystem: EcosystemActorV1[] = (proposal.ecosystem ?? [])
    .map((e) => ({
      entity: e.entity?.trim(),
      role: (e.role ?? "supplier") as EcosystemActorV1["role"],
      materialTo: (e.materialTo ?? "opportunity") as EcosystemActorV1["materialTo"],
      why: e.why?.trim() ?? "",
      evidence: resolveEvidence(e.sources, pool),
    }))
    .filter((e) => e.entity);

  return { benchmark, competitors, additionalOpportunities, ecosystem };
}

/** Create the live researcher. Deps are injectable so the LOGIC is provable at zero spend. */
export function createLivePremiumContextResearcher(deps: LiveResearcherDeps = {}): LivePremiumContextResearcher {
  const limits: LiveResearcherLimits = { ...DEFAULT_LIVE_LIMITS, ...(deps.limits ?? {}) };
  limits.maxProviderSearches = clampInt(limits.maxProviderSearches, 0, 12);
  limits.perQueryResults = clampInt(limits.perQueryResults, 1, PREMIUM_BUDGETS.discoverySurfaced);
  const now = deps.now ?? Date.now;

  return {
    async research(input) {
      const started = now();

      // Providers: health-gated. Fail-closed → no providers means empty raw (gate → NOT_ESTABLISHED).
      const candidates = deps.providers ?? REAL_PROVIDERS;
      const available: SearchProvider[] = [];
      for (const p of candidates) {
        try { if ((await p.health()).status === "available") available.push(p); } catch { /* unavailable */ }
      }
      const emptyCost = { providerCalls: 0, llmCalls: 0, deepResearchEscalations: 0, estimatedUsd: null as number | null, measured: false, elapsedMs: now() - started };
      if (available.length === 0) {
        return { benchmark: {}, competitors: [], additionalOpportunities: [], ecosystem: [], cost: emptyCost };
      }

      // Bounded search: one provider per query (round-robin over available), respecting the call cap.
      const plan = planQueries(input, limits);
      const pool: PoolItem[] = [];
      const seenUrl = new Set<string>();
      let providerCalls = 0, providerCostUsd = 0, allProviderCostMeasured = true;
      for (let i = 0; i < plan.length && providerCalls < limits.maxProviderSearches; i++) {
        const provider = available[i % available.length];
        const step = plan[i];
        const query: SearchQuery = {
          query: step.q, max_results: limits.perQueryResults, query_type: step.type,
          freshness_days: step.timeSensitive ? limits.freshnessDays : null,
        };
        let resp;
        try { resp = await provider.search(query); } catch { providerCalls++; continue; }
        providerCalls++;
        if (resp.cost_estimate_usd == null) allProviderCostMeasured = false; else providerCostUsd += resp.cost_estimate_usd;
        for (const item of resp.results) {
          const key = item.canonical_url || item.url;
          if (seenUrl.has(key)) continue;
          seenUrl.add(key);
          pool.push({ idx: pool.length, item });
        }
      }

      if (pool.length === 0) {
        return { benchmark: {}, competitors: [], additionalOpportunities: [], ecosystem: [], cost: { ...emptyCost, providerCalls, elapsedMs: now() - started } };
      }

      // LLM extraction: bounded to maxLlmCalls (default 1). Measures list cost via ledger delta.
      const extract = deps.extract ?? defaultExtract;
      const costBefore = (deps.readAnthropicCostUsd ?? defaultAnthropicCost)();
      let llmCalls = 0;
      let proposal: LlmProposal = {};
      if (limits.maxLlmCalls > 0) {
        const user = `OBJECTIVE: ${input.objective}\nPORTFOLIO: ${input.portfolioCompanies.join(", ") || "(none)"}\nOFFER: ${input.offer ?? "(unspecified)"}\n\nEVIDENCE POOL:\n${buildEvidenceBlock(pool)}`;
        try { proposal = await extract(EXTRACT_SYSTEM, user, 3000); llmCalls = 1; } catch { proposal = {}; }
      }
      const costAfter = (deps.readAnthropicCostUsd ?? defaultAnthropicCost)();
      const llmCostUsd = Math.max(0, costAfter - costBefore);

      const raw = mapProposalToRaw(proposal, pool);

      // Cost: list-price estimate. estimatedUsd is the sum of measured components; provider cost is
      // provider-reported (null for Brave/Serper → that component unmeasured → measured:false).
      const estimatedUsd = Number((llmCostUsd + providerCostUsd).toFixed(8));
      const measured = allProviderCostMeasured;   // LLM is list-price estimate; provider cost drives the flag
      if (estimatedUsd > limits.cogsCeilingUsd) {
        throw new Error(`PREMIUM_COGS_CEILING: estimated $${estimatedUsd.toFixed(4)} exceeds ceiling $${limits.cogsCeilingUsd.toFixed(2)} (providerCalls=${providerCalls}, llmCalls=${llmCalls})`);
      }

      return { ...raw, cost: { providerCalls, llmCalls, deepResearchEscalations: 0, estimatedUsd, measured, elapsedMs: now() - started } };
    },
  };
}

// ── Default live seams (used only when not injected) ──
async function defaultExtract(system: string, user: string, maxTokens: number): Promise<LlmProposal> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  return callClaudeJSON<LlmProposal>(system, user, maxTokens);
}
function defaultAnthropicCost(): number {
  try {
    // Lazy require to avoid pulling the ledger into pure-test contexts.

    const { getUsage } = require("@/lib/ops/usage-ledger") as typeof import("@/lib/ops/usage-ledger");
    return getUsage().anthropic?.calculated_cost_usd_today ?? 0;
  } catch { return 0; }
}
