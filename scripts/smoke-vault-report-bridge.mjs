#!/usr/bin/env node
// Static smoke checks for the Vault → Report pipeline bridge.
// Usage: npm run smoke:vault-bridge

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];
const check = (name, fn) => {
  try {
    const ok = fn();
    results.push({ name, ok: !!ok });
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
  }
};
const read = (p) => readFileSync(join(root, p), "utf8");

check("Selector exists (lib/vault/vault-opportunity-selector.ts)", () => existsSync(join(root, "lib/vault/vault-opportunity-selector.ts")));
check("Bridge types exist (lib/vault/vault-opportunity-types.ts)", () => existsSync(join(root, "lib/vault/vault-opportunity-types.ts")));
check("Adapter exists (lib/vault/vault-to-lead-candidate.ts)", () => existsSync(join(root, "lib/vault/vault-to-lead-candidate.ts")));

check("Selector exports core functions", () => {
  const src = read("lib/vault/vault-opportunity-selector.ts");
  return ["selectVaultOpportunities", "scoreVaultOpportunity", "rankVaultOpportunities", "buildVaultSelectionSummary"].every((f) => src.includes(`function ${f}`));
});
check("Selector enforces exclusion-first gates", () => {
  const src = read("lib/vault/vault-opportunity-selector.ts");
  return ["suppressed", "usage_rights_restricted", "usage_rights_unresolved", "already_used", "reserved_for_other"].every((r) => src.includes(`"${r}"`));
});
check("Adapter never fabricates contacts/emails", () => {
  const src = read("lib/vault/vault-to-lead-candidate.ts");
  return !/email:\s*["'`]/.test(src) && !/name:\s*["'`]/.test(src) && src.includes("account-level");
});
check("Adapter maps LeadSource 'vault'", () => read("lib/vault/vault-to-lead-candidate.ts").includes('source: "vault"') && read("types/index.ts").includes('"vault"'));

check("Preview API route exists", () => existsSync(join(root, "app/api/admin/vault-report-bridge/preview/route.ts")));
check("Dry-run API route exists", () => existsSync(join(root, "app/api/admin/vault-report-bridge/dry-run/route.ts")));
check("All bridge API routes require admin", () => {
  const dir = join(root, "app/api/admin/vault-report-bridge");
  const routes = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(join(d, e.name)) : e.name === "route.ts" && routes.push(join(d, e.name)); };
  walk(dir);
  return routes.length >= 2 && routes.every((r) => readFileSync(r, "utf8").includes("requireAdmin"));
});
check("Admin bridge page exists", () => existsSync(join(root, "app/admin/vault-report-bridge/page.tsx")));
check("No public bridge route", () => {
  const publicDirs = ["app/api/vault-report-bridge", "app/vault-report-bridge"];
  return publicDirs.every((d) => !existsSync(join(root, d)));
});
check("Usage/reservation helpers exist in vault-store", () => {
  const src = read("lib/storage/vault-store.ts");
  return ["reserveVaultOpportunitiesForRun", "recordVaultOpportunitiesUsed", "releaseVaultReservationsForFailedRun", "listVaultUsageForCustomer"].every((f) => src.includes(`function ${f}`));
});
check("Preview/dry-run never record usage or reservations", () => {
  const preview = read("app/api/admin/vault-report-bridge/preview/route.ts");
  const dryRun = read("app/api/admin/vault-report-bridge/dry-run/route.ts");
  return ["recordVault", "reserveVault", "createVaultReservation"].every((f) => !preview.includes(f) && !dryRun.includes(f));
});
check("No Apollo reference in bridge code", () => {
  const files = ["lib/vault/vault-opportunity-selector.ts", "lib/vault/vault-opportunity-types.ts", "lib/vault/vault-to-lead-candidate.ts", "app/api/admin/vault-report-bridge/preview/route.ts", "app/api/admin/vault-report-bridge/dry-run/route.ts", "app/admin/vault-report-bridge/page.tsx"];
  return files.every((f) => !/apollo/i.test(read(f)));
});
check("No LinkedIn scraping in bridge code", () => {
  const files = ["lib/vault/vault-opportunity-selector.ts", "lib/vault/vault-to-lead-candidate.ts", "app/admin/vault-report-bridge/page.tsx"];
  // Strip comments first — the adapter's comment names linkedin_url as a field it deliberately never sets.
  return files.every((f) => !/linkedin/i.test(read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));
});
check("No network fetches in selector/adapter", () => {
  const files = ["lib/vault/vault-opportunity-selector.ts", "lib/vault/vault-to-lead-candidate.ts"];
  return files.every((f) => !/fetch\(|axios|https?:\/\//.test(read(f).replace(/\/\/.*$/gm, "")));
});
check("No service role key leak (NEXT_PUBLIC…SERVICE_ROLE)", () => {
  const files = ["lib/vault/vault-opportunity-selector.ts", "lib/vault/vault-to-lead-candidate.ts", "app/admin/vault-report-bridge/page.tsx"];
  return files.every((f) => !read(f).includes("SERVICE_ROLE"));
});

const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.err ? ` — ${r.err}` : ""}`);
console.log(`\nResult: ${passed} passed, ${results.length - passed} failed.`);
process.exit(passed === results.length ? 0 : 1);
