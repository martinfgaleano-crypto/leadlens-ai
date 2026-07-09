#!/usr/bin/env node
/** Lead Hunter static smoke checks — files/exports/protection/policy. Read-only. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];
const record = (name, pass, detail) => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); };
const read = (p) => { try { return readFileSync(join(root, p), "utf8"); } catch { return null; } };

console.log("\nLeadLens Lead Hunter smoke (static)\n");

record("migration 030_lead_hunter.sql exists", existsSync(join(root, "supabase/migrations/030_lead_hunter.sql")));
record("types exist", existsSync(join(root, "lib/lead-hunter/lead-hunter-types.ts")));

{
  const src = read("lib/storage/lead-hunter-store.ts") ?? "";
  const fns = ["createLeadHunterBrief","getLeadHunterBriefById","listLeadHunterBriefs","updateLeadHunterBrief",
    "createLeadHunterRun","getLeadHunterRunById","listLeadHunterRuns","updateLeadHunterRunStatus","completeLeadHunterRun","failLeadHunterRun",
    "addLeadHunterSourceInput","listLeadHunterSourceInputs",
    "createLeadHunterCandidate","listLeadHunterCandidates","getLeadHunterCandidateById","updateLeadHunterCandidateReview",
    "promoteLeadHunterCandidateToVault"];
  const missing = fns.filter(f => !src.includes(f));
  record("store exports expected functions", missing.length === 0, missing.join(", "));
}

{
  const src = read("lib/lead-hunter/lead-hunter-policy.ts") ?? "";
  const fns = ["classifySourceCategory","isSourceCategoryAllowed","getSourceCategoryRisk","validateLeadHunterSource","validateCandidateSafety","normalizeSignalType","computeFreshnessStatus","computeEvidenceQuality","computeCandidateConfidence"];
  const missing = fns.filter(f => !src.includes(`function ${f}`));
  record("policy functions exist", missing.length === 0, missing.join(", "));
  record("restricted categories block LinkedIn/Apollo/paywall", src.includes("linkedin_scraping") && src.includes("apollo_without_license") && src.includes("paywalled_source"));
}

record("engine exists", existsSync(join(root, "lib/lead-hunter/lead-hunter-engine.ts")));
record("provider adapters exist", ["base.ts","manual-provider.ts","search-provider-placeholder.ts"].every(f => existsSync(join(root, `lib/lead-hunter/providers/${f}`))));

{
  const routes = ["briefs/route.ts","runs/route.ts","runs/[id]/route.ts","runs/[id]/sources/route.ts","runs/[id]/generate/route.ts","candidates/route.ts","candidates/[id]/[action]/route.ts"];
  const missing = routes.filter(r => !existsSync(join(root, `app/api/admin/lead-hunter/${r}`)));
  record("admin API routes exist", missing.length === 0, missing.join(", "));
  const unprotected = routes.filter(r => { const src = read(`app/api/admin/lead-hunter/${r}`) ?? ""; return !src.includes("requireAdmin"); });
  record("all routes require admin token", unprotected.length === 0, unprotected.join(", "));
}

{
  const pages = ["page.tsx","briefs/page.tsx","runs/page.tsx","runs/[id]/page.tsx","candidates/page.tsx"];
  const missing = pages.filter(p => !existsSync(join(root, `app/admin/lead-hunter/${p}`)));
  record("admin pages exist", missing.length === 0, missing.join(", "));
}

record("no public lead-hunter routes", !existsSync(join(root, "app/api/lead-hunter")) && !existsSync(join(root, "app/lead-hunter")));

{
  // No Apollo usage inside Lead Hunter implementation (policy text mentioning
  // the restricted category is expected and allowed).
  const files = ["lib/lead-hunter/lead-hunter-engine.ts","lib/storage/lead-hunter-store.ts","lib/lead-hunter/providers/manual-provider.ts"];
  const hits = files.filter(f => /from ["']@\/lib\/apollo/.test(read(f) ?? ""));
  record("no Apollo client usage in Lead Hunter", hits.length === 0, hits.join(", "));
  const fetchHits = files.filter(f => /fetch\(/.test(read(f) ?? ""));
  record("no network fetches in engine/providers/store", fetchHits.length === 0, fetchHits.join(", "));
}

record("no NEXT_PUBLIC service role leak", !/NEXT_PUBLIC[A-Z_]*SERVICE_ROLE/.test(read(".env.example") ?? ""));

const failed = results.filter(r => !r).length;
console.log(`\nResult: ${results.length - failed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
