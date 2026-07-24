import type { LeadCandidate, LeadSearchCriteria, OnboardingData } from "@/types";

const COUNTRY_ALIASES: Record<string, string> = {
  colombia: "colombia", co: "colombia",
  "united states": "united states", usa: "united states", us: "united states",
  mexico: "mexico", méxico: "mexico",
  canada: "canada", canadá: "canada",
};

function norm(value: string): string {
  const clean = value.trim().toLowerCase();
  return COUNTRY_ALIASES[clean] ?? clean;
}

export function assertGeographyContract(onboarding: OnboardingData, criteria: LeadSearchCriteria): void {
  const requested = (onboarding.target_countries ?? []).map(norm).filter(Boolean);
  if (requested.length === 0) return; // legacy jobs retain regional behavior
  const generated = (criteria.target_geography ?? []).map(norm).filter(Boolean);
  const allowedByRegion: Record<string, string[]> = {
    latin_america: ["colombia", "mexico", "brazil", "argentina", "chile"],
    north_america: ["united states", "canada"],
    europe: ["united kingdom", "germany", "france", "spain", "netherlands", "sweden"],
    asia: ["japan", "singapore", "australia", "india", "south korea"],
  };
  const region = onboarding.target_market_region;
  if (region && region !== "global") {
    const invalid = requested.filter(country => !(allowedByRegion[region] ?? []).includes(country));
    if (invalid.length) throw new Error(`GEOGRAPHY_REGION_MISMATCH: region=${region} countries=${invalid.join(",")}`);
  }
  const extra = generated.filter(country => !requested.includes(country));
  const missing = requested.filter(country => !generated.includes(country));
  if (extra.length || missing.length) {
    throw new Error(`GEOGRAPHY_CONTRACT_MISMATCH: requested=${requested.join(",")} generated=${generated.join(",")}`);
  }
}

export function candidateMatchesTargetGeography(candidate: LeadCandidate, targetCountries: string[]): boolean {
  if (targetCountries.length === 0) return true;
  const location = norm([candidate.country, candidate.location].filter(Boolean).join(" "));
  return targetCountries.map(norm).some(country => location.includes(country));
}

export function enforceCandidateGeography(candidates: LeadCandidate[], targetCountries: string[]): LeadCandidate[] {
  if (targetCountries.length === 0) return candidates;
  return candidates.filter(candidate => candidateMatchesTargetGeography(candidate, targetCountries));
}
