// Server-side only. Computes aggregate stats from company_profiles rows.
// Kept as a library function so both the API route and tests can use it.

export interface CompanyStats {
  total:         number;
  industries:    number;
  avg_score:     number;
  top_score:     number;
  repeat_count:  number;
  repeat_rate:   number;
}

export function computeCompanyStats(
  rows: { industry: string | null; average_score: number | null; top_score: number | null; times_seen: number }[],
  total: number,
): CompanyStats {
  const industries  = new Set(rows.map(r => r.industry).filter(Boolean)).size;
  const scored      = rows.filter(r => r.average_score != null);
  const avgScore    = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.average_score ?? 0), 0) / scored.length)
    : 0;
  const topScores   = rows.map(r => r.top_score ?? 0);
  const topScore    = topScores.length > 0 ? Math.max(...topScores) : 0;
  const repeatCount = rows.filter(r => r.times_seen > 1).length;
  const repeatRate  = total > 0 ? Math.round((repeatCount / total) * 100) : 0;

  return { total, industries, avg_score: avgScore, top_score: topScore, repeat_count: repeatCount, repeat_rate: repeatRate };
}
