// ─── Provider adapters: Tavily, Brave, fixture (offline tests) ────────────────
// Each adapter is real code gated by its credential. No keys hardcoded; no
// fake results; deprecated APIs not used as foundation.

import {
  canonicalizeUrl,
  classifySourceType,
  type ProviderCapabilities,
  type ProviderHealth,
  type SearchProvider,
  type SearchProviderResponse,
  type SearchQuery,
  type SearchResultItem,
} from "./provider-contract";

function emptyResponse(provider: string, query: SearchQuery, error: string, latency = 0): SearchProviderResponse {
  return { ok: false, provider, query, results: [], latency_ms: latency, cost_estimate_usd: null, error };
}

// ── Tavily (existing LeadLens provider credential: TAVILY_API_KEY) ────────────
export const tavilyProvider: SearchProvider = {
  id: "tavily",
  capabilities: (): ProviderCapabilities => ({ search: true, extract: false, regions: "global", supports_dates: true }),
  async health(): Promise<ProviderHealth> {
    const present = !!process.env.TAVILY_API_KEY;
    return { provider: "tavily", status: present ? "available" : "unavailable", reason: present ? null : "TAVILY_API_KEY missing", credentials_present: present };
  },
  async search(query: SearchQuery): Promise<SearchProviderResponse> {
    if (!process.env.TAVILY_API_KEY) return emptyResponse("tavily", query, "TAVILY_API_KEY missing");
    const started = Date.now();
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: query.query, max_results: Math.min(query.max_results ?? 8, 20), include_answer: false }),
        signal: AbortSignal.timeout(15_000),
      });
      const latency = Date.now() - started;
      if (!res.ok) return emptyResponse("tavily", query, `HTTP ${res.status}`, latency);
      const data = await res.json() as { results?: Array<{ url: string; title?: string; content?: string; published_date?: string }> };
      const now = new Date().toISOString();
      const results: SearchResultItem[] = (data.results ?? []).map((r, i) => ({
        url: r.url,
        canonical_url: canonicalizeUrl(r.url),
        title: r.title ?? null,
        snippet: r.content?.slice(0, 300) ?? null,
        published_date: r.published_date ?? null,
        retrieved_at: now,
        source_type: classifySourceType(r.url),
        provider: "tavily",
        rank: i + 1,
        locale: query.language ?? null,
      }));
      // Tavily prices per request; published pricing ≈ credits — recorded as null
      // until a real cost table is configured (never guessed).
      return { ok: true, provider: "tavily", query, results, latency_ms: latency, cost_estimate_usd: null, error: null };
    } catch (err) {
      return emptyResponse("tavily", query, err instanceof Error ? err.message.slice(0, 120) : "request failed", Date.now() - started);
    }
  },
};

// ── Brave Search (BRAVE_SEARCH_API_KEY, fallback BRAVE_API_KEY) ───────────────
function braveKey(): string | undefined {
  return process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY;
}
export const braveProvider: SearchProvider = {
  id: "brave",
  capabilities: (): ProviderCapabilities => ({ search: true, extract: false, regions: "global", supports_dates: true }),
  async health(): Promise<ProviderHealth> {
    const present = !!braveKey();
    return { provider: "brave", status: present ? "available" : "unavailable", reason: present ? null : "BRAVE_SEARCH_API_KEY missing", credentials_present: present };
  },
  async search(query: SearchQuery): Promise<SearchProviderResponse> {
    if (!braveKey()) return emptyResponse("brave", query, "BRAVE_SEARCH_API_KEY missing");
    const started = Date.now();
    try {
      const params = new URLSearchParams({ q: query.query, count: String(Math.min(query.max_results ?? 8, 20)) });
      if (query.language) params.set("search_lang", query.language);
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { "X-Subscription-Token": braveKey()!, accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      const latency = Date.now() - started;
      if (!res.ok) return emptyResponse("brave", query, `HTTP ${res.status}`, latency);
      const data = await res.json() as { web?: { results?: Array<{ url: string; title?: string; description?: string; page_age?: string }> } };
      const now = new Date().toISOString();
      const results: SearchResultItem[] = (data.web?.results ?? []).map((r, i) => ({
        url: r.url,
        canonical_url: canonicalizeUrl(r.url),
        title: r.title ?? null,
        snippet: r.description?.slice(0, 300) ?? null,
        published_date: r.page_age ?? null,
        retrieved_at: now,
        source_type: classifySourceType(r.url),
        provider: "brave",
        rank: i + 1,
        locale: query.language ?? null,
      }));
      return { ok: true, provider: "brave", query, results, latency_ms: latency, cost_estimate_usd: null, error: null };
    } catch (err) {
      return emptyResponse("brave", query, err instanceof Error ? err.message.slice(0, 120) : "request failed", Date.now() - started);
    }
  },
};

// ── Serper (Google results via SERPER_API_KEY) ────────────────────────────────
export const serperProvider: SearchProvider = {
  id: "serper",
  capabilities: (): ProviderCapabilities => ({ search: true, extract: false, regions: "global", supports_dates: true }),
  async health(): Promise<ProviderHealth> {
    const present = !!process.env.SERPER_API_KEY;
    return { provider: "serper", status: present ? "available" : "unavailable", reason: present ? null : "SERPER_API_KEY missing", credentials_present: present };
  },
  async search(query: SearchQuery): Promise<SearchProviderResponse> {
    if (!process.env.SERPER_API_KEY) return emptyResponse("serper", query, "SERPER_API_KEY missing");
    const started = Date.now();
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": process.env.SERPER_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ q: query.query, num: Math.min(query.max_results ?? 8, 20), ...(query.language ? { hl: query.language } : {}), ...(query.region ? { gl: query.region } : {}) }),
        signal: AbortSignal.timeout(15_000),
      });
      const latency = Date.now() - started;
      if (!res.ok) return emptyResponse("serper", query, `HTTP ${res.status}`, latency);
      const data = await res.json() as { organic?: Array<{ link: string; title?: string; snippet?: string; date?: string }> };
      const now = new Date().toISOString();
      const results: SearchResultItem[] = (data.organic ?? []).map((r, i) => ({
        url: r.link,
        canonical_url: canonicalizeUrl(r.link),
        title: r.title ?? null,
        snippet: r.snippet?.slice(0, 300) ?? null,
        published_date: r.date ?? null,
        retrieved_at: now,
        source_type: classifySourceType(r.link),
        provider: "serper",
        rank: i + 1,
        locale: query.language ?? null,
      }));
      return { ok: true, provider: "serper", query, results, latency_ms: latency, cost_estimate_usd: null, error: null };
    } catch (err) {
      return emptyResponse("serper", query, err instanceof Error ? err.message.slice(0, 120) : "request failed", Date.now() - started);
    }
  },
};

// ── Firecrawl (extraction-oriented; search endpoint via FIRECRAWL_API_KEY) ────
export const firecrawlProvider: SearchProvider = {
  id: "firecrawl",
  capabilities: (): ProviderCapabilities => ({ search: true, extract: true, regions: "global", supports_dates: false }),
  async health(): Promise<ProviderHealth> {
    const present = !!process.env.FIRECRAWL_API_KEY;
    return { provider: "firecrawl", status: present ? "available" : "unavailable", reason: present ? null : "FIRECRAWL_API_KEY missing", credentials_present: present };
  },
  async search(query: SearchQuery): Promise<SearchProviderResponse> {
    if (!process.env.FIRECRAWL_API_KEY) return emptyResponse("firecrawl", query, "FIRECRAWL_API_KEY missing");
    const started = Date.now();
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ query: query.query, limit: Math.min(query.max_results ?? 8, 20) }),
        signal: AbortSignal.timeout(20_000),
      });
      const latency = Date.now() - started;
      if (!res.ok) return emptyResponse("firecrawl", query, `HTTP ${res.status}`, latency);
      const data = await res.json() as { data?: Array<{ url: string; title?: string; description?: string }> };
      const now = new Date().toISOString();
      const results: SearchResultItem[] = (data.data ?? []).map((r, i) => ({
        url: r.url,
        canonical_url: canonicalizeUrl(r.url),
        title: r.title ?? null,
        snippet: r.description?.slice(0, 300) ?? null,
        published_date: null, // Firecrawl search doesn't carry dates — never invented
        retrieved_at: now,
        source_type: classifySourceType(r.url),
        provider: "firecrawl",
        rank: i + 1,
        locale: query.language ?? null,
      }));
      return { ok: true, provider: "firecrawl", query, results, latency_ms: latency, cost_estimate_usd: null, error: null };
    } catch (err) {
      return emptyResponse("firecrawl", query, err instanceof Error ? err.message.slice(0, 120) : "request failed", Date.now() - started);
    }
  },
};

// ── Fixture provider (offline, deterministic — tests/benchmarks only) ─────────
export const fixtureProvider: SearchProvider = {
  id: "fixture_offline",
  capabilities: (): ProviderCapabilities => ({ search: true, extract: false, regions: "global", supports_dates: true }),
  async health(): Promise<ProviderHealth> {
    return { provider: "fixture_offline", status: "available", reason: "offline fixture provider (tests only — never customer data)", credentials_present: true };
  },
  async search(query: SearchQuery): Promise<SearchProviderResponse> {
    const now = new Date().toISOString();
    const seedResults: SearchResultItem[] = [1, 2, 3].map((i) => ({
      url: `https://fixture.example.com/${encodeURIComponent(query.query.slice(0, 24))}/${i}?utm_source=x`,
      canonical_url: canonicalizeUrl(`https://fixture.example.com/${encodeURIComponent(query.query.slice(0, 24))}/${i}`),
      title: `[FIXTURE] result ${i} for ${query.query.slice(0, 40)}`,
      snippet: "[FIXTURE] deterministic offline result — never a real source.",
      published_date: null,
      retrieved_at: now,
      source_type: null,
      provider: "fixture_offline",
      rank: i,
      locale: query.language ?? null,
    }));
    return { ok: true, provider: "fixture_offline", query, results: seedResults, latency_ms: 1, cost_estimate_usd: 0, error: null };
  },
};

// Apollo is deliberately absent by strategic decision — never a provider,
// fallback, benchmark or dataset source. No LinkedIn automation either.
export const ALL_PROVIDERS: SearchProvider[] = [tavilyProvider, braveProvider, serperProvider, firecrawlProvider, fixtureProvider];
export const REAL_PROVIDERS: SearchProvider[] = [tavilyProvider, braveProvider, serperProvider, firecrawlProvider];

export function getProvider(id: string): SearchProvider | null {
  return ALL_PROVIDERS.find((p) => p.id === id) ?? null;
}
