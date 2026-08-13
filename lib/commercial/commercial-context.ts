export interface CommercialContextInput {
  company_description?: string | null;
  offer?: string | null;
  buyer?: string | null;
  problem_solved?: string | null;
  target_countries?: string[] | null;
  commercial_goal?: string | null;
  target_market_region?: string | null;
}

export interface CommercialContext {
  company_description: string;
  offer: string;
  buyer: string;
  problem_solved: string;
  target_countries: string[];
  commercial_goal: string;
  derived_region: string | null;
}

const COUNTRY_ALIASES: Record<string, string> = {
  colombia: "Colombia", "united states": "United States", usa: "United States", us: "United States",
  mexico: "Mexico", méxico: "Mexico", brazil: "Brazil", brasil: "Brazil", japan: "Japan", japón: "Japan",
};

function clean(value: string | null | undefined): string { return value?.trim().replace(/\s+/g, " ") ?? ""; }

export function normalizeTargetCountries(values: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return (values ?? []).map(clean).filter(Boolean).map(value => COUNTRY_ALIASES[value.toLowerCase()] ?? value)
    .filter(value => { const key = value.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}

export function deriveRegion(countries: string[]): string | null {
  if (!countries.length) return null;
  const regions = new Set(countries.map(country => {
    if (["Colombia", "Mexico", "Brazil"].includes(country)) return "latin_america";
    if (country === "United States") return "north_america";
    if (country === "Japan") return "asia_pacific";
    return "other";
  }));
  return regions.size === 1 ? Array.from(regions)[0] : "multi_region";
}

export function normalizeCommercialContext(input: CommercialContextInput): CommercialContext {
  const target_countries = normalizeTargetCountries(input.target_countries);
  return {
    company_description: clean(input.company_description), offer: clean(input.offer), buyer: clean(input.buyer),
    problem_solved: clean(input.problem_solved), target_countries, commercial_goal: clean(input.commercial_goal),
    derived_region: deriveRegion(target_countries),
  };
}
