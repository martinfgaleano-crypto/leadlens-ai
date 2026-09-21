import assert from "node:assert/strict";
import {
  geographyMatches, projectNeutralIdentity, selectVaultReuseCandidates, withVaultReuse,
  type NeutralVaultIdentity, type VaultReuseDeps,
} from "../../lib/lead-hunter/vault-identity-reuse";
import type { DiscoveryPlan, DiscoveryRunner, DiscoveryRunOutput } from "../../lib/lead-hunter/candidate-universe";

let p = 0; const t = (n: string, ok: boolean) => { assert.equal(ok, true, n); p++; console.log(`✅ ${n}`); };
const NEUTRAL_KEYS = new Set(["name", "domain", "country", "origin", "provider", "route", "confidence"]);

async function main() {
// ── geography (neutral facts only) ──
t("US geography matches US country/region", geographyMatches({ name: "Mars", domain: "mars.com", country: "United States", region: null }, ["United States"]));
t("Colombia geography matches Colombian rows", geographyMatches({ name: "Alpina", domain: "alpina.com", country: "Colombia", region: "Cundinamarca" }, ["Colombia"]));
t("US customer does not match a Colombian row", !geographyMatches({ name: "Alpina", domain: "alpina.com", country: "Colombia", region: null }, ["United States"]));
t("South America geography matches Colombian rows", geographyMatches({ name: "Alpina", domain: "alpina.com", country: "Colombia", region: null }, ["South America"]));

// ── neutral projection carries ONLY public identity (leakage guard) ──
const proj = projectNeutralIdentity({ name: "Post Holdings Inc.", domain: "PostHoldings.com", country: "United States", region: "Missouri" });
t("projection lowercases domain and keeps the name", proj?.domain === "postholdings.com" && proj?.name === "Post Holdings Inc.");
t("projection marks reuse provenance (not evidence)", proj?.origin === "vault_reuse" && proj?.route === "verified_identity_reuse" && proj?.confidence === "plausible");
t("projection exposes ONLY neutral identity keys — no industry/ICP/observation leakage",
  !!proj && Object.keys(proj).every((k) => NEUTRAL_KEYS.has(k)) && !("industry" in proj) && !("organizationType" in proj) && !("researchHint" in proj));
t("no name or no domain → not admitted", projectNeutralIdentity({ name: null, domain: "x.com", country: "US", region: null }) === null && projectNeutralIdentity({ name: "X", domain: null, country: "US", region: null }) === null);

// ── selection: geography filter, domain-required, dedup, bounded, neutral ──
const rows: NeutralVaultIdentity[] = [
  { name: "Mars", domain: "mars.com", country: "United States", region: null },
  { name: "American Packaging Corporation", domain: "americanpackaging.com", country: "United States", region: "New York" },
  { name: "Alpina", domain: "alpina.com", country: "Colombia", region: null },        // filtered for a US customer
  { name: "NoDomain Co", domain: null, country: "United States", region: null },       // rejected: no identity
  { name: "Mars", domain: "mars.com", country: "United States", region: null },        // duplicate domain
  { name: "SunOpta", domain: "sunopta.com", country: "United States", region: null },
];
const deps: VaultReuseDeps = { fetchNeutralIdentities: async () => rows };
const res = await selectVaultReuseCandidates({ geographies: ["United States"] }, deps, { maxCandidates: 40 });
const names = res.orgs.map((o) => o.name).sort();
t("admits US operators, filters Colombian, drops no-domain + duplicate", names.join(",") === "American Packaging Corporation,Mars,SunOpta");
t("every admitted candidate is neutral, reuse-origin and de-duplicated by domain",
  res.orgs.every((o) => o.origin === "vault_reuse" && o.provider === "vault" && Object.keys(o).every((k) => NEUTRAL_KEYS.has(k)))
  && new Set(res.orgs.map((o) => o.domain)).size === res.orgs.length);
t("metrics record geography + identity + duplicate rejections", (res.metrics.rejected["geography"] ?? 0) === 1 && (res.metrics.rejected["no_identity"] ?? 0) === 1 && (res.metrics.rejected["duplicate_domain"] ?? 0) === 1 && res.metrics.admitted === 3);

// ── budget bound ──
const many: NeutralVaultIdentity[] = Array.from({ length: 100 }, (_, i) => ({ name: `Co${i}`, domain: `co${i}.com`, country: "United States", region: null }));
const bounded = await selectVaultReuseCandidates({ geographies: ["United States"] }, { fetchNeutralIdentities: async () => many }, { maxCandidates: 40 });
t("selection respects the candidate budget", bounded.orgs.length === 40);

// ── withVaultReuse: additive composition over the base productive runner ──
const baseOut: DiscoveryRunOutput = { orgs: [{ name: "Mars", domain: "mars.com", origin: "event_first", provider: "engine", route: "event", confidence: "plausible" }], providersAvailable: ["brave"], providersFailed: [], operatingMode: "live" };
const base: DiscoveryRunner = async () => baseOut;
const plan = { geographies: ["United States"] } as unknown as DiscoveryPlan;
const composed = await withVaultReuse(base, { fetchNeutralIdentities: async () => rows }, { maxCandidates: 40 })(plan);
t("composition appends vault-reuse candidates to base output", composed.orgs.length > baseOut.orgs.length && composed.orgs.some((o) => o.origin === "vault_reuse" && o.name === "American Packaging Corporation"));
t("composition dedupes an identity already in the base universe (Mars once)", composed.orgs.filter((o) => o.domain === "mars.com").length === 1);
t("composition preserves the base output envelope", composed.providersAvailable.join() === "brave" && composed.operatingMode === "live");
const failComposed = await withVaultReuse(base, { fetchNeutralIdentities: async () => { throw new Error("db down"); } })(plan);
t("reuse is fail-closed: a fetch error preserves the base output unchanged", failComposed.orgs.length === baseOut.orgs.length);

console.log(`\n${p} passed, 0 failed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
