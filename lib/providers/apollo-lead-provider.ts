import type { LeadProvider } from "./lead-provider";
import type { LeadCandidate, LeadSearchCriteria, EmailFindResult } from "@/types";

/**
 * Apollo.io Lead Provider
 * Apollo has a large B2B contact database with verified emails and company data.
 * Best for: structured people search by title, industry, company size.
 *
 * Requires: APOLLO_API_KEY
 * Docs: https://apolloio.github.io/apollo-api-docs/
 * Free tier: 50 credits/month
 * Paid: from $49/month
 *
 * TODO: Test with real APOLLO_API_KEY and adjust field mapping as needed.
 */

const APOLLO_API_URL = "https://api.apollo.io/v1";

// Apollo API response types (simplified)
interface ApolloContact {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: "verified" | "unverified" | "invalid" | "bounce";
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: {
    name?: string;
    website_url?: string;
    linkedin_url?: string;
    primary_domain?: string;
    industry?: string;
    estimated_num_employees?: number;
  };
  contact_stage_id?: string;
}

interface ApolloPeopleSearchResponse {
  contacts?: ApolloContact[];
  pagination?: { total_entries: number };
}

export const apolloLeadProvider: LeadProvider = {
  name: "apollo",

  async searchLeads(criteria: LeadSearchCriteria, limit: number): Promise<LeadCandidate[]> {
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) throw new Error("APOLLO_API_KEY is not set");

    const body = buildApolloSearchBody(criteria, limit);

    const res = await fetch(`${APOLLO_API_URL}/mixed_people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apollo API error ${res.status}: ${text}`);
    }

    const data: ApolloPeopleSearchResponse = await res.json();
    return (data.contacts ?? []).map(mapApolloContact);
  },

  async findEmail(candidate: LeadCandidate): Promise<EmailFindResult> {
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) throw new Error("APOLLO_API_KEY is not set");

    // Apollo email enrichment endpoint
    // TODO: verify exact endpoint path with live key
    const res = await fetch(`${APOLLO_API_URL}/people/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        first_name: candidate.name?.split(" ")[0],
        last_name: candidate.name?.split(" ").slice(1).join(" "),
        organization_name: candidate.company,
        domain: candidate.domain,
        reveal_personal_emails: false,
      }),
    });

    if (!res.ok) return { email_status: "not_found", confidence_score: 0 };

    const data = await res.json();
    const contact: ApolloContact = data.person ?? {};

    return {
      email: contact.email,
      email_status: mapApolloEmailStatus(contact.email_status),
      confidence_score: contact.email_status === "verified" ? 0.95 : 0.5,
      source: "apollo",
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildApolloSearchBody(criteria: LeadSearchCriteria, limit: number) {
  // Map company size strings to Apollo's num_employees_ranges format
  const employeeRanges = criteria.target_company_size.map(size => {
    const map: Record<string, string> = {
      "1-10": "1,10",
      "11-50": "11,50",
      "51-200": "51,200",
      "201-500": "201,500",
      "501-1000": "501,1000",
      "1001-5000": "1001,5000",
    };
    return map[size] ?? "11,200";
  });

  return {
    page: 1,
    per_page: Math.min(limit, 100), // Apollo max 100 per page
    person_titles: criteria.target_job_titles,
    organization_industry_tag_ids: [], // TODO: map industry names to Apollo tag IDs
    // Fallback: use keywords for now
    q_keywords: criteria.target_industries.join(" "),
    organization_num_employees_ranges: employeeRanges,
    person_locations: criteria.target_geography,
    contact_email_status_v2: ["verified", "unverified"],
    prospected_by_current_team: ["no"],
  };
}

function mapApolloContact(c: ApolloContact): LeadCandidate {
  const org = c.organization;
  const employeeCount = org?.estimated_num_employees ?? 0;

  return {
    id: `apollo-${c.id}`,
    name: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(" "),
    title: c.title,
    company: org?.name ?? "Unknown",
    domain: org?.primary_domain,
    website_url: org?.website_url,
    linkedin_url: c.linkedin_url,
    email: c.email,
    email_status: mapApolloEmailStatus(c.email_status),
    location: [c.city, c.state, c.country].filter(Boolean).join(", "),
    industry: org?.industry,
    company_size: employeeRangeLabel(employeeCount),
    source: "apollo",
    confidence_score: c.email_status === "verified" ? 0.9 : c.email ? 0.65 : 0.4,
  };
}

function mapApolloEmailStatus(status?: string): import("@/types").EmailStatus {
  if (status === "verified") return "verified";
  if (status === "invalid" || status === "bounce") return "invalid";
  if (status === "unverified") return "unknown";
  return "not_found";
}

function employeeRangeLabel(count: number): string {
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1000";
  return "1001+";
}
