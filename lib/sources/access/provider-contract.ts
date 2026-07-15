// ─── Multiprovider Source Access Layer v0 — provider contract ─────────────────
// Provider-agnostic search/extract/health interface. Adapters work only when
// credentials exist; missing credentials degrade to health "unavailable" with
// the exact env var named — never fake results, never break the pipeline.
// Raw provider metadata stays server-side only.

export interface SearchQuery {
  query: string;
  region?: string | null;
  language?: string | null;
  max_results?: number;
  /** Restrict to recent results (provider-native operators; approximate). */
  freshness_days?: number | null;
  /** Query intent for routing/benchmark attribution. */
  query_type?: "company_specific" | "signal_specific" | "industry_discovery" | "regional_discovery" | "official_domain" | "news" | "careers" | "regulatory" | "generic";
}

export interface SearchResultItem {
  url: string;
  canonical_url: string;
  title: string | null;
  snippet: string | null;
  published_date: string | null;   // ISO when the provider carries one — never invented
  retrieved_at: string;
  source_type: string | null;      // best-effort classification (news/official/careers/…)
  provider: string;
  rank: number;
  locale: string | null;
}

export interface SearchProviderResponse {
  ok: boolean;
  provider: string;
  query: SearchQuery;
  results: SearchResultItem[];
  latency_ms: number;
  cost_estimate_usd: number | null; // null = unknown, never guessed
  error: string | null;
}

export interface ProviderHealth {
  provider: string;
  status: "available" | "unavailable" | "degraded";
  reason: string | null;            // e.g. "TAVILY_API_KEY missing"
  credentials_present: boolean;
}

export interface ProviderCapabilities {
  search: boolean;
  extract: boolean;
  regions: string[] | "global";
  supports_dates: boolean;
}

export interface SearchProvider {
  id: string;
  capabilities(): ProviderCapabilities;
  health(): Promise<ProviderHealth>;
  search(query: SearchQuery): Promise<SearchProviderResponse>;
}

/** Canonicalize a URL for dedupe: lowercase host, strip tracking params,
 *  trailing slash and fragments. Deterministic. */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const params = new URLSearchParams();
    const dropped = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"];
    for (const [k, v] of Array.from(u.searchParams.entries())) {
      if (!dropped.includes(k.toLowerCase())) params.append(k, v);
    }
    const qs = params.toString();
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "") || "/"}${qs ? `?${qs}` : ""}`;
  } catch {
    return raw.trim();
  }
}

export function classifySourceType(url: string): string | null {
  const u = url.toLowerCase();
  if (/careers|jobs|greenhouse|lever\.co|workable/.test(u)) return "careers";
  if (/news|press|prensa|forbes|bloomberg|reuters|techcrunch/.test(u)) return "news";
  if (/investor|newsroom|about/.test(u)) return "official";
  if (/gov\.|\.gov|registry|registro/.test(u)) return "regulatory";
  return null;
}
