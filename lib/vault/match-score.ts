import type { SourceSearchParams } from "@/lib/sources/source-provider";

export interface VaultLeadForScoring {
  country:           string | null;
  industry:          string | null;
  seniority:         string | null;
  opportunity_score: number | null;
  lead_score:        number | null;
  email:             string | null;
  email_quality:     string | null;
}

export function normalizeIndustry(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

export function normalizeCountry(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

export function normalizeCompanySize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

/**
 * Scores a vault lead against the given search params (0–100).
 *
 * Breakdown:
 *   35 — country match (or no country filter)
 *   30 — industry match (or no industry filter)
 *   20 — email quality (corporate = 20, other non-missing = 12)
 *   15 — opportunity / lead quality (proportional)
 */
export function computeVaultMatchScore(
  lead:   VaultLeadForScoring,
  params: SourceSearchParams,
): number {
  let score = 0;

  // Country
  const leadCountry = normalizeCountry(lead.country);
  if (params.countries.length === 0) {
    score += 35;
  } else if (leadCountry && params.countries.some(c => normalizeCountry(c) === leadCountry)) {
    score += 35;
  }

  // Industry
  const leadIndustry = normalizeIndustry(lead.industry);
  if (params.industries.length === 0) {
    score += 30;
  } else if (leadIndustry && params.industries.some(i => normalizeIndustry(i) === leadIndustry)) {
    score += 30;
  }

  // Email quality
  if (lead.email && lead.email_quality && lead.email_quality !== "missing") {
    score += lead.email_quality === "corporate" ? 20 : 12;
  }

  // Opportunity / lead quality
  const q = lead.opportunity_score ?? lead.lead_score ?? 0;
  score += Math.round((q / 100) * 15);

  return Math.min(100, score);
}
