import fs from "node:fs";
import capabilityModule from "@/lib/intelligence/capability-control-plane";
import envModule from "@/lib/config/env-health";
import adminModelModule from "@/lib/intelligence/admin-view-model";
import readinessModule from "@/lib/intelligence/launch-readiness";
import storeModule from "@/lib/intelligence/control-plane-store";
import parityModule from "@/lib/intelligence/admin-production-parity";
import validationModule from "@/lib/intelligence/control-plane-validation-evidence";
import scoreModule from "@/lib/intelligence/intelligence-score";

const { applyControlPlaneValidationEvidence } = capabilityModule;
const { getEnvHealth } = envModule;
const { loadAdminIntelligenceViewModel } = adminModelModule;
const { buildLaunchReadiness } = readinessModule;
const { buildControlPlaneMemoryRecord, loadControlPlaneHistory, persistControlPlaneMemory } = storeModule;
const { buildProductionConfigChecks, productionConfigFromChecks, selectCanonicalControlPlane } = parityModule;
const { validateControlPlaneValidationEvidence } = validationModule;
const { buildIntelligenceScoreView } = scoreModule;

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const evidencePath = "ml/data/acceptance/control-plane-validation-evidence-positive-commercial-case-v1.json";
const parsed = validateControlPlaneValidationEvidence(JSON.parse(fs.readFileSync(evidencePath, "utf8")));
if (!parsed.ok) throw new Error(`invalid_control_plane_evidence:${parsed.errors.join(",")}`);
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service configuration unavailable");

const { createServerClient } = await import("@/lib/supabase/server");
const db = createServerClient();
const [model, history] = await Promise.all([
  loadAdminIntelligenceViewModel(),
  loadControlPlaneHistory(db as never, 30),
]);
if (history.error) throw new Error(`control_plane_history_unavailable:${history.error}`);
const selected = selectCanonicalControlPlane({ live: model.control_plane, history: history.records });
if (selected.telemetry_state === "unavailable") throw new Error("canonical_control_plane_unavailable");

const now = new Date().toISOString();
const env = getEnvHealth();
const configChecks = buildProductionConfigChecks({
  env,
  databaseAvailable: model.availability.database !== "unavailable",
  serviceRoleQuerySucceeded: true,
});
const readinessInput = {
  now,
  database_available: configChecks.find((check) => check.id === "database")?.state === "present",
  production_config: productionConfigFromChecks(configChecks),
};
const beforePlane = selected.control_plane;
const beforeReadiness = buildLaunchReadiness({ ...readinessInput, control_plane: beforePlane });
const afterPlane = applyControlPlaneValidationEvidence(beforePlane, [parsed.evidence], now);
const afterReadiness = buildLaunchReadiness({ ...readinessInput, control_plane: afterPlane });
const beforeRecord = buildControlPlaneMemoryRecord({ control_plane: beforePlane, launch_readiness: beforeReadiness });
const afterRecord = buildControlPlaneMemoryRecord({
  control_plane: afterPlane,
  launch_readiness: afterReadiness,
  trigger_type: "controlled_acceptance_ingestion",
  trigger_ref: `${parsed.evidence.evidence_id}:${parsed.evidence.source_fingerprint.slice(0, 12)}`,
});
const materialChange = beforeRecord.snapshot_key !== afterRecord.snapshot_key;
const duplicate = history.records.some((item) => item.snapshot_key === afterRecord.snapshot_key);
const persistence = materialChange && !duplicate
  ? await persistControlPlaneMemory(db as never, afterRecord)
  : { persisted: false, error: null };
if (persistence.error) throw new Error(`snapshot_persistence_failed:${persistence.error}`);

const component = (plane: typeof beforePlane, id: string) =>
  buildIntelligenceScoreView(plane).components.find((item) => item.id === id) ?? null;
const gates = (readiness: typeof beforeReadiness) => Object.fromEntries(
  readiness.gates.map((gate) => [gate.id, { state: gate.state, score: gate.score, sample_size: gate.sample_size }]),
);

console.log(JSON.stringify({
  mode: "canonical_recompute_and_material_persist",
  canonical_source: selected.source,
  evidence_id: parsed.evidence.evidence_id,
  evidence_fingerprint: parsed.evidence.source_fingerprint,
  supersedes_source_fingerprint: parsed.evidence.supersedes_source_fingerprint,
  material_change: materialChange,
  duplicate_snapshot: duplicate,
  persisted: persistence.persisted,
  before_snapshot_key: beforeRecord.snapshot_key,
  after_snapshot_key: afterRecord.snapshot_key,
  before: {
    intelligence: buildIntelligenceScoreView(beforePlane),
    launch_readiness: { score: beforeReadiness.score, confidence: beforeReadiness.confidence, sample_size: beforeReadiness.sample_size, gates: gates(beforeReadiness) },
    commercial_validation: component(beforePlane, "commercial_validation"),
    opportunity_reasoning: component(beforePlane, "opportunity_reasoning"),
    evidence: component(beforePlane, "evidence"),
  },
  after: {
    intelligence: buildIntelligenceScoreView(afterPlane),
    launch_readiness: { score: afterReadiness.score, confidence: afterReadiness.confidence, sample_size: afterReadiness.sample_size, gates: gates(afterReadiness) },
    commercial_validation: component(afterPlane, "commercial_validation"),
    opportunity_reasoning: component(afterPlane, "opportunity_reasoning"),
    evidence: component(afterPlane, "evidence"),
  },
  production_configuration: configChecks.map(({ id, state, launch_stage, hard_blocking_readiness }) => ({ id, state, launch_stage, hard_blocking_readiness })),
}, null, 2));
