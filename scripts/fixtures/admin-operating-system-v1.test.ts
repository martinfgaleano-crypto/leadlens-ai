import { readFileSync } from "node:fs";
import path from "node:path";
import { buildCapabilityControlPlane, type CapabilityControlPlaneInput, type DynamicRecallSignals } from "@/lib/intelligence/capability-control-plane";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import { buildControlPlaneMemoryRecord, persistControlPlaneMemory } from "@/lib/intelligence/control-plane-store";
import { ADMIN_DEPRECATED_NAVIGATION, ADMIN_NAVIGATION } from "@/lib/admin/admin-information-architecture";
import { measured, type IntelligenceCapabilityAssessment } from "@/lib/intelligence/os-contracts";

let passed = 0, failed = 0;
const test = (name: string, ok: boolean) => { ok ? (passed++, console.log(`ok - ${name}`)) : (failed++, console.error(`FAIL - ${name}`)); };
const now = "2026-08-27T12:00:00.000Z";
const assessment = (id: string): IntelligenceCapabilityAssessment => ({
  capability_id: id, capability_version: "test", scope: { kind: "global" }, methodology_version: "test",
  mode: "production", maturity_level: "structured_knowledge", maturity_confidence: .8, measurement_state: "measured",
  evidence: [{ id, kind: "exercised_run", ref: `run:${id}`, date: now }], sample_size: 20, last_exercised: now,
  success_metric: "success", success_rate: measured(92, .8, 20), known_failure_modes: [], limitations: [], blocked_reason: null,
  ranking_impact: "low", report_impact: "medium", next_milestone: null, promotion_criteria: [], human_review_state: "human_reviewed",
  assessed_at: now, source_data_cutoff: now,
});
const recalls = (captured: number): DynamicRecallSignals => ({
  generated_at: now, metrics: { researched_accounts: 16, delivered_cases: captured, structural_reasonable_including_borderline: 14,
    structural_reasonable_rate: .875, wrong_target_accounts: 2, wrong_target_rate: .125, human_positive_outcomes: captured,
    bounded_positive_controls: 8, bounded_positive_controls_captured_defensibly: captured, bounded_capture_rate: captured / 8,
    provider_calls: 60, observed_cost_usd: 1.2, duration_ms: 900_000, average_calls_per_run: 20 },
  runs: Array.from({ length: 6 }, (_, i) => ({ run_id: `r${i}`, universe: 10, researched: 3, delivered: i < captured ? 1 : 0, duration_ms: 150_000 })),
});
const ids = ["market_interpretation", "company_discovery", "company_verification", "structural_account_ranking", "deep_account_research", "signal_detection", "temporal_reasoning", "recommendation_generation", "client_specific_opportunity_assessment", "portfolio_strategy", "account_memory", "anti_repetition", "report_readiness_assessment"];
const plane = (captured: number) => buildCapabilityControlPlane({ now, snapshot_capabilities: ids.map(assessment), dynamic_recall: recalls(captured), soak: { runs: [{ ok: true }] }, monitor_sample: 12, monitor_false_novelty: 0, account_memory_records: 10 } satisfies CapabilityControlPlaneInput);
const config = { supabase: true, admin_auth: true, internal_run_auth: true, app_url: true, demo_off: true };

async function run() {
  const poor = buildLaunchReadiness({ now, control_plane: plane(0), production_config: config, database_available: true });
  const better = buildLaunchReadiness({ now, control_plane: plane(4), production_config: config, database_available: true });
  const unsafe = buildLaunchReadiness({ now, control_plane: plane(4), production_config: { ...config, admin_auth: false }, database_available: true });
  test("1 readiness is explicitly automatic", poor.automatic && poor.policy.some((x) => /no browser checkbox/i.test(x)));
  test("2 zero human-positive Cases caps readiness below guided beta", poor.score <= 49);
  test("3 improved empirical capture raises readiness", better.score > poor.score);
  test("4 missing production control lowers and caps readiness", unsafe.score <= 39 && unsafe.gates.find((g) => g.id === "production_configuration")?.state === "fail");
  test("5 every gate has machine-readable capability sources and n", poor.gates.every((g) => Array.isArray(g.capability_ids) && Number.isInteger(g.sample_size)));
  test("6 payments and Apollo are not launch-quality gates", poor.gates.every((g) => !/payment|apollo/i.test(g.id + g.label)));
  const first = buildControlPlaneMemoryRecord({ control_plane: plane(0), launch_readiness: poor });
  const same = buildControlPlaneMemoryRecord({ control_plane: plane(0), launch_readiness: poor });
  const changed = buildControlPlaneMemoryRecord({ control_plane: plane(4), launch_readiness: better });
  test("7 snapshot key is idempotent for identical evidence", first.snapshot_key === same.snapshot_key);
  test("8 changed empirical evidence creates new durable snapshot", first.snapshot_key !== changed.snapshot_key);
  let writes = 0;
  const db = { from: () => ({ upsert: async () => { writes++; return { error: null }; } }) };
  const persisted = await persistControlPlaneMemory(db as never, first);
  test("9 persistence uses server store and reports outcome", persisted.persisted && writes === 1);
  const primary = ADMIN_NAVIGATION.flatMap((s) => s.items);
  test("10 Admin IA has four named operational groups", ADMIN_NAVIGATION.length === 4 && new Set(ADMIN_NAVIGATION.map((s) => s.id)).size === 4);
  test("11 every primary surface has explicit operational purpose", primary.every((item) => item.purpose.length > 5));
  test("12 duplicate legacy source and Vault surfaces leave primary navigation", ADMIN_DEPRECATED_NAVIGATION.some((x) => x.href === "/admin/sources") && !primary.some((x) => x.href === "/admin/sources"));
  const layout = readFileSync(path.join(process.cwd(), "app/admin/_components/AdminLayout.tsx"), "utf8");
  const beta = readFileSync(path.join(process.cwd(), "app/admin/beta-readiness/page.tsx"), "utf8");
  const route = readFileSync(path.join(process.cwd(), "app/api/admin/intelligence/launch-readiness/route.ts"), "utf8");
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/055_intelligence_control_plane_memory.sql"), "utf8");
  test("13 navigation renders canonical IA registry", /ADMIN_NAVIGATION\.map/.test(layout));
  test("14 old localStorage readiness is removed", !/localStorage|MANUAL_KEY|manualDone/.test(beta));
  test("15 readiness endpoint is Admin protected and private", /requireAdmin\(req\)/.test(route) && /private, no-store/.test(route));
  test("16 durable telemetry is RLS-on and service-role-only", /enable row level security/i.test(migration) && /no anon\/authenticated policies/i.test(migration));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((error) => { console.error(error); process.exit(1); });
