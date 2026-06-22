// Server-side only. No browser imports.

export interface VaultLeadInput {
  company_name:       string;
  normalized_company: string | null;
  website:            string | null;
  domain:             string | null;
  contact_name:       string | null;
  title:              string | null;
  normalized_title:   string | null;
  seniority:          string;
  email:              string | null;
  email_quality:      string;
  email_type:         string;
  linkedin_url:       string | null;
  country:            string | null;
  industry:           string | null;
  company_size:       string | null;
  source:             string;
  lead_score:         number;
  confidence_score:   number;
  opportunity_score:  number;
  buyer_fit:          string;
  temperature:        string;
  ai_reasoning:       string;
  strengths:          string[];
  weaknesses:         string[];
}

type ExistingRow = { id: string; times_seen: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertVaultLead(client: any, lead: VaultLeadInput): Promise<void> {
  const now = new Date().toISOString();

  // ── 1. Find existing record ────────────────────────────────────────────────
  let existing: ExistingRow | null = null;

  if (lead.email) {
    const { data } = await client
      .from("vault_leads")
      .select("id, times_seen")
      .eq("email", lead.email)
      .limit(1)
      .maybeSingle();
    existing = (data as ExistingRow) ?? null;
  }

  if (!existing && lead.normalized_company && lead.contact_name) {
    const { data } = await client
      .from("vault_leads")
      .select("id, times_seen")
      .eq("normalized_company", lead.normalized_company)
      .eq("contact_name", lead.contact_name)
      .limit(1)
      .maybeSingle();
    existing = (data as ExistingRow) ?? null;
  }

  // ── 2. Update or insert ────────────────────────────────────────────────────

  if (existing) {
    await client
      .from("vault_leads")
      .update({
        // Refresh latest enrichment
        normalized_title:  lead.normalized_title,
        seniority:         lead.seniority,
        email_quality:     lead.email_quality,
        email_type:        lead.email_type,
        linkedin_url:      lead.linkedin_url,
        website:           lead.website,
        domain:            lead.domain,
        buyer_fit:         lead.buyer_fit,
        temperature:       lead.temperature,
        ai_reasoning:      lead.ai_reasoning,
        strengths:         lead.strengths,
        weaknesses:        lead.weaknesses,
        // Take the latest scores (pipeline is always improving)
        lead_score:        lead.lead_score,
        confidence_score:  lead.confidence_score,
        opportunity_score: lead.opportunity_score,
        // Vault counters
        times_seen: existing.times_seen + 1,
        last_seen:  now,
      })
      .eq("id", existing.id);
  } else {
    await client
      .from("vault_leads")
      .insert({
        ...lead,
        times_seen: 1,
        last_seen:  now,
        created_at: now,
      });
  }
}
