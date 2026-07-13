#!/usr/bin/env node
// Static smoke checks for Vault Generation Ops (async lifecycle).
// Usage: npm run smoke:vault-generation-ops

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, ok: !!fn() }); }
  catch (err) { results.push({ name, ok: false, err: err.message }); }
};
const read = (p) => readFileSync(join(root, p), "utf8");

const GEN = "app/api/admin/vault-report-bridge/generate/route.ts";
const QUEUE = "lib/vault/vault-generation.ts";
const PROC = "app/api/internal/vault-report-bridge/process/route.ts";
const STORE = "lib/storage/vault-generation-store.ts";
const RETRY = "app/api/admin/vault-report-bridge/runs/[jobId]/retry/route.ts";
const RELEASE = "app/api/admin/vault-report-bridge/runs/[jobId]/release-reservations/route.ts";
const RUNS = "app/api/admin/vault-report-bridge/runs/route.ts";
const UI = "app/admin/vault-report-bridge/page.tsx";

check("Generate route is async (202)", () => read(GEN).includes("202") && read(GEN).includes("queueVaultGeneration"));
check("Queue reserves before creating the job trigger", () => {
  const src = read(QUEUE);
  return src.indexOf("reserveVaultOpportunitiesForRun(") < src.indexOf("createVaultGenerationJob(") &&
    src.indexOf("createVaultGenerationJob(") < src.indexOf("triggerVaultGenerationProcessor(jobId)");
});
check("Internal processor exists and checks x-internal-secret", () => read(PROC).includes("x-internal-secret") && read(PROC).includes("INTERNAL_RUN_SECRET"));
check("Processor fails closed in production without secret", () => read(PROC).includes('NODE_ENV === "production"') && read(PROC).includes("403"));
check("Processor idempotent: completed jobs never reprocess", () => read(STORE).includes('"completed"') && read(STORE).includes("nothing to do"));
check("Processor claim blocks concurrent duplicates", () => read(STORE).includes("processor_started_at") && read(STORE).includes("isProcessingFresh"));
check("Usage recorded only after report persistence", () => {
  const src = read(PROC);
  return src.indexOf("completeVaultGenerationJob(") < src.indexOf("recordVaultOpportunitiesUsed(");
});
check("Processor releases reservations on failure", () => {
  const src = read(PROC);
  return src.includes("releaseVaultReservationsForFailedRun(") && src.includes("failVaultGenerationJob(");
});
check("Completed report_json never carries criteria/vault ids", () => {
  const src = read(STORE);
  return src.includes('source_mode: "vault", generated_by: "admin", completed_at') && !/report,\s*_vault_generation:\s*meta/.test(src);
});
check("Retry route exists, admin-protected, refuses completed", () => {
  const src = read(RETRY);
  return src.includes("requireAdmin") && src.includes('"completed"') && src.includes("409");
});
check("Retry re-validates via fresh selection (queueVaultGeneration)", () => read(RETRY).includes("queueVaultGeneration"));
check("Release route exists, admin-protected, refuses fresh processing", () => {
  const src = read(RELEASE);
  return src.includes("requireAdmin") && src.includes("isProcessingFresh");
});
check("Runs list route admin-protected", () => read(RUNS).includes("requireAdmin"));
check("Preview/dry-run still side-effect-free", () => {
  return ["preview", "dry-run"].every((r) => {
    const src = read(`app/api/admin/vault-report-bridge/${r}/route.ts`);
    return !src.includes("reserveVault") && !src.includes("recordVault") && !src.includes("queueVaultGeneration");
  });
});
check("No Apollo in ops path", () => [GEN, QUEUE, PROC, STORE, RETRY, RELEASE].every((f) => !/apollo/i.test(read(f))));
check("No LinkedIn in ops path", () => {
  const strip = (s) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return [GEN, QUEUE, PROC, STORE].every((f) => !/linkedin/i.test(strip(read(f))));
});
check("No public bridge/processor route", () => !existsSync(join(root, "app/api/vault-report-bridge")) && !existsSync(join(root, "app/vault-report-bridge")));
check("No service role leak in ops files", () => [GEN, QUEUE, PROC, RETRY, RELEASE, RUNS, UI].every((f) => !read(f).includes("SERVICE_ROLE")));
check("Admin UI shows processing state + runs section", () => {
  const src = read(UI);
  return src.includes("Queue Vault report generation") && src.includes("Report is processing") &&
    src.includes("Recent Vault generation runs") && src.includes("vault-generation-ops-v0");
});
check("Admin UI surfaces retry/release/stuck", () => {
  const src = read(UI);
  return src.includes('"retry"') && src.includes("release-reservations") && src.includes("stale");
});
check("AI readiness check implemented (key presence + opt-in probe)", () => {
  const src = read("scripts/check-supabase-readiness.mjs");
  return src.includes("ANTHROPIC_API_KEY") && src.includes("ALLOW_AI_HEALTH_PROBE") && src.includes("credits NOT verified");
});
check("Pending demo signal approval script exists and guards non-demo", () => {
  const src = read("scripts/approve-demo-vault-signals.mjs");
  return src.includes("pending_review") && src.includes("FORCE") && src.includes("skip (non-demo");
});

const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.err ? ` — ${r.err}` : ""}`);
console.log(`\nResult: ${passed} passed, ${results.length - passed} failed.`);
process.exit(passed === results.length ? 0 : 1);
