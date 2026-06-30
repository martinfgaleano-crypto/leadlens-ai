import type { LeadCandidate, ProcessedLead, AccountMemoryState } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountMemoryRecord {
  id: string;
  client_id: string;
  normalized_domain: string | null;
  normalized_company: string;
  country: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_job_id: string | null;
  times_seen: number;
  last_category: string | null;
  last_fit_score: number | null;
  state: AccountMemoryState;
  do_not_show: boolean;
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDomain(domain: string | undefined): string | undefined {
  if (!domain) return undefined;
  const cleaned = domain
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();
  return cleaned || undefined;
}

function extractCountry(location: string | undefined): string | null {
  if (!location) return null;
  const parts = location.split(",");
  return parts[parts.length - 1]?.trim() ?? null;
}

// ─── Client key ───────────────────────────────────────────────────────────────

export function getClientKey(jobId: string | undefined): string {
  if (!jobId || jobId.startsWith("demo_")) return "demo";
  return "global";
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadAccountMemory(
  candidates: LeadCandidate[],
  clientKey: string
): Promise<Map<string, AccountMemoryRecord>> {
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    if (!supabase) return new Map();

    const domains = candidates
      .map(c => normalizeDomain(c.domain))
      .filter((d): d is string => Boolean(d));

    const companies = candidates.map(c => normalizeCompanyName(c.company));

    let query = supabase
      .from("account_memory")
      .select("*")
      .eq("client_id", clientKey);

    if (domains.length > 0) {
      query = query.or(
        `normalized_domain.in.(${domains.join(",")}),normalized_company.in.(${companies.join(",")})`
      );
    } else {
      query = query.in("normalized_company", companies);
    }

    const { data, error } = await query;
    if (error || !data) return new Map();

    const records = data as AccountMemoryRecord[];
    const result = new Map<string, AccountMemoryRecord>();

    for (const candidate of candidates) {
      const domain = normalizeDomain(candidate.domain);
      const company = normalizeCompanyName(candidate.company);

      // Domain match takes priority (more reliable)
      if (domain) {
        const domainMatch = records.find(r => r.normalized_domain === domain);
        if (domainMatch) {
          result.set(candidate.id, domainMatch);
          continue;
        }
      }

      // Company name fallback
      const companyMatch = records.find(r => r.normalized_company === company);
      if (companyMatch) {
        result.set(candidate.id, companyMatch);
      }
    }

    return result;
  } catch {
    return new Map();
  }
}

// ─── Classify ─────────────────────────────────────────────────────────────────

export function classifyAccountNovelty(
  _candidate: LeadCandidate,
  currentFitScore: number,
  currentCategory: string,
  existing: AccountMemoryRecord | undefined
): AccountMemoryState {
  if (!existing) return "new_opportunity";

  const prevCategory = existing.last_category;
  const prevScore    = existing.last_fit_score ?? 0;
  const timesSeen    = existing.times_seen;

  // Reactivated: was cold/discard, now hot/warm
  if (
    (prevCategory === "COLD" || prevCategory === "DISCARD") &&
    (currentCategory === "HOT" || currentCategory === "WARM")
  ) {
    return "reactivated_with_new_signal";
  }

  // Dropped: was hot/warm, now cold/discard
  if (
    (prevCategory === "HOT" || prevCategory === "WARM") &&
    (currentCategory === "COLD" || currentCategory === "DISCARD")
  ) {
    return "dropped";
  }

  // Meaningful score increase
  if (currentFitScore >= prevScore + 1.5) return "upgraded_priority";

  // Meaningful score decrease
  if (currentFitScore <= prevScore - 1.5) return "downgraded_priority";

  // Seen multiple times, no change
  if (timesSeen >= 2) return "repeated_without_new_signal";

  return "previously_seen";
}

// ─── Apply hints ──────────────────────────────────────────────────────────────

export function applyAccountMemoryHints(
  leads: ProcessedLead[],
  memoryMap: Map<string, AccountMemoryRecord>
): ProcessedLead[] {
  const result: ProcessedLead[] = [];

  for (const lead of leads) {
    const existing = memoryMap.get(lead.id);

    // Exclude accounts the client has flagged
    if (existing?.do_not_show) continue;

    const state = classifyAccountNovelty(
      lead.candidate,
      lead.qualification.fit_score,
      lead.qualification.category,
      existing
    );

    result.push({
      ...lead,
      learning: lead.learning
        ? {
            ...lead.learning,
            account_memory_state: state,
            account_memory_times_seen: existing?.times_seen ?? 0,
            account_memory_last_seen_at: existing?.last_seen_at,
            account_memory_last_category: existing?.last_category ?? undefined,
          }
        : lead.learning,
    });
  }

  return result;
}

// ─── Update after report ──────────────────────────────────────────────────────

export async function updateAccountMemoryFromReport(
  leads: ProcessedLead[],
  jobId: string,
  clientKey: string,
  memoryMap: Map<string, AccountMemoryRecord>
): Promise<void> {
  if (clientKey === "demo") return;

  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    if (!supabase) return;
    const now = new Date().toISOString();

    const withDomain: ProcessedLead[]    = [];
    const withoutDomain: ProcessedLead[] = [];

    for (const lead of leads) {
      if (normalizeDomain(lead.candidate.domain)) {
        withDomain.push(lead);
      } else {
        withoutDomain.push(lead);
      }
    }

    // Batch upsert domain-keyed leads
    if (withDomain.length > 0) {
      const rows = withDomain.map(lead => {
        const existing = memoryMap.get(lead.id);
        return {
          client_id:          clientKey,
          normalized_domain:  normalizeDomain(lead.candidate.domain)!,
          normalized_company: normalizeCompanyName(lead.candidate.company),
          country:            extractCountry(lead.candidate.location),
          first_seen_at:      existing?.first_seen_at ?? now,
          last_seen_at:       now,
          last_job_id:        jobId,
          last_category:      lead.qualification.category,
          last_fit_score:     lead.qualification.fit_score,
          state:              lead.learning?.account_memory_state ?? "new_opportunity",
          times_seen:         (existing?.times_seen ?? 0) + 1,
          updated_at:         now,
        };
      });

      await supabase
        .from("account_memory")
        .upsert(rows, { onConflict: "client_id,normalized_domain" });
    }

    // Insert new company-only leads; update existing ones by id
    const newCompanyLeads      = withoutDomain.filter(l => !memoryMap.has(l.id));
    const existingCompanyLeads = withoutDomain.filter(l =>  memoryMap.has(l.id));

    if (newCompanyLeads.length > 0) {
      await supabase.from("account_memory").insert(
        newCompanyLeads.map(lead => ({
          client_id:          clientKey,
          normalized_domain:  null,
          normalized_company: normalizeCompanyName(lead.candidate.company),
          country:            extractCountry(lead.candidate.location),
          last_job_id:        jobId,
          last_category:      lead.qualification.category,
          last_fit_score:     lead.qualification.fit_score,
          state:              lead.learning?.account_memory_state ?? "new_opportunity",
          times_seen:         1,
        }))
      );
    }

    for (const lead of existingCompanyLeads) {
      const existing = memoryMap.get(lead.id)!;
      await supabase
        .from("account_memory")
        .update({
          last_seen_at:   now,
          last_job_id:    jobId,
          last_category:  lead.qualification.category,
          last_fit_score: lead.qualification.fit_score,
          state:          lead.learning?.account_memory_state ?? "previously_seen",
          times_seen:     existing.times_seen + 1,
          updated_at:     now,
        })
        .eq("id", existing.id);
    }
  } catch {
    // Best-effort — never throw, never block pipeline
  }
}
