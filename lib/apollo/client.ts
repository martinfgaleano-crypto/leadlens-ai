/**
 * Apollo.io client for admin-triggered lead generation.
 *
 * Separate from lib/providers/apollo-lead-provider.ts, which is tied to the
 * old pipeline flow. This client maps ICP + lead_searches fields directly to
 * Apollo's people search API and returns objects shaped for lead_results rows.
 *
 * Server-side only. Never import this in browser code.
 * Requires: APOLLO_API_KEY (set in .env.local, never NEXT_PUBLIC_)
 */

const APOLLO_BASE = "https://api.apollo.io/v1";
const TIMEOUT_MS = 30_000;
const MAX_PER_PAGE = 100; // Apollo hard limit

// ─── Public types ──────────────────────────────────────────────────────────────

/** Input shape derived from lead_searches + icps rows. */
export interface ApolloSearchParams {
  job_titles: string[];
  industries: string[];
  company_sizes: string[];
  countries: string[];
  keywords: string[];
  limit: number;
}

/** One result row — maps directly to a lead_results insert. */
export interface ApolloLeadResult {
  company_name: string;
  website: string | null;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  country: string | null;
  source: "apollo";
}

export interface ApolloSearchResult {
  results: ApolloLeadResult[];
  total_available: number;
}

// ─── Internal Apollo types ────────────────────────────────────────────────────

interface ApolloContact {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  country?: string;
  organization?: {
    name?: string;
    website_url?: string;
    primary_domain?: string;
    industry?: string;
  };
}

interface ApolloPeopleResponse {
  contacts?: ApolloContact[];
  pagination?: { total_entries?: number };
  error?: string;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function sizeToEmployeeRange(size: string): string {
  const map: Record<string, string> = {
    "1-10":      "1,10",
    "11-50":     "11,50",
    "51-200":    "51,200",
    "201-500":   "201,500",
    "501-1000":  "501,1000",
    "1001-5000": "1001,5000",
    "5000+":     "5001,10000000",
  };
  return map[size] ?? "11,200";
}

function mapContact(c: ApolloContact): ApolloLeadResult {
  const org = c.organization;
  const domain = org?.primary_domain;
  const website = org?.website_url
    ?? (domain ? `https://${domain}` : null);

  const joined   = [c.first_name, c.last_name].filter(Boolean).join(" ");
  const fullName = c.name ?? (joined || null);

  return {
    company_name: org?.name?.trim() || "Unknown Company",
    website,
    contact_name: fullName,
    title:        c.title?.trim() ?? null,
    email:        c.email?.trim() ?? null,
    linkedin_url: c.linkedin_url?.trim() ?? null,
    country:      c.country?.trim() ?? null,
    source:       "apollo",
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Search Apollo people endpoint using ICP + search criteria.
 *
 * Handles:
 *   - Missing API key  → throws immediately
 *   - Network timeout  → throws after TIMEOUT_MS
 *   - Rate limit 429   → throws with clear message
 *   - Non-2xx errors   → throws with status + body
 *   - Empty results    → returns { results: [], total_available: 0 }
 *   - Per-page cap     → clamps to MAX_PER_PAGE (100); call multiple times for more
 */
export async function searchPeople(
  params: ApolloSearchParams
): Promise<ApolloSearchResult> {
  // Compliance gate: Apollo is licensed-only for customer deliverables.
  // API key presence alone never activates it — see provider-registry.ts and
  // LEADLENS_DATA_SOURCING_COMPLIANCE.md.
  const { apolloCustomerFacingBlockReason } = await import("@/lib/providers/provider-registry");
  const blockReason = apolloCustomerFacingBlockReason();
  if (blockReason) {
    throw new Error(`Apollo disabled: ${blockReason}`);
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "APOLLO_API_KEY is not set. Add it to .env.local (server-side only)."
    );
  }

  const perPage = Math.min(params.limit, MAX_PER_PAGE);

  // Combine industry names + keywords into Apollo's keyword search.
  // Apollo doesn't expose stable industry tag IDs via the public docs,
  // so q_keywords is the most reliable fallback for industry targeting.
  const allKeywords = [
    ...params.industries,
    ...params.keywords,
  ].filter(Boolean);

  const body: Record<string, unknown> = {
    page: 1,
    per_page: perPage,
    contact_email_status_v2: ["verified", "unverified"],
    prospected_by_current_team: ["no"],
  };

  if (params.job_titles.length > 0) {
    body.person_titles = params.job_titles;
  }
  if (params.countries.length > 0) {
    body.person_locations = params.countries;
  }
  if (params.company_sizes.length > 0) {
    body.organization_num_employees_ranges =
      params.company_sizes.map(sizeToEmployeeRange);
  }
  if (allKeywords.length > 0) {
    body.q_keywords = allKeywords.join(" ");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      throw new Error(`Apollo request timed out after ${TIMEOUT_MS / 1000}s.`);
    }
    throw new Error(
      `Apollo network error: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    throw new Error(
      "Apollo rate limit reached (HTTP 429). Wait a few minutes and try again."
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Apollo API error HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: ApolloPeopleResponse;
  try {
    data = await res.json();
  } catch {
    throw new Error("Apollo returned invalid JSON.");
  }

  if (data.error) {
    throw new Error(`Apollo returned error: ${data.error}`);
  }

  const contacts = data.contacts ?? [];
  const results  = contacts.map(mapContact);

  return {
    results,
    total_available: data.pagination?.total_entries ?? results.length,
  };
}
