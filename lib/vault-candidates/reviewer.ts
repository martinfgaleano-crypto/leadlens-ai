// Server-side only. Review engine — validates candidates and detects duplicates.
// Future: Claude fills review_notes automatically (Stage 2 automation).

import { normalizeCompany, extractDomain } from "@/lib/quality/company-normalizer";

export type ReviewStatus = "approved" | "rejected" | "needs_review" | "duplicate";

export interface ReviewResult {
  status:       ReviewStatus;
  reason:       string;
  duplicateOf?: string; // UUID of the canonical record
}

export interface DuplicateMatch {
  id:           string;
  company_name: string;
  website:      string | null;
  match_field:  "website" | "domain" | "normalized_name";
}

const CONFIDENCE_THRESHOLD = 50;

// ── detectDuplicate ───────────────────────────────────────────────────────────
// Checks vault_candidates for an existing record with the same website,
// domain, or normalized company name.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function detectDuplicate(
  client: any,
  candidateId: string,
  companyName: string,
  website: string | null,
  domain: string | null,
): Promise<DuplicateMatch | null> {
  const normalized = normalizeCompany(companyName);
  const dom        = domain ?? (website ? extractDomain(website) : null);

  // Check website match first (most precise)
  if (website) {
    const { data } = await client
      .from("vault_candidates")
      .select("id, company_name, website")
      .eq("website", website)
      .neq("id", candidateId)
      .neq("review_status", "rejected")
      .limit(1)
      .maybeSingle();

    if (data) return { ...(data as { id: string; company_name: string; website: string | null }), match_field: "website" };
  }

  // Check domain match
  if (dom) {
    const { data } = await client
      .from("vault_candidates")
      .select("id, company_name, website")
      .eq("domain", dom)
      .neq("id", candidateId)
      .neq("review_status", "rejected")
      .limit(1)
      .maybeSingle();

    if (data) return { ...(data as { id: string; company_name: string; website: string | null }), match_field: "domain" };
  }

  // Also check vault_leads — already promoted companies
  if (dom) {
    const { data } = await client
      .from("vault_leads")
      .select("id, company_name, website")
      .eq("domain", dom)
      .limit(1)
      .maybeSingle();

    if (data) {
      return { id: (data as { id: string }).id, company_name: (data as { company_name: string }).company_name, website: null, match_field: "domain" };
    }
  }

  // Normalized company name match (fuzzy-ish: just exact match on normalized)
  if (normalized) {
    const { data: existing } = await client
      .from("vault_candidates")
      .select("id, company_name, website")
      .ilike("company_name", normalized)
      .neq("id", candidateId)
      .neq("review_status", "rejected")
      .limit(1)
      .maybeSingle();

    if (existing) return { ...(existing as { id: string; company_name: string; website: string | null }), match_field: "normalized_name" };
  }

  return null;
}

// ── reviewCandidate ───────────────────────────────────────────────────────────
// Runs all validation rules and duplicate check synchronously against the DB.
// Returns a ReviewResult the caller should persist.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reviewCandidate(
  client: any,
  candidateId: string,
  notes?: string,
): Promise<ReviewResult> {
  const { data: candidate, error } = await client
    .from("vault_candidates")
    .select("id, company_name, website, domain, confidence_score")
    .eq("id", candidateId)
    .single();

  if (error || !candidate) {
    return { status: "rejected", reason: "Candidate not found" };
  }

  const c = candidate as {
    id: string;
    company_name: string;
    website: string | null;
    domain: string | null;
    confidence_score: number | null;
  };

  // Rule 1: company name must exist
  if (!c.company_name?.trim()) {
    return persist(client, candidateId, "rejected", "Missing company name", notes);
  }

  // Rule 2: website required for approval; missing → needs_review for human
  if (!c.website?.trim()) {
    return persist(client, candidateId, "needs_review", "No website — needs manual verification", notes);
  }

  // Rule 3: confidence threshold
  if ((c.confidence_score ?? 0) < CONFIDENCE_THRESHOLD) {
    return persist(client, candidateId, "needs_review", `Confidence ${c.confidence_score ?? 0} < threshold ${CONFIDENCE_THRESHOLD}`, notes);
  }

  // Rule 4: duplicate detection
  const dup = await detectDuplicate(client, candidateId, c.company_name, c.website, c.domain);
  if (dup) {
    await client
      .from("vault_candidates")
      .update({
        review_status:      "duplicate",
        duplicate_of:       dup.id,
        claude_review_notes: `${notes ? notes + "\n" : ""}Duplicate of ${dup.company_name} (matched on ${dup.match_field})`,
        reviewed_at:        new Date().toISOString(),
      })
      .eq("id", candidateId);
    return { status: "duplicate", reason: `Duplicate of ${dup.company_name} (${dup.match_field})`, duplicateOf: dup.id };
  }

  // All checks passed
  return persist(client, candidateId, "approved", notes ?? "Passed all validation checks", notes);
}

// ── approveCandidate ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function approveCandidate(
  client: any,
  candidateId: string,
  notes?: string,
): Promise<void> {
  await client
    .from("vault_candidates")
    .update({
      review_status:       "approved",
      approved_for_vault:  true,
      claude_review_notes: notes ?? null,
      reviewed_at:         new Date().toISOString(),
    })
    .eq("id", candidateId);
}

// ── rejectCandidate ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rejectCandidate(
  client: any,
  candidateId: string,
  reason?: string,
): Promise<void> {
  await client
    .from("vault_candidates")
    .update({
      review_status:       "rejected",
      approved_for_vault:  false,
      claude_review_notes: reason ?? null,
      reviewed_at:         new Date().toISOString(),
    })
    .eq("id", candidateId);
}

// ── persist helper ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persist(
  client: any,
  id: string,
  status: ReviewStatus,
  reason: string,
  notes?: string,
): Promise<ReviewResult> {
  await client
    .from("vault_candidates")
    .update({
      review_status:       status,
      approved_for_vault:  status === "approved",
      claude_review_notes: notes ?? reason,
      reviewed_at:         new Date().toISOString(),
    })
    .eq("id", id);

  return { status, reason };
}
