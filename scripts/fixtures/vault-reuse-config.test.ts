import assert from "node:assert/strict";
import {
  resolveVaultReuseConfig, vaultReuseEnabledForPlan, freshDomainVerifiedCoverage,
  freshCoverageIsSufficient, makeVaultReuseGate, FRESH_COVERAGE_SUFFICIENCY,
} from "../../lib/lead-hunter/vault-reuse-config";
import type { DiscoveryPlan, DiscoveryRunOutput, RawDiscoveredOrg } from "../../lib/lead-hunter/candidate-universe";
import { DEFAULT_DISCOVERY_BUDGET } from "../../lib/lead-hunter/candidate-universe";

let p = 0; const t = (n: string, ok: boolean) => { assert.equal(ok, true, n); p++; console.log(`✅ ${n}`); };

const planFor = (contextId: string, geographies: string[], maxProviderCalls = 24): DiscoveryPlan => ({
  contextRef: { contextId, version: 1 },
  objectiveType: "sell", targetRelationship: "customer",
  organizationTypes: ["manufacturer"], industries: [], geographies,
  routes: [], exclusions: [], namedAccountSeeds: [], watchSignalFamilies: [],
  budget: { ...DEFAULT_DISCOVERY_BUDGET, maxProviderCalls }, planGaps: [],
});
const org = (name: string, domain: string | undefined, country: string | undefined, origin = "vertical_seed"): RawDiscoveredOrg =>
  ({ name, domain, country, origin, provider: "engine", route: "engine", confidence: domain ? "verified" : "plausible" });
const outWith = (orgs: RawDiscoveredOrg[]): DiscoveryRunOutput =>
  ({ orgs, providersAvailable: ["brave"], providersFailed: [], operatingMode: "live" });

async function main() {
  // ── rollout resolution ──
  t("default env → OFF", resolveVaultReuseConfig({} as NodeJS.ProcessEnv).mode === "OFF");
  t("CANARY parsed with context allowlist", (() => {
    const c = resolveVaultReuseConfig({ VAULT_REUSE_MODE: "canary", VAULT_REUSE_CANARY_CONTEXTS: "ctx_a, ctx_b" } as never);
    return c.mode === "CANARY" && c.canaryContextIds.has("ctx_a") && c.canaryContextIds.has("ctx_b");
  })());
  t("ELIGIBLE_FALLBACK parsed", resolveVaultReuseConfig({ VAULT_REUSE_MODE: "ELIGIBLE_FALLBACK" } as never).mode === "ELIGIBLE_FALLBACK");
  t("unknown mode falls back to OFF", resolveVaultReuseConfig({ VAULT_REUSE_MODE: "garbage" } as never).mode === "OFF");

  // ── rollout gate per plan ──
  t("OFF disables every plan", !vaultReuseEnabledForPlan({ mode: "OFF", canaryContextIds: new Set(), eligibleGeographies: new Set<string>() }, planFor("ctx_a", ["United States"])));
  t("CANARY enables only allowlisted context", (() => {
    const cfg = { mode: "CANARY" as const, canaryContextIds: new Set(["ctx_a"]), eligibleGeographies: new Set<string>() };
    return vaultReuseEnabledForPlan(cfg, planFor("ctx_a", ["United States"])) && !vaultReuseEnabledForPlan(cfg, planFor("ctx_z", ["United States"]));
  })());
  t("ELIGIBLE_FALLBACK enables any context", vaultReuseEnabledForPlan({ mode: "ELIGIBLE_FALLBACK", canaryContextIds: new Set(), eligibleGeographies: new Set<string>() }, planFor("ctx_any", ["United States"])));

  // ── CONTROLLED PRODUCTION ROLLOUT: geography-scoped ELIGIBLE_FALLBACK (Intelligence V1 freeze) ──
  const coScoped = { mode: "ELIGIBLE_FALLBACK" as const, canaryContextIds: new Set<string>(), eligibleGeographies: new Set(["colombia"]) };
  t("scoped fallback ENABLES the accepted market (Colombia)", vaultReuseEnabledForPlan(coScoped, planFor("ctx_co", ["Colombia"])));
  t("scoped fallback DISABLES an untested market (USA) even with the flag ON", !vaultReuseEnabledForPlan(coScoped, planFor("ctx_us", ["United States"])));
  t("scoped fallback DISABLES a run with no geography", !vaultReuseEnabledForPlan(coScoped, planFor("ctx_none", [])));
  t("empty geo allowlist preserves unscoped behavior (harness)", vaultReuseEnabledForPlan({ mode: "ELIGIBLE_FALLBACK", canaryContextIds: new Set(), eligibleGeographies: new Set<string>() }, planFor("ctx", ["United States"])));
  t("resolveVaultReuseConfig parses VAULT_REUSE_ELIGIBLE_GEOS", (() => {
    const c = resolveVaultReuseConfig({ VAULT_REUSE_MODE: "ELIGIBLE_FALLBACK", VAULT_REUSE_ELIGIBLE_GEOS: "Colombia, Mexico" } as never);
    return c.eligibleGeographies.has("colombia") && c.eligibleGeographies.has("mexico");
  })());
  t("CANARY still requires the context allowlist AND geography scope", (() => {
    const cfg = { mode: "CANARY" as const, canaryContextIds: new Set(["ctx_ok"]), eligibleGeographies: new Set(["colombia"]) };
    return vaultReuseEnabledForPlan(cfg, planFor("ctx_ok", ["Colombia"])) && !vaultReuseEnabledForPlan(cfg, planFor("ctx_ok", ["United States"]));
  })());

  // ── coverage measurement (pre-Research, domain-verified, geography-matched, fresh only) ──
  const usPlan = planFor("ctx_us", ["United States"]);
  t("counts distinct domain-verified US fresh identities", freshDomainVerifiedCoverage(outWith([
    org("Mars", "mars.com", "United States"),
    org("Mars", "mars.com", "United States"),            // duplicate domain → once
    org("SunOpta", "sunopta.com", "United States"),
    org("NoDomain", undefined, "United States"),          // no domain → excluded
    org("Alpina", "alpina.com", "Colombia"),              // wrong geography → excluded
  ]), usPlan) === 2);
  t("excludes vault + context_memory origins from FRESH coverage", freshDomainVerifiedCoverage(outWith([
    org("Post Holdings", "postholdings.com", "United States", "vault_reuse"),
    org("Legacy Co", "legacy.com", "United States", "context_memory:vertical_seed"),
    org("American Packaging", "americanpackaging.com", "United States", "event_first"),
  ]), usPlan) === 1);

  // ── tier-aware sufficiency ──
  const enough = (n: number) => outWith(Array.from({ length: n }, (_, i) => org(`Co${i}`, `co${i}.com`, "United States")));
  const enough2 = (country: string, n: number) => outWith(Array.from({ length: n }, (_, i) => org(`C${i}`, `c${i}.com`, country)));
  t("preview sufficient at threshold", freshCoverageIsSufficient(enough(FRESH_COVERAGE_SUFFICIENCY.preview), planFor("c", ["United States"], 24)));
  t("preview insufficient below threshold", !freshCoverageIsSufficient(enough(FRESH_COVERAGE_SUFFICIENCY.preview - 1), planFor("c", ["United States"], 24)));
  t("higher tier needs a higher floor than preview", (() => {
    const n = FRESH_COVERAGE_SUFFICIENCY.preview; // enough for preview, not for standard/pro
    return freshCoverageIsSufficient(enough(n), planFor("c", ["United States"], 24))
      && !freshCoverageIsSufficient(enough(n), planFor("c", ["United States"], 96));
  })());
  // ── Portfolio/Premium supply regression (the 9/12 defect): the sufficiency FLOOR must exceed the
  // delivery target so reuse fires to top up. Fresh 10 was the exact Portfolio universe. ──
  const stdPlan = planFor("c", ["Colombia"], 64); // standard/Portfolio tier (floor 14)
  const proPlan = planFor("c", ["Colombia"], 90); // pro/Premium tier (floor 20)
  t("Portfolio: fresh 10 is INSUFFICIENT → reuse must be allowed to top up (was the 9/12 bug)",
    !freshCoverageIsSufficient(outWith(Array.from({ length: 10 }, (_, i) => org(`C${i}`, `c${i}.com`, "Colombia"))), stdPlan));
  t("Portfolio: fresh 14 (target+headroom) is sufficient", freshCoverageIsSufficient(enough2("Colombia", 14), stdPlan));
  t("Premium: fresh 10 INSUFFICIENT, fresh 20 sufficient",
    !freshCoverageIsSufficient(enough2("Colombia", 10), proPlan) && freshCoverageIsSufficient(enough2("Colombia", 20), proPlan));
  t("standard floor (14) exceeds Portfolio target (12); pro floor (20) exceeds Premium target (18)",
    FRESH_COVERAGE_SUFFICIENCY.standard > 12 && FRESH_COVERAGE_SUFFICIENCY.pro > 18);

  // ── combined gate: rollout AND insufficiency ──
  const thinUs = outWith([org("Rockwell", "rockwellautomation.com", "United States")]); // 1 → insufficient
  const richUs = enough(FRESH_COVERAGE_SUFFICIENCY.preview);                            // sufficient for preview tier
  t("gate OPEN only when enabled AND fresh coverage insufficient", (() => {
    const gate = makeVaultReuseGate({ mode: "ELIGIBLE_FALLBACK", canaryContextIds: new Set(), eligibleGeographies: new Set<string>() });
    return gate(thinUs, usPlan) && !gate(richUs, usPlan);
  })());
  t("gate CLOSED when rollout OFF regardless of thin coverage", !makeVaultReuseGate({ mode: "OFF", canaryContextIds: new Set(), eligibleGeographies: new Set<string>() })(thinUs, usPlan));
  t("gate CLOSED for non-canary context even when thin", (() => {
    const gate = makeVaultReuseGate({ mode: "CANARY", canaryContextIds: new Set(["ctx_allowed"]), eligibleGeographies: new Set<string>() });
    return !gate(thinUs, planFor("ctx_other", ["United States"])) && gate(thinUs, planFor("ctx_allowed", ["United States"]));
  })());
  // §10: fallback must NOT respond to commercial conclusions — only coverage. A rich
  // universe stays gated-closed regardless (the gate never sees Decisions/events).
  t("rich fresh universe keeps the gate closed (no reuse to manufacture opportunities)",
    !makeVaultReuseGate({ mode: "ELIGIBLE_FALLBACK", canaryContextIds: new Set(), eligibleGeographies: new Set<string>() })(enough(FRESH_COVERAGE_SUFFICIENCY.pro), planFor("c", ["United States"], 96)));

  console.log(`\n${p} passed, 0 failed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
