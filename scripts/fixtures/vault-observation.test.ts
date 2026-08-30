// CANONICAL VAULT V2 — observation tracking (migration 059).
// A re-observed company advances last_seen_at (deps.touch) and is NEVER duplicated; a new
// company is created (first_seen/last_seen set in the store), not touched.

import assert from "node:assert/strict";
import { accreteDiscoveredCompanies, type VaultAccretionDeps } from "@/lib/vault/vault-accretion";
import { accreteResearchedAccounts, type ResearchAccretionDeps } from "@/lib/vault/vault-research-accretion";
import type { VaultCompany } from "@/lib/vault/vault-types";

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

function companyDouble() {
  const rows = new Map<string, VaultCompany>(); const touched: string[] = []; let id = 0;
  const mk = (i: any): VaultCompany => ({ id: `c${id++}`, name: i.name, domain: i.domain ?? null, website_url: null, linkedin_company_url: null, industry: i.industry ?? null, region: null, country: i.country ?? null, company_size: null, description: null, source_status: i.source_status ?? null, vault_status: "candidate" as const, suppression_status: "active", created_at: "", updated_at: "" });
  return { rows, touched,
    findByDomain: async (d: string) => rows.get(d) ?? null,
    create: async (i: any) => { const r = mk(i); if (i.domain) rows.set(i.domain, r); return r; },
    touch: async (cid: string) => { touched.push(cid); return true; },
  };
}
const co = (name: string, domain: string) => ({ name, domain, country: "US", industry: "Manufacturing" });

const run = async () => {
  // Discovery accretion: first run creates (no touch); second run touches existing, no dup.
  await t("discovery: new company created (not touched), re-observed company touched + not duplicated", async () => {
    const d = companyDouble();
    const deps: VaultAccretionDeps = { findByDomain: d.findByDomain, create: d.create, touch: d.touch };
    const m1 = await accreteDiscoveredCompanies([co("Acme", "acme.com")], "customer_run", deps);
    assert.equal(m1.new_companies, 1); assert.equal(d.touched.length, 0, "new company must not be touched");
    const m2 = await accreteDiscoveredCompanies([co("Acme", "acme.com")], "customer_run", deps);
    assert.equal(m2.new_companies, 0); assert.equal(m2.existing_rediscovered, 1);
    assert.equal(d.rows.size, 1, "no duplicate company");
    assert.deepEqual(d.touched, ["c0"], "existing company observed → touched once");
  });

  // Research accretion: existing company on a later run is touched (visible reuse).
  await t("research: existing company re-observed is touched, new is not", async () => {
    const d = companyDouble();
    const deps: ResearchAccretionDeps = { findByDomain: d.findByDomain, createCompany: d.create, touch: d.touch,
      listSignalsByCompany: async () => [], createSource: async () => null, createSignal: async () => null };
    const acct = (dom: string) => ({ company: { name: "Acme", domain: dom, country: "US", industry: "Manufacturing" }, events: [] as never[] });
    await accreteResearchedAccounts([acct("acme.com")], "customer_run", deps);
    assert.equal(d.touched.length, 0, "first observation creates, does not touch");
    await accreteResearchedAccounts([acct("acme.com")], "customer_run", deps);
    assert.deepEqual(d.touched, ["c0"], "second observation touches existing");
    assert.equal(d.rows.size, 1);
  });

  // Touch is optional (deps without touch must not break).
  await t("touch is optional — accretion works without it", async () => {
    const d = companyDouble();
    const deps: VaultAccretionDeps = { findByDomain: d.findByDomain, create: d.create }; // no touch
    await accreteDiscoveredCompanies([co("Beta", "beta.com")], "customer_run", deps);
    const m = await accreteDiscoveredCompanies([co("Beta", "beta.com")], "customer_run", deps);
    assert.equal(m.existing_rediscovered, 1); assert.equal(d.rows.size, 1);
  });

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
