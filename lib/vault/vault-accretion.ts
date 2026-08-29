// Vault Accretion V1 (VAULT ACCRETION V1 §24) — persist VALID discovered companies as
// durable, reusable, customer-INDEPENDENT account intelligence.
//
// Reuses the EXISTING Vault primitives (vault_companies via vault-store, entity-
// resolution admission) rather than a parallel system (§2/§10). It is universal-only
// BY CONSTRUCTION: the VaultCompany schema carries no Fit/Timing/Decision/Opportunity
// fields, and this module writes only public company facts (§20). It never persists a
// customer-relative conclusion, never merges two companies by name (dedup is by
// DOMAIN, §10), rejects non-accounts (§8), and is failure-isolated — a Vault write
// error is returned as a metric and NEVER alters the Intelligence run (§25/§44).
//
// This module does NOT read Vault back into Discovery (no vault-assisted recall /
// benchmark leakage, §19); it only accretes.

import { classifyEntity } from "@/lib/vault/entity-resolution";
import type { VaultCompany } from "@/lib/vault/vault-types";

/** Production binding: the real durable Vault registry (global service-role table
 * vault_companies). Kept lazy so tests never touch the DB and can inject doubles. */
export async function productionVaultAccretionDeps(): Promise<VaultAccretionDeps> {
  const { findVaultCompanyByDomain, createVaultCompany } = await import("@/lib/storage/vault-store");
  return { findByDomain: findVaultCompanyByDomain, create: createVaultCompany };
}

export type VaultProvenance = "live_validation" | "controlled_validation" | "customer_run" | "diagnostic_control" | "monitor_update";

export interface DiscoveredCompanyInput {
  name: string;
  domain: string | null;
  country?: string | null;
  region?: string | null;
  industry?: string | null;
  website_url?: string | null;
  sourceUrl?: string | null;
}

export interface VaultAccretionDeps {
  findByDomain: (domain: string) => Promise<VaultCompany | null>;
  create: (input: Partial<VaultCompany> & { name: string }) => Promise<VaultCompany | null>;
  classify?: typeof classifyEntity;
}

export interface VaultAccretionMetrics {
  provenance: VaultProvenance;
  evaluated: number;
  new_companies: number;
  existing_rediscovered: number;
  rejected_non_account: number;
  no_domain_skipped: number;   // no reliable dedup key → not admitted (stays telemetry)
  errors: number;
}

// Only a canonically resolved single company is admitted (§8). Publishers,
// directories, facilities, multi-company and unresolved entities never enter the
// canonical registry — they remain Discovery telemetry.
const ADMISSIBLE = new Set(["single_company"]);

/**
 * Accrete valid discovered companies into the durable Vault registry. Idempotent by
 * domain: a rediscovered company updates nothing structural and is counted, never
 * duplicated (§9/§26). Best-effort and failure-isolated (§25/§44).
 */
export async function accreteDiscoveredCompanies(
  companies: DiscoveredCompanyInput[],
  provenance: VaultProvenance,
  deps: VaultAccretionDeps,
): Promise<VaultAccretionMetrics> {
  const classify = deps.classify ?? classifyEntity;
  const m: VaultAccretionMetrics = { provenance, evaluated: 0, new_companies: 0, existing_rediscovered: 0, rejected_non_account: 0, no_domain_skipped: 0, errors: 0 };
  const seenDomains = new Set<string>();

  for (const c of companies) {
    m.evaluated++;
    try {
      // Admission gate — reject anything that is not a single canonical company.
      const cls = classify({ name: c.name, sourceUrl: c.sourceUrl ?? null });
      if (!ADMISSIBLE.has(cls.entity_class)) { m.rejected_non_account++; continue; }

      // Domain is the safe dedup key. Without it we cannot resolve identity without
      // risking a wrong-merge (§10), so it stays Discovery telemetry, not the registry.
      const domain = (c.domain ?? "").trim().toLowerCase().replace(/^www\./, "");
      if (!domain) { m.no_domain_skipped++; continue; }

      // Within-run idempotency for repeated domains in the same batch.
      if (seenDomains.has(domain)) { m.existing_rediscovered++; continue; }
      seenDomains.add(domain);

      const existing = await deps.findByDomain(domain);
      if (existing) { m.existing_rediscovered++; continue; }

      // Universal facts ONLY. No Fit/Timing/Decision/Opportunity ever reaches Vault —
      // the VaultCompany shape has no such fields, and we pass only public facts.
      await deps.create({
        name: c.name,
        domain,
        website_url: c.website_url ?? (domain ? `https://${domain}` : null),
        industry: c.industry ?? null,
        region: c.region ?? null,
        country: c.country ?? null,
        source_status: provenance,
      });
      m.new_companies++;
    } catch {
      // A Vault write failure is isolated — it is counted and never rethrown, so the
      // Intelligence run's Decisions/Evidence are unaffected (§25/§44).
      m.errors++;
    }
  }
  return m;
}
