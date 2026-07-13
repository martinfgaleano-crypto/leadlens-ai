#!/usr/bin/env node
// Static smoke checks for Customer-facing Vault Delivery v1.
// Usage: npm run smoke:customer-vault-delivery

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, ok: !!fn() }); }
  catch (err) { results.push({ name, ok: false, err: err.message }); }
};
const read = (p) => readFileSync(join(root, p), "utf8");

const DASH = "app/dashboard/page.tsx";
const LIST = "app/dashboard/searches/page.tsx";
const DETAIL = "app/dashboard/searches/[id]/page.tsx";
const RESULTS = "app/results/[jobId]/page.tsx";
const RESULTS_API = "app/api/results/[jobId]/route.ts";
const OVERVIEW = "app/api/monitor/overview/route.ts";
const BRIDGE_UI = "app/admin/vault-report-bridge/page.tsx";
const GEN = "app/api/admin/vault-report-bridge/generate/route.ts";
const PROC = "app/api/internal/vault-report-bridge/process/route.ts";
const STORE = "lib/storage/vault-generation-store.ts";

check("Dashboard has latest report card + delivery marker", () => {
  const src = read(DASH);
  return src.includes("Open latest report") && src.includes("customer-vault-delivery-v1");
});
check("Dashboard covers processing / ready / empty states", () => {
  const src = read(DASH);
  return src.includes("being generated") && src.includes("first opportunity report") || (src.includes("being generated") && src.includes("first monitor"));
});
check("Monitor list shows latest report status/open link", () => {
  const src = read(LIST);
  return src.includes("latest_report_job_id") && src.includes("/results/");
});
check("Monitor detail has run/report history with polling", () => {
  const src = read(DETAIL);
  return src.includes("/runs") && src.includes("latest_report_job_id") && /poll/i.test(src);
});
check("Overview scopes reports to the authenticated user's searches", () => {
  const src = read(OVERVIEW);
  return src.includes("Bearer") && src.includes('eq("user_id", user.id)');
});
check("Results page handles processing and failed with customer-safe copy", () => {
  const src = read(RESULTS);
  return src.includes('"processing"') && src.includes('"failed"') && !/anthropic|billing|credit/i.test(src);
});
check("Results API hides internals on failed (no report_json, no user_id)", () => {
  const src = read(RESULTS_API);
  return src.includes("user_id intentionally omitted") && !src.match(/status === "failed"[\s\S]{0,400}report_json/);
});
check("No Vault/reservation IDs in customer components", () => {
  return [DASH, LIST, DETAIL, RESULTS].every((f) => {
    const src = read(f);
    return !src.includes("vault_company_id") && !src.includes("vault_signal_id") && !src.includes("reservation");
  });
});
check("Feedback carries job_id + search_id linkage", () => {
  const migration = read("supabase/migrations/023_opportunity_feedback.sql");
  return migration.includes("job_id") && migration.includes("search_id");
});
check("Generate reports workspace visibility (search_id contract)", () => {
  const src = read(GEN);
  return src.includes("workspace_visible") && src.includes("link-only");
});
check("Runs list exposes delivery (workspace vs link_only) to admin", () => {
  return read(STORE).includes('"link_only"') && read(BRIDGE_UI).includes('"workspace" ? "workspace" : "link-only"') || (read(STORE).includes("link_only") && read(BRIDGE_UI).includes("link-only"));
});
check("Bridge form has search_id linking field", () => read(BRIDGE_UI).includes("search_id") && read(BRIDGE_UI).includes("Link to monitor"));
check("Processor sends workspace notification on linked completion", () => {
  const src = read(PROC);
  return src.includes("createNotification") && src.includes("Your report is ready") && src.includes("meta.search_id");
});
check("Notification is best-effort (never blocks delivery)", () => read(PROC).includes("notifications never block delivery"));
check("Completed report marker carries no criteria/vault ids", () => {
  const src = read(STORE);
  return !/completed_at.*criteria/.test(src) && !/completed_at.*vault_company_ids/.test(src);
});
check("Admin/internal routes still protected", () => {
  return read(GEN).includes("requireAdmin") && read(PROC).includes("x-internal-secret");
});
// DETAIL keeps a legacy "apollo_leads_used" stat field from before licensed-only;
// this sprint's surfaces (dashboard, list, generate, processor) must stay clean.
check("No Apollo in customer delivery path", () => [DASH, LIST, GEN, PROC].every((f) => !/apollo/i.test(read(f))));
check("No LinkedIn in delivery additions", () => {
  const strip = (s) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return [GEN, PROC, STORE].every((f) => !/linkedin/i.test(strip(read(f))));
});
check("No service role leak in customer pages", () => [DASH, LIST, DETAIL, RESULTS].every((f) => !read(f).includes("SERVICE_ROLE")));
check("No pricing/payment files touched by delivery path", () => {
  return !read(GEN).includes("price") && !read(PROC).includes("lemonsqueezy") && !/\$\d/.test(read(BRIDGE_UI));
});

const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.err ? ` — ${r.err}` : ""}`);
console.log(`\nResult: ${passed} passed, ${results.length - passed} failed.`);
process.exit(passed === results.length ? 0 : 1);
