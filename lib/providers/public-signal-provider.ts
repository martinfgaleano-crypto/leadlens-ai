import type { LeadProvider } from "./lead-provider";
import type { LeadCandidate, LeadSearchCriteria } from "@/types";

// ─── Public-signal lead provider (compliant real discovery) ──────────────────
// Reuses the EXISTING multi-provider sources engine end to end — Brave + Serper
// search → canonical dedupe → Tavily extraction (Firecrawl per-URL fallback) →
// date resolution → promotion-gates-v3 (entity resolution v3, page type, event,
// geography) — and maps surviving rows to LeadCandidate for the pipeline.
// Company-level public signals only: no Apollo, no person databases, no emails,
// no phones, no personal profiles. Fail-closed: rows that do not survive the
// gates never become candidates; weak coverage returns fewer candidates, never
// filler.

export const publicSignalProvider: LeadProvider = {
  name: "public_signal",

  async searchLeads(criteria: LeadSearchCriteria, limit: number): Promise<LeadCandidate[]> {
    const { braveProvider, serperProvider } = await import("@/lib/sources/access/providers");
    const { extractWithFallback } = await import("@/lib/sources/access/extractors");
    const { resolvePublicationDate } = await import("@/lib/sources/access/date-resolver");
    const { evaluatePromotionGatesV3 } = await import("@/lib/sources/promotion-contract");

    const spanish = criteria.output_language === "es" || criteria.target_market_region === "latin_america";
    const gl = criteria.target_market_region === "latin_america" ? "co" : "us";
    const queries = buildQueries(criteria, spanish).slice(0, 4);

    // 1. Search (Brave + Serper, recency-limited) + canonical dedupe.
    const seen = new Set<string>();
    const results: SearchItem[] = [];
    for (const q of queries) {
      const [brave, serper] = await Promise.all([
        braveProvider.search({ query: q.query, language: spanish ? "es" : "en", region: gl, max_results: 8, query_type: "signal_specific", freshness_days: 90 }).catch(() => ({ results: [] as SearchItem[] })),
        serperProvider.search({ query: q.query, language: spanish ? "es" : "en", region: gl, max_results: 8, query_type: "signal_specific", freshness_days: 90 }).catch(() => ({ results: [] as SearchItem[] })),
      ]);
      for (const r of [...brave.results, ...serper.results]) {
        if (seen.has(r.canonical_url)) continue;
        seen.add(r.canonical_url);
        results.push({ ...r, signal: q.signal });
      }
    }

    // 2. Prefer dated + news/official results; extraction budget = 2× requested pool cap.
    const ranked = results.sort((a, b) => score(b) - score(a)).slice(0, Math.min(limit * 2, 16));

    // 3. Extract → resolve date → gates v3 → LeadCandidate.
    const out: LeadCandidate[] = [];
    for (const item of ranked) {
      if (out.length >= limit) break;
      const ext = await extractWithFallback(item.url).catch(() => ({ ok: false, content: "", extractor: "none", fallback_used: false }));
      const resolved = resolvePublicationDate({ provider_date: item.published_date ?? null, html: ext.content ?? "", url: item.url });
      const content = (ext.content ?? "").slice(0, 20_000);
      const titleCompany = (item.title ?? "").split(/[|\-–]/)[0]?.trim() ?? "";
      const companyInContent = titleCompany.length >= 4 && content.toLowerCase().includes(titleCompany.toLowerCase().slice(0, Math.min(18, titleCompany.length)));
      const grounded = ext.ok && (companyInContent || !!item.title);

      const sig = item.signal ?? "expansion";
      const verdict = evaluatePromotionGatesV3({
        query_id: sig, region: gl.toUpperCase(), signal: sig,
        url: item.url, canonical_url: item.canonical_url, title: item.title,
        provider_first_seen: item.provider, source_type: item.source_type ?? null,
        provider_date: item.published_date ?? null,
        extraction: { ok: !!ext.ok, extractor: ext.extractor ?? "none", fallback_used: !!ext.fallback_used },
        resolved_date: resolved,
        auto_flags: {
          relevant: true, company_match: companyInContent, valid_date: resolved.date !== null,
          fresh: !!resolved.date && (Date.now() - new Date(resolved.date).getTime()) / 86_400_000 <= 90,
          grounded_claim: grounded, qualified_opportunity: grounded && resolved.date !== null, duplicate: false,
        },
      });
      // Only gate-surviving rows become candidates; monitor-only rides along at
      // reduced confidence (pipeline qualification makes the final call).
      if (verdict.status !== "review_ready" && verdict.status !== "monitor_only") continue;
      const company = verdict.primary_account ?? titleCompany;
      if (!company || company.length < 2) continue;

      out.push({
        id: `ps_${Buffer.from(item.canonical_url).toString("base64url").slice(0, 16)}`,
        company,
        source: "public_signal",
        source_url: item.canonical_url,
        location: spanish ? "Colombia (por confirmar)" : undefined,
        industry: undefined,
        raw_context: `${item.title ?? ""}\nSignal type: ${sig} · Gate: ${verdict.status} · Date: ${resolved.date ?? "unknown"} (${resolved.confidence})\n${content.slice(0, 1500)}`,
        confidence_score: verdict.status === "review_ready" ? 0.75 : 0.5,
        signal_date: resolved.date ?? null,
        signal_type: sig,
      });
    }
    return out;
  },
};

interface SearchItem { url: string; canonical_url: string; title: string | null; provider: string; rank: number; published_date?: string | null; source_type?: string | null; signal?: string }
const score = (x: SearchItem) => (x.published_date ? 2 : 0) + (x.source_type === "official" || x.source_type === "news" ? 1 : 0) - x.rank * 0.01;

function buildQueries(c: LeadSearchCriteria, spanish: boolean): { query: string; signal: string }[] {
  const industry = (c.target_industries[0] ?? (spanish ? "empresa" : "company")).slice(0, 60);
  const geo = (c.target_geography[0] ?? (spanish ? "Colombia" : "United States")).slice(0, 40);
  const year = new Date().getFullYear();
  if (spanish) {
    return [
      { query: `empresa ${industry} "inaugura" OR "abre" nueva bodega planta ${geo} ${year} -tendencias -empleo -feria -listado`, signal: "expansion" },
      { query: `empresa ${industry} "invierte" operación logística ${geo} ${year} -tendencias -informe`, signal: "expansion" },
      { query: `empresa ${industry} "firma alianza" OR "anuncia acuerdo" ${geo} ${year} -tendencias -evento`, signal: "partnership" },
      { query: `empresa ${industry} "moderniza" OR "implementa" tecnología automatización ${geo} ${year} -tendencias -guía`, signal: "product_launch" },
    ];
  }
  return [
    { query: `${industry} company "opened a new" facility ${geo} ${year} -jobs -trends -directory`, signal: "expansion" },
    { query: `${industry} company "invests in" operations ${geo} ${year} -trends -report`, signal: "expansion" },
    { query: `${industry} "announced a strategic partnership" ${geo} ${year} -webinar -trends`, signal: "partnership" },
    { query: `${industry} company "launches" platform ${geo} ${year} -guide -trends`, signal: "product_launch" },
  ];
}
