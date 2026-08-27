import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getEnvHealth } from "@/lib/config/env-health";

export const dynamic = "force-dynamic";

const percentile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
};

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const checkedAt = new Date().toISOString();
  const env = getEnvHealth();
  const deployment = { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null, environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown" };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ version: "runtime-health-v2", checked_at: checkedAt, state: "unavailable", reason: "Canonical database configuration is unavailable.", deployment, env: { database_configured: false, worker_configured: env.internal_run_secret_set, cron_configured: env.cron_secret_set }, runs: null, monitor: null, control_plane: null }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) return NextResponse.json({ version: "runtime-health-v2", checked_at: checkedAt, state: "unavailable", reason: "Canonical database client could not be created.", deployment, env: { database_configured: true, worker_configured: env.internal_run_secret_set, cron_configured: env.cron_secret_set }, runs: null, monitor: null, control_plane: null }, { headers: { "Cache-Control": "private, no-store" } });
  const [runResult, monitorResult, controlResult] = await Promise.all([
    db.from("snapshot_reports").select("job_id,status,report_json,created_at").order("created_at", { ascending: false }).limit(250),
    db.from("intelligence_monitoring_runs").select("id,status,created_at,completed_at,error_code").order("created_at", { ascending: false }).limit(100),
    db.from("intelligence_control_plane_snapshots").select("snapshot_key,source_data_cutoff,observed_at").order("observed_at", { ascending: false }).limit(1),
  ]);
  if (runResult.error) return NextResponse.json({ version: "runtime-health-v2", checked_at: checkedAt, state: "unavailable", reason: "Canonical runtime query failed.", deployment, env: { database_configured: true, worker_configured: env.internal_run_secret_set, cron_configured: env.cron_secret_set }, runs: null, monitor: null, control_plane: { available: !controlResult.error, error: controlResult.error?.message ?? null } }, { headers: { "Cache-Control": "private, no-store" } });
  const intelligenceRuns = (runResult.data ?? []).flatMap((row) => {
    const meta = row.report_json?._intelligence_run;
    if (!meta) return [];
    const started = new Date(meta.createdAt ?? row.created_at).getTime();
    const ended = new Date(meta.updatedAt ?? row.created_at).getTime();
    return [{ status: row.status as string, stage: meta.stage as string, failure: meta.failureCode as string | null, duration_ms: Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : null, updated_at: meta.updatedAt ?? row.created_at }];
  });
  const now = Date.now();
  const stale = intelligenceRuns.filter((run) => run.status === "processing" && now - new Date(run.updated_at).getTime() > 15 * 60_000).length;
  const durations = intelligenceRuns.flatMap((run) => run.duration_ms === null ? [] : [run.duration_ms]);
  const statuses = (values: Array<{ status: string }>) => values.reduce<Record<string, number>>((acc, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {});
  const monitorRuns = monitorResult.error ? null : (monitorResult.data ?? []);
  const monitorDurations = monitorRuns?.flatMap((run) => run.created_at && run.completed_at ? [Math.max(0, new Date(run.completed_at).getTime() - new Date(run.created_at).getTime())] : []) ?? [];
  return NextResponse.json({
    version: "runtime-health-v2", checked_at: checkedAt, state: controlResult.error || monitorResult.error ? "degraded" : "available",
    reason: controlResult.error || monitorResult.error ? "One or more canonical telemetry stores are unavailable." : null, deployment,
    env: { database_configured: true, worker_configured: env.internal_run_secret_set, cron_configured: env.cron_secret_set },
    runs: { sample_size: intelligenceRuns.length, statuses: statuses(intelligenceRuns), stale, p50_ms: percentile(durations, .5), p90_ms: percentile(durations, .9), p95_ms: percentile(durations, .95), failures: intelligenceRuns.filter((run) => run.status === "failed").slice(0, 10).map((run) => ({ code: run.failure, stage: run.stage })) },
    monitor: monitorRuns === null ? { available: false, sample_size: 0, statuses: {}, p95_ms: null } : { available: true, sample_size: monitorRuns.length, statuses: statuses(monitorRuns), p95_ms: percentile(monitorDurations, .95) },
    control_plane: { available: !controlResult.error, latest_observed_at: controlResult.data?.[0]?.observed_at ?? null, source_data_cutoff: controlResult.data?.[0]?.source_data_cutoff ?? null, error: controlResult.error?.message ?? null },
  }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
