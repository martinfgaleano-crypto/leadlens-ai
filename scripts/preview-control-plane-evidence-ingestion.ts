import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { applyControlPlaneValidationEvidence, type IntelligenceControlPlane } from "@/lib/intelligence/capability-control-plane";
import { buildLaunchReadiness, type LaunchReadinessAssessment } from "@/lib/intelligence/launch-readiness";
import { validateControlPlaneValidationEvidence } from "@/lib/intelligence/control-plane-validation-evidence";

for (const file of [".env.local", ".env"]) if (fs.existsSync(file)) for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}
async function main() {
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service configuration unavailable");
const raw = JSON.parse(fs.readFileSync("ml/data/acceptance/control-plane-validation-evidence-v1.json", "utf8"));
const parsed = validateControlPlaneValidationEvidence(raw); if (!parsed.ok) throw new Error(parsed.errors.join("; "));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const result = await db.from("intelligence_control_plane_snapshots").select("snapshot_key,snapshot,observed_at").order("observed_at", { ascending: false }).limit(1).single();
if (result.error) throw new Error(result.error.message);
const before = result.data.snapshot.launch_readiness as LaunchReadinessAssessment;
const plane = result.data.snapshot.control_plane as IntelligenceControlPlane;
const priorConfig = before.gates.find((gate) => gate.id === "production_configuration")?.state ?? "fail";
// This preview preserves the observed production-configuration gate; it does not
// guess which secret/env is missing. The deployed API recomputes from real env.
const productionConfig = priorConfig === "pass"
  ? { supabase: true, admin_auth: true, internal_run_auth: true, app_url: true, demo_off: true }
  : priorConfig === "degraded"
    ? { supabase: true, admin_auth: true, internal_run_auth: false, app_url: true, demo_off: true }
    : { supabase: true, admin_auth: true, internal_run_auth: false, app_url: false, demo_off: true };
const now = new Date().toISOString();
const afterPlane = applyControlPlaneValidationEvidence(plane, [parsed.evidence], now);
const after = buildLaunchReadiness({ now, control_plane: afterPlane, database_available: true, production_config: productionConfig });
const gate = (assessment: LaunchReadinessAssessment) => Object.fromEntries(assessment.gates.map((item) => [item.id, { state: item.state, score: item.score, n: item.sample_size }]));
console.log(JSON.stringify({ mode: "read_only_preview", configuration_projection: "preserved_prior_gate_not_env_probe", snapshot_key: result.data.snapshot_key, evidence_fingerprint: parsed.evidence.source_fingerprint, before: { score: before.score, confidence: before.confidence, sample: before.sample_size, source_cutoff: before.source_data_cutoff, gates: gate(before) }, after: { score: after.score, confidence: after.confidence, sample: after.sample_size, source_cutoff: after.source_data_cutoff, gates: gate(after), blockers: after.blockers, limitations: after.limitations }, capability_overall: afterPlane.overall }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
