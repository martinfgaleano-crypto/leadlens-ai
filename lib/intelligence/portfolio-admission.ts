// Portfolio admission — the single policy for which evaluated accounts enter the
// customer portfolio + Account Memory, and how many are STRONG opportunities.
//
// Decision-first product truth (this sprint): the customer result is a portfolio of
// evaluated accounts. Prioritize/Validate (attention now) AND Monitor + eligible Hold
// (relevant, worth remembering and reevaluating) are retained so account continuity,
// What-Changed, and Portfolio Intelligence see the full evaluated set. Only NON-account
// noise is excluded: structural rejects (qc FAILED — wrong entity / invalid identity)
// and DISCARD-tier candidates. Failure honesty is preserved by reporting the STRONG
// count separately — commercial outcome is never inferred from portfolio size.

export type PortfolioDecision = "prioritize" | "validate" | "monitor" | "hold";
const PORTFOLIO_DECISIONS = new Set<string>(["prioritize", "validate", "monitor", "hold"]);
const STRONG_DECISIONS = new Set<string>(["prioritize", "validate"]);

export interface AdmissionCase { lead_id: string; decision: string }
export interface AdmissionLead { id: string; qc_status?: string | null; category?: string | null }

/** True for an account that is discovery/pipeline NOISE, not a real evaluated account:
 *  a structural reject (qc FAILED — §4-§6) or a DISCARD-tier candidate. */
export function isPortfolioNoise(lead: AdmissionLead | undefined): boolean {
  if (!lead) return false; // no lead row → cannot prove noise; admit and let memory's structural-reject net apply
  return lead.qc_status === "FAILED" || lead.category === "DISCARD";
}

export interface AdmissionResult { portfolioIds: Set<string>; strongCount: number }

/** Select the lead ids that belong in the customer portfolio + memory, and count the
 *  STRONG (Prioritize/Validate) opportunities. Pure. */
export function selectPortfolioAdmission(cases: AdmissionCase[], leads: AdmissionLead[]): AdmissionResult {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const portfolioIds = new Set<string>();
  let strongCount = 0;
  for (const c of cases) {
    if (!PORTFOLIO_DECISIONS.has(c.decision)) continue;
    if (isPortfolioNoise(leadById.get(c.lead_id))) continue;
    portfolioIds.add(c.lead_id);
    if (STRONG_DECISIONS.has(c.decision)) strongCount += 1;
  }
  return { portfolioIds, strongCount };
}
