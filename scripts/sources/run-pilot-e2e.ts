import { loadEnvConfig } from "@next/env";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluatePilotPreflight } from "../../lib/ops/pilot-preflight";
import { evaluatePilotHealth } from "../../lib/ops/pilot-run-gate";

loadEnvConfig(process.cwd());

const CONFIRMATION = "RUN_WITHIN_CONFIRMED_BUDGET";
async function main() {
const preflight = evaluatePilotPreflight();
if (!preflight.ready) {
  console.error(JSON.stringify(preflight, null, 2));
  console.error("STOPPED before health probes: configuration preflight is red.");
  process.exit(2);
}
if (process.env.PILOT_E2E_CONFIRM !== CONFIRMATION) {
  console.error(`STOPPED before health probes: set PILOT_E2E_CONFIRM=${CONFIRMATION} for this intentional run only.`);
  process.exit(3);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = join("ml", "data", "pilot-e2e", stamp);
mkdirSync(runDir, { recursive: true });

const git = (args: string[]) => {
  try { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
  catch { return "unavailable"; }
};
const commit = git(["rev-parse", "--short", "HEAD"]);
const dirty = git(["status", "--porcelain"]) !== "";

const { getUsage } = await import("../../lib/ops/usage-ledger");
const usageBefore = getUsage();
const { probeAll } = await import("../../lib/ops/provider-health");
const statuses = await probeAll(true);
const publicHealth = statuses.map(({ id, name, configured, state, state_kind, detail, latency_ms, credits, probed_at }) => ({
  id, name, configured, state, state_kind, detail, latency_ms, credits, probed_at,
}));
const healthGate = evaluatePilotHealth(statuses);
writeFileSync(join(runDir, "health.json"), JSON.stringify({ preflight, healthGate, providers: publicHealth }, null, 2));

if (!healthGate.ready) {
  writeFileSync(join(runDir, "STOPPED.txt"), `${healthGate.blockers.join("\n")}\nNo benchmark was executed.\n`);
  console.error(JSON.stringify(healthGate, null, 2));
  console.error(`STOPPED after minimal health probes. Evidence: ${runDir}`);
  process.exit(4);
}

const benchmarkDir = join("ml", "data", "company-first");
const before = new Set(existsSync(benchmarkDir) ? readdirSync(benchmarkDir) : []);
const startedAt = new Date().toISOString();
const benchmark = spawnSync("npm", ["run", "bench:company-first"], { stdio: "inherit", env: process.env });
if (benchmark.status !== 0) {
  writeFileSync(join(runDir, "STOPPED.txt"), `Benchmark failed with exit ${benchmark.status ?? "unknown"}.\n`);
  process.exit(benchmark.status ?? 5);
}

const after = existsSync(benchmarkDir) ? readdirSync(benchmarkDir) : [];
const outputName = after.filter((name) => !before.has(name) && name.startsWith("benchmark-") && name.endsWith(".json")).sort().at(-1);
if (!outputName) {
  writeFileSync(join(runDir, "STOPPED.txt"), "Benchmark returned success but produced no new JSON artifact.\n");
  process.exit(6);
}
const benchmarkSource = join(benchmarkDir, outputName);
cpSync(benchmarkSource, join(runDir, "benchmark.json"));
const benchmarkJson = JSON.parse(readFileSync(benchmarkSource, "utf8")) as { results?: Array<{ metrics?: { deep_trace?: unknown[] } }> };
const deepTrace = benchmarkJson.results?.flatMap((result) => result.metrics?.deep_trace ?? []) ?? [];
writeFileSync(join(runDir, "deep-trace.json"), JSON.stringify(deepTrace, null, 2));

const usageAfter = getUsage();
writeFileSync(join(runDir, "manifest.json"), JSON.stringify({
  version: "pilot-e2e-harness-v1",
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  git_commit: commit,
  working_tree_dirty: dirty,
  max_budget_usd: preflight.max_budget_usd,
  provider_health: "confirmed_by_provider",
  provider_calls_made: true,
  operating_mode: healthGate.operating_mode,
  benchmark_artifact: "benchmark.json",
  deep_trace_artifact: "deep-trace.json",
  usage_before: usageBefore,
  usage_after: usageAfter,
  next_manual_sequence: [
    "Human-adjudicate every emitted opportunity and high-score rejection.",
    "Run Preview in /admin/pilot with the approved ICP; record time/cost/output.",
    "Run Brief with the same ICP; record incremental evidence and decision value.",
    "Complete comparison.md; do not deliver until every critical rubric item passes.",
  ],
}, null, 2));

writeFileSync(join(runDir, "adjudication.csv"), [
  "run_id,icp_id,company,domain,event_date,source_url,identity_pass,role_pass,date_pass,evidence_pass,fit_pass,counterevidence_pass,no_pii,no_mock,coverage_disclosed,verdict,error_class,severity,reviewer_notes,future_outcome",
].join("\n"));
writeFileSync(join(runDir, "comparison.md"), `# Preview vs Brief\n\n- Run: ${stamp}\n- Commit: ${commit}\n- ICP: [fill]\n- Preview job/time/cost: [fill]\n- Brief job/time/cost: [fill]\n- Opportunities shared: [fill]\n- Incremental verified evidence in Brief: [fill]\n- Decision value added by Brief: [fill]\n- Consistency issues: [fill]\n- Human verdict: [PASS/FAIL]\n`);

console.log(`Harness complete. Human QA artifacts: ${runDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
