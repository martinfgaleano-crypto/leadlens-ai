import type { LeadProvider } from "./lead-provider";
import type { LeadCandidate, LeadSearchCriteria, EmailFindResult } from "@/types";

/**
 * People Data Labs (PDL) Lead Provider
 * PDL has one of the largest B2B contact databases with enrichment APIs.
 * Best for: high-volume enrichment, firmographic data, email finding.
 *
 * Requires: PEOPLE_DATA_LABS_API_KEY
 * Docs: https://docs.peopledatalabs.com
 * Free tier: 100 API calls/month
 * Paid: from $99/month
 *
 * TODO: Test with real PEOPLE_DATA_LABS_API_KEY and adjust field mapping.
 */

const PDL_API_URL = "https://api.peopledatalabs.com/v5";

interface PDLPerson {
  id?: string;
  full_name?: string;
  job_title?: string;
  job_company_name?: string;
  job_company_website?: string;
  job_company_size?: string;
  job_company_industry?: string;
  linkedin_url?: string;
  work_email?: string;
  emails?: { address: string; type: string }[];
  location_name?: string;
  profiles?: { network: string; url: string }[];
}

interface PDLSearchResponse {
  data?: PDLPerson[];
  total?: number;
  status?: number;
  error?: { type: string; message: string };
}

export const peopleDataLabsProvider: LeadProvider = {
  name: "people_data_labs",

  async searchLeads(criteria: LeadSearchCriteria, limit: number): Promise<LeadCandidate[]> {
    const apiKey = process.env.PEOPLE_DATA_LABS_API_KEY;
    if (!apiKey) throw new Error("PEOPLE_DATA_LABS_API_KEY is not set");

    const query = buildPDLQuery(criteria);
    const params = new URLSearchParams({
      query: JSON.stringify(query),
      size: String(Math.min(limit, 100)),
      pretty: "false",
    });

    const res = await fetch(`${PDL_API_URL}/person/search?${params.toString()}`, {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PDL API error ${res.status}: ${text}`);
    }

    const data: PDLSearchResponse = await res.json();
    if (data.error) throw new Error(`PDL error: ${data.error.message}`);

    return (data.data ?? []).map(mapPDLPerson);
  },

  async findEmail(candidate: LeadCandidate): Promise<EmailFindResult> {
    const apiKey = process.env.PEOPLE_DATA_LABS_API_KEY;
    if (!apiKey) throw new Error("PEOPLE_DATA_LABS_API_KEY is not set");

    const params = new URLSearchParams({
      ...(candidate.name ? { name: candidate.name } : {}),
      ...(candidate.company ? { company: candidate.company } : {}),
      ...(candidate.domain ? { company_domain: candidate.domain } : {}),
      pretty: "false",
    });

    const res = await fetch(`${PDL_API_URL}/person/enrich?${params.toString()}`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) return { email_status: "not_found", confidence_score: 0 };

    const data: { data?: PDLPerson; likelihood?: number } = await res.json();
    const person = data.data;
    const email = person?.work_email ?? person?.emails?.[0]?.address;

    return {
      email,
      email_status: email ? "unknown" : "not_found",
      confidence_score: (data.likelihood ?? 0) / 10,
      source: "people_data_labs",
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPDLQuery(criteria: LeadSearchCriteria): object {
  const must: object[] = [];

  if (criteria.target_job_titles.length > 0) {
    must.push({
      terms: { field: "job_title", value: criteria.target_job_titles },
    });
  }

  if (criteria.target_industries.length > 0) {
    must.push({
      terms: { field: "job_company_industry", value: criteria.target_industries },
    });
  }

  if (criteria.target_geography.length > 0) {
    must.push({
      terms: { field: "location_country", value: criteria.target_geography },
    });
  }

  return {
    bool: {
      must,
      must_not: criteria.disqualification_criteria.map(d => ({
        match: { field: "job_company_industry", query: d },
      })),
    },
  };
}

function mapPDLPerson(p: PDLPerson): LeadCandidate {
  const linkedinUrl = p.profiles?.find(pr => pr.network === "linkedin")?.url ?? p.linkedin_url;

  return {
    id: `pdl-${p.id ?? Date.now()}`,
    name: p.full_name,
    title: p.job_title,
    company: p.job_company_name ?? "Unknown",
    domain: p.job_company_website?.replace(/^https?:\/\//, ""),
    website_url: p.job_company_website,
    linkedin_url: linkedinUrl,
    email: p.work_email ?? p.emails?.[0]?.address,
    email_status: p.work_email ? "unknown" : "not_found",
    location: p.location_name,
    industry: p.job_company_industry,
    company_size: p.job_company_size,
    source: "people_data_labs",
    confidence_score: p.work_email ? 0.75 : 0.45,
  };
}
