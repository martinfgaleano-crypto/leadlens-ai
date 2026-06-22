import type { Seniority } from "@/lib/quality/title-normalizer";

interface OpportunityInput {
  lead_score: number;
  confidence_score: number;
  seniority: Seniority;
}

const SENIORITY_BONUS: Record<Seniority, number> = {
  "C-Level":              6,
  "VP":                   4,
  "Director":             2,
  "Manager":              1,
  "Individual Contributor": 0,
  "Unknown":              0,
};

export function computeOpportunityScore(input: OpportunityInput): number {
  const base  = Math.round(input.lead_score * 0.6 + input.confidence_score * 0.4);
  const bonus = SENIORITY_BONUS[input.seniority] ?? 0;
  return Math.max(0, Math.min(100, base + bonus));
}
