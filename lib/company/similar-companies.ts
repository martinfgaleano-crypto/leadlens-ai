// Server-side only.

export interface SimilarCompanyRow {
  id:                 string;
  company_name:       string;
  normalized_company: string;
  industry:           string | null;
  contacts_count:     number;
  top_score:          number | null;
  average_score:      number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findSimilarCompanies(
  client: any,
  company: { id: string; industry: string | null; domain: string | null },
  limit = 5,
): Promise<SimilarCompanyRow[]> {
  const SELECT = "id, company_name, normalized_company, industry, contacts_count, top_score, average_score";
  const results: SimilarCompanyRow[] = [];
  const seen = new Set<string>([company.id]);

  // Strategy 1: same industry
  if (company.industry) {
    const { data } = await client
      .from("company_profiles")
      .select(SELECT)
      .eq("industry", company.industry)
      .neq("id", company.id)
      .order("top_score", { ascending: false })
      .limit(limit);

    for (const row of (data ?? []) as SimilarCompanyRow[]) {
      if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
    }
  }

  return results.slice(0, limit);
}
