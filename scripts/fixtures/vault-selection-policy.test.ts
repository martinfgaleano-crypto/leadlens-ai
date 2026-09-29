// Vault Selection Policy (§2): below the milestone Vault is inventory/dedup/memory,
// NOT the customer shortlist source; above it, the wider inventory may seed candidates.
// Also verifies the customer-job orchestrator honors vaultAsSelectionSource.
import { resolveVaultSelectionPolicy, VAULT_SELECTION_THRESHOLD_DEFAULT } from "../../lib/intelligence/vault-selection-policy";
import { newCustomerJobState, runOnePass, type CustomerJobDeps, type DiscoveredCompany } from "../../lib/intelligence/customer-job";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

// ── Policy resolution ──
{
  const below = resolveVaultSelectionPolicy(242);
  t("below 5000 → inventory_only, not a selection source", below.mode === "inventory_only" && below.vaultAsSelectionSource === false && below.threshold === VAULT_SELECTION_THRESHOLD_DEFAULT);
  const at = resolveVaultSelectionPolicy(5000);
  t("at 5000 → candidate_source", at.mode === "candidate_source" && at.vaultAsSelectionSource === true);
  const above = resolveVaultSelectionPolicy(9000);
  t("above 5000 → candidate_source", above.vaultAsSelectionSource === true);
  const overrideOn = resolveVaultSelectionPolicy(10, { VAULT_SELECTION_MODE: "candidate_source" });
  t("explicit mode override wins (candidate_source at low count)", overrideOn.vaultAsSelectionSource === true);
  const overrideOff = resolveVaultSelectionPolicy(99999, { VAULT_SELECTION_MODE: "inventory_only" });
  t("explicit mode override wins (inventory_only at high count)", overrideOff.vaultAsSelectionSource === false);
  const customThreshold = resolveVaultSelectionPolicy(300, { VAULT_SELECTION_THRESHOLD: "200" });
  t("custom threshold honored (300 ≥ 200 → candidate_source)", customThreshold.vaultAsSelectionSource === true && customThreshold.threshold === 200);
}

// ── Orchestrator honors the policy ──
async function main() {
  const co = (n: string, d: string): DiscoveredCompany => ({ company: n, domain: d, country: "United States", industry: "grocery" });
  const makeDeps = (): CustomerJobDeps => ({
    now: () => new Date("2026-09-29T00:00:00Z"),
    vaultFirst: async () => [co("VaultCo A", "vaulta.com"), co("VaultCo B", "vaultb.com")],
    discover: async () => ({ discovered: [co("FreshCo", "fresh.com")], providersAttempted: ["brave"], providerState: {}, rawResults: 3, costUsd: 0.01 }),
    vaultWriteThrough: async (companies) => ({ evaluated: companies.length, new_companies: companies.length, existing_rediscovered: 0, rejected_non_account: 0 }),
    qualify: async (cands) => ({ qualified: cands.map((c) => ({ key: c.key, company: c.company, domain: c.domain, route: c.route, decision: "hold" as const, fit: "Strong", timing: null, evidenceCount: 1, qualifiedAtPass: c.firstSeenPass })), rejected: [] }),
  });
  const spec = { passId: 1, route: "retail", queryFamilyId: "retail:f1", queries: [] };

  // Policy OFF (below milestone): only the fresh external company enters selection.
  const s1 = newCustomerJobState({ jobId: "jp1", customer: "C", objective: "O", contextVersion: 1, geography: "US" });
  await runOnePass(s1, spec, makeDeps(), { vaultAsSelectionSource: false });
  t("inventory_only: Vault-first hits NOT selected (only fresh external)", s1.candidates.length === 1 && s1.candidates[0].company === "FreshCo");
  t("inventory_only: Vault-first matches still counted for observability", (s1.vault.vaultFirstMatches ?? 0) === 2);
  t("inventory_only: existingReused not inflated by vault-first hits", s1.vault.existingReused === 0);

  // Policy ON (at/above milestone): Vault-first hits may seed candidates.
  const s2 = newCustomerJobState({ jobId: "jp2", customer: "C", objective: "O", contextVersion: 1, geography: "US" });
  await runOnePass(s2, spec, makeDeps(), { vaultAsSelectionSource: true });
  t("candidate_source: Vault-first hits + fresh all enter selection (3)", s2.candidates.length === 3);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
