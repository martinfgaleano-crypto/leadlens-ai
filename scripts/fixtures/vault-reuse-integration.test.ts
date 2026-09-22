import assert from "node:assert/strict";
import { hunt, DEFAULT_DISCOVERY_BUDGET } from "../../lib/lead-hunter/candidate-universe";
import type { DiscoveryPlan, DiscoveryRunner, DiscoveryRunOutput, RawDiscoveredOrg } from "../../lib/lead-hunter/candidate-universe";
import { withVaultReuse } from "../../lib/lead-hunter/vault-identity-reuse";
import type { NeutralVaultIdentity } from "../../lib/lead-hunter/vault-identity-reuse";
import { prioritizeResearch } from "../../lib/lead-hunter/research-readiness";

let p = 0; const t = (n: string, ok: boolean) => { assert.equal(ok, true, n); p++; console.log(`✅ ${n}`); };

const plan = (geographies: string[], exclusions: string[] = []): DiscoveryPlan => ({
  contextRef: { contextId: "ctx", version: 1 },
  objectiveType: "sell", targetRelationship: "customer",
  organizationTypes: ["manufacturer"], industries: ["packaging"], geographies,
  routes: [{ id: "route_industry_category", kind: "industry_category", label: "x" }],
  exclusions, namedAccountSeeds: [], watchSignalFamilies: [],
  budget: DEFAULT_DISCOVERY_BUDGET, planGaps: [],
});
const fresh = (name: string, domain: string | undefined, country: string, origin = "vertical_seed"): RawDiscoveredOrg =>
  ({ name, domain, country, organizationType: "manufacturer", origin, provider: "engine", route: "engine", confidence: domain ? "verified" : "plausible" });
const baseRunner = (orgs: RawDiscoveredOrg[]): DiscoveryRunner => async (): Promise<DiscoveryRunOutput> =>
  ({ orgs, providersAvailable: ["brave"], providersFailed: [], operatingMode: "live" });
const vaultRows = (rows: NeutralVaultIdentity[]) => ({ fetchNeutralIdentities: async () => rows });

async function main() {
  // ── thin fresh universe + Vault fallback → combined, honestly accounted ──
  {
    const runner = withVaultReuse(
      baseRunner([fresh("Rockwell Automation", "rockwellautomation.com", "United States", "event_first")]),
      vaultRows([
        { name: "Post Holdings", domain: "postholdings.com", country: "United States", region: "Missouri" },
        { name: "SunOpta", domain: "sunopta.com", country: "United States", region: null },
        { name: "American Packaging", domain: "americanpackaging.com", country: "United States", region: null },
      ]),
      { maxCandidates: 40 }, { gate: () => true },
    );
    const u = await hunt(plan(["United States"]), runner);
    const inScope = u.candidates.filter((c) => c.status !== "excluded");
    t("combined universe = 1 fresh + 3 reused = 4 unique in-scope candidates", inScope.length === 4);
    t("Vault candidates carry VAULT_REUSED origin flag", u.candidates.filter((c) => c.originFlags?.includes("VAULT_REUSED")).length === 3);
    t("fresh discovery count excludes the 3 reused identities (§14/§25)", u.coverage.freshCandidates === 1);
    t("vaultReusedCandidates counts exactly the reused in-scope identities", u.coverage.vaultReusedCandidates === 3);
    // Provenance hygiene: a reused candidate exposes only neutral discovery provenance.
    const reused = u.candidates.find((c) => c.identity.canonicalName === "Post Holdings")!;
    t("reused candidate provenance is neutral (vault_reuse origin, no sourceUrl, no run/customer id)",
      reused.provenance.every((pr) => pr.origin === "vault_reuse" && pr.provider === "vault" && !pr.sourceUrl)
      && !reused.researchHints);
    t("reused candidate carries NO Evidence/Timing/Decision (hunt emits none)",
      !("decision" in reused) && !("timing" in reused) && reused.status !== "excluded");
  }

  // ── dedup: fresh and Vault find the SAME company → one candidate, both origins ──
  {
    const runner = withVaultReuse(
      baseRunner([fresh("Mars", "mars.com", "United States", "vertical_seed")]),
      vaultRows([{ name: "Mars Incorporated", domain: "mars.com", country: "United States", region: null }]),
      { maxCandidates: 40 }, { gate: () => true },
    );
    const u = await hunt(plan(["United States"]), runner);
    t("same company from fresh + Vault collapses to ONE canonical candidate", u.candidates.filter((c) => c.identity.domain === "mars.com").length === 1);
    const mars = u.candidates.find((c) => c.identity.domain === "mars.com")!;
    // Vault added no NEW identity here (fresh already had mars.com), so the redundant reuse
    // copy is dropped at the runner boundary: the company is counted once, as a fresh discovery,
    // and never double-counted (§18/§25).
    t("the already-fresh company stays a fresh discovery, not inflated by reuse", mars.originFlags?.includes("ACCOUNT_FIRST") === true);
    t("a company fresh Discovery already found is NOT double-counted as reuse", u.coverage.freshCandidates === 1 && u.coverage.vaultReusedCandidates === 0);
  }

  // ── geography: a wrong-country Vault identity never enters a US universe ──
  {
    const runner = withVaultReuse(
      baseRunner([fresh("Rockwell", "rockwellautomation.com", "United States")]),
      vaultRows([{ name: "Alpina", domain: "alpina.com", country: "Colombia", region: null }]),
      { maxCandidates: 40 }, { gate: () => true },
    );
    const u = await hunt(plan(["United States"]), runner);
    t("Colombian Vault identity is excluded from a US customer universe", !u.candidates.some((c) => c.identity.domain === "alpina.com"));
  }

  // ── off-target: a reused identity matching a hard exclusion is NOT admitted in-scope ──
  {
    const runner = withVaultReuse(
      baseRunner([fresh("Rockwell", "rockwellautomation.com", "United States")]),
      vaultRows([{ name: "Government Agency Bureau", domain: "usagov.example", country: "United States", region: null }]),
      { maxCandidates: 40 }, { gate: () => true },
    );
    const u = await hunt(plan(["United States"], ["government agency bureau"]), runner);
    const gov = u.candidates.find((c) => c.identity.domain === "usagov.example");
    t("off-target reused identity is admitted to grouping but EXCLUDED by hard exclusion",
      !!gov && gov.status === "excluded" && u.coverage.vaultReusedCandidates === 0);
  }

  // ── OFF path: gate closed → hunt sees only fresh, no Vault contribution ──
  {
    const runner = withVaultReuse(
      baseRunner([fresh("Rockwell", "rockwellautomation.com", "United States")]),
      vaultRows([{ name: "Post Holdings", domain: "postholdings.com", country: "United States", region: null }]),
      { maxCandidates: 40 }, { gate: () => false },
    );
    const u = await hunt(plan(["United States"]), runner);
    t("closed gate → universe is fresh-only, vaultReusedCandidates = 0", !u.candidates.some((c) => c.originFlags?.includes("VAULT_REUSED")) && (u.coverage.vaultReusedCandidates ?? 0) === 0);
  }

  // ── DOCUMENTED BLOCKER (canary finding §34): the neutral projection omits org type,
  // and the frozen research-readiness gate requires a confirmed/target-matching type, so
  // reused identities are admitted to the Universe but do NOT reach Research yet. This is
  // the identified loss stage (Research selection); enabling Research on reused identities
  // is a scoped, separately-validated next step. Locked here so the behavior is explicit. ──
  {
    const runner = withVaultReuse(
      baseRunner([fresh("Fresh Mfr", "freshmfr.com", "United States", "vertical_seed")]),
      vaultRows([
        { name: "American Packaging", domain: "americanpackaging.com", country: "United States", region: null },
        { name: "Post Holdings", domain: "postholdings.com", country: "United States", region: null },
      ]),
      { maxCandidates: 40 }, { gate: () => true },
    );
    const u = await hunt(plan(["United States"]), runner);
    const ready = prioritizeResearch(u.candidates, u.plan);
    t("reused identities are admitted to the Universe (2 vault_reused)", u.coverage.vaultReusedCandidates === 2);
    t("BLOCKER: type-free reused identities do NOT reach Research (loss at Research selection §34)",
      ready.length >= 1 && ready.every((c) => !c.originFlags?.includes("VAULT_REUSED")));
    t("fresh, type-confirmed candidate still reaches Research (no regression)", ready.some((c) => c.identity.canonicalName === "Fresh Mfr"));
  }

  console.log(`\n${p} passed, 0 failed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
