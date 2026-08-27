import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const { loadAdminIntelligenceViewModel } = await import("@/lib/intelligence/admin-view-model");
const model = await loadAdminIntelligenceViewModel({ root, db: null });
const artifact = {
  audit: "admin-intelligence-control-plane-v1",
  generated_at: model.generated_at,
  source_mode: "local_acceptance_artifacts_no_database",
  database_metrics_included: false,
  control_plane: model.control_plane,
  availability: model.availability,
};
const target = path.join(root, "ml/data/acceptance/admin-intelligence-control-plane-v1.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(target);
console.log(JSON.stringify({
  overall: model.control_plane.overall,
  confidence: model.control_plane.overall_confidence,
  states: model.control_plane.state_counts,
  blockers: model.control_plane.critical_blockers,
}, null, 2));
