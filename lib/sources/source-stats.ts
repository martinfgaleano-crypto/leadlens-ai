// Pure statistical functions over source_run data.
// No DB access — pass pre-fetched run arrays.
// Server-side only.

export interface RunData {
  status:        string;
  duration_ms:   number | null;
  results_found: number;
}

/** Percentage of runs that completed successfully (0–100). */
export function computeSuccessRate(runs: RunData[]): number {
  if (runs.length === 0) return 0;
  const completed = runs.filter(r => r.status === "completed").length;
  return Math.round((completed / runs.length) * 100);
}

/** Percentage of runs that failed (0–100). */
export function computeFailureRate(runs: RunData[]): number {
  if (runs.length === 0) return 0;
  const failed = runs.filter(r => r.status === "failed").length;
  return Math.round((failed / runs.length) * 100);
}

/** Average duration in ms across completed runs only. Returns null if no data. */
export function computeAverageDuration(runs: RunData[]): number | null {
  const completed = runs.filter(r => r.status === "completed" && r.duration_ms != null);
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, r) => sum + (r.duration_ms as number), 0);
  return Math.round(total / completed.length);
}

/** Average results_found per completed run. Returns null if no data. */
export function computeAverageResults(runs: RunData[]): number | null {
  const completed = runs.filter(r => r.status === "completed");
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, r) => sum + r.results_found, 0);
  return Math.round((total / completed.length) * 10) / 10; // 1 decimal place
}
