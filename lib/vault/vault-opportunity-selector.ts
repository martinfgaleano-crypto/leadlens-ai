// ─── Vault opportunity selector v0 ────────────────────────────────────────────
// Turns approved Vault companies/signals into a ranked, exclusion-first
// selection for a customer ICP. Server-side only; reads via vault-store (which
// degrades gracefully without Supabase). Scoring is deterministic and every
// exclusion carries a named reason — nothing is silently dropped or invented.

import type { VaultCompany, VaultReservation, VaultSignal, VaultSource } from "./vault-types";
import type {
  VaultOpportunity,
  VaultOpportunityMatchScore,
  VaultOpportunityRejectionReason,
  VaultOpportunitySelectionCriteria,
  VaultOpportunitySelectionResult,
} from "./vault-opportunity-types";
import { computeFreshnessStatus } from "@/lib/lead-hunter/lead-hunter-policy";
import {
  getVaultCompanyById,
  getVaultSourceById,
  listActiveReservations,
  listSuppressionEntries,
  listUsageByCompany,
  listVaultCompanies,
  listVaultSignals,
} from "@/lib/storage/vault-store";

export const DEFAULT_MAX_CANDIDATES = 10;
export const HARD_MAX_CANDIDATES = 25;

const PERMITTED_RIGHTS = ["permitted", "licensed", "customer_provided"];
const STRONG_SIGNALS = ["funding", "expansion", "hiring", "product_launch"];

function normalizeCriteria(input: VaultOpportunitySelectionCriteria): Required<Pick<VaultOpportunitySelectionCriteria, "include_reserved" | "exclude_used" | "require_approved" | "require_permitted_usage_rights">> & VaultOpportunitySelectionCriteria {
  return {
    ...input,
    max_candidates: Math.min(Math.max(1, input.max_candidates ?? DEFAULT_MAX_CANDIDATES), HARD_MAX_CANDIDATES),
    min_confidence: Math.min(Math.max(0, input.min_confidence ?? 0), 100),
    freshness_preference: input.freshness_preference ?? "any",
    include_reserved: input.include_reserved ?? false,
    exclude_used: input.exclude_used ?? true,
    require_approved: input.require_approved ?? true,
    require_permitted_usage_rights: input.require_permitted_usage_rights ?? true,
  };
}

function tokenize(text: string | null | undefined): string[] {
  return (text ?? "").toLowerCase().split(/[^a-z0-9áéíóúñü]+/).filter((t) => t.length >= 4);
}

/** Deterministic, explainable 0–100 match score. Never higher than inputs justify. */
export function scoreVaultOpportunity(
  opp: VaultOpportunity,
  criteria: VaultOpportunitySelectionCriteria,
): { score: VaultOpportunityMatchScore; reasons: string[] } {
  const reasons: string[] = [];

  // ICP fit (0–25): token overlap between brief text and what the Vault knows.
  const icpTokens = new Set(tokenize(`${criteria.target_market ?? ""} ${criteria.icp_notes ?? ""}`));
  const oppTokens = tokenize(`${opp.industry ?? ""} ${opp.signal_summary ?? ""} ${opp.evidence_snippet ?? ""}`);
  const overlap = oppTokens.filter((t) => icpTokens.has(t)).length;
  const icp_fit = icpTokens.size === 0 ? 10 : Math.min(25, overlap * 8);
  if (overlap > 0) reasons.push(`ICP keyword overlap (${overlap} term${overlap === 1 ? "" : "s"})`);

  // Geography (0–15)
  let geography = 0;
  if (criteria.country && opp.country && criteria.country.toLowerCase() === opp.country.toLowerCase()) {
    geography = 15; reasons.push(`Same country (${opp.country})`);
  } else if (criteria.region && opp.region && criteria.region.toLowerCase() === opp.region.toLowerCase()) {
    geography = 10; reasons.push(`Same region (${opp.region})`);
  } else if (!criteria.country && !criteria.region) {
    geography = 8; // no geo requirement — neutral
  }

  // Industry (0–15): exact or token-adjacent.
  let industry = 0;
  if (criteria.industry && opp.industry) {
    const want = criteria.industry.toLowerCase();
    const have = opp.industry.toLowerCase();
    if (want === have) { industry = 15; reasons.push(`Industry match (${opp.industry})`); }
    else if (tokenize(want).some((t) => have.includes(t))) { industry = 8; reasons.push(`Adjacent industry (${opp.industry})`); }
  } else if (!criteria.industry) {
    industry = 8;
  }

  // Freshness (0–20): date-driven, from the same rule as everywhere else.
  const freshness = opp.freshness_status === "fresh" ? 20 : opp.freshness_status === "recent" ? 12 : opp.freshness_status === "stale" ? 3 : 0;
  if (opp.freshness_status === "fresh") reasons.push("Fresh signal (≤30 days)");
  else if (opp.freshness_status === "recent") reasons.push("Recent signal (≤90 days)");

  // Confidence (0–10): stored Vault confidence, scaled.
  const confidence = Math.round(((opp.confidence_score ?? 0) / 100) * 10);
  if ((opp.confidence_score ?? 0) >= 70) reasons.push(`High Vault confidence (${opp.confidence_score})`);

  // Evidence (0–10): a real snippet + provenance URL.
  let evidence = 0;
  if (opp.evidence_snippet && opp.evidence_snippet.trim().length >= 40) evidence += 6;
  if (opp.source_url) { evidence += 4; reasons.push("Source provenance available"); }

  // Signal strength (0–5): stronger buying triggers score higher.
  const signal_strength = opp.signal_type && STRONG_SIGNALS.includes(opp.signal_type) ? 5 : opp.signal_type ? 2 : 0;
  if (signal_strength === 5) reasons.push(`Strong signal type (${opp.signal_type})`);

  const total = Math.min(100, icp_fit + geography + industry + freshness + confidence + evidence + signal_strength);
  return { score: { total, icp_fit, geography, industry, freshness, confidence, evidence, signal_strength }, reasons };
}

export function explainVaultOpportunityMatch(opp: VaultOpportunity, criteria: VaultOpportunitySelectionCriteria): string[] {
  return scoreVaultOpportunity(opp, criteria).reasons;
}

export function filterSuppressedOpportunities(opps: VaultOpportunity[]): VaultOpportunity[] {
  return opps.filter((o) => o.suppression_status !== "suppressed" && o.rejection_reasons.length === 0);
}

export function filterUsedOpportunities(opps: VaultOpportunity[], criteria: VaultOpportunitySelectionCriteria): VaultOpportunity[] {
  if (criteria.exclude_used === false) return opps;
  return opps.filter((o) => !o.rejection_reasons.includes("already_used"));
}

export function filterReservedOpportunities(opps: VaultOpportunity[], criteria: VaultOpportunitySelectionCriteria): VaultOpportunity[] {
  if (criteria.include_reserved) return opps;
  return opps.filter((o) => o.reservation_status !== "reserved_for_other");
}

export function rankVaultOpportunities(opps: VaultOpportunity[], criteria: VaultOpportunitySelectionCriteria): VaultOpportunity[] {
  return [...opps].sort((a, b) => (b.match_score?.total ?? 0) - (a.match_score?.total ?? 0));
}

export function buildVaultSelectionSummary(result: VaultOpportunitySelectionResult): string {
  const parts: string[] = [`${result.selected.length} selected of ${result.total_considered} considered.`];
  for (const [reason, count] of Object.entries(result.rejected_counts)) {
    if (count) parts.push(`${count} excluded: ${reason.replace(/_/g, " ")}.`);
  }
  if (result.sparse) parts.push("Not enough approved Vault opportunities match this ICP yet.");
  return parts.join(" ");
}

/** Main entry: exclusion-first selection of approved Vault opportunities. */
export async function selectVaultOpportunities(
  input: VaultOpportunitySelectionCriteria,
): Promise<VaultOpportunitySelectionResult> {
  const criteria = normalizeCriteria(input);
  const reject = (opp: VaultOpportunity, reason: VaultOpportunityRejectionReason) => {
    opp.rejection_reasons.push(reason);
    result.rejected_counts[reason] = (result.rejected_counts[reason] ?? 0) + 1;
  };
  const result: VaultOpportunitySelectionResult = {
    ok: true, mode: "preview", selected: [], rejected_counts: {}, total_considered: 0, sparse: false, message: "",
  };

  // Approved signals are the primary axis; companies without signals are
  // considered only as a fallback (signal-less accounts score low on freshness).
  const [signals, companies, reservations, suppressions] = await Promise.all([
    listVaultSignals(criteria.require_approved ? { review_status: "approved" } : {}),
    listVaultCompanies({}),
    listActiveReservations(),
    listSuppressionEntries(),
  ]);

  if (signals.length === 0 && companies.length === 0) {
    result.ok = false;
    result.sparse = true;
    result.unavailable_reason = "No Vault data available — Supabase unavailable, migration 029 not applied, or the Vault is empty.";
    result.message = "No approved Vault opportunities yet. Promote approved Lead Hunter candidates to the Vault first.";
    return result;
  }

  const companyById = new Map<string, VaultCompany>(companies.map((c) => [c.id, c]));
  const suppressedDomains = new Set(suppressions.filter((s) => s.suppression_type === "domain").map((s) => s.value.toLowerCase()));
  const suppressedCompanies = new Set(suppressions.filter((s) => s.suppression_type === "company").map((s) => s.value.toLowerCase()));
  const excludedDomains = new Set((criteria.excluded_domains ?? []).map((d) => d.toLowerCase().trim()).filter(Boolean));
  const reservationsByCompany = new Map<string, VaultReservation[]>();
  const now = Date.now();
  for (const r of reservations) {
    if (!r.company_id || r.status !== "active") continue;
    if (r.expires_at && new Date(r.expires_at).getTime() < now) continue; // expired = released
    const list = reservationsByCompany.get(r.company_id) ?? [];
    list.push(r);
    reservationsByCompany.set(r.company_id, list);
  }

  // One opportunity per approved signal; dedupe extra signal-less companies at the end.
  const seenCompanyIds = new Set<string>();
  const candidates: Array<{ signal: VaultSignal | null; company: VaultCompany }> = [];
  for (const signal of signals) {
    const company = signal.company_id ? companyById.get(signal.company_id) ?? (await getVaultCompanyById(signal.company_id)) : null;
    if (!company) { result.rejected_counts.missing_company = (result.rejected_counts.missing_company ?? 0) + 1; result.total_considered++; continue; }
    candidates.push({ signal, company });
    seenCompanyIds.add(company.id);
  }
  for (const company of companies) {
    if (!seenCompanyIds.has(company.id) && company.vault_status !== "archived") candidates.push({ signal: null, company });
  }

  const passing: VaultOpportunity[] = [];
  for (const { signal, company } of candidates) {
    result.total_considered++;
    let source: VaultSource | null = null;
    if (signal?.source_id) source = await getVaultSourceById(signal.source_id);

    const rights = (source?.usage_rights_status ?? "unverified").toLowerCase();
    const domain = (company.domain ?? "").toLowerCase();
    const reservedFor = reservationsByCompany.get(company.id) ?? [];
    const reservedForThisCustomer = criteria.customer_email
      ? reservedFor.some((r) => r.reserved_for_customer_email?.toLowerCase() === criteria.customer_email!.toLowerCase())
      : false;

    const opp: VaultOpportunity = {
      vault_company_id: company.id,
      vault_signal_id: signal?.id ?? null,
      vault_source_id: source?.id ?? null,
      company_name: company.name,
      domain: company.domain,
      website_url: company.website_url,
      industry: company.industry,
      region: company.region,
      country: company.country,
      signal_type: signal?.signal_type ?? null,
      signal_summary: signal?.signal_summary ?? null,
      signal_date: signal?.signal_date ?? null,
      freshness_status: computeFreshnessStatus(signal?.signal_date),
      source_url: source?.source_url ?? null,
      source_title: source?.source_title ?? null,
      source_type: source?.source_type ?? null,
      evidence_snippet: source?.notes ?? signal?.signal_summary ?? null,
      usage_rights_status: source ? rights : "unverified",
      confidence_score: signal?.confidence_score ?? source?.confidence_score ?? null,
      review_status: signal?.review_status ?? "approved",
      suppression_status: company.suppression_status ?? "none",
      reservation_status: reservedFor.length === 0 ? "none" : reservedForThisCustomer ? "reserved_for_customer" : "reserved_for_other",
      usage_history_count: 0,
      match_score: null,
      match_reasons: [],
      rejection_reasons: [],
    };

    // ── Exclusion-first gates (each names its reason) ──
    if (criteria.require_approved && signal && signal.review_status !== "approved") reject(opp, "not_approved");
    if (opp.suppression_status === "suppressed" || suppressedDomains.has(domain) || suppressedCompanies.has(company.name.toLowerCase())) reject(opp, "suppressed");
    if (criteria.require_permitted_usage_rights) {
      if (rights === "restricted") reject(opp, "usage_rights_restricted");
      else if (!PERMITTED_RIGHTS.includes(rights)) reject(opp, "usage_rights_unresolved");
    }
    if (excludedDomains.has(domain) && domain) reject(opp, "excluded_domain");
    if (!criteria.include_reserved && opp.reservation_status === "reserved_for_other") reject(opp, "reserved_for_other");
    if (criteria.freshness_preference === "fresh_only" && opp.freshness_status !== "fresh") reject(opp, "too_stale");
    if (criteria.freshness_preference === "fresh_or_recent" && opp.freshness_status !== "fresh" && opp.freshness_status !== "recent") reject(opp, "too_stale");
    if ((criteria.min_confidence ?? 0) > 0 && (opp.confidence_score ?? 0) < criteria.min_confidence!) reject(opp, "below_min_confidence");

    if (criteria.exclude_used && opp.rejection_reasons.length === 0) {
      const usage = await listUsageByCompany(company.id);
      opp.usage_history_count = usage.length;
      const usedForSameContext = usage.some((u) =>
        (criteria.customer_email && u.customer_email?.toLowerCase() === criteria.customer_email.toLowerCase()) ||
        (criteria.order_id && u.order_id === criteria.order_id) ||
        (criteria.monitor_id && u.job_id === criteria.monitor_id),
      );
      if (usedForSameContext) reject(opp, "already_used");
    }

    if (opp.rejection_reasons.length > 0) continue;
    const { score, reasons } = scoreVaultOpportunity(opp, criteria);
    opp.match_score = score;
    opp.match_reasons = reasons;
    passing.push(opp);
  }

  result.selected = rankVaultOpportunities(passing, criteria).slice(0, criteria.max_candidates);
  result.sparse = result.selected.length < (criteria.max_candidates ?? DEFAULT_MAX_CANDIDATES);
  result.message = result.selected.length === 0
    ? "No approved Vault opportunities match this ICP yet. Add or promote more candidates, or relax the criteria."
    : buildVaultSelectionSummary(result);
  return result;
}
