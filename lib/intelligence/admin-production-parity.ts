import type { EnvHealth } from "@/lib/config/env-health";
import type { IntelligenceControlPlane } from "./capability-control-plane";
import type { ControlPlaneMemoryRecord } from "./control-plane-store";

export const ADMIN_PRODUCTION_PARITY_VERSION = "admin-production-parity-v1";

export type ConfigCheckState = "present" | "missing" | "invalid" | "not_applicable" | "unverified";
export interface ProductionConfigCheck {
  id: "database" | "admin_auth" | "application_url" | "demo_isolation" | "internal_worker" | "supabase_service_access";
  label: string;
  state: ConfigCheckState;
  launch_stage: "internal_pilot" | "closed_alpha" | "self_serve";
  detail: string;
}

export function buildProductionConfigChecks(input: {
  env: EnvHealth;
  databaseAvailable: boolean;
  serviceRoleQuerySucceeded: boolean;
}): ProductionConfigCheck[] {
  const { env } = input;
  return [
    { id: "database", label: "Database", state: input.databaseAvailable ? "present" : "missing", launch_stage: "internal_pilot", detail: input.databaseAvailable ? "Canonical database queries succeeded." : "Canonical database access is unavailable." },
    { id: "admin_auth", label: "Admin auth", state: env.admin_session_secret_set || env.admin_secret_set ? "present" : "missing", launch_stage: "internal_pilot", detail: env.admin_session_secret_set ? "Signed Admin sessions are configured." : env.admin_secret_set ? "Development/shared Admin credential only." : "No Admin credential chain is configured." },
    { id: "application_url", label: "Application URL", state: env.app_url_set || env.vercel_url_set ? "present" : "missing", launch_stage: "closed_alpha", detail: env.app_url_set ? "Canonical application URL is configured." : env.vercel_url_set ? "Vercel deployment URL is available; canonical public URL is not explicit." : "No application URL is available." },
    { id: "demo_isolation", label: "Demo isolation", state: env.demo_mode ? "invalid" : "present", launch_stage: "internal_pilot", detail: env.demo_mode ? "DEMO_MODE is enabled in this runtime." : "Demo mode is disabled." },
    { id: "internal_worker", label: "Internal worker secret", state: env.internal_run_secret_set ? "present" : "missing", launch_stage: "closed_alpha", detail: env.internal_run_secret_set ? "Asynchronous customer worker authentication is configured." : "Guided Admin pilots remain available; asynchronous customer execution is degraded." },
    { id: "supabase_service_access", label: "Supabase service access", state: input.serviceRoleQuerySucceeded ? "present" : env.supabase_service_role_set ? "unverified" : "missing", launch_stage: "internal_pilot", detail: input.serviceRoleQuerySucceeded ? "Service-role Control Plane query succeeded." : env.supabase_service_role_set ? "Credential is present but the Control Plane query did not succeed." : "Service-role credential is absent." },
  ];
}

export function productionConfigFromChecks(checks: ProductionConfigCheck[]) {
  const state = (id: ProductionConfigCheck["id"]) => checks.find((check) => check.id === id)?.state === "present";
  return {
    supabase: state("database") && state("supabase_service_access"),
    admin_auth: state("admin_auth"),
    internal_run_auth: state("internal_worker"),
    app_url: state("application_url"),
    demo_off: state("demo_isolation"),
  };
}

function measuredCapabilityCount(plane: IntelligenceControlPlane): number {
  return plane.capabilities.filter((item) => item.evidence.some((evidence) => !["schema_exists", "unit_test_passing"].includes(evidence.kind)) || (item.score.state === "measured" && item.score.sample_size > 0)).length;
}

export function selectCanonicalControlPlane(input: {
  live: IntelligenceControlPlane;
  history: ControlPlaneMemoryRecord[];
}): {
  control_plane: IntelligenceControlPlane;
  source: "live_runtime" | "last_durable_evaluation" | "unavailable";
  telemetry_state: "current" | "degraded_using_last_durable" | "unavailable";
  durable_record: ControlPlaneMemoryRecord | null;
  explanation: string;
} {
  const liveMeasured = measuredCapabilityCount(input.live);
  if (liveMeasured > 0 && input.live.overall.state === "measured") {
    return { control_plane: input.live, source: "live_runtime", telemetry_state: "current", durable_record: null, explanation: `${liveMeasured} capabilities have current runtime evidence.` };
  }
  const durable = input.history.find((record) => record.source_data_cutoff && measuredCapabilityCount(record.snapshot.control_plane) > 0) ?? null;
  if (durable) return {
    control_plane: durable.snapshot.control_plane,
    source: "last_durable_evaluation",
    telemetry_state: "degraded_using_last_durable",
    durable_record: durable,
    explanation: "Controlled acceptance artifacts are unavailable in this deployment; the last durable canonical evaluation is retained instead of converting unavailable telemetry to zero.",
  };
  return { control_plane: input.live, source: "unavailable", telemetry_state: "unavailable", durable_record: null, explanation: "Neither current runtime evidence nor a durable canonical evaluation is available." };
}

export function canonicalHistory(records: ControlPlaneMemoryRecord[]): ControlPlaneMemoryRecord[] {
  return records.filter((record) => record.source_data_cutoff !== null && measuredCapabilityCount(record.snapshot.control_plane) > 0);
}
