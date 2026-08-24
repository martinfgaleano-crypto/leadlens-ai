// ─── Landing comparison fixture (illustrative) ────────────────────────────────
// The SAME three illustrative accounts used across the landing (Northstar /
// FreshRoute / Atlas), consolidated once as a typed, canonical-compatible
// projection (§26). Compare PROJECTS canonical Fit/Timing/Evidence + decision
// state — it never recomputes ranking or invents a score (§7/§10). "Who leads on
// a dimension" is read from the canonical ordinal strength, not a blended number.
import type { DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";

export type CompareDimension = "Fit" | "Timing" | "Evidence";

export interface LandingCompareAccount {
  name: string;
  short: string;
  segment: string;
  decision: DecisionState;
  fit: Strength;
  timing: Strength;
  evidence: Strength;
  changed: string;   // the material change (ties to What Changed)
  fresh: string;     // freshness of that change
  unknown: string;   // what remains unresolved
}

export interface LandingComparison {
  accounts: LandingCompareAccount[];
  // Per-dimension relative reasoning — why the dimension does (or does not)
  // separate the accounts. Content is illustrative, consistent with the sample.
  why: Record<CompareDimension, string>;
  provenance: "illustrative_fixture";
  illustrative: true;
}

const RANK: Record<Strength, number> = { Limited: 1, Moderate: 2, Strong: 3 };
export const dimValue = (a: LandingCompareAccount, d: CompareDimension): Strength => d === "Fit" ? a.fit : d === "Timing" ? a.timing : a.evidence;

/** Accounts that share the highest canonical strength on a dimension (ordinal
 *  read of Strength — NOT a computed score). Ties are preserved, because a
 *  dimension that does not separate the accounts is itself the insight. */
export function leadersOn(c: LandingComparison, d: CompareDimension): string[] {
  const top = Math.max(...c.accounts.map((a) => RANK[dimValue(a, d)]));
  return c.accounts.filter((a) => RANK[dimValue(a, d)] === top).map((a) => a.name);
}

export const LANDING_COMPARISON: LandingComparison = {
  accounts: [
    { name: "Northstar Logistics", short: "Northstar", segment: "Mid-market logistics", decision: "prioritize", fit: "Strong", timing: "Strong", evidence: "Strong", changed: "Signed a regional distribution agreement", fresh: "9d", unknown: "Procurement ownership not confirmed" },
    { name: "FreshRoute Foods", short: "FreshRoute", segment: "Regional food distribution", decision: "validate", fit: "Strong", timing: "Moderate", evidence: "Moderate", changed: "Opened two new distribution sites", fresh: "14d", unknown: "Decision scope may be regional" },
    { name: "Atlas Clinics Group", short: "Atlas", segment: "Multi-location healthcare", decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Moderate", changed: "Announced two new clinic locations", fresh: "21d", unknown: "Only one source on the expansion" },
  ],
  why: {
    Fit: "Fit is Strong for both Northstar and FreshRoute — so Fit alone does not decide this. Timing does.",
    Timing: "Northstar leads on Timing: a recent, dated distribution change. FreshRoute's is softer; Atlas's is older and single-sourced.",
    Evidence: "Northstar's case is corroborated across independent sources; the others rest on fewer or a single source.",
  },
  provenance: "illustrative_fixture",
  illustrative: true,
};
