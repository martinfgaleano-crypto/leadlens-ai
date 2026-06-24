// Server-side only. Promotion engine — moves approved candidates into the Vault.
// Requirements: approved_for_vault=true, review_status=approved, not duplicate,
// website present, country present (soft — promoted either way, warned if missing).

import { normalizeCompany, extractDomain } from "@/lib/quality/company-normalizer";
import { upsertCompanyProfile } from "@/lib/company/upsert-company";

export interface PromoteResult {
  candidateId:  string;
  status:       "promoted" | "skipped" | "error";
  reason?:      string;
  vaultLeadId?: string;
}

export interface BulkPromoteResult {
  total:     number;
  promoted:  number;
  skipped:   number;
  failed:    number;
  results:   PromoteResult[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function promoteCandidate(
  client: any,
  candidateId: string,
): Promise<PromoteResult> {
  // ── 1. Fetch candidate ─────────────────────────────────────────────────────
  const { data: candidate, error: fetchErr } = await client
    .from("vault_candidates")
    .select("id, company_name, website, domain, country, industry, confidence_score, claude_review_notes, approved_for_vault, review_status, promoted_at")
    .eq("id", candidateId)
    .single();

  if (fetchErr || !candidate) {
    return { candidateId, status: "error", reason: "Candidate not found" };
  }

  const c = candidate as {
    id: string;
    company_name: string;
    website: string | null;
    domain: string | null;
    country: string | null;
    industry: string | null;
    confidence_score: number | null;
    claude_review_notes: string | null;
    approved_for_vault: boolean;
    review_status: string;
    promoted_at: string | null;
  };

  // ── 2. Guard: eligibility checks ───────────────────────────────────────────
  if (!c.approved_for_vault || c.review_status !== "approved") {
    return { candidateId, status: "skipped", reason: "Not approved for vault" };
  }
  if ((c.review_status as string) === "duplicate") {
    return { candidateId, status: "skipped", reason: "Marked as duplicate" };
  }
  if (c.promoted_at) {
    return { candidateId, status: "skipped", reason: "Already promoted" };
  }
  if (!c.website?.trim()) {
    return { candidateId, status: "skipped", reason: "No website — cannot promote without website" };
  }

  // ── 3. Derive normalised fields ────────────────────────────────────────────
  const normalizedCompany = normalizeCompany(c.company_name) ?? c.company_name;
  const domain            = c.domain ?? extractDomain(c.website);
  const score             = c.confidence_score ?? 50;
  const now               = new Date().toISOString();

  // ── 4. Upsert company profile ─────────────────────────────────────────────
  try {
    await upsertCompanyProfile(client, {
      normalized_company: normalizedCompany,
      company_name:       c.company_name,
      domain,
      industry:           c.industry ?? null,
      company_size:       null,
      country:            c.country ?? null,
      title:              null,
      opportunity_score:  score,
    });
  } catch (e) {
    // Company profile failure is non-blocking — vault lead is still valuable
    console.error("[promote] company profile upsert failed:", e instanceof Error ? e.message : e);
  }

  // ── 5. Insert vault_lead (company-level, no contact) ───────────────────────
  // vault_leads is designed for person+company combos; company-only records
  // use sentinel values so vault searches can still match by domain/company.
  const { data: vaultRow, error: vaultErr } = await client
    .from("vault_leads")
    .insert({
      company_name:       c.company_name,
      normalized_company: normalizedCompany,
      website:            c.website,
      domain,
      country:            c.country ?? null,
      industry:           c.industry ?? null,
      // No contact
      contact_name:       null,
      title:              null,
      normalized_title:   null,
      email:              null,
      email_quality:      "unknown",
      email_type:         "unknown",
      linkedin_url:       null,
      company_size:       null,
      seniority:          "unknown",
      // Source
      source:             "vault_candidate",
      // Scores derived from candidate confidence
      lead_score:         score,
      confidence_score:   score,
      opportunity_score:  score,
      // Enrichment placeholders
      buyer_fit:          "unknown",
      temperature:        "cold",
      ai_reasoning:       c.claude_review_notes ?? "",
      strengths:          [],
      weaknesses:         [],
      // Vault metadata
      times_seen:         1,
      last_seen:          now,
      created_at:         now,
    })
    .select("id")
    .single();

  if (vaultErr) {
    return { candidateId, status: "error", reason: `vault_leads insert failed: ${vaultErr.message}` };
  }

  const vaultLeadId = (vaultRow as { id: string }).id;

  // ── 6. Mark candidate as promoted ─────────────────────────────────────────
  await client
    .from("vault_candidates")
    .update({ promoted_at: now })
    .eq("id", candidateId);

  return { candidateId, status: "promoted", vaultLeadId };
}

// ── promoteAllApproved ────────────────────────────────────────────────────────
// Bulk-promotes every candidate that is approved but not yet promoted.
// Processes at most `limit` per call to stay within serverless timeouts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function promoteAllApproved(
  client: any,
  limit = 50,
): Promise<BulkPromoteResult> {
  const { data: candidates } = await client
    .from("vault_candidates")
    .select("id")
    .eq("review_status", "approved")
    .eq("approved_for_vault", true)
    .is("promoted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  const ids = ((candidates ?? []) as { id: string }[]).map(r => r.id);
  const result: BulkPromoteResult = { total: ids.length, promoted: 0, skipped: 0, failed: 0, results: [] };

  for (const id of ids) {
    const r = await promoteCandidate(client, id);
    result.results.push(r);
    if (r.status === "promoted") result.promoted++;
    else if (r.status === "skipped") result.skipped++;
    else result.failed++;
  }

  return result;
}
