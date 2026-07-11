#!/usr/bin/env node
// Static smoke checks for Vault-powered report generation.
// Usage: npm run smoke:vault-report-generation

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

check("Generate route exists", () => existsSync(join(root, GEN)));
check("Generate route requires admin", () => read(GEN).includes("requireAdmin"));
check("Generate reserves before pipeline", () => {
  const src = read(GEN);
  return src.indexOf("reserveVaultOpportunitiesForRun(") < src.indexOf("runLeadLensPipeline(");
});
check("Usage recorded only after successful persistence", () => {
  const src = read(GEN);
  const complete = src.indexOf("completeSnapshot(");
  const usage = src.indexOf("recordVaultOpportunitiesUsed(");
  return complete !== -1 && usage !== -1 && usage > complete;
});
check("Reservations released on failure", () => {
  const src = read(GEN);
  return src.includes("releaseVaultReservationsForFailedRun(") && src.indexOf("releaseVaultReservationsForFailedRun(") > src.indexOf("catch");
});
check("Failed runs mark snapshot failed", () => read(GEN).includes("failSnapshot("));
check("customer_email required", () => read(GEN).includes("customer_email is required"));
check("Pipeline consumes candidatesOverride (no provider discovery)", () => {
  return read(GEN).includes("candidatesOverride") && read("lib/pipeline.ts").includes("candidatesOverride") &&
    read("lib/pipeline.ts").includes("provider discovery skipped");
});
check("Preview does NOT reserve or record usage", () => {
  const src = read("app/api/admin/vault-report-bridge/preview/route.ts");
  return !src.includes("reserveVault") && !src.includes("recordVault") && !src.includes("createVaultReservation");
});
check("Dry-run does NOT reserve or record usage", () => {
  const src = read("app/api/admin/vault-report-bridge/dry-run/route.ts");
  return !src.includes("reserveVault") && !src.includes("recordVault") && !src.includes("createVaultReservation");
});
check("Adapter still creates no contacts/emails", () => {
  const src = read("lib/vault/vault-to-lead-candidate.ts");
  return !/email:\s*["'`]/.test(src) && !/\btitle:\s*["'`]/.test(src) && src.includes("account-level");
});
check("No Apollo in generation path", () => [GEN, "lib/vault/vault-opportunity-selector.ts", "lib/vault/vault-to-lead-candidate.ts"].every((f) => !/apollo/i.test(read(f))));
check("No LinkedIn in generation path", () => {
  const strip = (s) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return [GEN, "lib/vault/vault-opportunity-selector.ts", "lib/vault/vault-to-lead-candidate.ts"].every((f) => !/linkedin/i.test(strip(read(f))));
});
check("No public generate route", () => !existsSync(join(root, "app/api/vault-report-bridge")) && !existsSync(join(root, "app/vault-report-bridge")));
check("No service role leak in generate/UI", () => [GEN, "app/admin/vault-report-bridge/page.tsx"].every((f) => !read(f).includes("SERVICE_ROLE")));
check("Admin UI has generate control with warning", () => {
  const src = read("app/admin/vault-report-bridge/page.tsx");
  return src.includes("Generate customer report from Vault") && src.includes("customer-accessible report") && src.includes("vault-generation-v0");
});

const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.err ? ` — ${r.err}` : ""}`);
console.log(`\nResult: ${passed} passed, ${results.length - passed} failed.`);
process.exit(passed === results.length ? 0 : 1);
