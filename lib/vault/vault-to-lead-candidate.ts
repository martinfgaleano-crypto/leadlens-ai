// ─── Vault → LeadCandidate adapter v0 ─────────────────────────────────────────
// Converts selected VaultOpportunity records into the report pipeline's
// LeadCandidate shape. Account-level only: no contacts, no emails, no invented
// people fields — the report stays opportunity intelligence, not a contact
// database. Vault ids travel in raw_context for traceability (admin-side).

import type { LeadCandidate } from "@/types";
import type { VaultOpportunity, VaultToLeadCandidateResult } from "./vault-opportunity-types";

export interface VaultToLeadCandidateContext {
  customer_email?: string | null;
  monitor_id?: string | null;
  order_id?: string | null;
}

export function convertVaultOpportunityToLeadCandidate(
  opp: VaultOpportunity,
  _context: VaultToLeadCandidateContext = {},
): LeadCandidate | null {
  if (!opp.company_name?.trim()) return null;

  const contextLines = [
    opp.signal_summary ? `Signal: ${opp.signal_summary}` : null,
    opp.evidence_snippet && opp.evidence_snippet !== opp.signal_summary ? `Evidence: ${opp.evidence_snippet}` : null,
    opp.source_title ? `Source: ${opp.source_title}` : null,
    opp.match_reasons.length > 0 ? `Why now: ${opp.match_reasons.join("; ")}` : null,
    // Traceability (internal — the report pipeline never surfaces raw_context verbatim to customers):
    `Vault refs: company=${opp.vault_company_id}${opp.vault_signal_id ? ` signal=${opp.vault_signal_id}` : ""}${opp.vault_source_id ? ` source=${opp.vault_source_id}` : ""}`,
  ].filter(Boolean);

  return {
    id: `vault-${opp.vault_company_id}${opp.vault_signal_id ? `-${opp.vault_signal_id}` : ""}`,
    company: opp.company_name.trim(),
    domain: opp.domain ?? undefined,
    website_url: opp.website_url ?? undefined,
    location: [opp.region, opp.country].filter(Boolean).join(", ") || undefined,
    industry: opp.industry ?? undefined,
    // Structured metadata for feature snapshots — scoring never reads these.
    signal_type: opp.signal_type ?? null,
    region: opp.region ?? null,
    country: opp.country ?? null,
    source: "vault",
    source_url: opp.source_url ?? undefined,
    raw_context: contextLines.join("\n"),
    confidence_score: Math.min(1, Math.max(0, (opp.confidence_score ?? 0) / 100)),
    signal_date: opp.signal_date ?? null,
    // Deliberately absent: name, title, email, linkedin_url — Lead Hunter/Vault
    // bridge is account-level. Contact fields stay undefined (safe pattern used
    // by account-level candidates elsewhere in the pipeline).
  };
}

export function convertVaultOpportunitiesToLeadCandidates(
  opportunities: VaultOpportunity[],
  context: VaultToLeadCandidateContext = {},
): VaultToLeadCandidateResult {
  const candidates: LeadCandidate[] = [];
  const notes: string[] = [];
  let skipped = 0;
  for (const opp of opportunities) {
    const candidate = convertVaultOpportunityToLeadCandidate(opp, context);
    if (candidate) candidates.push(candidate);
    else { skipped++; notes.push(`Skipped opportunity ${opp.vault_company_id}: missing company name.`); }
  }
  if (candidates.length === 0) notes.push("No report-compatible candidates could be produced from this selection.");
  return { ok: candidates.length > 0, candidates, skipped, notes };
}
