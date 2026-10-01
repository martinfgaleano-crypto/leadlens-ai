// ─── Provider-resilient content extraction ───────────────────────────────────
// Firecrawl is NOT used as a general search in this round — extraction only,
// and only when Tavily fails on a relevant URL. Env-gated, no fake content.

export interface ExtractResult {
  url: string;
  ok: boolean;
  extractor: "tavily" | "firecrawl" | "direct_http" | "none";
  content: string | null;   // raw html/markdown (server-side only)
  error: string | null;
  latency_ms: number;
}

import { retrievePublicPage, type RetrievalFailure, type RetrievalProvenance, type SafePageDependencies } from "./safe-page-retrieval";

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

export interface ExtractionAttempt { extractor: ExtractResult["extractor"]; ok: boolean; error: string | null; failure: RetrievalFailure | null; latency_ms: number; }

/** Preferred providers remain useful, but ordinary public pages have a safe direct fallback. */
export async function extractWithFallback(url: string, safeDeps: SafePageDependencies = {}): Promise<ExtractResult & { fallback_used: boolean; attempts: ExtractionAttempt[]; provenance: RetrievalProvenance | null; failure: RetrievalFailure | null }> {
  const attempts: ExtractionAttempt[] = [];
  const primary = await tavilyExtract(url);
  attempts.push({ extractor: primary.extractor, ok: primary.ok, error: primary.error, failure: primary.error?.includes("missing") ? "PROVIDER_UNAVAILABLE" : primary.error === "HTTP 402" ? "PAYMENT_EXHAUSTED" : primary.error === "HTTP 429" ? "RATE_LIMITED" : null, latency_ms: primary.latency_ms });
  if (primary.ok) return { ...primary, fallback_used: false, attempts, provenance: null, failure: null };
  const fallback = await firecrawlScrape(url);
  attempts.push({ extractor: fallback.extractor, ok: fallback.ok, error: fallback.error, failure: fallback.error?.includes("missing") ? "PROVIDER_UNAVAILABLE" : fallback.error === "HTTP 402" ? "PAYMENT_EXHAUSTED" : fallback.error === "HTTP 429" ? "RATE_LIMITED" : null, latency_ms: fallback.latency_ms });
  if (fallback.ok) return { ...fallback, fallback_used: true, attempts, provenance: null, failure: null };
  const direct = await retrievePublicPage(url, safeDeps);
  attempts.push({ extractor: "direct_http", ok: direct.ok, error: direct.error, failure: direct.failure, latency_ms: direct.latency_ms });
  return { url, ok: direct.ok, extractor: direct.ok ? "direct_http" : "none", content: direct.content, error: direct.error, latency_ms: direct.latency_ms, fallback_used: true, attempts, provenance: direct.provenance, failure: direct.failure };
}
