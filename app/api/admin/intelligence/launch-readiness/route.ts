import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getEnvHealth } from "@/lib/config/env-health";
import { loadAdminIntelligenceViewModel } from "@/lib/intelligence/admin-view-model";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import { buildControlPlaneMemoryRecord, loadControlPlaneHistory, persistControlPlaneMemory, summarizeControlPlaneHistory } from "@/lib/intelligence/control-plane-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const model = await loadAdminIntelligenceViewModel();
    const env = getEnvHealth();
    const readiness = buildLaunchReadiness({
      now: new Date().toISOString(), control_plane: model.control_plane,
      database_available: model.availability.database !== "unavailable",
      production_config: {
        supabase: env.supabase_url_set && env.supabase_service_role_set && env.supabase_anon_key_set,
        admin_auth: env.admin_secret_set,
        internal_run_auth: env.internal_run_secret_set,
        app_url: env.app_url_set,
        demo_off: !env.demo_mode,
      },
    });
    let persistence: { persisted: boolean; error: string | null } = { persisted: false, error: "Database unavailable." };
    let history: Awaited<ReturnType<typeof loadControlPlaneHistory>> = { records: [], error: "Database unavailable." };
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createServerClient } = await import("@/lib/supabase/server");
      const db = createServerClient();
      const record = buildControlPlaneMemoryRecord({ control_plane: model.control_plane, launch_readiness: readiness });
      persistence = await persistControlPlaneMemory(db as never, record);
      history = await loadControlPlaneHistory(db as never, 30);
    }
    return NextResponse.json({
      version: "admin-launch-readiness-api-v1", generated_at: readiness.evaluated_at,
      readiness, capability_summary: {
        overall: model.control_plane.overall, confidence: model.control_plane.overall_confidence,
        states: model.control_plane.state_counts, blockers: model.control_plane.critical_blockers,
      },
      history: history.records.map((row) => ({
        observed_at: row.observed_at, score: row.launch_readiness_score, level: row.launch_readiness_level,
        confidence: row.confidence, blocker_count: row.blocker_count, capability_score: row.capability_score,
      })),
      history_summary: summarizeControlPlaneHistory(history.records),
      persistence: { available: persistence.persisted || !persistence.error, persisted: persistence.persisted, error: persistence.error ?? history.error },
    }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    console.error("[launch-readiness] evaluation failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Launch readiness could not be evaluated. No stale score was substituted." }, { status: 503 });
  }
}
