// Verified-Identity Reuse V1 — neutral Vault → Candidate Universe seeding
//
// Fresh USA Account-First/Event-First discovery collapses to ~1 operating company because English
// category search returns market-research SEO (see the USA discovery acceptance docs). The canonical
// global Vault, however, already holds verified operating-company identities (measured: 71 US companies,
// all with domains, 46 industrial-relevant; plus Colombian operators). This lane reuses those NEUTRAL
// public identities as additional Account-First candidates so the customer's own target-validation and
// canonical Research can evaluate them.
//
// TENANCY / TRUTH BOUNDARY (§24–§27, FIX-BEFORE-CLOSE): reuse projects ONLY neutral public identity —
// company name, canonical domain, country. It never reads or emits the Vault `industry` field (which is
// customer-ICP-derived), observation counts, last_seen, source status, or any customer-relative Fit /
// Timing / Decision / thesis / notes / run id. Selection is filtered only by the CURRENT customer's own
// requested geography. Relevance and current events are re-established downstream by the existing
// per-customer target-validation and canonical Research — a reused identity carries no Evidence, no
// Timing and no Decision, and `last_seen` is never an event date. Discovery provenance only.

import type { RawDiscoveredOrg, DiscoveryPlan, DiscoveryRunOutput, DiscoveryRunner } from "./candidate-universe";

export const VAULT_IDENTITY_REUSE_VERSION = "vault-identity-reuse-v1";

/** The ONLY fields projected from the Vault. Deliberately excludes industry/observation/ICP metadata. */
export interface NeutralVaultIdentity { name: string | null; domain: string | null; country: string | null; region: string | null }

export interface VaultReuseDeps {
  /** Fetch neutral identities for the requested geographies. Implementations MUST select only
   * name/domain/country/region from the global Vault — never industry or customer-relative columns. */
  fetchNeutralIdentities: (geographies: string[]) => Promise<NeutralVaultIdentity[]>;
}
export interface VaultReuseBudget { maxCandidates: number }
export const DEFAULT_VAULT_REUSE_BUDGET: VaultReuseBudget = { maxCandidates: 40 };

export interface VaultReuseMetrics { fetched: number; admitted: number; rejected: Record<string, number> }
export interface VaultReuseResult { orgs: RawDiscoveredOrg[]; metrics: VaultReuseMetrics }

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

const GEO_ALIASES: Record<string, RegExp> = {
  us: /united states|u\.?s\.?a?\.?|america/i,
  co: /colombia|bogot|medell|\bcali\b|barranquilla|cartagena/i,
};
/** Neutral geography match: the Vault country/region (a public fact) against the customer's requested
 * geography. Never uses any customer-relative attribute. */
export function geographyMatches(row: NeutralVaultIdentity, geographies: string[]): boolean {
  if (!geographies.length) return true;
  const hay = `${row.country ?? ""} ${row.region ?? ""}`.toLowerCase();
  return geographies.some((g) => {
    const gl = g.toLowerCase();
    if (/united states|usa|u\.s\./.test(gl)) return GEO_ALIASES.us.test(hay);
    if (/colombia/.test(gl)) return GEO_ALIASES.co.test(hay);
    if (/south america|latin/.test(gl)) return /colombia|brazil|brasil|chile|peru|per[uú]|argentina|ecuador|bolivia|uruguay|paraguay|venezuela/i.test(hay);
    // Fallback: token overlap on the geography name.
    return hay.includes(gl.split(/[:,]/)[0].trim());
  });
}

/** Project a Vault row to a candidate account carrying ONLY neutral identity + reuse provenance. */
export function projectNeutralIdentity(row: NeutralVaultIdentity): RawDiscoveredOrg | null {
  if (!row.name || !row.domain) return null;
  const name = clean(row.name);
  if (name.length < 2) return null;
  return {
    name, domain: row.domain.trim().toLowerCase(),
    country: row.country ?? undefined,
    origin: "vault_reuse", provider: "vault", route: "verified_identity_reuse",
    confidence: "plausible",
    // No researchHint, no industry, no organizationType from Vault — relevance is recomputed per customer.
  };
}

export async function selectVaultReuseCandidates(
  context: { geographies: string[] },
  deps: VaultReuseDeps,
  budget: VaultReuseBudget = DEFAULT_VAULT_REUSE_BUDGET,
): Promise<VaultReuseResult> {
  const metrics: VaultReuseMetrics = { fetched: 0, admitted: 0, rejected: {} };
  const reject = (r: string) => { metrics.rejected[r] = (metrics.rejected[r] ?? 0) + 1; };
  const rows = await deps.fetchNeutralIdentities(context.geographies).catch(() => [] as NeutralVaultIdentity[]);
  metrics.fetched = rows.length;
  const orgs: RawDiscoveredOrg[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!geographyMatches(row, context.geographies)) { reject("geography"); continue; }
    const org = projectNeutralIdentity(row);
    if (!org) { reject("no_identity"); continue; }
    if (seen.has(org.domain!)) { reject("duplicate_domain"); continue; }
    seen.add(org.domain!);
    orgs.push(org);
    metrics.admitted++;
    if (orgs.length >= budget.maxCandidates) break;
  }
  return { orgs, metrics };
}

/** Additive composition: run the base productive discovery runner, then APPEND neutral Vault-reuse
 * identities as extra candidates. The base output (metrics, coverage, event-first/account-first orgs)
 * is preserved; hunt's existing per-customer target-validation, geography and canonical dedup then
 * evaluate the combined set — vault-reuse orgs never bypass a gate, and a reused identity carries no
 * Evidence/Timing/Decision. Enable at the productive runner-injection points to overcome a thin fresh
 * universe without a competing discovery engine. */
export function withVaultReuse(base: DiscoveryRunner, deps: VaultReuseDeps, budget: VaultReuseBudget = DEFAULT_VAULT_REUSE_BUDGET): DiscoveryRunner {
  return async (plan: DiscoveryPlan): Promise<DiscoveryRunOutput> => {
    const out = await base(plan);
    try {
      const reuse = await selectVaultReuseCandidates({ geographies: plan.geographies }, deps, budget);
      if (!reuse.orgs.length) return out;
      const seen = new Set(out.orgs.map((o) => (o.domain ?? o.name).toLowerCase()));
      const extra = reuse.orgs.filter((o) => !seen.has((o.domain ?? o.name).toLowerCase()));
      return { ...out, orgs: [...out.orgs, ...extra] };
    } catch {
      return out; // fail-closed: reuse never breaks a customer discovery run
    }
  };
}
