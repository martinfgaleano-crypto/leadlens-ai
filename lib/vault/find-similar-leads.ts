// Server-side only. Finds vault leads similar to a given lead.
// Used on the vault detail page to surface related contacts.

export interface SimilarLeadRow {
  id: string;
  company_name: string;
  contact_name: string | null;
  title: string | null;
  country: string | null;
  opportunity_score: number | null;
  temperature: string | null;
  buyer_fit: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findSimilarVaultLeads(
  client: any,
  lead: {
    id: string;
    domain: string | null;
    country: string | null;
    seniority: string | null;
  },
  limit = 5,
): Promise<SimilarLeadRow[]> {
  const SELECT = "id, company_name, contact_name, title, country, opportunity_score, temperature, buyer_fit";
  const results: SimilarLeadRow[] = [];
  const seen = new Set<string>([lead.id]);

  // Strategy 1: same domain (different contact at same company)
  if (lead.domain) {
    const { data } = await client
      .from("vault_leads")
      .select(SELECT)
      .eq("domain", lead.domain)
      .neq("id", lead.id)
      .order("opportunity_score", { ascending: false })
      .limit(limit);

    for (const row of (data ?? []) as SimilarLeadRow[]) {
      if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
    }
  }

  // Strategy 2: same country + seniority (fill remaining slots)
  if (results.length < limit && lead.country && lead.seniority) {
    const { data } = await client
      .from("vault_leads")
      .select(SELECT)
      .eq("country", lead.country)
      .eq("seniority", lead.seniority)
      .neq("id", lead.id)
      .order("opportunity_score", { ascending: false })
      .limit(limit - results.length);

    for (const row of (data ?? []) as SimilarLeadRow[]) {
      if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
    }
  }

  return results.slice(0, limit);
}
