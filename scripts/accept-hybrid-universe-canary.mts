#!/usr/bin/env node
// Live Hybrid Candidate Universe canary — USA + Colombia.
//
// Exercises the REAL productive composition (defaultDiscoveryRunner + real neutral
// Vault read + ELIGIBLE_FALLBACK gate) against LIVE providers and the REAL global
// vault_companies registry, and compares fresh-only vs hybrid universes through the
// real hunt() admission. Read-only: hunt performs no writes; the Vault read selects
// only neutral columns. Bounded cost: real Discovery runs ONCE per market (its output
// is reused for both the fresh-only and hybrid universes); NO downstream Research is
// invoked. Reads .env.local without printing secrets.
//
// Exit 0 = canary completed · 2 = a safety check failed · 3 = env not configured.
// Run: npx tsx --tsconfig tsconfig.json scripts/accept-hybrid-universe-canary.mts
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "TAVILY_API_KEY", "BRAVE_API_KEY", "SERPER_API_KEY", "FIRECRAWL_API_KEY"]) if (env[k]) process.env[k] = env[k];
if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "SUPABASE_SERVICE_ROLE_KEY")) { console.log("SUPABASE_NOT_CONFIGURED"); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { hunt, DEFAULT_DISCOVERY_BUDGET } = await import("@/lib/lead-hunter/candidate-universe");
const { defaultDiscoveryRunner } = await import("@/lib/lead-hunter/discovery-runner");
const { withVaultReuse } = await import("@/lib/lead-hunter/vault-identity-reuse");
const { createVaultReuseDeps } = await import("@/lib/lead-hunter/vault-reuse-deps");
const { freshDomainVerifiedCoverage, freshCoverageIsSufficient, makeVaultReuseGate } = await import("@/lib/lead-hunter/vault-reuse-config");

const db = createServerClient();
if (!db) { console.log("NO_DB"); process.exit(3); }
const deps = createVaultReuseDeps(db as never);
const gate = makeVaultReuseGate({ mode: "ELIGIBLE_FALLBACK", canaryContextIds: new Set() });

let failed = 0;
const check = (n: string, ok: boolean) => { if (!ok) { failed++; console.log(`❌ ${n}`); } else console.log(`✅ ${n}`); };

const NEUTRAL_IDENTITY_KEYS = new Set(["canonicalName", "domain", "country", "organizationType", "aliases", "confidence"]);

function plan(contextId: string, geographies: string[], industries: string[]) {
  return {
    contextRef: { contextId, version: 1 },
    objectiveType: "sell_products", targetRelationship: "customer",
    organizationTypes: ["manufacturer"], industries, geographies,
    routes: [{ id: "route_industry_category", kind: "industry_category" as const, label: "Organizations by industry / type" }],
    exclusions: [], namedAccountSeeds: [], watchSignalFamilies: [],
    budget: DEFAULT_DISCOVERY_BUDGET, planGaps: [],
  };
}

async function canary(label: string, contextId: string, geographies: string[], industries: string[]) {
  console.log(`\n──────── ${label} ────────`);
  const p = plan(contextId, geographies, industries);
  const t0 = Date.now();
  let freshOut;
  try { freshOut = await defaultDiscoveryRunner(p as never); }
  catch (e) { console.log(`DISCOVERY_FAILED: ${e instanceof Error ? e.message : "unknown"}`); return; }
  const discMs = Date.now() - t0;
  const cachedBase = async () => freshOut!; // reuse the single live discovery for both universes

  const freshCoverage = freshDomainVerifiedCoverage(freshOut as never, p as never);
  const sufficient = freshCoverageIsSufficient(freshOut as never, p as never);
  const gateOpen = gate(freshOut as never, p as never);

  const freshUniverse = await hunt(p as never, cachedBase as never);
  const hybridRunner = withVaultReuse(cachedBase as never, deps, undefined, { gate });
  const hybridUniverse = await hunt(p as never, hybridRunner);

  const freshInScope = freshUniverse.candidates.filter((c) => c.status !== "excluded");
  const hybridInScope = hybridUniverse.candidates.filter((c) => c.status !== "excluded");
  const vaultCands = hybridUniverse.candidates.filter((c) => c.originFlags?.includes("VAULT_REUSED"));
  const vaultInScope = vaultCands.filter((c) => c.status !== "excluded");

  console.log(`discovery_ms=${discMs} providersAvailable=${JSON.stringify(freshOut!.providersAvailable)} providersFailed=${JSON.stringify(freshOut!.providersFailed)}`);
  console.log(`fresh_domain_verified_coverage=${freshCoverage} sufficient=${sufficient} gate_open=${gateOpen}`);
  console.log(`FRESH universe: raw_orgs=${freshOut!.orgs.length} unique=${freshUniverse.candidates.length} in_scope=${freshInScope.length} fresh_discovery=${freshUniverse.coverage.freshCandidates}`);
  console.log(`HYBRID universe: unique=${hybridUniverse.candidates.length} in_scope=${hybridInScope.length} fresh_discovery=${hybridUniverse.coverage.freshCandidates} vault_reused=${hybridUniverse.coverage.vaultReusedCandidates}`);
  console.log(`vault candidates admitted in-scope (${vaultInScope.length}):`);
  for (const c of vaultInScope.slice(0, 25)) console.log(`   • ${c.identity.canonicalName}  [${c.identity.domain ?? "no-domain"}]  ${c.identity.country ?? "?"}  status=${c.status}`);

  // Safety: gate consistency
  check(`${label}: gate open ⇔ fresh coverage insufficient`, gateOpen === !sufficient);
  // Safety: when fresh is insufficient the hybrid universe is >= fresh (fallback helps or is neutral)
  check(`${label}: hybrid in-scope ≥ fresh in-scope`, hybridInScope.length >= freshInScope.length);
  // Safety: no reused identity is counted as a fresh discovery
  check(`${label}: fresh_discovery count identical fresh vs hybrid (reuse never inflates fresh)`, freshUniverse.coverage.freshCandidates === hybridUniverse.coverage.freshCandidates);
  // Safety: LEAKAGE — every vault-origin candidate exposes only neutral identity, no industry/customer data, neutral provenance
  let leak = 0;
  for (const c of vaultCands) {
    const idKeys = Object.keys(c.identity).filter((k) => c.identity[k as keyof typeof c.identity] !== undefined);
    if (!idKeys.every((k) => NEUTRAL_IDENTITY_KEYS.has(k))) leak++;
    if (c.identity.organizationType !== undefined) leak++; // industry/ICP must NOT be projected from Vault
    for (const pr of c.provenance) {
      if (!pr.origin.startsWith("vault")) leak++;
      if (pr.sourceUrl) leak++;              // no customer source reference
    }
    if (c.researchHints && c.researchHints.length) leak++; // no historical events
  }
  check(`${label}: ZERO cross-tenant / ICP / historical-event leakage in ${vaultCands.length} vault candidates`, leak === 0);
  // Safety: geography — every vault candidate matches the requested market
  const geoBad = vaultCands.filter((c) => {
    const hay = (c.identity.country ?? "").toLowerCase();
    if (geographies.some((g) => /united states/i.test(g))) return !/united states|usa|u\.s\.|america/.test(hay);
    if (geographies.some((g) => /colombia/i.test(g))) return !/colombia/.test(hay);
    return false;
  }).length;
  check(`${label}: every vault candidate is in the requested geography`, geoBad === 0);

  return { freshCoverage, sufficient, gateOpen, freshInScope: freshInScope.length, hybridInScope: hybridInScope.length, vaultInScope: vaultInScope.length, vaultReused: hybridUniverse.coverage.vaultReusedCandidates };
}

// Live Vault inventory snapshot (current, not historical §2)
const inv = await deps.fetchNeutralIdentities([]);
const withDomain = inv.filter((r) => r.domain);
const us = withDomain.filter((r) => /united states|usa|u\.s\.|america/i.test(`${r.country ?? ""} ${r.region ?? ""}`));
const co = withDomain.filter((r) => /colombia/i.test(`${r.country ?? ""} ${r.region ?? ""}`));
console.log(`LIVE VAULT INVENTORY: total_neutral=${inv.length} with_domain=${withDomain.length} US=${us.length} CO=${co.length}`);

const usRes = await canary("USA industrial-automation", "canary_us_indauto", ["United States"], ["industrial automation", "factory automation", "manufacturing"]);
const coRes = await canary("Colombia manufacturing", "canary_co_mfg", ["Colombia"], ["manufacturing", "packaging", "food and beverage"]);

console.log(`\n════ CANARY SUMMARY ════`);
console.log(JSON.stringify({ us: usRes, co: coRes, safety_failures: failed }, null, 2));
process.exit(failed === 0 ? 0 : 2);
