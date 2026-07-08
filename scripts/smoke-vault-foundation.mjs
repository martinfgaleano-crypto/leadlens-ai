#!/usr/bin/env node
/**
 * Vault Foundation + compliance smoke checks (static, read-only).
 * Verifies files/exports exist, Apollo stays licensed-only by default, and
 * customer surfaces carry no prohibited language. No network, no DB.
 *
 * Usage: npm run smoke:vault
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const read = (p) => { try { return readFileSync(join(root, p), "utf8"); } catch { return null; } };

console.log("\nLeadLens Vault Foundation smoke (static)\n");

// ── 1. Migration exists ──
record("migration 029_vault_foundation.sql exists",
  existsSync(join(root, "supabase/migrations/029_vault_foundation.sql")));

// ── 2. vault-store exports ──
{
  const src = read("lib/storage/vault-store.ts") ?? "";
  const fns = [
    "createVaultCompany", "getVaultCompanyById", "findVaultCompanyByDomain", "listVaultCompanies", "updateVaultCompanyStatus",
    "createVaultContact", "getVaultContactById", "findVaultContactByEmail", "listVaultContacts", "updateVaultContactReviewStatus",
    "createVaultSource", "listVaultSources", "getVaultSourceById",
    "createVaultSignal", "listVaultSignals", "listSignalsByCompany", "updateVaultSignalReviewStatus",
    "recordVaultUsage", "listUsageByContact", "listUsageByCompany",
    "createVaultReservation", "listActiveReservations", "releaseVaultReservation",
    "addSuppressionEntry", "isSuppressed", "listSuppressionEntries",
  ];
  const missing = fns.filter(f => !src.includes(`export async function ${f}`));
  record("vault-store exports all expected functions", missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `${fns.length} functions`);
}

// ── 3. Admin API routes + pages exist ──
{
  const routes = ["companies", "contacts", "signals", "sources", "suppression", "candidates"];
  const missingRoutes = routes.filter(r => !existsSync(join(root, `app/api/admin/vault-foundation/${r}/route.ts`)));
  record("admin vault API routes exist", missingRoutes.length === 0,
    missingRoutes.length ? `missing: ${missingRoutes.join(", ")}` : "");

  const pages = ["page.tsx", "companies/page.tsx", "contacts/page.tsx", "signals/page.tsx", "sources/page.tsx", "suppression/page.tsx", "candidates/new/page.tsx"];
  const missingPages = pages.filter(p => !existsSync(join(root, `app/admin/vault-foundation/${p}`)));
  record("admin vault pages exist", missingPages.length === 0,
    missingPages.length ? `missing: ${missingPages.join(", ")}` : "");
}

// ── 4. Vault APIs are admin-protected + no public vault routes ──
{
  const routes = ["companies", "contacts", "signals", "sources", "suppression", "candidates"];
  const unprotected = routes.filter(r => {
    const src = read(`app/api/admin/vault-foundation/${r}/route.ts`) ?? "";
    return !src.includes("requireAdmin");
  });
  record("all vault routes require admin token", unprotected.length === 0,
    unprotected.length ? `unprotected: ${unprotected.join(", ")}` : "");
  record("no public/customer vault route exists",
    !existsSync(join(root, "app/api/vault")) && !existsSync(join(root, "app/api/monitor/vault")));
}

// ── 5. Apollo licensed-only enforcement ──
{
  const registry = read("lib/providers/provider-registry.ts") ?? "";
  record("provider registry gates Apollo on APOLLO_LICENSED_PROVIDER_ENABLED",
    registry.includes("APOLLO_LICENSED_PROVIDER_ENABLED"));
  const client = read("lib/apollo/client.ts") ?? "";
  record("apollo client enforces licensing gate",
    client.includes("apolloCustomerFacingBlockReason"));
  const envExample = read(".env.example") ?? "";
  record(".env.example defaults APOLLO_LICENSED_PROVIDER_ENABLED=false",
    envExample.includes("APOLLO_LICENSED_PROVIDER_ENABLED=false"));
}

// ── 6. No service-role leak to browser ──
{
  const envExample = read(".env.example") ?? "";
  record("no NEXT_PUBLIC service role in .env.example",
    !/NEXT_PUBLIC[A-Z_]*SERVICE_ROLE/.test(envExample));
}

// ── 7. Customer surface safety grep ──
{
  const customerFiles = [
    "app/demo-pipeline/page.tsx",
    "app/dashboard/page.tsx",
    "app/dashboard/searches/page.tsx",
    "app/dashboard/searches/[id]/page.tsx",
    "app/results/[jobId]/page.tsx",
    "app/login/page.tsx",
    "app/signup/page.tsx",
  ];
  const prohibited = [
    /apollo[- ]powered/i,
    /contact database(?!s\b)/i,   // "contact databases" appears only in "No contact databases" trust copy
    /email automation/i,
    /linkedin automation/i,
    /guaranteed meetings/i,
    /guaranteed revenue/i,
    /scrape linkedin/i,
    /largest database/i,
  ];
  const hits = [];
  for (const f of customerFiles) {
    const src = read(f);
    if (!src) continue;
    for (const re of prohibited) {
      const m = src.match(re);
      if (!m) continue;
      // Allow negated trust copy ("No contact databases", "not a contact database",
      // "do not sell ... contact") and FAQ differentiation ("Apollo and ZoomInfo are contact databases").
      const idx = src.search(re);
      const ctx = src.slice(Math.max(0, idx - 80), idx + 80).toLowerCase();
      const negated = /(no |not |don't |do not |never |aren't|isn't|different from|are contact databases)/.test(ctx);
      if (!negated) hits.push(`${f}: "${m[0]}"`);
    }
  }
  record("customer surfaces free of prohibited language", hits.length === 0,
    hits.length ? hits.join(" | ") : `${customerFiles.length} files checked`);
}

const failed = results.filter(r => !r.pass).length;
console.log(`\nResult: ${results.length - failed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
