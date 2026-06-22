// Pure lead-count allocation engine.
// Distributes a total requested count across active sources proportionally by weight.
// Server-side only — no DB access.

/** Registered weights per source. Used when DB weights are unavailable. */
const DEFAULT_WEIGHTS: Record<string, number> = {
  apollo:      1.0,
  google_maps: 0.5,
  linkedin:    0.7,
  directories: 0.4,
  crunchbase:  0.5,
  manual:      1.0,
};

/**
 * Allocates `totalCount` leads across `activeSources` proportionally by weight.
 *
 * Returns a map of { sourceName → leadsToRequest }.
 * Unregistered sources fall back to weight 0.5.
 * If no active sources, returns an empty object.
 *
 * Example — 25 leads, only Apollo active:
 *   { apollo: 25 }
 *
 * Example — 25 leads, Apollo + Google Maps active:
 *   Apollo weight 1.0, Google Maps weight 0.5, total weight 1.5
 *   { apollo: 17, google_maps: 8 }  (rounded, sum ≤ totalCount)
 */
export function allocateTargets(
  totalCount:    number,
  activeSources: string[],
  weights?:      Record<string, number>,
): Record<string, number> {
  if (activeSources.length === 0 || totalCount <= 0) return {};

  const W = weights ?? DEFAULT_WEIGHTS;

  const sourceWeights = activeSources.map(name => ({
    name,
    weight: W[name] ?? 0.5,
  }));

  const totalWeight = sourceWeights.reduce((s, sw) => s + sw.weight, 0);
  if (totalWeight === 0) return {};

  const allocation: Record<string, number> = {};
  let allocated = 0;

  // Proportional allocation with floor rounding
  for (const sw of sourceWeights) {
    const share = Math.floor((sw.weight / totalWeight) * totalCount);
    allocation[sw.name] = share;
    allocated += share;
  }

  // Give remainder to highest-weight source
  const remainder = totalCount - allocated;
  if (remainder > 0) {
    const top = sourceWeights.reduce((a, b) => a.weight >= b.weight ? a : b);
    allocation[top.name] = (allocation[top.name] ?? 0) + remainder;
  }

  return allocation;
}

/** Returns the default weight for a source name. */
export function getDefaultWeight(sourceName: string): number {
  return DEFAULT_WEIGHTS[sourceName] ?? 0.5;
}
