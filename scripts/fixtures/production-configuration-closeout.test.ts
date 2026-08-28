import { strict as assert } from "node:assert";
import { buildCapabilityControlPlane } from "@/lib/intelligence/capability-control-plane";
import { buildProductionConfigChecks, productionConfigFromChecks } from "@/lib/intelligence/admin-production-parity";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import type { EnvHealth } from "@/lib/config/env-health";

let passed = 0;
const test = (name: string, condition: boolean) => {
  assert.equal(condition, true, name);
  passed++;
  console.log(`ok - ${name}`);
};

const now = "2026-08-27T20:00:00.000Z";
const plane = buildCapabilityControlPlane({
  now,
  snapshot_capabilities: [],
  dynamic_recall: null,
  soak: null,
  monitor_sample: 0,
  monitor_false_novelty: null,
  account_memory_records: 0,
});

const baseEnv: EnvHealth = {
  supabase_url_set: true,
  supabase_anon_key_set: true,
  supabase_service_role_set: true,
  admin_secret_set: false,
  admin_session_secret_set: true,
  internal_run_secret_set: true,
  cron_secret_set: false,
  app_url_set: true,
  vercel_url_set: false,
  vercel_production_url_set: false,
  demo_mode: false,
  node_env: "production",
  supabase_ready: true,
  report_auth_ready: true,
  processor_ready: true,
  drainer_ready: false,
  cron_ready: false,
  production_safe: false,
  missing_for_production: ["CRON_SECRET"],
};

const evaluate = (env: EnvHealth, databaseAvailable = true, serviceRoleQuerySucceeded = true) => {
  const checks = buildProductionConfigChecks({ env, databaseAvailable, serviceRoleQuerySucceeded });
  const readiness = buildLaunchReadiness({
    now,
    control_plane: plane,
    database_available: databaseAvailable,
    production_config: productionConfigFromChecks(checks),
  });
  return { checks, readiness, gate: readiness.gates.find((gate) => gate.id === "production_configuration")! };
};

const intelligenceScoreBefore = plane.overall.score;
const healthy = evaluate(baseEnv);
test("1 all required controls pass production configuration", healthy.gate.state === "pass" && healthy.gate.score === 100 && healthy.gate.sample_size === 6);

const noDatabase = evaluate(baseEnv, false, true);
test("2 missing database is an Internal Pilot hard failure", noDatabase.gate.state === "fail" && /Database \(missing\)/.test(noDatabase.gate.reason));

const noAdmin = evaluate({ ...baseEnv, admin_session_secret_set: false });
test("3 missing canonical Admin session secret is an Internal Pilot hard failure", noAdmin.gate.state === "fail" && /Admin auth \(missing\)/.test(noAdmin.gate.reason));

const legacyAdmin = evaluate({ ...baseEnv, admin_session_secret_set: false, admin_secret_set: true });
const legacyCheck = legacyAdmin.checks.find((check) => check.id === "admin_auth")!;
test("4 ADMIN_SECRET_TOKEN alone cannot satisfy canonical production Admin auth", legacyCheck.state === "missing" && /Legacy ADMIN_SECRET_TOKEN/.test(legacyCheck.detail) && legacyAdmin.gate.state === "fail");

const noAppUrl = evaluate({ ...baseEnv, app_url_set: false });
test("5 missing application URL degrades closed alpha without failing Internal Pilot configuration", noAppUrl.gate.state === "degraded" && /Internal Pilot configuration is valid/.test(noAppUrl.gate.reason) && /Application URL \(missing\)/.test(noAppUrl.gate.reason));

const vercelProductionUrl = evaluate({ ...baseEnv, app_url_set: false, vercel_production_url_set: true });
test("6 canonical Vercel production URL satisfies application URL", vercelProductionUrl.checks.find((check) => check.id === "application_url")?.state === "present" && vercelProductionUrl.gate.state === "pass");

const noWorker = evaluate({ ...baseEnv, internal_run_secret_set: false });
test("7 missing worker secret degrades closed alpha without failing guided Internal Pilot configuration", noWorker.gate.state === "degraded" && /Internal Pilot configuration is valid/.test(noWorker.gate.reason) && /Internal worker secret \(missing\)/.test(noWorker.gate.reason));

const demoEnabled = evaluate({ ...baseEnv, demo_mode: true });
test("8 enabled demo mode is an invalid Internal Pilot hard failure", demoEnabled.gate.state === "fail" && /Demo isolation \(invalid\)/.test(demoEnabled.gate.reason));

const demoDisabled = healthy.checks.find((check) => check.id === "demo_isolation")!;
test("9 disabled demo mode needs no legacy flag and passes", demoDisabled.state === "present" && /no legacy demo flag is required/.test(demoDisabled.detail));

const serviceUnverified = evaluate(baseEnv, true, false);
test("10 unverified Supabase service access is an Internal Pilot hard failure", serviceUnverified.gate.state === "fail" && /Supabase service access \(unverified\)/.test(serviceUnverified.gate.reason));

const onlyLaterStageMissing = evaluate({ ...baseEnv, app_url_set: false, internal_run_secret_set: false });
test("11 exact diagnostics replace the broad core-configuration error", onlyLaterStageMissing.gate.state === "degraded" && /Application URL \(missing\)/.test(onlyLaterStageMissing.gate.reason) && /Internal worker secret \(missing\)/.test(onlyLaterStageMissing.gate.reason) && !/core database/i.test(onlyLaterStageMissing.gate.reason));

test("12 configuration changes do not mutate Intelligence capability score", plane.overall.score === intelligenceScoreBefore);

test("13 every check exposes launch scope and founder-action semantics", healthy.checks.every((check) => Boolean(check.launch_stage) && typeof check.hard_blocking_readiness === "boolean" && typeof check.founder_action_required === "boolean"));

console.log(`\n${passed} passed, 0 failed`);
