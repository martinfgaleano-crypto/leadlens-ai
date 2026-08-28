// Denominator integrity (INTELLIGENCE ACCELERATION V2 §4).
//
// Four measurement populations must NEVER be merged into one rate. Each answers a
// different question with a different denominator. Conflating them (e.g. treating
// the 6/8 diagnostic event sample as if it were the 3 human-reviewed Cases, or the
// 11 Evidence relationships) produces a false claim about the system.
//
//   A. Diagnostic event sample      — measures event RETRIEVAL          (e.g. 6/8)
//   B. Human-reviewed Cases         — measures COMMERCIAL USEFULNESS / safety (e.g. 3)
//   C. Evidence/source relationships— measures EVIDENCE QUALITY         (e.g. 11)
//   D. Expanded run sample          — measures REPEATABILITY            (new)
//
// This module is the single place that names the populations and the guard that
// refuses to combine them. It holds no score and drives no capability dimension.

export type DenominatorPopulation =
  | "diagnostic_event_sample"
  | "human_reviewed_cases"
  | "evidence_relationships"
  | "expanded_run_sample"
  // Runtime + live validation instrumentation V1 populations (§14):
  | "live_researched_accounts"
  | "provider_operations"
  | "commercial_usefulness_reviews";

export const DENOMINATOR_POPULATIONS: Record<DenominatorPopulation, { measures: string }> = {
  diagnostic_event_sample: { measures: "event retrieval (material-event capture)" },
  human_reviewed_cases: { measures: "commercial usefulness / customer safety (human-confirmed)" },
  evidence_relationships: { measures: "evidence quality (source→claim relationships)" },
  expanded_run_sample: { measures: "repeatability across a broader bounded sample" },
  live_researched_accounts: { measures: "runtime / autonomy / research-depth per researched account" },
  provider_operations: { measures: "provider call reliability / cost per external operation" },
  commercial_usefulness_reviews: { measures: "QA usefulness over completed Cases (never a runtime score)" },
};

export interface PopulationCount {
  population: DenominatorPopulation;
  /** Distinct sample identity — two counts with the same id are the same sample. */
  sample_id: string;
  numerator: number;
  denominator: number;
}

/** A rate is only well-formed within ONE population. 0/0 is NOT_MEASURED, never 0%. */
export function populationRate(count: PopulationCount): number | null {
  return count.denominator > 0 ? count.numerator / count.denominator : null;
}

export class DenominatorIntegrityError extends Error {}

/**
 * Refuse to merge denominators across populations. Returns the per-population
 * totals (summing only same-population, same-sample-or-distinct-sample counts),
 * and throws if a caller tries to reduce mixed populations into one rate.
 */
export function assertDistinctDenominators(counts: PopulationCount[]): Record<DenominatorPopulation, { numerator: number; denominator: number; samples: string[] }> {
  const totals = {} as Record<DenominatorPopulation, { numerator: number; denominator: number; samples: string[] }>;
  for (const c of counts) {
    if (!(c.population in DENOMINATOR_POPULATIONS)) throw new DenominatorIntegrityError(`unknown population: ${c.population}`);
    if (c.numerator > c.denominator) throw new DenominatorIntegrityError(`numerator exceeds denominator for ${c.population}/${c.sample_id}`);
    const bucket = totals[c.population] ?? { numerator: 0, denominator: 0, samples: [] };
    bucket.numerator += c.numerator;
    bucket.denominator += c.denominator;
    if (!bucket.samples.includes(c.sample_id)) bucket.samples.push(c.sample_id);
    totals[c.population] = bucket;
  }
  return totals;
}

/**
 * The guard the regression tests assert: a single blended rate over more than one
 * population is a truth violation. Callers that need a rate must pick ONE population.
 */
export function blendedRateIsForbidden(counts: PopulationCount[]): boolean {
  return new Set(counts.map((c) => c.population)).size > 1;
}
