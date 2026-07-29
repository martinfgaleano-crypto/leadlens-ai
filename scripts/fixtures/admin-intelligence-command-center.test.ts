import { readFileSync } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  ADMIN_INTELLIGENCE_VIEW_VERSION, buildAdminIntelligenceViewModel,
  loadAdminIntelligenceViewModel, type AdminIntelligenceLoadedData,
} from "@/lib/intelligence/admin-view-model";
import { loadSnapshotInputs } from "@/lib/intelligence/snapshot-loader";
import { GET } from "@/app/api/admin/intelligence/command-center/route";

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
  test("14 readiness exposes blockers", local.snapshot.readiness.blockers.length > 0 && /Current blockers/.test(pageSource));
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
  test("26 no Amor-specific presentation", !/Amor de Gea|amor-de-gea/i.test(pageSource));
  test("27 all eight dimensions present", local.snapshot.index.dimensions.length === 8);
  test("28 observation pattern production is forbidden", local.snapshot.patterns.every((p) => p.mode !== "production"));
  test("29 outputs retain ranking off", local.snapshot.outputs.every((o) => o.ranking_impact === "none"));
  test("30 trends remain explicitly uninstrumented", /not instrumented/.test(local.empty_states.trends));
  test("31 lift remains explicit not measured", /Not measured/.test(local.empty_states.lift));
  test("32 no historical persistence added", !/intelligence_index_snapshots/.test(loaderSource + routeSource));
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
  if (saved.node === undefined) delete env.NODE_ENV; else env.NODE_ENV = saved.node;
  if (saved.secret === undefined) delete env.ADMIN_SESSION_SECRET; else env.ADMIN_SESSION_SECRET = saved.secret;
  if (saved.token === undefined) delete env.ADMIN_SECRET_TOKEN; else env.ADMIN_SECRET_TOKEN = saved.token;
  if (saved.bypass === undefined) delete env.ADMIN_LOCAL_BYPASS; else env.ADMIN_LOCAL_BYPASS = saved.bypass;

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((error) => { console.error(error); process.exit(1); });
