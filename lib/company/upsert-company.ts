// Server-side only. Upserts a company profile from a single enriched lead.

export interface CompanyUpsertInput {
  normalized_company: string;
  company_name:       string;
  domain:             string | null;
  industry:           string | null;
  company_size:       string | null;
  country:            string | null;
  title:              string | null;
  opportunity_score:  number | null;
}

type ExistingRow = {
  id:             string;
  contacts_count: number;
  times_seen:     number;
  average_score:  number | null;
  top_score:      number | null;
  countries_seen: string[];
  titles_seen:    string[];
};

function appendUnique(arr: string[], value: string | null): string[] {
  if (!value) return arr;
  const v = value.trim();
  return arr.includes(v) ? arr : [...arr, v];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertCompanyProfile(client: any, input: CompanyUpsertInput): Promise<void> {
  const now = new Date().toISOString();

  const { data: existing } = await client
    .from("company_profiles")
    .select("id, contacts_count, times_seen, average_score, top_score, countries_seen, titles_seen")
    .eq("normalized_company", input.normalized_company)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const row = existing as ExistingRow;

    // Recalculate running average (only when new lead has a score)
    let newAvg = row.average_score;
    if (input.opportunity_score != null) {
      if (newAvg == null) {
        newAvg = input.opportunity_score;
      } else {
        newAvg = Math.round(
          (newAvg * row.contacts_count + input.opportunity_score) / (row.contacts_count + 1)
        );
      }
    }

    await client
      .from("company_profiles")
      .update({
        contacts_count: row.contacts_count + 1,
        times_seen:     row.times_seen + 1,
        average_score:  newAvg,
        top_score: input.opportunity_score != null
          ? Math.max(row.top_score ?? 0, input.opportunity_score)
          : row.top_score,
        countries_seen: appendUnique(row.countries_seen, input.country),
        titles_seen:    appendUnique(row.titles_seen, input.title),
        last_seen:      now,
      })
      .eq("id", row.id);
  } else {
    await client
      .from("company_profiles")
      .insert({
        normalized_company: input.normalized_company,
        company_name:       input.company_name,
        domain:             input.domain,
        industry:           input.industry,
        company_size:       input.company_size,
        countries_seen:     input.country  ? [input.country]  : [],
        titles_seen:        input.title    ? [input.title]    : [],
        contacts_count:     1,
        times_seen:         1,
        average_score:      input.opportunity_score,
        top_score:          input.opportunity_score,
        first_seen:         now,
        last_seen:          now,
        created_at:         now,
      });
  }
}
