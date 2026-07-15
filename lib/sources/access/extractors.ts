// ─── Content extractors: Tavily Extract primary, Firecrawl fallback ──────────
// Firecrawl is NOT used as a general search in this round — extraction only,
// and only when Tavily fails on a relevant URL. Env-gated, no fake content.

export interface ExtractResult {
  url: string;
  ok: boolean;
  extractor: "tavily" | "firecrawl" | "none";
  content: string | null;   // raw html/markdown (server-side only)
  error: string | null;
  latency_ms: number;
}

export async function tavilyExtract(url: string): Promise<ExtractResult> {
  const started = Date.now();
  if (!process.env.TAVILY_API_KEY) return { url, ok: false, extractor: "none", content: null, error: "TAVILY_API_KEY missing", latency_ms: 0 };
  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, urls: [url] }),
      signal: AbortSignal.timeout(25_000),
    });
    const latency = Date.now() - started;
    if (!res.ok) return { url, ok: false, extractor: "tavily", content: null, error: `HTTP ${res.status}`, latency_ms: latency };
    const data = await res.json() as { results?: Array<{ url: string; raw_content?: string }>; failed_results?: unknown[] };
    const content = data.results?.[0]?.raw_content ?? null;
    return { url, ok: !!content, extractor: "tavily", content, error: content ? null : "empty extraction", latency_ms: latency };
  } catch (err) {
    return { url, ok: false, extractor: "tavily", content: null, error: err instanceof Error ? err.message.slice(0, 100) : "failed", latency_ms: Date.now() - started };
  }
}

export async function firecrawlScrape(url: string): Promise<ExtractResult> {
  const started = Date.now();
  if (!process.env.FIRECRAWL_API_KEY) return { url, ok: false, extractor: "none", content: null, error: "FIRECRAWL_API_KEY missing", latency_ms: 0 };
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "html"] }),
      signal: AbortSignal.timeout(35_000),
    });
    const latency = Date.now() - started;
    if (!res.ok) return { url, ok: false, extractor: "firecrawl", content: null, error: `HTTP ${res.status}`, latency_ms: latency };
    const data = await res.json() as { data?: { markdown?: string; html?: string } };
    const content = data.data?.html ?? data.data?.markdown ?? null;
    return { url, ok: !!content, extractor: "firecrawl", content, error: content ? null : "empty extraction", latency_ms: latency };
  } catch (err) {
    return { url, ok: false, extractor: "firecrawl", content: null, error: err instanceof Error ? err.message.slice(0, 100) : "failed", latency_ms: Date.now() - started };
  }
}

/** Extraction policy for this validation round: Tavily first, Firecrawl only on failure. */
export async function extractWithFallback(url: string): Promise<ExtractResult & { fallback_used: boolean }> {
  const primary = await tavilyExtract(url);
  if (primary.ok) return { ...primary, fallback_used: false };
  const fallback = await firecrawlScrape(url);
  return { ...fallback, fallback_used: true };
}
