import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/sources
// Returns all lead sources enriched with per-source run statistics.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const [sourcesRes, runsRes] = await Promise.all([
    client.from("lead_sources").select("*").order("name"),
    client.from("source_runs").select("source_name, status, duration_ms, results_found, completed_at").order("started_at", { ascending: false }).limit(5000),
  ]);

  const sources = sourcesRes.data ?? [];
  const runs    = (runsRes.data ?? []) as {
    source_name:  string;
    status:       string;
    duration_ms:  number | null;
    results_found: number;
    completed_at: string | null;
  }[];

  // Compute per-source stats in memory
  const statsMap = new Map<string, {
    total_runs:    number;
    completed:     number;
    failed:        number;
    total_results: number;
    total_duration: number;
    last_run:      string | null;
  }>();

  for (const r of runs) {
    const s = statsMap.get(r.source_name) ?? { total_runs: 0, completed: 0, failed: 0, total_results: 0, total_duration: 0, last_run: null };
    s.total_runs++;
    if (r.status === "completed") { s.completed++; s.total_results += r.results_found; }
    if (r.status === "failed")    s.failed++;
    if (r.duration_ms != null)    s.total_duration += r.duration_ms;
    if (r.completed_at && (!s.last_run || r.completed_at > s.last_run)) s.last_run = r.completed_at;
    statsMap.set(r.source_name, s);
  }

  const enriched = sources.map(src => {
    const st = statsMap.get(src.name as string);
    const success_rate = st && st.total_runs > 0
      ? Math.round((st.completed / st.total_runs) * 100)
      : null;
    const avg_duration = st && st.completed > 0
      ? Math.round(st.total_duration / st.completed)
      : null;
    return {
      ...src,
      total_runs:    st?.total_runs    ?? 0,
      total_results: st?.total_results ?? 0,
      success_rate,
      avg_duration_ms: avg_duration,
      last_run:      st?.last_run      ?? null,
    };
  });

  // Global stats
  const allRuns = runs;
  const totalRuns = allRuns.length;
  const totalCompleted = allRuns.filter(r => r.status === "completed").length;
  const globalSuccessRate = totalRuns > 0 ? Math.round((totalCompleted / totalRuns) * 100) : 0;
  const durations = allRuns.filter(r => r.duration_ms != null).map(r => r.duration_ms as number);
  const fastestMs = durations.length > 0 ? Math.min(...durations) : null;
  const slowestMs = durations.length > 0 ? Math.max(...durations) : null;

  // Most productive source (most results_found total)
  let mostProductiveSource: string | null = null;
  let mostProductiveCount = 0;
  Array.from(statsMap.entries()).forEach(([name, st]) => {
    if (st.total_results > mostProductiveCount) {
      mostProductiveCount = st.total_results;
      mostProductiveSource = name;
    }
  });

  // Additional orchestrator metrics
  const completedRuns  = allRuns.filter(r => r.status === "completed");
  const avgDurationMs  = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / completedRuns.length)
    : null;
  const avgResultsPerRun = completedRuns.length > 0
    ? Math.round((completedRuns.reduce((s, r) => s + r.results_found, 0) / completedRuns.length) * 10) / 10
    : null;
  const healthySources = enriched.filter(s =>
    (s.success_rate ?? 0) >= 80 && s.total_runs > 0 && (s as { active: boolean }).active
  ).length;

  return NextResponse.json({
    sources: enriched,
    stats: {
      total_runs:           totalRuns,
      global_success_rate:  globalSuccessRate,
      fastest_ms:           fastestMs,
      slowest_ms:           slowestMs,
      most_productive:      mostProductiveSource,
      avg_duration_ms:      avgDurationMs,
      avg_results_per_run:  avgResultsPerRun,
      healthy_sources:      healthySources,
    },
  });
}
