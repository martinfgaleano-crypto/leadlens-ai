// ─── Market-to-Account staged pipeline (market-to-account-pipeline-v1) ───────
// Formalizes the operative sequence as an explicit, deterministic, replayable
// pipeline (was a post-hoc Admin transform):
//   client objective → buyer segments → segment queries → company universe →
//   verification+classification → structural ranking → shortlist →
//   deep research ONLY for the shortlist → signals/timing → staged artifact.
// Live provider work is injected via `StageExecutors`, so tests run fully
// deterministically (stub executors) and the harness wires real ones. Preserves
// separate structural scores, channel_fit_not_buying_intent, and never lets
// channel-fit alone reach act_now (recommendation stays in the report layer).

import {
  deriveBuyerSegments, buildSegmentQueries, classifyBuyerSegment, computeStructuralScores,
  selectAccounts, buildMarketLandscape, type BuyerSegment, type RankedAccount, type MarketLandscape,
} from "./market-to-account";

export const MARKET_TO_ACCOUNT_PIPELINE_VERSION = "market-to-account-pipeline-v1";

/** A company as returned by the discover+verify stage (already resolved). */
export interface VerifiedCompany {
  company: string; domain: string | null; sector: string | null;
  visibility: "obvious" | "emerging" | "unknown" | string; baseScore: number | null;
  verified: boolean;
}

/** Result of account-specific deep research (Block 5 fills this; here it may be
 *  null = not run → deep_research_incomplete, reported honestly). */
export interface DeepResearchResult {
  company: string; complete: boolean; hasTiming: boolean; hasEvidence: boolean;
  daysOld: number | null; corroboration: "high" | "medium" | "low" | "insufficient" | null;
  note: string;
}

export interface StageExecutors {
  /** Stage 3-4: run segment queries → discover + verify + classify companies.
   *  Live in the harness (search/identity); stub in tests. Deterministic given
   *  the same queries. */
  discoverAndVerify: (queriesBySegment: Record<string, string[]>) => Promise<VerifiedCompany[]>;
  /** Stage 7: deep research for the shortlist ONLY. Return null per account to
   *  signal "not researched yet" (deep_research_incomplete). */
  deepResearch?: (shortlist: RankedAccount[]) => Promise<DeepResearchResult[]>;
  /** Optional monotonic clock for deterministic durations in tests. */
  now?: () => number;
  /** Optional per-stage cost hook (USD). */
  costOf?: (stage: string) => number;
}

export type ReasonCode =
  | "included_in_universe" | "excluded_from_universe" | "shortlisted" | "not_shortlisted"
  | "deep_research_complete" | "deep_research_incomplete" | "no_current_timing" | "insufficient_evidence";

export interface StagedRunArtifact {
  version: string;
  segments: BuyerSegment[];
  queries_by_segment: Record<string, string[]>;
  discovered_companies: number;
  verified_companies: number;
  classified_companies: number;
  structural_ranking: RankedAccount[];
  shortlist: RankedAccount[];
  deep_research_status: { requested: number; complete: number; incomplete: number };
  signal_coverage: { with_timing: number; total_shortlist: number };
  evidence_coverage: { corroborated: number; weak: number; total_shortlist: number };
  market_landscape: MarketLandscape;
  cost_by_stage: Record<string, number>;
  duration_by_stage: Record<string, number>;
  reason_codes: Record<string, ReasonCode[]>;
}

export interface PipelineInput {
  offering: string; objective?: string; region?: string;
  shortlist_size?: number; per_segment_cap?: number;
}

/** Run the staged pipeline. Deterministic given the executors' outputs. */
export async function runStagedPipeline(input: PipelineInput, ex: StageExecutors): Promise<StagedRunArtifact> {
  const now = ex.now ?? (() => Date.now());
  const cost = (s: string) => (ex.costOf ? ex.costOf(s) : 0);
  const cost_by_stage: Record<string, number> = {};
  const duration_by_stage: Record<string, number> = {};
  const reason_codes: Record<string, ReasonCode[]> = {};
  const addReason = (company: string, code: ReasonCode) => { (reason_codes[company] ??= []).push(code); };
  const stage = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    const t0 = now(); const r = await fn(); duration_by_stage[name] = now() - t0; cost_by_stage[name] = cost(name); return r;
  };

  // Stage 1 — buyer segments.
  const segDefs = await stage("segments", () => deriveBuyerSegments(input.offering, input.objective ?? ""));
  const segments = segDefs.map((s) => s.id);

  // Stage 2 — queries by segment.
  const queries_by_segment = await stage("queries_by_segment", () => {
    const q: Record<string, string[]> = {};
    for (const s of segDefs) q[s.id] = buildSegmentQueries(s.id, input.region ?? "Colombia");
    return q;
  });

  // Stage 3-4 — discover + verify + classify.
  const discovered = await stage("discover_verify", () => ex.discoverAndVerify(queries_by_segment));
  const verified = discovered.filter((c) => c.verified);
  const ranked: RankedAccount[] = await stage("classify_rank", () => verified.map((c) => {
    const seg = classifyBuyerSegment(c.company, c.sector);
    const scores = computeStructuralScores({
      segment: seg, visibility: c.visibility, hasDomain: !!c.domain, baseScore: c.baseScore,
      daysOld: null, corroboration: null, isChannelOnly: true, // timing/evidence enriched by deep research
    });
    return { company: c.company, domain: c.domain, sector: c.sector, visibility: c.visibility, segment: seg, scores };
  }));

  // Universe reason codes.
  for (const c of discovered) c.verified ? addReason(c.company, "included_in_universe") : addReason(c.company, "excluded_from_universe");

  // Stage 5-6 — structural ranking (already computed) → deterministic diverse shortlist.
  const shortlist = await stage("shortlist", () => selectAccounts(ranked, input.shortlist_size ?? 8, input.per_segment_cap ?? 3));
  const inShort = new Set(shortlist.map((a) => a.company));
  for (const a of ranked) addReason(a.company, inShort.has(a.company) ? "shortlisted" : "not_shortlisted");

  // Stage 7 — deep research ONLY on the shortlist.
  const deep = await stage("deep_research", () => (ex.deepResearch ? ex.deepResearch(shortlist) : Promise.resolve([] as DeepResearchResult[])));
  const deepByCompany = new Map(deep.map((d) => [d.company, d]));
  let complete = 0, incomplete = 0, withTiming = 0, corroborated = 0, weak = 0;
  for (const a of shortlist) {
    const d = deepByCompany.get(a.company);
    if (d?.complete) { complete++; addReason(a.company, "deep_research_complete"); } else { incomplete++; addReason(a.company, "deep_research_incomplete"); }
    if (d?.hasTiming) withTiming++; else addReason(a.company, "no_current_timing");
    if (d?.corroboration === "high" || d?.corroboration === "medium") corroborated++;
    else { weak++; addReason(a.company, "insufficient_evidence"); }
  }

  const market_landscape = buildMarketLandscape(ranked, { shortlisted: shortlist.length, validation_candidates: complete, dynamic_opportunities: withTiming });

  return {
    version: MARKET_TO_ACCOUNT_PIPELINE_VERSION,
    segments, queries_by_segment,
    discovered_companies: discovered.length, verified_companies: verified.length, classified_companies: ranked.length,
    structural_ranking: ranked, shortlist,
    deep_research_status: { requested: shortlist.length, complete, incomplete },
    signal_coverage: { with_timing: withTiming, total_shortlist: shortlist.length },
    evidence_coverage: { corroborated, weak, total_shortlist: shortlist.length },
    market_landscape, cost_by_stage, duration_by_stage, reason_codes,
  };
}
