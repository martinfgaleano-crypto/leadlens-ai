import { readFileSync, mkdtempSync } from "fs";
import os from "node:os";
import path from "path";
import { NextRequest } from "next/server";
import {
  ADMIN_INTELLIGENCE_VIEW_VERSION, buildAdminIntelligenceViewModel,
  loadAdminIntelligenceViewModel, type AdminIntelligenceLoadedData,
} from "@/lib/intelligence/admin-view-model";
import { loadSnapshotInputs } from "@/lib/intelligence/snapshot-loader";
import { GET } from "@/app/api/admin/intelligence/command-center/route";
import { buildControlPlaneMemoryRecord } from "@/lib/intelligence/control-plane-store";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import type { ControlPlaneValidationEvidenceV1 } from "@/lib/intelligence/control-plane-validation-evidence";
import validationEvidenceJson from "@/ml/data/acceptance/control-plane-validation-evidence-positive-commercial-case-v1.json";

let passed = 0, failed = 0;
const test = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : ` (${detail})`}`);
  ok ? passed++ : failed++;
};
const ROOT = process.cwd();
const NOW = "2026-07-29T14:00:00.000Z";
const pageSource = readFileSync(path.join(ROOT, "app/admin/intelligence/page.tsx"), "utf8");
const loaderSource = readFileSync(path.join(ROOT, "lib/intelligence/admin-view-model.ts"), "utf8");
const routeSource = readFileSync(path.join(ROOT, "app/api/admin/intelligence/command-center/route.ts"), "utf8");

async function run() {
  const local = await loadAdminIntelligenceViewModel({ root: ROOT, now: NOW, db: null });
  test("1 loader returns versioned real snapshot", local.version === ADMIN_INTELLIGENCE_VIEW_VERSION && local.snapshot.id.startsWith("snapshot:"));
  test("2 DB-unavailable mode remains honest", local.availability.database === "unavailable" && local.feedback.total_events === null);
  test("3 unavailable DB metrics do not become zero", local.knowledge.vault_records === null && local.feedback.with_snapshot === null);
  test("4 unmeasured dimensions expose state and reason", local.snapshot.index.dimensions.filter((d) => d.measurement.state !== "measured").every((d) => "reason" in d.measurement));
  test("5 capability map uses snapshot assessments", local.snapshot.capability_assessments.length >= 25 && /snapshot\.capability_assessments/.test(pageSource));
  test("6 current artifact produces six real outputs", local.snapshot.outputs.length === 6, `got ${local.snapshot.outputs.length}`);
  test("7 output validation/eligibility preserved", local.snapshot.outputs.every((o) => o.validation_state === "unreviewed" && o.report_eligibility === "not_eligible"));
  test("8 zero patterns has informative empty state", local.snapshot.patterns.length === 0 && /No valid patterns yet/.test(local.empty_states.patterns));
  test("9 pattern threshold is canonical", local.pattern_threshold === 5 && /pattern_threshold/.test(loaderSource));
  test("10 validation funnel derives real counts", local.snapshot.validation_summary.output_count === 6 && local.snapshot.validation_summary.reviewed_count === 0);
  test("11 zero outcomes explains performance", /Fewer than five attributable outcomes/.test(local.empty_states.outcomes));
  test("12 gaps ordered by priority", local.snapshot.gaps.every((g, i, rows) => i === 0 || rows[i - 1].priority >= g.priority));
  test("13 actions derived from gaps", local.snapshot.actions.length === local.snapshot.gaps.length && local.snapshot.actions.every((a) => a.affected_gaps.length > 0));
  test("14 canonical readiness surface never substitutes legacy snapshot readiness", /model\.canonical\.launch_readiness/.test(pageSource) && !/const r = model\.snapshot\.readiness/.test(pageSource));
  test("15 zero corroboration is explained", local.evidence.corroborated === 0 && /0 corroborated evidence items/.test(local.evidence.explanation));
  test("16 knowledge is labeled infrastructure", local.knowledge.label === "Knowledge Infrastructure" && /do not directly determine Intelligence Maturity/.test(local.knowledge.disclaimer));
  test("17 limitations derive from gaps", local.unsupported_claims.length > 0 && local.unsupported_claims.some((x) => local.snapshot.gaps.some((g) => g.impact === x)));
  test("18 unreviewed output creates no customer claim", local.snapshot.readiness.customer_safe_outputs.every((id) => !local.snapshot.outputs.some((o) => o.id === id && o.human_review_state === "unreviewed")));
  test("19 patterns cannot affect ranking", local.snapshot.patterns.every((p) => p.ranking_impact === "off"));
  test("20 no provider call in loader", !/searchWeb|tavily|serper|provider.*search|anthropic|openai/i.test(loaderSource));
  test("21 no LLM call during page render", !/anthropic|openai|generateText|chat\.completions/i.test(pageSource + routeSource));
  test("22 route uses Admin gate", /requireAdmin\(req\)/.test(routeSource));
  test("23 route is private no-store", /private, no-store/.test(routeSource));
  test("24 every major tab has content code", ["Overview","Capabilities","Outputs","Patterns","Validation","Gaps & Actions","Readiness","Evidence"].every((x) => pageSource.includes(x)));
  test("25 useful error fallback exists", /No values have been replaced with fabricated zeros/.test(pageSource) && /Retry/.test(pageSource));
  test("26 canonical pilot remains linked without stale manually maintained counts",
    pageSource.includes("/admin/intelligence/pilots/amor-de-gea") &&
    !pageSource.includes('value="17"') &&
    !pageSource.includes('value="10"'));
  test("27 all eight dimensions present", local.snapshot.index.dimensions.length === 8);
  test("28 observation pattern production is forbidden", local.snapshot.patterns.every((p) => p.mode !== "production"));
  test("29 outputs retain ranking off", local.snapshot.outputs.every((o) => o.ranking_impact === "none"));
  test("30 trends remain explicitly uninstrumented", /not instrumented/.test(local.empty_states.trends));
  test("31 lift remains explicit not measured", /Not measured/.test(local.empty_states.lift));
  test("32 command-center reads canonical durable score history without writing snapshots", /loadControlPlaneHistory/.test(loaderSource) && !/persistControlPlaneMemory/.test(loaderSource + routeSource));
  test("33 source links preserved", ["growth","review","sources","source-review"].every((x) => pageSource.includes(`/admin/intelligence/${x}`)));
  test("34 page performs one command-center load", (pageSource.match(/adminFetch\("\/api\/admin\/intelligence\/command-center"/g) ?? []).length === 1);

  const input = await loadSnapshotInputs({ root: ROOT, now: NOW });
  const fallbackData: AdminIntelligenceLoadedData = {
    input,
    feedback: { available: false, total_events: null, with_reason_codes: null, with_snapshot: null, with_versions: null, sentiment: null, top_reason_codes: [], reason: "fixture unavailable" },
    availability: { artifact: "available", database: "partial", validation_persistence: "migration_missing", learned_preferences: "unavailable", message: "partial fixture" },
  };
  const partial = buildAdminIntelligenceViewModel(fallbackData);
  test("35 partial mode retains artifact intelligence", partial.snapshot.outputs.length === 6 && partial.availability.database === "partial");

  const env = process.env as Record<string, string | undefined>;
  const saved = { node: env.NODE_ENV, secret: env.ADMIN_SESSION_SECRET, token: env.ADMIN_SECRET_TOKEN, bypass: env.ADMIN_LOCAL_BYPASS };
  Object.assign(env, { NODE_ENV: "production", ADMIN_SESSION_SECRET: "command-center-test-secret" });
  delete env.ADMIN_SECRET_TOKEN; delete env.ADMIN_LOCAL_BYPASS;
  const denied = await GET(new NextRequest("https://leadlensintel.com/api/admin/intelligence/command-center"));
  test("36 normal user is denied by command-center API", denied.status === 401);
  test("37 command center exposes the canonical automatic capability registry", local.control_plane.capabilities.length === 47);
  const dynamicDiscovery = local.control_plane.capabilities.find((c) => c.capability.id === "dynamic_universe_discovery");
  test("38 latest bounded capture evidence validates retrieval while preserving the customer-safe Case blocker",
    dynamicDiscovery?.state === "live_validated" && dynamicDiscovery.blockers.some((b) => /no customer-safe Case has been human-confirmed/i.test(b)));
  test("39 global score is anti-inflation capped while no human-positive Case exists",
    local.control_plane.overall.state === "measured" && local.control_plane.overall.score <= 59);
  test("40 command center no longer carries manually maintained pilot counts", !pageSource.includes('value="17"') && !pageSource.includes('value="10"'));
  test("41 Intelligence Score reuses canonical Control Plane overall", local.intelligence_score.score === (local.control_plane.overall.state === "measured" ? local.control_plane.overall.score : null));
  test("42 UI distinguishes Intelligence Score from Launch Readiness", pageSource.includes("Intelligence Score") && pageSource.includes("Launch Readiness") && pageSource.includes("intelligence_score"));
  test("43 component scores are explainable and sample-aware", local.intelligence_score.components.length === 8 && local.intelligence_score.components.every((component) => component.sample_size >= 0 && component.state));

  const durablePlane = {
    ...local.control_plane,
    generated_at: "2026-08-28T12:00:00.000Z",
    overall: { state: "measured" as const, score: 76, confidence: 0.84, sample_size: 8 },
    overall_confidence: "high" as const,
    validation_evidence: [validationEvidenceJson as ControlPlaneValidationEvidenceV1],
  };
  const durableReadiness = {
    ...buildLaunchReadiness({ now: "2026-08-28T12:00:00.000Z", control_plane: durablePlane, database_available: true, production_config: { supabase: true, admin_auth: true, internal_run_auth: true, app_url: true, demo_off: true } }),
    score: 72, level: "guided_beta" as const,
  };
  const durableRecord = buildControlPlaneMemoryRecord({ control_plane: durablePlane, launch_readiness: durableReadiness });
  const emptyRoot = mkdtempSync(path.join(os.tmpdir(), "leadlens-command-center-parity-"));
  const emptyInput = await loadSnapshotInputs({ root: emptyRoot, now: "2026-08-28T13:00:00.000Z" });
  const durableFallback = buildAdminIntelligenceViewModel({ ...fallbackData, input: emptyInput, control_plane_history: [durableRecord] });
  test("44 local acceptance artifacts absent falls back to latest durable canonical plane", durableFallback.canonical.source === "last_durable_evaluation" && durableFallback.intelligence_score.score === 76);
  test("45 Evidence may remain unmeasured while canonical overall remains measured", durableFallback.intelligence_score.components.find((item) => item.id === "evidence")?.score === null && durableFallback.control_plane.overall.state === "measured" && durableFallback.intelligence_score.score === 76);
  test("46 human-positive durable validation removes the false no-commercial-outcome diagnosis", durableFallback.canonical.human_validation.positive_cases === 3 && !pageSource.includes("no commercial outcome"));
  test("47 Intelligence OS exposes the same durable readiness score and stage", durableFallback.launch_readiness_summary?.score === 72 && durableFallback.canonical.launch_readiness?.level === "guided_beta");
  test("48 stale local diagnosis no longer drives canonical Overview", !/snapshot\.diagnosis\.(headline|strongest_capability|weakest_capability|top_bottleneck|highest_leverage_action)/.test(pageSource));
  test("49 canonical source, freshness and human validation are visible", /model\.canonical\.(source|source_data_cutoff|human_validation)/.test(pageSource));
  if (saved.node === undefined) delete env.NODE_ENV; else env.NODE_ENV = saved.node;
  if (saved.secret === undefined) delete env.ADMIN_SESSION_SECRET; else env.ADMIN_SESSION_SECRET = saved.secret;
  if (saved.token === undefined) delete env.ADMIN_SECRET_TOKEN; else env.ADMIN_SECRET_TOKEN = saved.token;
  if (saved.bypass === undefined) delete env.ADMIN_LOCAL_BYPASS; else env.ADMIN_LOCAL_BYPASS = saved.bypass;

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((error) => { console.error(error); process.exit(1); });
