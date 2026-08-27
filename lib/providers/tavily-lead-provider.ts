import type { LeadProvider } from "./lead-provider";
import type { LeadCandidate, LeadSearchCriteria } from "@/types";

/**
 * Tavily Lead Provider
 * Uses Tavily's search API to find B2B leads based on ICP criteria.
 * Tavily is best for: web research, company context, finding LinkedIn profiles.
 * It does NOT have a structured people/company database like Apollo.
 *
 * Requires: TAVILY_API_KEY
 * Docs: https://docs.tavily.com
 */

const TAVILY_API_URL = "https://api.tavily.com/search";

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilySearchResult[];
}

export const tavilyLeadProvider: LeadProvider = {
  name: "tavily",

  async searchLeads(criteria: LeadSearchCriteria, limit: number): Promise<LeadCandidate[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

    const queries = buildSearchQueries(criteria);
    const allResults: LeadCandidate[] = [];

    for (const query of queries.slice(0, 5)) {
      try {
        const results = await searchTavily(apiKey, query);
        const candidates = parseResultsToLeads(results, criteria);
        allResults.push(...candidates);
        if (allResults.length >= limit) break;
      } catch {
        // Non-blocking per query
        continue;
      }
    }

    // Deduplicate by domain/company
    const seen = new Set<string>();
    const deduped = allResults.filter(l => {
      const key = l.domain ?? l.company.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.slice(0, limit);
  },
};

// ─── Tavily web search helper (also used by research-agent) ──────────────────

export async function researchTavilyForLead(company: string, industry?: string, offer?: string, signals: string[] = []): Promise<{ context: string; sourceUrl: string | null; publishedDate: string | null }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { context: "", sourceUrl: null, publishedDate: null };

  const trigger = signals.slice(0, 3).join(" OR ") || "opened expanded invested acquired implemented";
  const query = `"${company}" ${industry ?? "company"} (${trigger}) ${offer?.slice(0, 80) ?? "operations"} 2025 2026`;

  try {
    const raw = await searchTavily(apiKey, query, { news: true });
    const results = filterAccountResearchResults(company, raw);
    return { context: results
      .slice(0, 3)
      .map(r => `${r.published_date ? `[${r.published_date}] ` : ""}${r.content.slice(0, 260)} (source: ${r.url})`)
      .join(" | "), sourceUrl: results[0]?.url ?? null, publishedDate: results[0]?.published_date ?? null };
  } catch {
    return { context: "", sourceUrl: null, publishedDate: null };
  }
}

export function filterAccountResearchResults(company: string, results: TavilySearchResult[]): TavilySearchResult[] {
  const normalizedCompany = company.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const generic = new Set(["first", "advanced", "professional", "services", "specialty", "industrial", "industries", "international", "group", "company", "corporation", "inc", "llc", "ltd", "market"]);
  const tokens = normalizedCompany.split(/\s+/).filter(t => t.length >= 4 && !generic.has(t));
  const blocked = /(instagram|facebook|linkedin|youtube|tiktok|wikipedia|crunchbase)\.com/i;
  return results.filter(r => {
    if (blocked.test(r.url)) return false;
    const hay = `${r.title} ${r.content}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ");
    if (hay.includes(normalizedCompany)) return true;
    return tokens.length > 0 && tokens.every(token => new RegExp(`(?:^|\\s)${token}(?:\\s|$)`).test(hay));
  });
}

export async function searchTavilyForLead(company: string, title?: string): Promise<string> {
  return (await researchTavilyForLead(company, title)).context;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function searchTavily(apiKey: string, query: string, opts: { news?: boolean } = {}): Promise<TavilySearchResult[]> {
  const res = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 10,
      ...(opts.news ? { topic: "news", days: 730 } : {}),
    }),
  });

  if (!res.ok) throw new Error(`Tavily error ${res.status}: ${await res.text()}`);
  const data: TavilyResponse = await res.json();
  return data.results ?? [];
}

function buildSearchQueries(criteria: LeadSearchCriteria): string[] {
  const queries: string[] = [];
  for (const industry of criteria.target_industries.slice(0, 3)) {
    for (const title of criteria.target_job_titles.slice(0, 2)) {
      queries.push(`${title} "${industry}" company B2B site:linkedin.com/in`);
    }
  }
  for (const signal of criteria.buying_signals.slice(0, 2)) {
    queries.push(`B2B ${criteria.target_industries[0] ?? "SaaS"} company ${signal} 2024`);
  }
  return queries;
}

function parseResultsToLeads(
  results: TavilySearchResult[],
  criteria: LeadSearchCriteria
): LeadCandidate[] {
  return results
    .filter(r => r.score > 0.3)
    .map((r, i): LeadCandidate => {
      // Extract company/name from LinkedIn URL or title when possible
      const linkedinMatch = r.url.match(/linkedin\.com\/in\/([^/]+)/);
      const companyMatch = r.title.match(/at\s+([A-Z][A-Za-z\s]+?)(?:\s*[-|•]|$)/);

      return {
        id: `tavily-${i}-${Date.now()}`,
        company: companyMatch?.[1]?.trim() ?? "Unknown Company",
        linkedin_url: r.url.includes("linkedin.com") ? r.url : undefined,
        source: "tavily",
        source_url: r.url,
        industry: criteria.target_industries[0],
        raw_context: r.content.slice(0, 300),
        confidence_score: r.score * 0.7, // Tavily results are less reliable than structured DB
      };
    });
}
