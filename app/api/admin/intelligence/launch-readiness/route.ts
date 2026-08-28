import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getEnvHealth } from "@/lib/config/env-health";
import { loadAdminIntelligenceViewModel } from "@/lib/intelligence/admin-view-model";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import { buildControlPlaneMemoryRecord, loadControlPlaneHistory, persistControlPlaneMemory, summarizeControlPlaneHistory } from "@/lib/intelligence/control-plane-store";
import { buildProductionConfigChecks, canonicalHistory, productionConfigFromChecks } from "@/lib/intelligence/admin-production-parity";
import { applyControlPlaneValidationEvidence } from "@/lib/intelligence/capability-control-plane";
import { validateControlPlaneValidationEvidence } from "@/lib/intelligence/control-plane-validation-evidence";
import bundledValidationEvidence from "@/ml/data/acceptance/control-plane-validation-evidence-v1.json";

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
    const selected = {
      control_plane: model.control_plane,
      source: model.canonical.source,
      telemetry_state: model.canonical.telemetry_state,
      durable_record: history.records.find((row) => row.snapshot_key === model.canonical.durable_snapshot_key) ?? null,
      explanation: model.canonical.explanation,
    };
    const deployment = { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null, environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown" };
    if (selected.telemetry_state === "unavailable") return NextResponse.json({
      error: "Control Plane telemetry is unavailable. Readiness was not converted to zero.", readiness: null,
      telemetry: { state: selected.telemetry_state, source: selected.source, explanation: selected.explanation, store_available: serviceRoleQuerySucceeded, last_durable_snapshot_key: null },
      production_configuration: configChecks, deployment,
    }, { status: 503, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
    const readiness = model.canonical.launch_readiness ?? buildLaunchReadiness({
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
      validation_evidence: (selected.control_plane.validation_evidence ?? []).map((item) => ({ evidence_id: item.evidence_id, source_type: item.source_type, source_fingerprint: item.source_fingerprint, observed_at: item.observed_at, artifact_version: item.artifact_version, provenance: item.provenance })),
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

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = await req.json();
    const parsed = validateControlPlaneValidationEvidence(body?.use_bundled_evidence === true ? bundledValidationEvidence : body);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid controlled validation evidence.", details: parsed.errors }, { status: 400 });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Durable Control Plane store unavailable." }, { status: 503 });
    const { createServerClient } = await import("@/lib/supabase/server");
    const db = createServerClient();
    const [model, history] = await Promise.all([loadAdminIntelligenceViewModel(), loadControlPlaneHistory(db as never, 30)]);
    if (history.error) return NextResponse.json({ error: "Durable Control Plane history unavailable." }, { status: 503 });
    const selected = {
      control_plane: model.control_plane,
      source: model.canonical.source,
      telemetry_state: model.canonical.telemetry_state,
      durable_record: history.records.find((row) => row.snapshot_key === model.canonical.durable_snapshot_key) ?? null,
    };
    if (selected.telemetry_state === "unavailable") return NextResponse.json({ error: "No canonical Control Plane baseline is available." }, { status: 503 });
    const alreadyPresent = (selected.control_plane.validation_evidence ?? []).some((item) => item.source_fingerprint === parsed.evidence.source_fingerprint);
    if (alreadyPresent) return NextResponse.json({ accepted: true, duplicate: true, persisted: false, source_fingerprint: parsed.evidence.source_fingerprint, readiness: selected.durable_record?.snapshot.launch_readiness ?? null });

    const now = new Date().toISOString();
    const controlPlane = applyControlPlaneValidationEvidence(selected.control_plane, [parsed.evidence], now);
    const env = getEnvHealth();
    const configChecks = buildProductionConfigChecks({ env, databaseAvailable: model.availability.database !== "unavailable", serviceRoleQuerySucceeded: true });
    const readiness = buildLaunchReadiness({ now, control_plane: controlPlane, database_available: configChecks.find((check) => check.id === "database")?.state === "present", production_config: productionConfigFromChecks(configChecks) });
    const record = buildControlPlaneMemoryRecord({ control_plane: controlPlane, launch_readiness: readiness, trigger_type: "controlled_acceptance_ingestion", trigger_ref: `${parsed.evidence.evidence_id}:${parsed.evidence.source_fingerprint.slice(0, 12)}` });
    const duplicateSnapshot = history.records.some((item) => item.snapshot_key === record.snapshot_key);
    const persistence = duplicateSnapshot ? { persisted: false, error: null } : await persistControlPlaneMemory(db as never, record);
    if (persistence.error) return NextResponse.json({ error: "Controlled evidence was valid but snapshot persistence failed." }, { status: 503 });
    return NextResponse.json({
      accepted: true, duplicate: duplicateSnapshot, persisted: persistence.persisted,
      source_fingerprint: parsed.evidence.source_fingerprint,
      before: selected.durable_record?.snapshot.launch_readiness ?? null,
      after: readiness,
      snapshot_key: record.snapshot_key,
      production_configuration: configChecks,
    }, { status: duplicateSnapshot ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid JSON body." : "Controlled evidence ingestion failed." }, { status: 400 });
  }
}
