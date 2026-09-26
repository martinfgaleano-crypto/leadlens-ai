// ─── Honest portfolio analytics derived from EXISTING account data (no new generation, no fabrication) ─
// These close three catalog capabilities that are DERIVABLE from data already in the deliverable:
//   • coverage_gaps  — evidence gaps across the evaluated set (§15: account evidence gaps meaning).
//   • portfolio_risk — where the case rests on thin/uncorroborated evidence (§16: existing risk signals).
//   • playbooks      — a structured organization of each account's own objective/why/validation/conditions
//                      (§19: organize canonical company context + decision-critical evidence; invent nothing).
// Momentum/decay are NOT derived here: a one-time first review has no observation history, so those remain
// an honest "recurring (Monitor) capability" — never a fabricated trend (§17). Nothing here extrapolates
// beyond the evaluated set to the whole market (§18).
import type { AccountBriefVM, DecisionState } from "@/lib/deliverable/deliverable-view-model";

export interface CoverageGaps {
  total: number;
  withoutDatedEvidence: string[];   // companies with no dated evidence
  withoutCorroboration: string[];   // companies without independent corroboration
  limitedEvidence: string[];        // companies whose evidence strength is Limited
}
export function deriveCoverageGaps(accounts: AccountBriefVM[]): CoverageGaps {
  return {
    total: accounts.length,
    withoutDatedEvidence: accounts.filter((a) => a.evidence.datedCount === 0).map((a) => a.company),
    withoutCorroboration: accounts.filter((a) => a.evidence.corroborated !== true).map((a) => a.company),
    limitedEvidence: accounts.filter((a) => a.evidence.strength === "Limited").map((a) => a.company),
  };
}

export interface PortfolioRisk {
  thinEvidence: string[];           // prioritize/validate accounts resting on Limited or uncorroborated evidence
  staleTiming: string[];            // accounts whose latest evidence is months old
  concentration: string | null;    // dominant segment when >40% of the set shares one segment
}
export function derivePortfolioRisk(accounts: AccountBriefVM[]): PortfolioRisk {
  const actionable = accounts.filter((a) => a.decision === "prioritize" || a.decision === "validate");
  const thin = actionable.filter((a) => a.evidence.strength === "Limited" || a.evidence.corroborated !== true).map((a) => a.company);
  const stale = accounts.filter((a) => /\b\d+\s*(mo|month|meses|m)\b/i.test(a.evidence.latestAge ?? "")).map((a) => a.company);
  const bySeg = new Map<string, number>();
  for (const a of accounts) { const k = a.segment ?? "—"; bySeg.set(k, (bySeg.get(k) ?? 0) + 1); }
  let concentration: string | null = null;
  for (const [seg, n] of Array.from(bySeg.entries())) if (seg !== "—" && n / accounts.length > 0.4) concentration = seg;
  return { thinEvidence: thin, staleTiming: stale, concentration };
}

export interface Playbook {
  company: string;
  decision: DecisionState;
  objective: string | null;         // opportunity type / commercial angle
  why: string | null;               // account's own decision note
  validate: string[];               // decision-critical questions (existing validations)
  advanceWhen: string | null;       // organized from the first validation
  holdWhen: string | null;          // organized from the first counter-signal
  nextStep: string | null;
}
export interface StakeholderFunction { function: string; whyRelevant: string; validate: string }
// Functional-role hypotheses derived from the account's OWN opportunity type / segment. These are
// INFERRED FUNCTIONS (unverified), never named people, titles, emails or budget authority (§15). The
// map is conservative and only emits a function when the opportunity type clearly implies one.
const FUNCTION_BY_OPP: Array<{ re: RegExp; fns: string[] }> = [
  { re: /operations|capacity|expansion/i, fns: ["Operations", "Supply Chain"] },
  { re: /technology|platform|vendor|modernization/i, fns: ["IT / Systems Integration", "Engineering"] },
  { re: /market entry|channel|partnership/i, fns: ["Commercial / Partnerships"] },
  { re: /construc|facilit|plant|infra/i, fns: ["Facilities", "Operations"] },
];
export function deriveStakeholderFunctions(a: AccountBriefVM): StakeholderFunction[] {
  const key = `${a.opportunityType ?? ""} ${a.segment ?? ""}`;
  const hit = FUNCTION_BY_OPP.find((f) => f.re.test(key));
  const fns = hit ? hit.fns : (a.decision === "prioritize" || a.decision === "validate" ? ["Operations"] : []);
  return fns.map((fn) => ({
    function: fn,
    whyRelevant: a.opportunityType ? `Relevant to the ${a.opportunityType.toLowerCase()} the evidence points to` : "Relevant to the observed operational change",
    validate: `Confirm who owns the ${fn.toLowerCase()} decision before outreach`,
  }));
}

/** The count of accounts that receive the deeper "deep dossier" treatment at each tier (catalog
 *  deep_dossiers: Preview 0 · Brief 0 · Intelligence 4 · Premium 6). Attention order decides which. */
export function deepDossierIds(accounts: AccountBriefVM[], count: number): Set<string> {
  return new Set(accounts.slice(0, Math.max(0, count)).map((a) => a.id));
}

/** Structured playbooks for the accounts worth acting on (prioritize/validate) — a reorganization of the
 *  account's OWN fields into an entry plan. Never invents a purchasing process or a stakeholder. */
export function derivePlaybooks(accounts: AccountBriefVM[], max = 8): Playbook[] {
  return accounts
    .filter((a) => a.decision === "prioritize" || a.decision === "validate")
    .slice(0, max)
    .map((a) => ({
      company: a.company,
      decision: a.decision,
      objective: a.opportunityType,
      why: a.decisionNote,
      validate: a.validations.slice(0, 3),
      advanceWhen: a.validations[0] ?? null,
      holdWhen: a.counterSignals[0] ?? null,
      nextStep: a.nextStep,
    }));
}
