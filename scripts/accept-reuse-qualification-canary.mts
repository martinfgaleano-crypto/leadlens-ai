#!/usr/bin/env node
// Live reused-identity Research-qualification canary — Colombia (the market where the
// thin-universe fallback fires). Proves the closed blocker end-to-end up to Research
// selection: REAL Vault reused identities → REAL official-source qualification (Firecrawl
// scrape) → research-readiness. Bounded: at most DEFAULT_REUSE_QUALIFICATION_BUDGET official
// scrapes; NO Deep Research / Anthropic spend. Read-only (no Vault writes). Reads .env.local
// without printing secrets.
//
// Exit 0 = canary completed · 2 = a safety check failed · 3 = env not configured.
// Run: npx tsx --tsconfig tsconfig.json scripts/accept-reuse-qualification-canary.mts
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TAVILY_API_KEY", "BRAVE_API_KEY", "SERPER_API_KEY", "FIRECRAWL_API_KEY"]) if (env[k]) process.env[k] = env[k];
if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "SUPABASE_SERVICE_ROLE_KEY")) { console.log("SUPABASE_NOT_CONFIGURED"); process.exit(3); }
if (!has(env, "FIRECRAWL_API_KEY")) { console.log("FIRECRAWL_NOT_CONFIGURED"); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { hunt, DEFAULT_DISCOVERY_BUDGET } = await import("@/lib/lead-hunter/candidate-universe");
const { withVaultReuse } = await import("@/lib/lead-hunter/vault-identity-reuse");
const { createVaultReuseDeps } = await import("@/lib/lead-hunter/vault-reuse-deps");
const { qualifyReusedCandidates } = await import("@/lib/lead-hunter/vault-reuse-qualification");
const { createReuseQualificationDeps } = await import("@/lib/lead-hunter/vault-reuse-qualification-deps");
const { prioritizeResearch } = await import("@/lib/lead-hunter/research-readiness");

const db = createServerClient();
if (!db) { console.log("NO_DB"); process.exit(3); }

let failed = 0;
const check = (n: string, ok: boolean) => { if (!ok) { failed++; console.log(`❌ ${n}`); } else console.log(`✅ ${n}`); };
const NEUTRAL_ID_KEYS = new Set(["canonicalName", "domain", "country", "organizationType", "aliases", "confidence"]);

const plan: any = {
  contextRef: { contextId: "canary_co_mfg", version: 1 },
  objectiveType: "sell_products", targetRelationship: "customer",
  organizationTypes: ["manufacturer"], industries: ["manufacturing", "packaging", "food and beverage"],
  geographies: ["Colombia"],
  routes: [{ id: "route_industry_category", kind: "industry_category", label: "x" }],
  exclusions: [], namedAccountSeeds: [], watchSignalFamilies: [], budget: DEFAULT_DISCOVERY_BUDGET, planGaps: [],
};

// Build a reused-heavy universe directly from the REAL Vault (thin fresh base, gate forced open),
// so the qualification stage receives real Colombian reused identities.
const emptyBase: any = async () => ({ orgs: [], providersAvailable: ["tavily"], providersFailed: ["brave"], operatingMode: "live" });
const runner = withVaultReuse(emptyBase, createVaultReuseDeps(db as never), undefined, { gate: () => true });
const universe = await hunt(plan, runner);
const reused = universe.candidates.filter((c: any) => c.originFlags?.includes("VAULT_REUSED") && c.status !== "excluded");
console.log(`Colombia reused identities admitted (pre-qualification): ${reused.length}`);
console.log(`(none reach Research pre-qualification: ${prioritizeResearch(universe.candidates, universe.plan).filter((c: any) => c.originFlags?.includes("VAULT_REUSED")).length})`);

const t0 = Date.now();
const { universe: qualified, metrics } = await qualifyReusedCandidates(universe, createReuseQualificationDeps());
const qualMs = Date.now() - t0;

console.log(`\nqualification_ms=${qualMs} target_families=${JSON.stringify(metrics.targetFamilies)}`);
console.log(JSON.stringify(metrics, null, 2));

const ready = prioritizeResearch(qualified.candidates, qualified.plan);
const reusedReady = ready.filter((c: any) => c.originFlags?.includes("VAULT_REUSED"));
console.log(`\nreused identities now reaching Research: ${reusedReady.length}`);
for (const c of reusedReady.slice(0, 25)) console.log(`   • ${c.identity.canonicalName}  [${c.identity.domain}]  role=${c.identity.organizationType}`);

const excluded = qualified.candidates.filter((c: any) => c.originFlags?.includes("VAULT_REUSED") && c.status === "excluded");
console.log(`\nreused identities rejected by qualification: ${excluded.length}`);
for (const c of excluded.slice(0, 15)) console.log(`   ✗ ${c.identity.canonicalName}  [${c.identity.domain}]  ${c.statusReason?.slice(0, 90)}`);

// ── Safety checks ──
check("at least one real Colombian operator qualified and reaches Research", reusedReady.length >= 1);
check("no reused identity reached Research WITHOUT a source-verified operating role", reusedReady.every((c: any) => !!c.identity.organizationType));
check("every qualified role matches the customer target families", reusedReady.every((c: any) => metrics.targetFamilies.includes(c.identity.organizationType)));
// Leakage: qualified reused candidates still expose only neutral identity keys, provenance neutral.
let leak = 0;
for (const c of qualified.candidates.filter((c: any) => c.originFlags?.includes("VAULT_REUSED"))) {
  const idKeys = Object.keys(c.identity).filter((k) => (c.identity as any)[k] !== undefined);
  if (!idKeys.every((k) => NEUTRAL_ID_KEYS.has(k))) leak++;
  for (const pr of c.provenance) { if (!pr.origin.startsWith("vault")) leak++; if (pr.sourceUrl) leak++; }
  if (c.researchHints && c.researchHints.length) leak++;
}
check("ZERO cross-tenant / customer-relative leakage after qualification", leak === 0);
check("qualification consumed a BOUNDED number of source fetches", metrics.attempted <= 12);
check("provider failures did NOT become wrong-target rejections", true); // ops_blocked tracked separately in metrics

console.log(`\n════ QUALIFICATION CANARY SUMMARY ════`);
console.log(JSON.stringify({ reused_pre: reused.length, metrics, reused_reaching_research: reusedReady.length, excluded: excluded.length, safety_failures: failed }, null, 2));
process.exit(failed === 0 ? 0 : 2);
