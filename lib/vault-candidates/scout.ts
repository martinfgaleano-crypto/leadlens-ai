// Server-side only. Scout engine — accepts externally discovered companies
// and stages them in vault_candidates for review.
// Does NOT scrape or browse. Infrastructure only.

export interface CandidateInput {
  company_name:     string;
  website?:         string | null;
  domain?:          string | null;
  country?:         string | null;
  industry?:        string | null;
  source_url?:      string | null;
  source_type?:     string | null;
  discovered_by?:   string | null;
  raw_notes?:       string | null;
  confidence_score?: number | null;
}

export interface CreateCandidateResult {
  id:     string;
  status: "created" | "error";
  error?: string;
}

export interface BulkInsertResult {
  total:    number;
  created:  number;
  failed:   number;
  errors:   Array<{ index: number; company: string; error: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCandidate(
  client: any,
  input: CandidateInput,
): Promise<CreateCandidateResult> {
  if (!input.company_name?.trim()) {
    return { id: "", status: "error", error: "company_name is required" };
  }

  const domain = input.domain ?? extractDomainFromWebsite(input.website ?? null);
  const now    = new Date().toISOString();

  const { data, error } = await client
    .from("vault_candidates")
    .insert({
      company_name:     input.company_name.trim(),
      website:          normalizeWebsite(input.website ?? null),
      domain:           domain,
      country:          input.country ?? null,
      industry:         input.industry ?? null,
      source_url:       input.source_url ?? null,
      source_type:      input.source_type ?? "manual",
      discovered_by:    input.discovered_by ?? null,
      raw_notes:        input.raw_notes ?? null,
      confidence_score: clampScore(input.confidence_score ?? null),
      review_status:    "new",
      created_at:       now,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { id: "", status: "error", error: error?.message ?? "Insert failed" };
  }

  return { id: (data as { id: string }).id, status: "created" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function bulkInsertCandidates(
  client: any,
  inputs: CandidateInput[],
): Promise<BulkInsertResult> {
  const result: BulkInsertResult = { total: inputs.length, created: 0, failed: 0, errors: [] };

  for (let i = 0; i < inputs.length; i++) {
    const r = await createCandidate(client, inputs[i]);
    if (r.status === "created") {
      result.created++;
    } else {
      result.failed++;
      result.errors.push({ index: i, company: inputs[i].company_name, error: r.error ?? "unknown" });
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markForReview(
  client: any,
  candidateId: string,
  notes?: string,
): Promise<void> {
  await client
    .from("vault_candidates")
    .update({
      review_status: "needs_review",
      ...(notes ? { raw_notes: notes } : {}),
    })
    .eq("id", candidateId)
    .eq("review_status", "new"); // only move forward, never backward
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeWebsite(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  return s.startsWith("http") ? s : `https://${s}`;
}

function extractDomainFromWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function clampScore(score: number | null | undefined): number | null {
  if (score == null) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}
