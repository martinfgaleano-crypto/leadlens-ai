// ─── Provider-search → Vault bridge (OBSERVATION MODE) ────────────────────────
// Persists promotion candidates into the Vault as pending_review with full
// provenance. Idempotent: a source URL already in the Vault is skipped, so
// re-running never duplicates companies, sources or signals. pending_review
// means these never enter the approved-only selector → ranking untouched.

import {
  createVaultCompany,
  createVaultSignal,
  createVaultSource,
  findVaultCompanyByDomain,
} from "@/lib/storage/vault-store";
import type { ProviderSearchPromotionCandidate } from "./promotion-contract";

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export interface BridgeResult {
  ok: boolean;
  considered: number;
  promoted: number;
  skipped_existing: number;
  skipped_no_company: number;
  companies_created: number;
  companies_reused: number;
  reason?: string;
}

export async function promoteToVault(candidates: ProviderSearchPromotionCandidate[]): Promise<BridgeResult> {
  const db = await getDb();
  if (!db) return { ok: false, considered: candidates.length, promoted: 0, skipped_existing: 0, skipped_no_company: 0, companies_created: 0, companies_reused: 0, reason: "Supabase not configured" };

  const res: BridgeResult = { ok: true, considered: candidates.length, promoted: 0, skipped_existing: 0, skipped_no_company: 0, companies_created: 0, companies_reused: 0 };

  for (const c of candidates) {
    // Idempotency: skip if this canonical source URL is already in the Vault.
    const { data: existingSrc } = await db.from("vault_sources").select("id").eq("source_url", c.evidence.canonical_url).limit(1).maybeSingle();
    if (existingSrc) { res.skipped_existing++; continue; }

    // Company: reuse by domain when possible; else create (pending, candidate status).
    let company = c.company.domain ? await findVaultCompanyByDomain(c.company.domain) : null;
    if (company) { res.companies_reused++; }
    else {
      company = await createVaultCompany({
        name: c.company.canonical_name,
        domain: c.company.domain,
        industry: null,
        region: c.company.region,
        country: c.company.country,
        source_status: "provider_search",
      });
      if (!company) { res.skipped_no_company++; continue; }
      res.companies_created++;
    }

    // Source: provenance preserved (provider, url, date, method, benchmark run).
    const source = await createVaultSource({
      source_type: c.evidence.source_type ?? "public_news",
      source_url: c.evidence.canonical_url,
      source_title: c.signal.claim.slice(0, 200),
      published_at: c.signal.publication_date,
      freshness_status: c.signal.freshness_bucket,
      confidence_score: c.signal.confidence,
      usage_rights_status: "unverified",   // public search result — rights need human review
      notes: `provider=${c.evidence.provider} query=${c.provenance.query_id} date_method=${c.evidence.date_method} conf=${c.evidence.date_confidence}${c.evidence.conflict ? " CONFLICT" : ""} run=${c.provenance.benchmark_run ?? "-"}`,
      raw_metadata: { promotion: c.provenance, evidence: c.evidence, qualification: c.qualification, source_mode: "provider_search_observation" },
    });
    if (!source) continue;

    // Signal: pending_review — never enters the approved selector pool.
    await createVaultSignal({
      company_id: company.id,
      source_id: source.id,
      signal_type: c.signal.type,
      signal_summary: c.signal.claim,
      signal_date: c.signal.publication_date,
      confidence_score: c.signal.confidence,
      review_status: "pending_review",
      data_origin: "production",
      origin_reason: "provider_search observation with recorded provenance",
      origin_version: "origin-v1",
    });
    res.promoted++;
  }

  return res;
}
