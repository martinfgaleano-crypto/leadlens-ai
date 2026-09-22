// ─── Production reused-identity qualification deps — resilient official-source fetch ──
//
// Supplies ReuseQualificationDeps.fetchCompanyEvidence for the productive path: a BOUNDED
// retrieval of the company's OWN current public content, used only to establish a neutral
// operating-role family. Reuses existing provider infrastructure (Firecrawl scrape + Tavily
// search — mirrors providers.ts).
//
// RESILIENCE (Breakthrough V1): the first live canary lost most REAL targets (Alpina, Colombina,
// Carvajal, Corona) — not to irrelevance, but to Firecrawl HTTP 429 rate-limiting that persisted
// across the run. This fetcher therefore (1) retries 429/5xx honoring Retry-After, and (2) FALLS
// BACK to the independent, funded Tavily search provider for a structural role signal when
// Firecrawl is unavailable. Per §18 the Tavily signal supports STRUCTURAL role qualification only —
// it is NEVER material-event Evidence or Timing (canonical Research owns those). Fail-closed:
// exhaustion returns ok:false so the candidate is held (never wrongly excluded, §13/§43).
//
// Not unit-tested (needs live providers), mirroring discovery-runner.ts; the qualification DECISION
// is covered by the pure qualifyFromEvidence tests.

import type { CompanyEvidence, ReuseQualificationDeps } from "./vault-reuse-qualification";
import { tavilyProvider } from "@/lib/sources/access/providers";

const SCRAPE_TIMEOUT_MS = 12_000;
const MAX_CONTENT_CHARS = 6_000;
const MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 6_000;

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter) { const s = Number(retryAfter); if (Number.isFinite(s) && s >= 0) return Math.min(s * 1000, MAX_BACKOFF_MS); }
  return Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
}

async function firecrawlScrape(sourceUrl: string, clean: string): Promise<CompanyEvidence> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { domain: clean, content: "", sourceUrl, ok: false };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl, formats: ["markdown"], onlyMainContent: true, timeout: SCRAPE_TIMEOUT_MS }),
        signal: controller.signal,
      });
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS - 1) {
        clearTimeout(timer); await sleep(backoffMs(res.headers.get("retry-after"), attempt)); continue;
      }
      if (!res.ok) { clearTimeout(timer); return { domain: clean, content: "", sourceUrl, ok: false }; }
      const json = (await res.json()) as { data?: { markdown?: string; metadata?: { description?: string; title?: string } } };
      const md = json?.data?.markdown ?? "";
      const meta = `${json?.data?.metadata?.title ?? ""} ${json?.data?.metadata?.description ?? ""}`;
      const content = `${meta} ${md}`.trim().slice(0, MAX_CONTENT_CHARS);
      clearTimeout(timer);
      return { domain: clean, content, sourceUrl, ok: content.length > 0 };
    } catch {
      clearTimeout(timer);
      if (attempt < MAX_ATTEMPTS - 1) { await sleep(backoffMs(null, attempt)); continue; }
      return { domain: clean, content: "", sourceUrl, ok: false };
    }
  }
  return { domain: clean, content: "", sourceUrl, ok: false };
}

/** Structural-role fallback when Firecrawl is unavailable: aggregate the company's OWN official-site
 * search results (title+snippet) into content for role detection. Role only — NOT Evidence/Timing (§18). */
async function tavilyRoleFallback(name: string, clean: string): Promise<CompanyEvidence> {
  const sourceUrl = `https://${clean}`;
  try {
    let resp = await tavilyProvider.search({ query: name, include_domains: [clean], max_results: 5, query_type: "official_domain", search_mode: "fast" });
    let items = resp.ok ? resp.results : [];
    if (!items.length) {
      resp = await tavilyProvider.search({ query: `"${name}" ${clean} company profile products operations services`, max_results: 5, query_type: "company_specific", search_mode: "fast" });
      items = resp.ok ? resp.results : [];
    }
    const content = items.map((i) => `${i.title ?? ""} ${i.snippet ?? ""}`).join("\n").trim().slice(0, MAX_CONTENT_CHARS);
    return { domain: clean, content, sourceUrl, ok: content.length > 40 };
  } catch {
    return { domain: clean, content: "", sourceUrl, ok: false };
  }
}

export function createReuseQualificationDeps(): ReuseQualificationDeps {
  return {
    async fetchCompanyEvidence({ domain, name, path }): Promise<CompanyEvidence> {
      const clean = normalizeDomain(domain);
      if (!clean) return { domain: clean, content: "", sourceUrl: `https://${clean}`, ok: false };
      const sourceUrl = `https://${clean}${path ?? ""}`;
      const fc = await firecrawlScrape(sourceUrl, clean);
      if (fc.ok) return fc;
      // Firecrawl unavailable → independent Tavily structural-role fallback (homepage-level only,
      // never for subpage deepening). Recovers targets lost to Firecrawl rate-limiting.
      if (!path) return await tavilyRoleFallback(name, clean);
      return fc;
    },
  };
}
