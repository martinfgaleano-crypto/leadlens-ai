import { createHash } from "node:crypto";
import type { IntelligenceControlPlane } from "./capability-control-plane";
import { launchReadinessFingerprint, type LaunchReadinessAssessment } from "./launch-readiness";

export const CONTROL_PLANE_MEMORY_VERSION = "control-plane-memory-v1";

export interface ControlPlaneMemoryRecord {
  snapshot_key: string;
  trigger_type: string;
  trigger_ref: string | null;
  control_plane_version: string;
  launch_readiness_version: string;
  capability_score: number | null;
  launch_readiness_score: number;
  launch_readiness_level: string;
  confidence: string;
  source_data_cutoff: string | null;
  capability_state_counts: Record<string, number>;
  blocker_count: number;
  snapshot: { control_plane: IntelligenceControlPlane; launch_readiness: LaunchReadinessAssessment };
  observed_at: string;
}

type StoreDb = {
  from(table: string): {
    upsert(value: unknown, options?: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    select(columns: string): {
      order(column: string, options?: Record<string, unknown>): { limit(n: number): Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
  };
};

export function buildControlPlaneMemoryRecord(input: {
  control_plane: IntelligenceControlPlane;
  launch_readiness: LaunchReadinessAssessment;
  trigger_type?: string;
  trigger_ref?: string | null;
}): ControlPlaneMemoryRecord {
  const raw = launchReadinessFingerprint(input.launch_readiness);
  const key = createHash("sha256").update(raw).digest("hex");
  const overall = input.control_plane.overall;
  return {
    snapshot_key: key, trigger_type: input.trigger_type ?? "admin_observation", trigger_ref: input.trigger_ref ?? null,
    control_plane_version: input.control_plane.version, launch_readiness_version: input.launch_readiness.version,
    capability_score: overall.state === "measured" ? overall.score : null,
    launch_readiness_score: input.launch_readiness.score, launch_readiness_level: input.launch_readiness.level,
    confidence: input.launch_readiness.confidence, source_data_cutoff: input.launch_readiness.source_data_cutoff,
    capability_state_counts: input.control_plane.state_counts,
    blocker_count: input.launch_readiness.blockers.length,
    snapshot: { control_plane: input.control_plane, launch_readiness: input.launch_readiness },
    observed_at: input.launch_readiness.evaluated_at,
  };
}

export async function persistControlPlaneMemory(db: StoreDb, record: ControlPlaneMemoryRecord): Promise<{ persisted: boolean; error: string | null }> {
  try {
    const { error } = await db.from("intelligence_control_plane_snapshots").upsert(record, { onConflict: "snapshot_key", ignoreDuplicates: true });
    return { persisted: !error, error: error?.message ?? null };
  } catch (error) {
    return { persisted: false, error: error instanceof Error ? error.message : "control plane persistence failed" };
  }
}

export async function loadControlPlaneHistory(db: StoreDb, limit = 30): Promise<{ records: ControlPlaneMemoryRecord[]; error: string | null }> {
  try {
    const result = await db.from("intelligence_control_plane_snapshots").select("snapshot_key,trigger_type,trigger_ref,control_plane_version,launch_readiness_version,capability_score,launch_readiness_score,launch_readiness_level,confidence,source_data_cutoff,capability_state_counts,blocker_count,snapshot,observed_at").order("observed_at", { ascending: false }).limit(limit);
    return { records: (result.data ?? []) as ControlPlaneMemoryRecord[], error: result.error?.message ?? null };
  } catch (error) {
    return { records: [], error: error instanceof Error ? error.message : "control plane history unavailable" };
  }
}
