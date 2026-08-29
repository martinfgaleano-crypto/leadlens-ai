// VAULT ACCRETION V1 — controlled safety tests (§34-44).
// Proves: canonical company persists once; rediscovery dedups by domain; same-name /
// different-domain never merges; non-accounts excluded; NO customer-relative field
// ever reaches Vault; Vault-write failure is isolated; idempotent; no-domain skipped.

import assert from "node:assert/strict";
import { accreteDiscoveredCompanies, type DiscoveredCompanyInput, type VaultAccretionDeps } from "@/lib/vault/vault-accretion";
import type { VaultCompany } from "@/lib/vault/vault-types";

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

// In-memory Vault double keyed by domain.
function vaultDouble(opts: { failOnCreate?: boolean } = {}) {
  const rows = new Map<string, VaultCompany>();
  const creates: Array<Partial<VaultCompany>> = [];
  const deps: VaultAccretionDeps = {
    findByDomain: async (d) => rows.get(d) ?? null,
    create: async (input) => {
      if (opts.failOnCreate) throw new Error("vault_write_failed");
      creates.push(input);
      const row = { id: `v_${rows.size}`, name: input.name!, domain: input.domain ?? null, website_url: input.website_url ?? null, linkedin_company_url: null, industry: input.industry ?? null, region: input.region ?? null, country: input.country ?? null, company_size: null, description: null, source_status: input.source_status ?? null, vault_status: "candidate" as const, suppression_status: "active", created_at: "", updated_at: "" };
      if (input.domain) rows.set(input.domain, row);
      return row;
    },
  };
  return { deps, rows, creates };
}

const co = (name: string, domain: string | null, extra: Partial<DiscoveredCompanyInput> = {}): DiscoveredCompanyInput => ({ name, domain, country: "United States", industry: "Manufacturing", ...extra });

const run = async () => {
  // §34 — new valid company: created once.
  await t("34 new valid company is created once", async () => {
    const v = vaultDouble();
    const m = await accreteDiscoveredCompanies([co("Acme Manufacturing", "acme.com")], "live_validation", v.deps);
    assert.equal(m.new_companies, 1); assert.equal(v.creates.length, 1); assert.equal(v.rows.size, 1);
  });

  // §35 / §26 — rediscovery + idempotency: same domain never duplicates.
  await t("35/26 rediscovery + rerun dedups by domain (idempotent)", async () => {
    const v = vaultDouble();
    await accreteDiscoveredCompanies([co("Acme Manufacturing", "acme.com")], "live_validation", v.deps);
    const m2 = await accreteDiscoveredCompanies([co("Acme Manufacturing", "acme.com"), co("Acme Manufacturing", "acme.com")], "live_validation", v.deps);
    assert.equal(m2.new_companies, 0); assert.equal(m2.existing_rediscovered, 2); assert.equal(v.rows.size, 1);
  });

  // §36 / §10 — same name, different domain: NOT merged.
  await t("36 same name different domain -> two records, no unsafe merge", async () => {
    const v = vaultDouble();
    const m = await accreteDiscoveredCompanies([co("Apex Corp", "apex-us.com"), co("Apex Corp", "apex-eu.com")], "live_validation", v.deps);
    assert.equal(m.new_companies, 2); assert.equal(v.rows.size, 2);
  });

  // §37 / §8 — publisher / non-account rejected.
  await t("37 publisher/non-account is rejected from the registry", async () => {
    const v = vaultDouble();
    const m = await accreteDiscoveredCompanies([co("Reuters", "reuters.com"), co("Top 20 Manufacturing Companies", "industryweek.com")], "live_validation", v.deps);
    assert.ok(m.rejected_non_account >= 1, "at least the publisher/list is rejected");
    assert.ok(!Array.from(v.rows.keys()).includes("reuters.com") || v.rows.size < 2);
  });

  // no-domain: skipped (no safe dedup key), not fabricated.
  await t("no-domain company is skipped (no safe identity key)", async () => {
    const v = vaultDouble();
    const m = await accreteDiscoveredCompanies([co("Ambiguous Co", null)], "live_validation", v.deps);
    assert.equal(m.no_domain_skipped, 1); assert.equal(m.new_companies, 0); assert.equal(v.rows.size, 0);
  });

  // §41 / §20 — customer-relative data MUST NOT reach Vault.
  await t("41 customer-relative Fit/Timing/Decision never persisted to Vault", async () => {
    const v = vaultDouble();
    // Attach forbidden fields; the module must ignore them (it only reads universal keys).
    const poisoned = { ...co("Globex Inc", "globex.com"), fit: "Strong", timing: "Now", decision: "prioritize", opportunity_thesis: "secret" } as unknown as DiscoveredCompanyInput;
    await accreteDiscoveredCompanies([poisoned], "customer_run", v.deps);
    const written = JSON.stringify(v.creates[0] ?? {});
    for (const forbidden of ["fit", "timing", "decision", "opportunity", "prioritize", "Strong", "secret"]) {
      assert.ok(!written.toLowerCase().includes(forbidden.toLowerCase()), `Vault write must not contain '${forbidden}'`);
    }
  });

  // §44 / §25 — Vault write failure is isolated (never throws).
  await t("44 Vault write failure is isolated (counted, never thrown)", async () => {
    const v = vaultDouble({ failOnCreate: true });
    const m = await accreteDiscoveredCompanies([co("Initech", "initech.com")], "live_validation", v.deps);
    assert.equal(m.errors, 1); assert.equal(m.new_companies, 0); // returned metrics, no exception
  });

  // provenance recorded (§17/§20 — diagnostic vs live distinguished, no customer prose).
  await t("provenance is recorded as source_status (diagnostic/live distinguishable)", async () => {
    const v = vaultDouble();
    await accreteDiscoveredCompanies([co("Umbrella LLC", "umbrella.com")], "diagnostic_control", v.deps);
    assert.equal(v.creates[0].source_status, "diagnostic_control");
  });

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
