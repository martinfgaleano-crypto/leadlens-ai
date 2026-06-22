import type { SourceSearchParams } from "@/lib/sources/source-provider";
import { computeVaultMatchScore } from "./match-score";

export interface VaultCandidate {
  id:                 string;
  company_name:       string;
  normalized_company: string | null;
  website:            string | null;
  domain:             string | null;
  contact_name:       string | null;
  title:              string | null;
  normalized_title:   string | null;
  seniority:          string | null;
  email:              string | null;
  email_quality:      string | null;
  email_type:         string | null;
  linkedin_url:       string | null;
  country:            string | null;
  industry:           string | null;
  company_size:       string | null;
  lead_score:         number | null;
  confidence_score:   number | null;
  opportunity_score:  number | null;
  buyer_fit:          string | null;
  temperature:        string | null;
  ai_reasoning:       string | null;
  strengths:          string[] | null;
  weaknesses:         string[] | null;
  match_score:        number;
}

const SELECT_COLS = [
  "id", "company_name", "normalized_company", "website", "domain",
  "contact_name", "title", "normalized_title", "seniority",
  "email", "email_quality", "email_type", "linkedin_url",
  "country", "industry", "company_size",
  "lead_score", "confidence_score", "opportunity_score",
  "buyer_fit", "temperature", "ai_reasoning", "strengths", "weaknesses",
].join(", ");

const SCORE_THRESHOLD = 40;
const MAX_OVERFETCH   = 1000;

/**
 * Searches vault_leads for candidates matching the given search params.
 * Returns leads scored and sorted best-first, capped at `limit`.
 *
 * Throws on DB error — caller must catch and fall through to Apollo.
 */
export async function searchVault(
  client: any,
  params: SourceSearchParams,
  limit:  number,
): Promise<VaultCandidate[]> {
  const overfetch = Math.min(limit * 10, MAX_OVERFETCH);

  let query = client
    .from("vault_leads")
    .select(SELECT_COLS)
    .limit(overfetch);

  if (params.countries.length > 0) {
    query = query.in("country", params.countries);
  }

  const { data, error } = await query;

  if (error || !data) {
    throw new Error(`Vault query failed: ${(error as { message: string } | null)?.message ?? "no data"}`);
  }

  const rows = data as Array<Omit<VaultCandidate, "match_score">>;

  const scored: VaultCandidate[] = rows
    .filter(r => r.email && r.email_quality !== "missing")
    .map(r => ({ ...r, match_score: computeVaultMatchScore(r, params) }))
    .filter(c => c.match_score >= SCORE_THRESHOLD);

  scored.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0);
  });

  return scored.slice(0, limit);
}
