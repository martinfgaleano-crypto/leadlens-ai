// VAULT ACCRETION V1 — CLOSEOUT: Research event/source accretion controlled tests.
// Proves the truth invariants for the productive Research → Vault path WITHOUT a DB:
//  §5  only grounded events with a source are admitted
//  §7  event_date ≠ publication_date ≠ retrieval date
//  §8  same real event rediscovered dedups (fingerprint, not URL)
//  §9  distinct events (different date/type/claim) stay distinct
//  §11/§12 source dedup within account; no false independence from differing URLs
//  §18 Vault write failure is isolated (counted, never thrown)
//  §19/§20 retry + cross-run idempotency
//  §21 cross-tenant SAME company shares one global identity + dedups the public event
//  §22 zero customer-relative leakage into Vault
//  §23 weaker identity does not downgrade a stronger existing company
//  §24 same name / different domain never merges
//  §25 no-domain researched account is not fabricated into a company

import assert from "node:assert/strict";
import { accreteResearchedAccounts, type ResearchAccretionDeps, type ResearchedAccountInput } from "@/lib/vault/vault-research-accretion";
import type { VaultCompany, VaultSignal, VaultSource } from "@/lib/vault/vault-types";

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

// Shared in-memory Vault doubles (a GLOBAL registry — the same instance across tenants).
function vaultDouble(opts: { failSignal?: boolean } = {}) {
  const companies = new Map<string, VaultCompany>(); // domain -> company
  const signals: VaultSignal[] = [];
  const sources: VaultSource[] = [];
  let cid = 0, sid = 0, gid = 0;
  const deps: ResearchAccretionDeps = {
    findByDomain: async (d) => companies.get(d) ?? null,
    createCompany: async (i) => {
      const row = { id: `c${cid++}`, name: i.name!, domain: i.domain ?? null, website_url: i.website_url ?? null, linkedin_company_url: null, industry: i.industry ?? null, region: i.region ?? null, country: i.country ?? null, company_size: null, description: null, source_status: i.source_status ?? null, vault_status: "candidate" as const, suppression_status: "active", created_at: "", updated_at: "" };
      if (i.domain) companies.set(i.domain, row);
      return row;
    },
    listSignalsByCompany: async (companyId) => signals.filter((s) => s.company_id === companyId),
    createSource: async (i) => {
      const row = { id: `s${sid++}`, provider_id: null, source_type: i.source_type, source_url: i.source_url ?? null, source_title: null, retrieved_at: i.retrieved_at ?? null, published_at: i.published_at ?? null, freshness_status: null, confidence_score: null, usage_rights_status: "unverified" as const, notes: null, raw_metadata: i.raw_metadata ?? null, created_at: "" };
      sources.push(row); return row;
    },
    createSignal: async (i) => {
      if (opts.failSignal) throw new Error("vault_signal_write_failed");
      const row = { id: `g${gid++}`, company_id: i.company_id ?? null, contact_id: null, source_id: i.source_id ?? null, signal_type: i.signal_type, signal_summary: i.signal_summary ?? null, signal_date: i.signal_date ?? null, expires_at: null, strength_score: null, confidence_score: null, review_status: "pending_review" as const, data_origin: i.data_origin, production_eligible: false, origin_reason: i.origin_reason ?? null, created_at: "", updated_at: "" };
      signals.push(row); return row;
    },
  };
  return { deps, companies, signals, sources };
}

const acct = (name: string, domain: string | null, events: ResearchedAccountInput["events"]): ResearchedAccountInput => ({ company: { name, domain, country: "United States", industry: "Manufacturing" }, events });
const ev = (extra: Partial<ResearchedAccountInput["events"][number]> = {}): ResearchedAccountInput["events"][number] => ({ event_type: "new_facility", claim: "Opened a new plant in Ohio", event_date: "2026-06-10", source_url: "https://news.example/plant", ...extra });

const run = async () => {
  // §5 — grounded event with a source is admitted; claimless / sourceless rejected.
  await t("5 grounded event admitted; claimless & sourceless rejected", async () => {
    const v = vaultDouble();
    const m = await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [ev(), ev({ claim: "", event_date: "2026-06-11" }), ev({ source_url: null, claim: "No source claim" })])], "controlled_validation", v.deps);
    assert.equal(m.events_new, 1); assert.equal(m.events_rejected, 2);
    assert.equal(v.signals.length, 1); assert.equal(v.sources.length, 1);
  });

  // §7 — event_date, publication_date, retrieved_at are distinct fields.
  await t("7 event_date != publication_date != retrieval date", async () => {
    const v = vaultDouble();
    await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [ev({ event_date: "2026-06-10", publication_date: "2026-06-20" })])], "controlled_validation", v.deps);
    assert.equal(v.signals[0].signal_date, "2026-06-10");           // event date
    assert.equal(v.sources[0].published_at, "2026-06-20");          // publication date
    assert.ok(v.sources[0].retrieved_at && v.sources[0].retrieved_at !== "2026-06-10"); // observed_at distinct, not backfilled with event date
  });

  // §8 — same real event rediscovered (diff URL/provider/run) dedups.
  await t("8 same event rediscovered dedups (not by URL)", async () => {
    const v = vaultDouble();
    await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [ev()])], "controlled_validation", v.deps);
    const m2 = await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [ev({ source_url: "https://OTHER-provider.example/x" })])], "controlled_validation", v.deps);
    assert.equal(m2.events_new, 0); assert.equal(m2.events_rediscovered, 1);
    assert.equal(v.signals.length, 1);
  });

  // §9 — distinct events (different date + material claim) remain distinct.
  await t("9 distinct events stay distinct (June expansion vs Aug acquisition)", async () => {
    const v = vaultDouble();
    const m = await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [
      ev({ event_type: "expansion", claim: "Opened a new plant in Ohio", event_date: "2026-06-10" }),
      ev({ event_type: "acquisition", claim: "Acquired a rival supplier", event_date: "2026-08-02", source_url: "https://news.example/deal" }),
    ])], "controlled_validation", v.deps);
    assert.equal(m.events_new, 2); assert.equal(v.signals.length, 2);
  });

  // §11/§12 — two events, same source URL → one source row (no false independence).
  await t("11/12 same source url deduped within account", async () => {
    const v = vaultDouble();
    const m = await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [
      ev({ claim: "Opened a new plant", event_date: "2026-06-10", source_url: "https://news.example/same" }),
      ev({ claim: "Broke ground on a new warehouse", event_type: "expansion", event_date: "2026-06-12", source_url: "https://news.example/same" }),
    ])], "controlled_validation", v.deps);
    assert.equal(m.events_new, 2); assert.equal(m.sources_new, 1); assert.equal(m.sources_rediscovered, 1);
  });

  // §18 — signal write failure isolated (counted, never thrown).
  await t("18 Vault write failure is isolated (counted, never thrown)", async () => {
    const v = vaultDouble({ failSignal: true });
    const m = await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [ev()])], "controlled_validation", v.deps);
    assert.equal(m.errors, 1); assert.equal(m.events_new, 0);
  });

  // §19/§20 — retry / cross-run idempotency: re-accreting the identical account adds nothing.
  await t("19/20 retry + cross-run idempotency", async () => {
    const v = vaultDouble();
    await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [ev()])], "customer_run", v.deps);
    const m2 = await accreteResearchedAccounts([acct("Acme Mfg", "acme.com", [ev()])], "customer_run", v.deps);
    assert.equal(m2.events_new, 0); assert.equal(m2.events_rediscovered, 1);
    assert.equal(v.signals.length, 1); assert.equal(v.companies.size, 1);
  });

  // §21 — cross-tenant SAME public company: one global identity, one public event.
  await t("21 cross-tenant same company shares global identity + dedups public event", async () => {
    const v = vaultDouble(); // one GLOBAL registry shared by both tenants
    await accreteResearchedAccounts([acct("Nestle", "nestle.com", [ev({ claim: "Opened a new factory", event_date: "2026-05-01" })])], "customer_run", v.deps); // tenant A
    const mB = await accreteResearchedAccounts([acct("Nestle", "nestle.com", [ev({ claim: "Opened a new factory", event_date: "2026-05-01", source_url: "https://tenantB.example/x" })])], "customer_run", v.deps); // tenant B
    assert.equal(v.companies.size, 1);               // same global company
    assert.equal(mB.companies_new, 0);
    assert.equal(mB.events_rediscovered, 1);         // same public event deduped globally
    assert.equal(v.signals.length, 1);
  });

  // §22 — ZERO customer-relative leakage: no Fit/Timing/Decision/thesis anywhere in Vault.
  await t("22 zero customer-relative leakage into Vault", async () => {
    const v = vaultDouble();
    // Poison the input with forbidden fields; the module must ignore them entirely.
    const poisoned = { company: { name: "Globex", domain: "globex.com", fit: "Strong", decision: "prioritize", opportunity_thesis: "secret" }, events: [{ ...ev(), timing: "immediate", why_it_matters: "customer-A rationale", revisit_when: "Q4" }] } as unknown as ResearchedAccountInput;
    await accreteResearchedAccounts([poisoned], "customer_run", v.deps);
    const dump = JSON.stringify({ companies: Array.from(v.companies.values()), signals: v.signals, sources: v.sources }).toLowerCase();
    for (const forbidden of ["fit", "timing", "decision", "prioritize", "opportunity_thesis", "secret", "why_it_matters", "revisit", "customer-a", "strong"]) {
      assert.ok(!dump.includes(forbidden.toLowerCase()), `Vault must not contain '${forbidden}'`);
    }
  });

  // §23 — weaker later identity does not downgrade a stronger existing company.
  await t("23 weaker identity does not downgrade stronger existing company", async () => {
    const v = vaultDouble();
    await accreteResearchedAccounts([{ company: { name: "Strong Co", domain: "strong.com", country: "United States", industry: "Manufacturing", website_url: "https://strong.com" }, events: [ev()] }], "customer_run", v.deps);
    await accreteResearchedAccounts([{ company: { name: "Strong Co", domain: "strong.com" }, events: [ev({ claim: "Acquired a logistics firm", event_date: "2026-07-01", source_url: "https://news.example/2" })] }], "customer_run", v.deps);
    const c = v.companies.get("strong.com")!;
    assert.equal(c.country, "United States"); assert.equal(c.industry, "Manufacturing"); // retained
    assert.equal(v.companies.size, 1);
  });

  // §24 — same name / different domain never merges.
  await t("24 same name different domain -> two companies", async () => {
    const v = vaultDouble();
    await accreteResearchedAccounts([acct("Apex Corp", "apex-us.com", [ev()]), acct("Apex Corp", "apex-eu.com", [ev({ source_url: "https://news.example/eu" })])], "customer_run", v.deps);
    assert.equal(v.companies.size, 2);
  });

  // §25 — no-domain researched account is not fabricated into a company.
  await t("25 no-domain account is not fabricated", async () => {
    const v = vaultDouble();
    const m = await accreteResearchedAccounts([acct("Ambiguous Co", null, [ev()])], "customer_run", v.deps);
    assert.equal(m.no_domain_skipped, 1); assert.equal(v.companies.size, 0); assert.equal(v.signals.length, 0);
  });

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
