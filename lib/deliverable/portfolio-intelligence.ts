// ─── Portfolio Intelligence V1 — cross-account synthesis ──────────────────────
// Turns a set of structured Opportunity Cases (AccountBriefVM[]) into portfolio-
// level commercial intelligence. This is NOT summarization: every output is
// deterministic or gated, field-specific, provenance-backed, and uncertainty-
// aware. No output is inferred to fill a section (§65). The layer receives ONLY
// curated structured Case fields (§83) — never raw web results.
//
// Two tiers (§80): DETERMINISTIC metrics (counts/distributions/coverage) always
// render; GATED SYNTHESIS (patterns/tensions/validation themes/guidance/Read) is
// admitted only when field-specific eligibility + minimum support hold (§87).
// An LLM may later normalize phrasing (§88) but can never create an unsupported
// pattern — the gates below are the authority.
import type { AccountBriefVM, DecisionState, DeliverableViewModel, Strength } from "./deliverable-view-model";

export const PORTFOLIO_INTELLIGENCE_VERSION = "portfolio-intelligence-v1";

// Descriptive evidence-observability state — NOT a quality score (§13/§45/§46).
export type CoverageState = "rich" | "usable" | "limited";

export interface Provenance { caseIds: string[]; fieldTypes: string[]; counterCaseIds?: string[] }

export interface PortfolioPattern {
  kind: "opportunity_type" | "change_theme";
  label: string;
  summary: string;
  supportingCaseIds: string[];
  opposingCaseIds?: string[];
  coverage: CoverageState;
  notable: boolean;              // true = single notable case, not a pattern (§22)
  caveat?: string;
}
export interface ValidationTheme { theme: string; summary: string; caseIds: string[]; decisionCritical: boolean }
export interface PortfolioTension { caseId: string; company: string; positive: string; counter: string; meaning: string }
export interface CoverageGap { category: string; summary: string; caseIds: string[] }
export interface Guidance { kind: "Focus" | "Validate" | "Sequence" | "Monitor" | "Defer"; statement: string; provenance: Provenance }
export interface ReadStatement { text: string; provenance: Provenance }

export interface PortfolioIntelligenceVM {
  version: string;
  generatedAt: string;
  clientSubject: string | null;
  // deterministic layer (§81) — always present
  deterministic: {
    total: number;
    decisionCounts: Record<DecisionState, number>;
    fitDistribution: Record<Strength, number>;
    timingDistribution: Record<Strength | "Unknown", number>;
    evidenceDistribution: Record<Strength | "None", number>;
    verifiedChangeCount: number;
    independentSupportCount: number;
    counterevidenceCount: number;
    validationItemCount: number;
    coverageStates: Record<CoverageState, number>;
  };
  read: ReadStatement[];                    // §16-18
  attention: { decision: DecisionState; caseIds: string[]; differentiator: string | null }[]; // §27-31
  opportunityPatterns: PortfolioPattern[];  // §21
  changePatterns: PortfolioPattern[];       // §25
  evidenceCoverage: { statements: string[]; states: Record<CoverageState, string[]> }; // §13-15
  coverageGaps: CoverageGap[];              // §43
  validationThemes: ValidationTheme[];      // §32
  tensions: PortfolioTension[];             // §35
  guidance: Guidance[];                     // §38
  limitations: string[];
}

// ── field-specific eligibility (§10-11) — never one generic isQualified ──
const isVerifiedChange = (a: AccountBriefVM): boolean =>
  a.whatChanged.some(c => (c.kind === "true_change" || c.kind === "recent_event") && !!c.date);
const eligibleOpportunityType = (a: AccountBriefVM): boolean => !!a.opportunityType;
const dim = (a: AccountBriefVM, label: string): Strength | null => a.dimensions.find(d => d.label === label)?.value ?? null;
const eligibleTiming = (a: AccountBriefVM): boolean => { const t = dim(a, "Timing"); return t === "Strong" || t === "Moderate" || t === "Limited"; };
const eligibleCorroboration = (a: AccountBriefVM): boolean => a.evidence.corroborated === true;
const eligibleValidation = (a: AccountBriefVM): boolean => a.validations.length > 0;
// A tension needs MATERIALLY contradictory evidence (§35/§37) — real negative
// operational signal, not a soft caveat or an open category-fit question. This is
// what keeps GXO's layoffs-vs-expansion prominent while a mild "markets
// stabilizing" note does not manufacture a tension (§97).
const CONTRADICTORY = /\b(layoff|lay off|job cuts?|clos(e|es|ed|ure|ing)|shut|declin|decline|contract(ion|ing)?|loss(es)?|soft|muted|downturn|lawsuit|reduc(e|tion|ing)|cut(s|ting)?)\b/i;
const isContradictoryCounter = (s: string): boolean => CONTRADICTORY.test(s);
const eligibleTension = (a: AccountBriefVM): boolean => isVerifiedChange(a) && a.counterSignals.some(isContradictoryCounter);

// evidence observability state (§46) — richness, NOT opportunity quality (§49/§50)
function coverageState(a: AccountBriefVM): CoverageState {
  if (isVerifiedChange(a) && a.evidence.corroborated === true) return "rich";
  if (isVerifiedChange(a) || a.evidence.datedCount > 0) return "usable";
  return "limited";
}

const DECISION_ORDER: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];
const cid = (a: AccountBriefVM) => a.id;

// change-theme classifier from verified What Changed text (§25) — only verified cases feed this
function changeTheme(text: string): { key: string; label: string } | null {
  const s = text.toLowerCase();
  if (/terminal/.test(s)) return { key: "terminal", label: "Terminal network expansion" };
  if (/distribution cent|warehouse|logistics hub|\bdc\b|fulfil/.test(s)) return { key: "dc", label: "Distribution / warehouse expansion" };
  if (/hospital|clinic|facility .*(health|rehab)|rehabilitation/.test(s)) return { key: "hospital", label: "Healthcare facility expansion" };
  if (/plant|factory|manufacturing|production line|capacity/.test(s)) return { key: "plant", label: "Plant / capacity expansion" };
  if (/acqui|merger|integration/.test(s)) return { key: "acquisition", label: "Acquisition / integration" };
  if (/facilit|open|expan/.test(s)) return { key: "facility", label: "Facility / operations expansion" };
  return null;
}

// validation-theme normalizer (§32-33) — cluster conceptually-equivalent questions
function validationTheme(q: string): { key: string; theme: string } | null {
  const s = q.toLowerCase();
  if (/system|vendor|platform|stack|tooling|tms|wms|erp/.test(s)) return { key: "systems", theme: "Current systems / vendor posture" };
  if (/owner|ownership|who .*(lead|owns)|decision.?maker|procurement/.test(s)) return { key: "owner", theme: "Operations / procurement ownership" };
  if (/integrat|scope|post-close|onboard/.test(s)) return { key: "integration", theme: "Integration / expansion scope" };
  if (/fit|category|relevan|applicab/.test(s)) return { key: "fit", theme: "Category / commercial fit" };
  if (/corroborat|second (source|origin)|independent|confirm/.test(s)) return { key: "corroboration", theme: "Evidence corroboration" };
  if (/window|timeline|timing|when|moved from plan|build/.test(s)) return { key: "timing", theme: "Implementation / timing window" };
  return null;
}

// ── Memory-ready snapshot diff (§73-79/§119-120) ──────────────────────────────
// PortfolioIntelligenceVM carries stable identifiers (case ids, opportunity-type
// / change-theme labels, guidance kinds). That is enough for a later Account
// Memory layer to answer "what changed since last review?" without a parallel
// memory system (§76). This pure diff is the schema-compatibility proof: it
// classifies movement as new / persisting / strengthened / weakened / resolved.
export interface PortfolioSnapshotDiff {
  decisionChanges: Array<{ caseId: string; from: DecisionState; to: DecisionState }>;
  changePatterns: { new: string[]; persisting: string[]; disappeared: string[] };
  patternSupport: Array<{ label: string; from: number; to: number; direction: "strengthened" | "weakened" }>;
  coverage: { verifiedChange: { from: number; to: number }; independentSupport: { from: number; to: number } };
  validationsResolved: Array<{ caseId: string; resolved: string[] }>;
}

export function diffPortfolioIntelligence(
  prev: { pi: PortfolioIntelligenceVM; decisions: Record<string, DecisionState>; validations: Record<string, string[]> },
  next: { pi: PortfolioIntelligenceVM; decisions: Record<string, DecisionState>; validations: Record<string, string[]> },
): PortfolioSnapshotDiff {
  const decisionChanges = Object.keys(next.decisions)
    .filter(id => prev.decisions[id] && prev.decisions[id] !== next.decisions[id])
    .map(id => ({ caseId: id, from: prev.decisions[id], to: next.decisions[id] }));

  const prevThemes = new Map(prev.pi.changePatterns.map(p => [p.label, p.supportingCaseIds.length]));
  const nextThemes = new Map(next.pi.changePatterns.map(p => [p.label, p.supportingCaseIds.length]));
  const changePatterns = {
    new: Array.from(nextThemes.keys()).filter(l => !prevThemes.has(l)),
    persisting: Array.from(nextThemes.keys()).filter(l => prevThemes.has(l)),
    disappeared: Array.from(prevThemes.keys()).filter(l => !nextThemes.has(l)),
  };
  const patternSupport = changePatterns.persisting
    .filter(l => nextThemes.get(l)! !== prevThemes.get(l)!)
    .map(l => ({ label: l, from: prevThemes.get(l)!, to: nextThemes.get(l)!, direction: (nextThemes.get(l)! > prevThemes.get(l)! ? "strengthened" : "weakened") as "strengthened" | "weakened" }));

  const validationsResolved = Object.keys(prev.validations)
    .map(id => ({ caseId: id, resolved: (prev.validations[id] ?? []).filter(q => !(next.validations[id] ?? []).includes(q)) }))
    .filter(x => x.resolved.length > 0);

  return {
    decisionChanges, changePatterns, patternSupport,
    coverage: {
      verifiedChange: { from: prev.pi.deterministic.verifiedChangeCount, to: next.pi.deterministic.verifiedChangeCount },
      independentSupport: { from: prev.pi.deterministic.independentSupportCount, to: next.pi.deterministic.independentSupportCount },
    },
    validationsResolved,
  };
}

export function buildPortfolioIntelligence(vm: DeliverableViewModel): PortfolioIntelligenceVM {
  const accounts = vm.accounts;
  const total = accounts.length;
  const es = vm.meta.language === "es";

  // ── deterministic layer ──
  const decisionCounts = { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<DecisionState, number>;
  const fitDistribution = { Strong: 0, Moderate: 0, Limited: 0 } as Record<Strength, number>;
  const timingDistribution = { Strong: 0, Moderate: 0, Limited: 0, Unknown: 0 } as Record<Strength | "Unknown", number>;
  const evidenceDistribution = { Strong: 0, Moderate: 0, Limited: 0, None: 0 } as Record<Strength | "None", number>;
  const coverageStates = { rich: 0, usable: 0, limited: 0 } as Record<CoverageState, number>;
  for (const a of accounts) {
    decisionCounts[a.decision]++;
    const f = dim(a, "Fit"); if (f) fitDistribution[f]++;
    const tv = dim(a, "Timing"); timingDistribution[(tv ?? "Unknown") as Strength | "Unknown"]++;
    const ev = dim(a, "Evidence") ?? a.evidence.strength; evidenceDistribution[(ev ?? "None") as Strength | "None"]++;
    coverageStates[coverageState(a)]++;
  }
  const verified = accounts.filter(isVerifiedChange);
  const corroborated = accounts.filter(eligibleCorroboration);
  const withCounter = accounts.filter(a => a.counterSignals.length > 0);
  const validationItemCount = accounts.reduce((n, a) => n + a.validations.length, 0);

  // ── attention allocation (§27-31) ──
  const attention = DECISION_ORDER.filter(d => decisionCounts[d] > 0).map(d => {
    const group = accounts.filter(a => a.decision === d);
    let differentiator: string | null = null;
    if (d === "prioritize") {
      const nVer = group.filter(isVerifiedChange).length, nCorr = group.filter(eligibleCorroboration).length, nStrong = group.filter(a => dim(a, "Fit") === "Strong").length;
      const parts = [nVer ? `${nVer} with a verified recent change` : "", nCorr ? `${nCorr} independently corroborated` : "", nStrong ? `${nStrong} with Strong fit` : ""].filter(Boolean);
      differentiator = parts.length ? `Set apart by ${parts.join(", ")}.` : null;
    } else if (d === "validate") {
      const dc = group.filter(a => (a.validationDetails ?? []).some(v => v.decisionCritical)).length;
      differentiator = dc ? `${dc} carry a decision-critical open question that gates action.` : "Each needs a specific fact confirmed before allocation.";
    }
    return { decision: d, caseIds: group.map(cid), differentiator };
  });

  // ── opportunity patterns (§21-24) — group by Opportunity Type ──
  const byType = new Map<string, AccountBriefVM[]>();
  for (const a of accounts.filter(eligibleOpportunityType)) { const k = a.opportunityType as string; (byType.get(k) ?? byType.set(k, []).get(k)!).push(a); }
  const opportunityPatterns: PortfolioPattern[] = Array.from(byType.entries())
    .filter(([, g]) => g.length >= 1)
    .map(([type, g]) => {
      const notable = g.length < 2; // §22: <2 is a single notable case, not a pattern
      const cov = g.some(a => coverageState(a) === "rich") ? "rich" : g.some(a => coverageState(a) === "usable") ? "usable" : "limited";
      return { kind: "opportunity_type" as const, label: type, notable,
        summary: notable ? `A single notable ${type} opportunity in the evaluated set.` : `${g.length} evaluated opportunities share the ${type} shape.`,
        supportingCaseIds: g.map(cid), coverage: cov as CoverageState };
    })
    .sort((a, b) => b.supportingCaseIds.length - a.supportingCaseIds.length);

  // ── change patterns (§25-26) — ONLY verified changes ──
  const byTheme = new Map<string, { label: string; cases: AccountBriefVM[] }>();
  for (const a of verified) { const th = changeTheme(a.whatChanged.find(c => c.kind === "true_change" || c.kind === "recent_event")?.event ?? ""); if (!th) continue; const e = byTheme.get(th.key) ?? { label: th.label, cases: [] }; e.cases.push(a); byTheme.set(th.key, e); }
  const changePatterns: PortfolioPattern[] = Array.from(byTheme.values())
    .filter(e => e.cases.length >= 1)
    .map(e => { const notable = e.cases.length < 2; const cov = e.cases.some(a => eligibleCorroboration(a)) ? "rich" : "usable";
      return { kind: "change_theme" as const, label: e.label, notable,
        summary: notable ? `${e.label} appears in a single evaluated opportunity.` : `${e.label} recurs across ${e.cases.length} evaluated opportunities.`,
        supportingCaseIds: e.cases.map(cid), coverage: cov as CoverageState,
        caveat: "Describes the evaluated opportunity set, not the wider market." }; }) // §19/§20/§26
    .sort((a, b) => b.supportingCaseIds.length - a.supportingCaseIds.length);

  // ── evidence coverage (§13-15) descriptive, no score ──
  const states: Record<CoverageState, string[]> = { rich: [], usable: [], limited: [] };
  for (const a of accounts) states[coverageState(a)].push(cid(a));
  const noChange = accounts.filter(a => !isVerifiedChange(a));
  const evidenceCoverage = { states, statements: [
    `${verified.length} of ${total} opportunities have a verified recent material development.`,
    `${corroborated.length} of ${total} have independent support.`,
    `${noChange.length} of ${total} have no verified recent change in the reviewed public evidence.`,
  ] };

  // ── coverage gaps (§43-44) — what is not established (never negative evidence, §50) ──
  const singleSource = accounts.filter(a => isVerifiedChange(a) && a.evidence.corroborated !== true && a.evidence.sourceCount <= 1);
  const missingDC = accounts.filter(a => (a.validationDetails ?? []).some(v => v.decisionCritical));
  const limitedFootprint = accounts.filter(a => coverageState(a) === "limited");
  const coverageGaps: CoverageGap[] = [
    noChange.length ? { category: "No verified recent change", summary: `${noChange.length} opportunities show no verified recent material development in the reviewed public evidence — not evidence of inactivity, only of what is not yet established.`, caseIds: noChange.map(cid) } : null,
    singleSource.length ? { category: "Single-source only", summary: `${singleSource.length} verified change(s) rest on a single origin and need independent corroboration.`, caseIds: singleSource.map(cid) } : null,
    missingDC.length ? { category: "Missing decision-critical fact", summary: `${missingDC.length} opportunities have a decision-critical question still open.`, caseIds: missingDC.map(cid) } : null,
    limitedFootprint.length ? { category: "Limited public footprint", summary: `${limitedFootprint.length} opportunities have limited observable public evidence — evaluation leans on structural fit and direct validation.`, caseIds: limitedFootprint.map(cid) } : null,
  ].filter(Boolean) as CoverageGap[];

  // ── validation themes (§32-33) — ≥2 conceptually-equivalent ──
  const themeMap = new Map<string, { theme: string; caseIds: Set<string>; decisionCritical: boolean }>();
  for (const a of accounts.filter(eligibleValidation)) {
    const seenKeys = new Set<string>();
    const details = a.validationDetails ?? a.validations.map(q => ({ question: q, decisionCritical: false, howToValidate: null, changesDecisionBecause: null }));
    for (const v of details) { const th = validationTheme(v.question); if (!th || seenKeys.has(th.key)) continue; seenKeys.add(th.key);
      const e = themeMap.get(th.key) ?? { theme: th.theme, caseIds: new Set<string>(), decisionCritical: false }; e.caseIds.add(cid(a)); if (v.decisionCritical) e.decisionCritical = true; themeMap.set(th.key, e); }
  }
  const validationThemes: ValidationTheme[] = Array.from(themeMap.values())
    .filter(e => e.caseIds.size >= 2)   // §33 genuine recurrence
    .map(e => ({ theme: e.theme, summary: `Recurs across ${e.caseIds.size} opportunities${e.decisionCritical ? " (decision-critical)" : ""}.`, caseIds: Array.from(e.caseIds), decisionCritical: e.decisionCritical }))
    .sort((a, b) => Number(b.decisionCritical) - Number(a.decisionCritical) || b.caseIds.length - a.caseIds.length);

  // ── portfolio tensions (§35-37) — real positive AND real counter ──
  const tensions: PortfolioTension[] = accounts.filter(eligibleTension).map(a => ({
    caseId: cid(a), company: a.company,
    positive: a.whatChanged.find(c => c.kind === "true_change" || c.kind === "recent_event")?.event ?? "verified expansion",
    counter: a.counterSignals[0],
    meaning: `Positive expansion and material contradictory evidence coexist — the Case must be reconciled before ${a.decision === "prioritize" ? "sustaining priority" : "raising attention"}.`,
  }));

  // ── strategic guidance (§38-42) — provenance-backed, no revenue/conversion ──
  const prioritized = accounts.filter(a => a.decision === "prioritize");
  const toValidate = accounts.filter(a => a.decision === "validate");
  const monitored = accounts.filter(a => a.decision === "monitor");
  const guidance: Guidance[] = [];
  if (prioritized.length) guidance.push({ kind: "Focus", statement: `Work the ${prioritized.length} corroborated, recent expansions first — ${prioritized.slice(0, 4).map(a => a.company).join(", ")}.`, provenance: { caseIds: prioritized.map(cid), fieldTypes: ["decision", "whatChanged", "evidence.corroborated"] } });
  if (validationThemes.length) { const top = validationThemes[0]; guidance.push({ kind: "Validate", statement: `Resolve "${top.theme}" — it recurs across ${top.caseIds.length} opportunities and would unlock several at once.`, provenance: { caseIds: top.caseIds, fieldTypes: ["validations"] } }); }
  if (prioritized.length >= 2) { const seq = [...prioritized].sort((a, b) => (dim(b, "Timing") === "Strong" ? 1 : 0) - (dim(a, "Timing") === "Strong" ? 1 : 0)); guidance.push({ kind: "Sequence", statement: `Lead with ${seq[0].company} (strongest timing + corroboration), then the remaining priority accounts.`, provenance: { caseIds: seq.map(cid), fieldTypes: ["decision", "dimensions.Timing", "evidence.corroborated"] } }); }
  if (tensions.length) guidance.push({ kind: "Validate", statement: `Reconcile ${tensions.map(t => t.company).join(", ")} before elevating — expansion and contraction signals conflict.`, provenance: { caseIds: tensions.map(t => t.caseId), fieldTypes: ["whatChanged", "counterSignals"], counterCaseIds: tensions.map(t => t.caseId) } });
  if (monitored.length) guidance.push({ kind: "Monitor", statement: `Hold ${monitored.length} opportunities for a dated trigger — structural fit is present but no verified recent change is established.`, provenance: { caseIds: monitored.map(cid), fieldTypes: ["decision", "whatChanged"] } });

  // ── LeadLens Read (§16-19) — 2-4 traceable statements ──
  const read: ReadStatement[] = [];
  if (prioritized.length) read.push({ text: `${prioritized.length} of ${total} opportunities merit priority now; the strongest combine a recent verified change with independent corroboration.`, provenance: { caseIds: prioritized.map(cid), fieldTypes: ["decision", "whatChanged", "evidence.corroborated"] } });
  if (changePatterns.some(p => !p.notable)) { const p = changePatterns.find(x => !x.notable)!; read.push({ text: `The recurring commercial condition among stronger opportunities is ${p.label.toLowerCase()} (${p.supportingCaseIds.length} evaluated accounts).`, provenance: { caseIds: p.supportingCaseIds, fieldTypes: ["whatChanged"] } }); }
  if (noChange.length) read.push({ text: `${noChange.length} of ${total} have no verified recent change in the reviewed public evidence — a coverage limit, not a quality judgment; these need direct validation.`, provenance: { caseIds: noChange.map(cid), fieldTypes: ["whatChanged", "evidence"] } });
  if (tensions.length) read.push({ text: `${tensions.map(t => t.company).join(", ")} show genuine tension — real expansion alongside material contradictory evidence.`, provenance: { caseIds: tensions.map(t => t.caseId), fieldTypes: ["whatChanged", "counterSignals"] } });

  const limitations = [
    ...(vm.limitations ?? []),
    "Portfolio Intelligence describes the evaluated opportunity set — not the wider market.",
    coverageStates.limited > 0 ? "Some opportunities have limited public evidence; their intelligence is validation-first rather than change-driven." : "",
  ].filter(Boolean) as string[];

  return {
    version: PORTFOLIO_INTELLIGENCE_VERSION, generatedAt: new Date().toISOString(), clientSubject: vm.meta.client,
    deterministic: { total, decisionCounts, fitDistribution, timingDistribution, evidenceDistribution,
      verifiedChangeCount: verified.length, independentSupportCount: corroborated.length, counterevidenceCount: withCounter.length,
      validationItemCount, coverageStates },
    read, attention, opportunityPatterns, changePatterns, evidenceCoverage, coverageGaps, validationThemes, tensions, guidance, limitations,
  };
}
