/** Validated live default: bounded two-account research. An explicit `1` is the
 * immediate serial rollback; values above 2 are deliberately unsupported. */
export function resolveResearchConcurrency(raw = process.env.INTELLIGENCE_RESEARCH_CONCURRENCY): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(2, Math.floor(parsed))) : 2;
}
