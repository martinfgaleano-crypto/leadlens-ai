// Vault Research Accretion V1 (VAULT ACCRETION V1 — CLOSEOUT §3–§26) — persist
// VALIDATED, reusable, customer-INDEPENDENT factual EVENTS + SOURCES from Account Deep
// Research into the durable Vault (vault_signals / vault_sources), keyed to the global
// vault_companies registry.
//
// Universal-only BY CONSTRUCTION. The input projection carries no Fit/Timing/Decision/
// Opportunity Thesis/customer context (§5/§22), and this module writes only:
//   - a canonical company (reusing the same domain-keyed registry as company accretion),
//   - a bounded factual event (VaultSignal: type + claim + event_date),
//   - a source relation (VaultSource: url + publication/retrieval dates).
//
// Truth invariants preserved:
//   §4  Only accrete claims already accepted as verified_public_signal by Research gates
//       (the caller passes only those); never raw LLM prose.
//   §7  event_date ≠ publication_date ≠ retrieval date ≠ observed_at — kept in distinct
//       fields; an unknown event_date is stored as null, NEVER back-filled with today.
//   §8  Rediscovering the SAME real event dedups (fingerprint from stable identity), not
//       by URL, provider, publisher, wording, run, or tenant.
//   §9  Distinct events (different type/date/material claim) stay distinct — never merged
//       on company+type alone.
//   §13 Historical corroboration is stored as factual history, not promoted to current
//       Evidence; freshness is a READER concern, never asserted here.
//   §18 Failure-isolated: any write error is counted and NEVER rethrown, so Research
//       truth / Case / Decision are unaffected.
//   §16 Write-only: this module never reads Vault back into Case/Discovery reasoning.

import { classifyEntity } from "@/lib/vault/entity-resolution";
import { isMaterialEventClaim } from "@/lib/intelligence/evidence-materiality";
import type { VaultCompany, VaultSignal, VaultSource, VaultSignalType, DataOrigin } from "@/lib/vault/vault-types";
import type { VaultProvenance } from "@/lib/vault/vault-accretion";

/** Map accretion provenance to the fail-closed origin contract (037). Real live research
 *  is "production" origin; diagnostic controls are "benchmark"; controlled runs are
 *  "internal_qa". production_eligible stays false at insert regardless (§13 — factual
 *  history is not automatically current Evidence). */
function originFor(p: VaultProvenance): DataOrigin {
  if (p === "diagnostic_control") return "benchmark";
  if (p === "controlled_validation") return "internal_qa";
  return "production"; // customer_run | live_validation | monitor_update
}

/** Production binding to the real durable Vault registry (global service-role tables).
 *  Lazy so tests never touch the DB and can inject doubles. */
export async function productionResearchAccretionDeps(): Promise<ResearchAccretionDeps> {
  const s = await import("@/lib/storage/vault-store");
  return {
    findByDomain: s.findVaultCompanyByDomain,
    createCompany: s.createVaultCompany,
    listSignalsByCompany: s.listSignalsByCompany,
    createSource: s.createVaultSource,
    createSignal: s.createVaultSignal,
  };
}

/** Universal factual event projected from a researched account. Customer-relative by
 *  construction: NONE of Fit/Timing/Decision/thesis/context may appear here (§5/§22). */
export interface ResearchedEventInput {
  event_type: string | null;        // raw signal kind; mapped to a VaultSignalType
  claim: string;                    // bounded factual claim (verified_public_signal only)
  event_date: string | null;        // when the event happened — ≠ publication/retrieval (§7)
  publication_date?: string | null; // when a source published it, if known
  source_url: string | null;        // supporting source (provenance must exist, §5)
  materiality?: string | null;
  corroborating_domains?: number | null; // historical corroboration count (fact, not Evidence, §13)
}

export interface ResearchedAccountInput {
  company: { name: string; domain: string | null; country?: string | null; region?: string | null; industry?: string | null; website_url?: string | null; sourceUrl?: string | null };
  events: ResearchedEventInput[];
}

export interface ResearchAccretionDeps {
  findByDomain: (domain: string) => Promise<VaultCompany | null>;
  createCompany: (input: Partial<VaultCompany> & { name: string }) => Promise<VaultCompany | null>;
  listSignalsByCompany: (companyId: string) => Promise<VaultSignal[]>;
  createSource: (input: Partial<VaultSource> & { source_type: string }) => Promise<VaultSource | null>;
  createSignal: (input: Partial<VaultSignal> & { signal_type: string }) => Promise<VaultSignal | null>;
  classify?: typeof classifyEntity;
}

export interface ResearchAccretionMetrics {
  provenance: VaultProvenance;
  companies_evaluated: number;
  companies_resolved: number;      // admitted + domain-resolved
  companies_new: number;
  events_evaluated: number;
  events_new: number;
  events_rediscovered: number;     // same real event already in Vault (deduped)
  events_rejected: number;         // no claim / no source / non-account
  sources_new: number;
  sources_rediscovered: number;    // same source url within this accretion
  no_domain_skipped: number;       // account without a safe identity key
  errors: number;
}

const ADMISSIBLE = new Set(["single_company"]);

/** Map a raw research signal kind to the bounded Vault signal taxonomy. Unknown kinds
 *  are recorded as "other" (never dropped, never invented). */
function mapEventType(raw: string | null | undefined): VaultSignalType {
  const s = (raw ?? "").toLowerCase();
  if (/hir|job|talent|headcount|recruit/.test(s)) return "hiring";
  if (/expan|facility|plant|open|site|warehouse|capacity|construct/.test(s)) return "expansion";
  if (/fund|raise|series|invest|capital|round/.test(s)) return "funding";
  if (/launch|product|release|unveil/.test(s)) return "product_launch";
  if (/exec|leader|ceo|cfo|cto|appoint|hire.*(officer|chief)|leadership/.test(s)) return "leadership_change";
  if (/event|conference|summit|expo|tradeshow|booth/.test(s)) return "event_participation";
  if (/regulat|complian|approval|permit|fda|sanction/.test(s)) return "regulatory";
  return "other";
}

/** Normalize a claim into stable identity tokens for the event fingerprint (§10). Lower-
 *  cased, punctuation-stripped, first significant tokens — enough to identify the same
 *  real event, coarse enough that provider/publisher wording differences still match. */
function normalizeClaim(claim: string | null | undefined): string {
  return (claim ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 10)
    .join(" ");
}

/** Event identity from STABLE features only (company via signal row + type + date +
 *  normalized claim). NOT URL/provider/publisher/run/tenant (§8). Two events with the
 *  same type but different date or material claim → different fingerprints (§9). */
function eventFingerprint(type: VaultSignalType | string, eventDate: string | null, claim: string | null): string {
  return `${type}|${eventDate ?? "undated"}|${normalizeClaim(claim)}`;
}

function cleanDomain(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase().replace(/^www\./, "");
}

/**
 * Accrete validated research events/sources for a set of researched accounts. Idempotent
 * by event fingerprint (§8/§19/§20); best-effort and failure-isolated (§18).
 */
export async function accreteResearchedAccounts(
  accounts: ResearchedAccountInput[],
  provenance: VaultProvenance,
  deps: ResearchAccretionDeps,
): Promise<ResearchAccretionMetrics> {
  const classify = deps.classify ?? classifyEntity;
  const m: ResearchAccretionMetrics = {
    provenance, companies_evaluated: 0, companies_resolved: 0, companies_new: 0,
    events_evaluated: 0, events_new: 0, events_rediscovered: 0, events_rejected: 0,
    sources_new: 0, sources_rediscovered: 0, no_domain_skipped: 0, errors: 0,
  };

  for (const account of accounts) {
    m.companies_evaluated++;
    try {
      // Admission — canonical single company only (§5/§24).
      const cls = classify({ name: account.company.name, sourceUrl: account.company.sourceUrl ?? null });
      if (!ADMISSIBLE.has(cls.entity_class)) { m.events_rejected += account.events.length; continue; }

      // Domain is the only safe identity key — no domain → no fabricated company (§25).
      const domain = cleanDomain(account.company.domain);
      if (!domain) { m.no_domain_skipped++; continue; }

      // Resolve or create the canonical company (reuses the domain-keyed registry;
      // never downgrades a stronger existing identity — we only create when absent, §23).
      let company = await deps.findByDomain(domain);
      if (!company) {
        company = await deps.createCompany({
          name: account.company.name,
          domain,
          website_url: account.company.website_url ?? `https://${domain}`,
          industry: account.company.industry ?? null,
          region: account.company.region ?? null,
          country: account.company.country ?? null,
          source_status: provenance,
        });
        if (company) m.companies_new++;
      }
      if (!company) { m.errors++; continue; }
      m.companies_resolved++;

      // Existing event fingerprints for this company, reconstructed from stored fields
      // (no schema change needed, §34) — enables cross-run / cross-tenant dedup (§8/§20/§21).
      const existing = await deps.listSignalsByCompany(company.id);
      const seen = new Set(existing.map((s) => eventFingerprint(s.signal_type, s.signal_date ?? null, s.signal_summary)));
      const sourcesThisAccount = new Map<string, string>(); // url → source_id (dedup, §12)

      for (const ev of account.events) {
        m.events_evaluated++;
        // Reject events lacking a factual claim or any source/provenance (§5).
        if (!ev.claim || !ev.claim.trim() || !ev.source_url) { m.events_rejected++; continue; }
        // MATERIALITY gate (§6/§15): a verified static company FACT is not a material
        // EVENT and must never become a vault_signal, however true or well-sourced.
        if (!isMaterialEventClaim(ev.claim)) { m.events_rejected++; continue; }

        const type = mapEventType(ev.event_type);
        const fp = eventFingerprint(type, ev.event_date ?? null, ev.claim);
        if (seen.has(fp)) { m.events_rediscovered++; continue; }
        seen.add(fp);

        // Source relation — dedup identical URLs within this account (§12). Independence
        // is NEVER inferred from a differing URL (§11); we record only the primary source.
        const srcUrl = ev.source_url.trim();
        let sourceId = sourcesThisAccount.get(srcUrl);
        if (!sourceId) {
          const source = await deps.createSource({
            source_type: "public_news",
            source_url: srcUrl,
            published_at: ev.publication_date ?? null,   // §7 publication ≠ event date
            retrieved_at: new Date().toISOString(),      // observed_at, distinct from both
            freshness_status: null,                      // freshness is a reader concern (§13)
            raw_metadata: { materiality: ev.materiality ?? null, corroborating_domains: ev.corroborating_domains ?? null },
          });
          if (source) { sourceId = source.id; sourcesThisAccount.set(srcUrl, sourceId); m.sources_new++; }
        } else {
          m.sources_rediscovered++;
        }

        await deps.createSignal({
          company_id: company.id,
          source_id: sourceId ?? null,
          signal_type: type,
          signal_summary: ev.claim,          // bounded factual claim, NOT customer prose
          signal_date: ev.event_date ?? null, // the event date — never today's date (§7)
          data_origin: originFor(provenance),
          origin_reason: `vault-research-accretion:${provenance}`,
        });
        m.events_new++;
      }
    } catch {
      // Isolated: a Vault write failure is counted and never rethrown (§18).
      m.errors++;
    }
  }
  return m;
}
