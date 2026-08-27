import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getEnvHealth } from "@/lib/config/env-health";
import { loadAdminIntelligenceViewModel } from "@/lib/intelligence/admin-view-model";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import { buildControlPlaneMemoryRecord, loadControlPlaneHistory, persistControlPlaneMemory, summarizeControlPlaneHistory } from "@/lib/intelligence/control-plane-store";
import { buildProductionConfigChecks, canonicalHistory, productionConfigFromChecks, selectCanonicalControlPlane } from "@/lib/intelligence/admin-production-parity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const model = await loadAdminIntelligenceViewModel();
    const env = getEnvHealth();
    let history: Awaited<ReturnType<typeof loadControlPlaneHistory>> = { records: [], error: "Database unavailable." };
    let db: ReturnType<(typeof import("@/lib/supabase/server"))["createServerClient"]> | null = null;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createServerClient } = await import("@/lib/supabase/server");
      db = createServerClient();
      history = await loadControlPlaneHistory(db as never, 30);
    }
    const serviceRoleQuerySucceeded = !history.error;
    const configChecks = buildProductionConfigChecks({ env, databaseAvailable: model.availability.database !== "unavailable" && serviceRoleQuerySucceeded, serviceRoleQuerySucceeded });
    const selected = selectCanonicalControlPlane({ live: model.control_plane, history: history.records });
    const deployment = { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null, environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown" };
    if (selected.telemetry_state === "unavailable") return NextResponse.json({
      error: "Control Plane telemetry is unavailable. Readiness was not converted to zero.", readiness: null,
      telemetry: { state: selected.telemetry_state, source: selected.source, explanation: selected.explanation, store_available: serviceRoleQuerySucceeded, last_durable_snapshot_key: null },
      production_configuration: configChecks, deployment,
    }, { status: 503, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
    const readiness = buildLaunchReadiness({
      now: new Date().toISOString(), control_plane: selected.control_plane,
      database_available: configChecks.find((check) => check.id === "database")?.state === "present",
      production_config: productionConfigFromChecks(configChecks),
    });
    let persistence: { persisted: boolean; error: string | null } = { persisted: false, error: "Database unavailable." };
    if (db) {
      const record = buildControlPlaneMemoryRecord({ control_plane: selected.control_plane, launch_readiness: readiness, trigger_type: selected.source === "last_durable_evaluation" ? "production_parity_recompute" : "admin_observation", trigger_ref: process.env.VERCEL_GIT_COMMIT_SHA ?? null });
      persistence = await persistControlPlaneMemory(db as never, record);
      history = await loadControlPlaneHistory(db as never, 30);
    }
    const materialHistory = canonicalHistory(history.records);
    return NextResponse.json({
      version: "admin-launch-readiness-api-v2", generated_at: readiness.evaluated_at,
      readiness, capability_summary: {
        overall: selected.control_plane.overall, confidence: selected.control_plane.overall_confidence,
        states: selected.control_plane.state_counts, blockers: selected.control_plane.critical_blockers,
      },
      telemetry: { state: selected.telemetry_state, source: selected.source, explanation: selected.explanation, store_available: serviceRoleQuerySucceeded, last_durable_snapshot_key: selected.durable_record?.snapshot_key ?? null },
      production_configuration: configChecks,
      deployment,
      history: materialHistory.map((row) => ({
        observed_at: row.observed_at, score: row.launch_readiness_score, level: row.launch_readiness_level,
        confidence: row.confidence, blocker_count: row.blocker_count, capability_score: row.capability_score,
      })),
      history_summary: summarizeControlPlaneHistory(materialHistory),
      persistence: { available: persistence.persisted || !persistence.error, persisted: persistence.persisted, error: persistence.error ?? history.error },
    }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    console.error("[launch-readiness] evaluation failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Launch readiness could not be evaluated. No stale score was substituted." }, { status: 503 });
  }
}
