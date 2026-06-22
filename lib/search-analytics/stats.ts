// Pure analytics functions for lead search statistics.
// No DB access — all inputs are plain data arrays.

export interface SearchStatsRow {
  status:                  string;
  process_duration_ms:     number | null;
  process_generated_count: number | null;
  credits_consumed:        number | null;
}

/**
 * Average processing duration (ms) across completed searches.
 * Returns null if no completed searches with duration data.
 */
export function computeAverageCompletionTime(rows: SearchStatsRow[]): number | null {
  const durations = rows
    .filter(r => r.status === "completed" && r.process_duration_ms != null)
    .map(r => r.process_duration_ms as number);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

/**
 * Percentage of searches that ended in "failed" status (0–100).
 */
export function computeFailureRate(rows: SearchStatsRow[]): number {
  if (rows.length === 0) return 0;
  const failed = rows.filter(r => r.status === "failed").length;
  return Math.round((failed / rows.length) * 100);
}

/**
 * Total credits consumed across all searches.
 */
export function computeCreditUsage(rows: SearchStatsRow[]): number {
  return rows.reduce((sum, r) => sum + (r.credits_consumed ?? 0), 0);
}

/**
 * Average leads delivered per completed search.
 * Returns null if no completed searches with count data.
 */
export function computeAverageLeadsDelivered(rows: SearchStatsRow[]): number | null {
  const completed = rows.filter(
    r => r.status === "completed" && r.process_generated_count != null
  );
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, r) => sum + (r.process_generated_count ?? 0), 0);
  return Math.round((total / completed.length) * 10) / 10;
}
