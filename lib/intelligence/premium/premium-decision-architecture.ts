// ─── Premium Differentiation V1 — deterministic decision-architecture layer ─────────────────────
//
// PURE, deterministic Premium capabilities computed ONLY from the already-evaluated portfolio
// (AccountBriefVM[] produced by the canonical Case engine). No new research, no network, no LLM, no
// Intelligence-semantic change: these read existing Decision / Fit / Timing / Evidence / counter-
// evidence / validation fields and RE-ORGANIZE them into a stronger decision layer for Premium.
//
// Guarantees (truth doctrine):
//   • Never fabricates: every field traces to a real account field; missing → fail closed.
//   • Never overrides the canonical Decision (prioritize|validate|monitor|hold). Pathways are
//     CONDITIONAL evidence structures, not predictions.
//   • Fail-closed: builders return null / empty / an explicit unknown state when substance is absent.
//   • Deterministic: same input → same output (stable sort, no randomness) — safe for autonomy.
//
// The research-backed Premium capabilities (Commercial Benchmark, Competitor Context, Additional
// Opportunity Discovery, Ecosystem Context) are Phase B: their contracts live in
// ./premium-context-contracts.ts and compose in here as OPTIONAL inputs (absent = fail-closed).

import type { AccountBriefVM, DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";

/** Canonical unknown states — a Premium object is never forced to exist. */
export type UnknownState =
  | "UNKNOWN"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_ESTABLISHED"
  | "REQUIRES_VALIDATION"
  | "OUTSIDE_RESEARCH_SCOPE";

const DECISION_WEIGHT: Record<DecisionState, number> = { prioritize: 4, validate: 3, monitor: 2, hold: 1 };
const STRENGTH_WEIGHT: Record<Strength, number> = { Strong: 2, Moderate: 1, Limited: 0 };

function dim(a: AccountBriefVM, label: string): Strength | null {
  return a.dimensions.find((d) => d.label.toLowerCase() === label.toLowerCase())?.value ?? null;
}
function decisionCriticalValidations(a: AccountBriefVM): string[] {
  const fromDetails = a.validationDetails?.filter((v) => v.decisionCritical).map((v) => v.question) ?? [];
  return fromDetails.length ? fromDetails : a.validations;
}
/** An account has enough substance for a full-depth Premium treatment (excludes mini/empty cases). */
function hasCaseSubstance(a: AccountBriefVM): boolean {
  return Boolean((a.thesis && a.thesis.trim()) || (a.whyItMatters && a.whyItMatters.trim()));
}

// ── Contact Rationale (§23) — why a commercial conversation could be relevant. NOT outreach copy. ──
export interface ContactRationaleV1 {
  accountId: string;
  whyRelevant: string;              // why a conversation could be commercially relevant
  angle: string | null;            // the commercial angle worth exploring (null when not established)
  validateFirst: string | null;    // what to understand/confirm before investing effort
}
export function buildContactRationale(a: AccountBriefVM): ContactRationaleV1 | null {
  if (!hasCaseSubstance(a)) return null;                        // fail closed: no substance (e.g. mini depth)
  const whyRelevant = (a.whyItMatters || a.thesis || "").trim();
  if (!whyRelevant) return null;
  const dc = decisionCriticalValidations(a);
  return {
    accountId: a.id,
    whyRelevant,
    angle: a.opportunityDescriptor?.trim() || a.thesis?.trim() || null,
    validateFirst: dc[0] ?? null,
  };
}

// ── Decision Pathway (§18) — CONDITIONAL: what blocks stronger attention + what would need to be true. ──
export interface DecisionPathwayV1 {
  accountId: string;
  currentDecision: DecisionState;   // unchanged canonical Decision
  state: "OPEN" | UnknownState;    // OPEN = a real conditional pathway exists
  blockingUncertainty: string[];   // what currently limits stronger attention
  validationRequirements: string[];// what to confirm (decision-critical first)
  evidenceConditions: string[];    // conditions that could strengthen OR weaken the case
  conditionalNote: string;         // conditional interpretation — never a predicted future Decision
}
export function buildDecisionPathway(a: AccountBriefVM): DecisionPathwayV1 {
  const validations = decisionCriticalValidations(a);
  const blocking = [...a.limitations];
  if (dim(a, "Timing") === "Limited") blocking.push("Timing is not established from observed evidence.");
  if (a.evidence.strength === "Limited" || a.evidence.corroborated === false) blocking.push("Evidence is thin or uncorroborated.");
  const conditions: string[] = [];
  for (const v of a.validationDetails ?? []) if (v.changesDecisionBecause) conditions.push(v.changesDecisionBecause);
  for (const c of a.counterSignals) conditions.push(`If confirmed, this counter-signal weakens the case: ${c}`);

  // Fail-closed: no validations, no blockers, no counter-signals → nothing to move; not a pathway.
  const hasMaterial = validations.length > 0 || blocking.length > 0 || a.counterSignals.length > 0;
  if (!hasMaterial) {
    return { accountId: a.id, currentDecision: a.decision, state: "NOT_ESTABLISHED", blockingUncertainty: [], validationRequirements: [], evidenceConditions: [], conditionalNote: "No open validation pathway from current evidence." };
  }
  return {
    accountId: a.id,
    currentDecision: a.decision,
    state: "OPEN",
    blockingUncertainty: dedupe(blocking),
    validationRequirements: validations,
    evidenceConditions: dedupe(conditions),
    conditionalNote: `Current Decision is ${a.decision}. Confirming the validation items could strengthen the case; unresolved counter-signals or uncertainties keep it where it is. This is conditional — it does not predict a future Decision.`,
  };
}

// ── Decision-Critical Briefs (§19) — up to 5, deterministic, only where justified. ──
export interface DecisionCriticalBriefV1 {
  accountId: string;
  company: string;
  decision: DecisionState;
  score: number;                   // deterministic selection score (exposed for auditability)
  whyMatters: string;
  whyNow: string | null;           // only when Timing is actually supported
  strongestEvidence: string;
  counterEvidence: string[];
  unknowns: string[];
  contactRationale: ContactRationaleV1 | null;
  validationPriority: string[];
  pathway: DecisionPathwayV1;
  whatCouldChange: string;
}
function briefScore(a: AccountBriefVM): number {
  const timing = dim(a, "Timing");
  const evidence = a.evidence.strength;
  return DECISION_WEIGHT[a.decision] * 10
    + (decisionCriticalValidations(a).some(Boolean) ? 3 : 0)         // validation leverage
    + (timing ? STRENGTH_WEIGHT[timing] : 0)                         // timing support
    + (evidence ? STRENGTH_WEIGHT[evidence] : 0)                     // evidence strength
    + (a.counterSignals.length > 0 ? 1 : 0);                         // decision tension → worth a brief
}
export function selectDecisionCriticalBriefs(accounts: AccountBriefVM[], max = 5): DecisionCriticalBriefV1[] {
  // Qualification: real substance AND decision-critical (prioritize/validate, or a decision-critical validation).
  const qualified = accounts.filter((a) =>
    hasCaseSubstance(a) && (a.decision === "prioritize" || a.decision === "validate" || (a.validationDetails?.some((v) => v.decisionCritical) ?? false)),
  );
  const ranked = qualified
    .map((a) => ({ a, score: briefScore(a) }))
    .sort((x, y) => (y.score - x.score) || ((x.a.rank ?? 1e9) - (y.a.rank ?? 1e9)) || x.a.id.localeCompare(y.a.id));
  return ranked.slice(0, max).map(({ a, score }) => {
    const timing = dim(a, "Timing");
    return {
      accountId: a.id, company: a.company, decision: a.decision, score,
      whyMatters: (a.whyItMatters || a.thesis || "").trim(),
      whyNow: timing && timing !== "Limited" ? (a.whatChanged[0]?.event ?? null) : null,
      strongestEvidence: `${a.evidence.sourceCount} source(s), ${a.evidence.datedCount} dated${a.evidence.strength ? `, ${a.evidence.strength}` : ""}${a.evidence.corroborated ? ", corroborated" : ""}`,
      counterEvidence: a.counterSignals,
      unknowns: a.limitations,
      contactRationale: buildContactRationale(a),
      validationPriority: decisionCriticalValidations(a),
      pathway: buildDecisionPathway(a),
      whatCouldChange: a.validationDetails?.find((v) => v.decisionCritical && v.changesDecisionBecause)?.changesDecisionBecause
        ?? "Stronger corroborated evidence or a dated timing signal could strengthen the case.",
    };
  });
}

// ── Advanced Portfolio Synthesis (§17) — structured, only supportable dimensions. portfolio ≠ market. ──
export interface PortfolioCluster { key: string; kind: "decision" | "segment"; accountIds: string[] }
export interface AdvancedPortfolioSynthesisV1 {
  total: number;
  decisionDistribution: Record<DecisionState, number>;
  clusters: PortfolioCluster[];
  timingPattern: { supported: number; unsupported: number } | null;
  validationBottlenecks: { accountId: string; items: string[] }[];
  evidenceConcentration: { strong: number; limited: number } | null;
  contradictions: { accountId: string; note: string }[];
  scopeNote: string;               // portfolio ≠ market
}
export function buildAdvancedSynthesis(accounts: AccountBriefVM[]): AdvancedPortfolioSynthesisV1 {
  const dist: Record<DecisionState, number> = { prioritize: 0, validate: 0, monitor: 0, hold: 0 };
  for (const a of accounts) dist[a.decision]++;

  const clusters: PortfolioCluster[] = [];
  for (const d of ["prioritize", "validate", "monitor", "hold"] as DecisionState[]) {
    const ids = accounts.filter((a) => a.decision === d).map((a) => a.id);
    if (ids.length >= 2) clusters.push({ key: d, kind: "decision", accountIds: ids });     // only supportable clusters
  }
  const bySeg = new Map<string, string[]>();
  for (const a of accounts) if (a.segment) { const k = a.segment; bySeg.set(k, [...(bySeg.get(k) ?? []), a.id]); }
  Array.from(bySeg.entries()).forEach(([seg, ids]) => { if (ids.length >= 2) clusters.push({ key: seg, kind: "segment", accountIds: ids }); });

  const timingSupported = accounts.filter((a) => { const t = dim(a, "Timing"); return t === "Strong" || t === "Moderate"; }).length;
  const timingPattern = accounts.length ? { supported: timingSupported, unsupported: accounts.length - timingSupported } : null;

  const validationBottlenecks = accounts
    .map((a) => ({ accountId: a.id, items: decisionCriticalValidations(a) }))
    .filter((x) => x.items.length > 0);

  const strong = accounts.filter((a) => a.evidence.strength === "Strong").length;
  const limited = accounts.filter((a) => a.evidence.strength === "Limited").length;
  const evidenceConcentration = accounts.length ? { strong, limited } : null;

  const contradictions = accounts
    .filter((a) => dim(a, "Fit") === "Strong" && (a.evidence.strength === "Limited" || a.evidence.corroborated === false))
    .map((a) => ({ accountId: a.id, note: "Strong fit but thin/uncorroborated evidence — validate before committing effort." }));

  return {
    total: accounts.length,
    decisionDistribution: dist,
    clusters,
    timingPattern,
    validationBottlenecks,
    evidenceConcentration,
    contradictions,
    scopeNote: "Patterns describe only the evaluated portfolio and its available evidence — not the whole market.",
  };
}

// ── Premium Executive Portfolio (§31) — the decision layer that composes the above. ──
export interface PremiumExecutivePortfolioV1 {
  total: number;
  decisionDistribution: Record<DecisionState, number>;
  priorityMap: { accountId: string; company: string; decision: DecisionState }[];  // attention order
  topOpportunities: string[];      // accountIds worth attention first (prioritize/validate)
  keyUncertainties: string[];
  validationPriorities: string[];
  decisionCriticalBriefRefs: string[];  // accountIds of the selected briefs
  synthesis: AdvancedPortfolioSynthesisV1;
}
export function buildPremiumExecutivePortfolio(accounts: AccountBriefVM[]): PremiumExecutivePortfolioV1 {
  const synthesis = buildAdvancedSynthesis(accounts);
  const priorityMap = [...accounts]
    .sort((a, b) => (DECISION_WEIGHT[b.decision] - DECISION_WEIGHT[a.decision]) || ((a.rank ?? 1e9) - (b.rank ?? 1e9)))
    .map((a) => ({ accountId: a.id, company: a.company, decision: a.decision }));
  const briefs = selectDecisionCriticalBriefs(accounts);
  return {
    total: accounts.length,
    decisionDistribution: synthesis.decisionDistribution,
    priorityMap,
    topOpportunities: priorityMap.filter((p) => p.decision === "prioritize" || p.decision === "validate").map((p) => p.accountId),
    keyUncertainties: dedupe(accounts.flatMap((a) => a.limitations)),
    validationPriorities: dedupe(accounts.flatMap((a) => decisionCriticalValidations(a))),
    decisionCriticalBriefRefs: briefs.map((b) => b.accountId),
    synthesis,
  };
}

function dedupe(xs: string[]): string[] { return Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean))); }
