import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadLocalEnv();
const { loadAdminIntelligenceViewModel } = await import("@/lib/intelligence/admin-view-model");
const { buildLaunchReadiness } = await import("@/lib/intelligence/launch-readiness");
const { buildControlPlaneMemoryRecord, persistControlPlaneMemory } = await import("@/lib/intelligence/control-plane-store");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service configuration unavailable");
const db = createClient(url, key, { auth: { persistSession: false } });
const model = await loadAdminIntelligenceViewModel({ db: db as never });
const existing = await db.from("intelligence_control_plane_snapshots").select("snapshot_key", { count: "exact", head: true });
if (existing.error) throw new Error(`Control Plane history unavailable: ${existing.error.message}`);
const readiness = buildLaunchReadiness({
  now: new Date().toISOString(), control_plane: model.control_plane,
  database_available: model.availability.database !== "unavailable",
  production_config: {
    supabase: Boolean(url && key && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    admin_auth: Boolean(process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_SESSION_SECRET),
    internal_run_auth: Boolean(process.env.INTERNAL_RUN_SECRET),
    app_url: Boolean(process.env.NEXT_PUBLIC_APP_URL), demo_off: process.env.DEMO_MODE !== "true",
  },
});
const result = await persistControlPlaneMemory(db as never, buildControlPlaneMemoryRecord({
  control_plane: model.control_plane, launch_readiness: readiness,
  trigger_type: existing.count === 0 ? "control_plane_baseline_v1" : "operational_snapshot",
  trigger_ref: process.env.GIT_COMMIT_SHA ?? null,
}));
console.log(JSON.stringify({ persisted: result.persisted, error: result.error, readiness: readiness.score, level: readiness.level, confidence: readiness.confidence, sample_size: readiness.sample_size, blockers: readiness.blockers.length }));
if (!result.persisted) process.exit(1);
