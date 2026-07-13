#!/usr/bin/env node
// Beta E2E readiness — deterministic checks, NO paid AI calls.
// Answers: is the code path for a first real beta delivery in place?
// Operational items (Anthropic credits, Vercel APP_URL) are reported as
// manual checks, not silently assumed.
// Usage: npm run test:beta-e2e-readiness

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, has } from "./lib/load-env.mjs";

const root = process.cwd();
const env = loadEnv();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, ok: !!fn() }); }
  catch (err) { results.push({ name, ok: false, err: err.message }); }
};
const read = (p) => readFileSync(join(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));

// ── Chain components exist ──
check("Supabase env configured (schema check via probe:supabase)", () => has(env, "NEXT_PUBLIC_SUPABASE_URL") && has(env, "SUPABASE_SERVICE_ROLE_KEY"));
check("All chain commands registered", () => [
  "check:supabase", "probe:supabase", "seed:vault-bridge-demo", "test:vault-bridge",
  "smoke:vault", "smoke:lead-hunter", "smoke:vault-bridge", "smoke:vault-report-generation",
  "smoke:vault-generation-ops", "smoke:customer-vault-delivery", "approve:demo-signals",
].every((s) => !!pkg.scripts[s]));
check("Generate route + internal processor exist", () =>
  existsSync(join(root, "app/api/admin/vault-report-bridge/generate/route.ts")) &&
  existsSync(join(root, "app/api/internal/vault-report-bridge/process/route.ts")));
check("search_id delivery contract in generate + admin UI", () => {
  return read("app/api/admin/vault-report-bridge/generate/route.ts").includes("workspace_visible") &&
    read("app/admin/vault-report-bridge/page.tsx").includes("Link to monitor");
});
check("Workspace latest report card exists", () => read("app/dashboard/page.tsx").includes("Open latest report"));
check("Monitor detail report history exists", () => read("app/dashboard/searches/[id]/page.tsx").includes("latest_report_job_id"));
check("Selection dedupes accounts (no company twice in a report)", () => read("lib/vault/vault-opportunity-selector.ts").includes("seenAccounts"));
check("Feedback attaches job/search/user", () => {
  const src = read("app/api/feedback/opportunity/route.ts");
  return src.includes("job_id") && src.includes("search_id") && src.includes("feedbackUserId");
});
check("Admin delivery pills (workspace/link-only)", () => read("app/admin/vault-report-bridge/page.tsx").includes("link-only"));
check("Notification on linked completion", () => read("app/api/internal/vault-report-bridge/process/route.ts").includes("Your report is ready"));

// ── Safety ──
check("No internal metadata in customer components", () => {
  return ["app/dashboard/page.tsx", "app/dashboard/searches/page.tsx", "app/results/[jobId]/page.tsx"].every((f) => {
    const src = read(f);
    return !src.includes("vault_company_id") && !src.includes("reservation") && !src.includes("_vault_generation");
  });
});
check("Customer APIs require JWT; monitor scope by user_id", () => {
  const src = read("app/api/monitor/overview/route.ts");
  return src.includes("Bearer") && src.includes('eq("user_id", user.id)');
});
check("No Apollo/LinkedIn/outreach claims on customer surfaces", () => {
  return ["app/dashboard/page.tsx", "app/dashboard/searches/page.tsx"].every((f) => {
    const src = read(f);
    return !/apollo|linkedin|automatic outreach|emails sent/i.test(src);
  });
});
check("Env check covers Anthropic readiness + APP_URL", () => {
  const src = read("scripts/check-supabase-readiness.mjs");
  return src.includes("ANTHROPIC_API_KEY") && src.includes("NEXT_PUBLIC_APP_URL");
});
check("Runbook exists (LEADLENS_BETA_E2E_TRIAL_RUN.md)", () => existsSync(join(root, "docs/strategy/LEADLENS_BETA_E2E_TRIAL_RUN.md")));

// ── Operational (manual) ──
const manual = [];
if (!has(env, "ANTHROPIC_API_KEY")) manual.push("Set ANTHROPIC_API_KEY.");
manual.push("Verify Anthropic credits: ALLOW_AI_HEALTH_PROBE=true npm run check:supabase (must NOT fail).");
manual.push("Verify Vercel NEXT_PUBLIC_APP_URL is exactly the deployed URL — no trailing '=' or spaces.");
const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
check("Local NEXT_PUBLIC_APP_URL has no trailing junk", () => appUrl === "" || /^https?:\/\/[^\s=]+[^\s=/]$/.test(appUrl.replace(/\/$/, "")));

const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.err ? ` — ${r.err}` : ""}`);
console.log("\nManual operational items before a real beta delivery:");
for (const m of manual) console.log(`  ▢ ${m}`);
console.log(`\nResult: ${passed} passed, ${results.length - passed} failed.`);
process.exit(passed === results.length ? 0 : 1);
