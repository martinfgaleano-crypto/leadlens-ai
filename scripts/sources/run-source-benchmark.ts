// ─── Source Quality Validation benchmark (24 real queries) ────────────────────
// Policy per query: Brave + Serper search → canonical dedupe → top-3 combined
// URLs → Tavily Extract (Firecrawl ONLY as per-URL fallback) → date resolution
// → auto-assessed quality flags → metrics. Results to ml/data/source-benchmark/.
// Auto-assessments are heuristic pre-labels for admin review — never customer
// performance claims. Cost figures are ESTIMATES from published list prices.
// Run: npm run sources:benchmark

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { braveProvider, serperProvider } from "@/lib/sources/access/providers";
import type { SearchResultItem } from "@/lib/sources/access/provider-contract";
import { extractWithFallback } from "@/lib/sources/access/extractors";
import { resolvePublicationDate } from "@/lib/sources/access/date-resolver";

// Env for standalone tsx (Next loads .env.local; tsx does not).
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Estimated per-call list prices (USD) — estimates, not billed amounts.
const EST_COST = { brave: 0.003, serper: 0.001, tavily_extract: 0.008, firecrawl_scrape: 0.005 };

interface BenchQuery { id: string; region: "US" | "CO" | "MX"; signal: string; query: string; language: string; gl: string }

const QUERIES: BenchQuery[] = [
  // US — 8
  { id: "us-exp-1", region: "US", signal: "expansion", language: "en", gl: "us", query: "logistics company announces new distribution center opening Texas" },
  { id: "us-exp-2", region: "US", signal: "expansion", language: "en", gl: "us", query: "industrial manufacturer opens new facility announcement Ohio 2026" },
  // query-policy-v2: hiring templates produced staffing/SEO/job-post pages —
  // pin to company announcements and exclude job boards and guide content.
  { id: "us-hir-1", region: "US", signal: "hiring", language: "en", gl: "us", query: "B2B software company announces sales team expansion press release -jobs -careers -staffing -agency -guide -\"how to\"" },
  { id: "us-hir-2", region: "US", signal: "hiring", language: "en", gl: "us", query: "freight brokerage company announces operations hiring expansion news -jobs -careers -indeed -glassdoor -staffing" },
  { id: "us-par-1", region: "US", signal: "partnership", language: "en", gl: "us", query: "supply chain software company strategic partnership announcement 2026" },
  { id: "us-par-2", region: "US", signal: "partnership", language: "en", gl: "us", query: "warehouse automation company partners with 3PL announcement" },
  // query-policy-v2: us-lau-1 pulled UK-market results and newsroom index
  // pages; both launch templates pulled stale launches — pin geography + year.
  { id: "us-lau-1", region: "US", signal: "product_launch", language: "en", gl: "us", query: "B2B SaaS company launches procurement platform announcement \"United States\" 2026 -UK -Europe -newsroom" },
  { id: "us-lau-2", region: "US", signal: "product_launch", language: "en", gl: "us", query: "logistics technology company launches freight visibility product 2026" },
  // CO — 8
  // query-policy-v2: stale (2025) results observed — pin year.
  { id: "co-exp-1", region: "CO", signal: "expansion", language: "es", gl: "co", query: "empresa logística Colombia anuncia nueva bodega expansión 2026" },
  { id: "co-exp-2", region: "CO", signal: "expansion", language: "es", gl: "co", query: "empresa manufactura Colombia abre nueva planta anuncio" },
  { id: "co-hir-1", region: "CO", signal: "hiring", language: "es", gl: "co", query: "empresa Colombia contratación equipo comercial crecimiento" },
  { id: "co-hir-2", region: "CO", signal: "hiring", language: "es", gl: "co", query: "compañía tecnología Bogotá contrata gerentes operaciones expansión" },
  { id: "co-par-1", region: "CO", signal: "partnership", language: "es", gl: "co", query: "empresa logística colombiana firma alianza estratégica anuncio" },
  { id: "co-par-2", region: "CO", signal: "partnership", language: "es", gl: "co", query: "empresa colombiana alianza tecnología B2B anuncio 2026" },
  // query-policy-v2: pulled a stale trade-fair (event) page — pin year, drop ferias.
  { id: "co-lau-1", region: "CO", signal: "product_launch", language: "es", gl: "co", query: "empresa Colombia lanza plataforma B2B logística anuncio 2026 -feria -evento" },
  { id: "co-lau-2", region: "CO", signal: "product_launch", language: "es", gl: "co", query: "empresa colombiana lanza nuevo servicio empresarial anuncio" },
  // MX — 8
  { id: "mx-exp-1", region: "MX", signal: "expansion", language: "es", gl: "mx", query: "empresa logística México anuncia nuevo centro distribución" },
  { id: "mx-exp-2", region: "MX", signal: "expansion", language: "es", gl: "mx", query: "empresa manufactura México abre nueva planta Monterrey anuncio" },
  { id: "mx-hir-1", region: "MX", signal: "hiring", language: "es", gl: "mx", query: "empresa México contratación personal operaciones expansión nearshoring" },
  { id: "mx-hir-2", region: "MX", signal: "hiring", language: "es", gl: "mx", query: "compañía tecnología México contrata equipo ventas B2B crecimiento" },
  { id: "mx-par-1", region: "MX", signal: "partnership", language: "es", gl: "mx", query: "empresa mexicana firma alianza estratégica logística anuncio" },
  { id: "mx-par-2", region: "MX", signal: "partnership", language: "es", gl: "mx", query: "empresa México alianza tecnología cadena suministro anuncio" },
  { id: "mx-lau-1", region: "MX", signal: "product_launch", language: "es", gl: "mx", query: "empresa México lanza plataforma logística B2B anuncio" },
  { id: "mx-lau-2", region: "MX", signal: "product_launch", language: "es", gl: "mx", query: "empresa mexicana lanza nuevo producto industrial anuncio 2026" },
];

const SIGNAL_WORDS: Record<string, RegExp> = {
  expansion: /(expan|abre|opens?|nueva? (bodega|planta|centro)|new (facility|distribution|center|plant)|crecimiento)/i,
  hiring: /(hir|contrat|vacan|empleo|recruit|sales team|equipo)/i,
  partnership: /(partner|alianza|alliance|acuerdo|agreement|colabora)/i,
  product_launch: /(launch|lanza|nuevo (producto|servicio|plataforma)|new (product|platform|service))/i,
};

function pickTopUrls(results: SearchResultItem[], n: number): SearchResultItem[] {
  // Prefer dated results, then official/news source types, then rank.
  return [...results].sort((a, b) => {
    const dateScore = (x: SearchResultItem) => (x.published_date ? 2 : 0) + (x.source_type === "official" || x.source_type === "news" ? 1 : 0);
    return dateScore(b) - dateScore(a) || a.rank - b.rank;
  }).slice(0, n);
}

async function main() {
  mkdirSync("ml/data/source-benchmark", { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const rows: Record<string, unknown>[] = [];
  const perQuery: Record<string, unknown>[] = [];
  let extractCalls = 0, firecrawlFallbacks = 0, braveCalls = 0, serperCalls = 0;

  // Recency operators (next-step b): FRESHNESS_DAYS applies provider-native
  // date filters (Brave freshness=, Serper tbs=qdr:) to test if the 25% fresh
  // rate rises. Unset = the original wide benchmark, so runs stay comparable.
  const freshnessDays = process.env.FRESHNESS_DAYS ? parseInt(process.env.FRESHNESS_DAYS, 10) : null;

  // High-precision runs: QUERY_FILTER=id,id,… restricts the query set;
  // MAX_EXTRACTIONS caps total adjudicated (extracted) results.
  const queryFilter = (process.env.QUERY_FILTER ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const activeQueries = queryFilter.length ? QUERIES.filter((q) => queryFilter.includes(q.id)) : QUERIES;
  const maxExtractions = process.env.MAX_EXTRACTIONS ? parseInt(process.env.MAX_EXTRACTIONS, 10) : null;

  for (const q of activeQueries) {
    if (maxExtractions && extractCalls >= maxExtractions) break;
    const [brave, serper] = await Promise.all([
      braveProvider.search({ query: q.query, language: q.language, region: q.gl, max_results: 8, query_type: "signal_specific", freshness_days: freshnessDays }),
      serperProvider.search({ query: q.query, language: q.language, region: q.gl, max_results: 8, query_type: "signal_specific", freshness_days: freshnessDays }),
    ]);
    braveCalls++; serperCalls++;

    const seen = new Set<string>();
    const combined: SearchResultItem[] = [];
    let dupes = 0;
    for (const r of [...brave.results, ...serper.results]) {
      if (seen.has(r.canonical_url)) { dupes++; continue; }
      seen.add(r.canonical_url);
      combined.push(r);
    }
    const braveSet = new Set(brave.results.map((r) => r.canonical_url));
    const serperSet = new Set(serper.results.map((r) => r.canonical_url));

    const topN = process.env.TOP_PER_QUERY ? Math.max(1, parseInt(process.env.TOP_PER_QUERY, 10)) : 3;
    const top = pickTopUrls(combined, topN);
    for (const item of top) {
      if (maxExtractions && extractCalls >= maxExtractions) break;
      const ext = await extractWithFallback(item.url);
      extractCalls++;
      if (ext.fallback_used) firecrawlFallbacks++;
      const resolved = resolvePublicationDate({ provider_date: item.published_date, html: ext.content, url: item.url });
      const content = (ext.content ?? "").slice(0, 20_000);
      const signalMatch = SIGNAL_WORDS[q.signal]?.test(content) || SIGNAL_WORDS[q.signal]?.test(item.snippet ?? "") || false;
      const titleCompany = (item.title ?? "").split(/[|\-–]/)[0]?.trim() ?? "";
      const companyInContent = titleCompany.length >= 4 && content.toLowerCase().includes(titleCompany.toLowerCase().slice(0, Math.min(18, titleCompany.length)));
      const fresh = resolved.date ? (Date.now() - new Date(resolved.date).getTime()) / 86_400_000 <= 90 : false;
      const grounded = ext.ok && signalMatch && (companyInContent || !!item.title);
      const validSignal = grounded && (resolved.date !== null || item.source_type === "official");
      const qualified = validSignal && fresh && resolved.confidence !== "low";

      rows.push({
        query_id: q.id, region: q.region, signal: q.signal, url: item.url, canonical_url: item.canonical_url,
        title: item.title, provider_first_seen: item.provider,
        in_brave: braveSet.has(item.canonical_url), in_serper: serperSet.has(item.canonical_url),
        source_type: item.source_type, provider_date: item.published_date,
        extraction: { ok: ext.ok, extractor: ext.extractor, fallback_used: ext.fallback_used, error: ext.error, latency_ms: ext.latency_ms },
        resolved_date: resolved,
        auto_flags: {
          relevant: signalMatch, company_match: companyInContent, official_source: item.source_type === "official",
          valid_date: resolved.date !== null, fresh, duplicate: false,
          extraction_success: ext.ok, grounded_claim: grounded, commercial_signal: signalMatch,
          qualified_opportunity: qualified, insufficient_evidence: !grounded,
          note: "auto-assessed heuristics — pending human review, never customer performance",
        },
      });
    }

    perQuery.push({
      query_id: q.id, region: q.region, signal: q.signal,
      brave: { ok: brave.ok, results: brave.results.length, dated: brave.results.filter((r) => r.published_date).length, latency_ms: brave.latency_ms, error: brave.error },
      serper: { ok: serper.ok, results: serper.results.length, dated: serper.results.filter((r) => r.published_date).length, latency_ms: serper.latency_ms, error: serper.error },
      combined_unique: combined.length, cross_provider_duplicates: dupes,
      brave_only: combined.filter((r) => braveSet.has(r.canonical_url) && !serperSet.has(r.canonical_url)).length,
      serper_only: combined.filter((r) => serperSet.has(r.canonical_url) && !braveSet.has(r.canonical_url)).length,
    });
    console.log(`${q.id}: brave=${brave.results.length} serper=${serper.results.length} unique=${combined.length} extracted=${Math.min(topN, top.length)}`);
  }

  // ── Aggregate metrics ──
  const byRegion = (region: string) => rows.filter((r) => r.region === region);
  const agg = (subset: Record<string, unknown>[]) => {
    const n = subset.length;
    const f = (fn: (r: Record<string, unknown>) => boolean) => n ? Number((subset.filter(fn).length / n).toFixed(3)) : null;
    type Flags = { relevant: boolean; company_match: boolean; official_source: boolean; valid_date: boolean; fresh: boolean; extraction_success: boolean; grounded_claim: boolean; qualified_opportunity: boolean };
    const flag = (k: keyof Flags) => f((r) => (r.auto_flags as Flags)[k]);
    return {
      sample_size: n,
      relevant_rate: flag("relevant"), company_match_rate: flag("company_match"),
      official_source_rate: flag("official_source"),
      provider_date_rate: f((r) => !!r.provider_date),
      resolved_date_rate: flag("valid_date"), fresh_rate: flag("fresh"),
      extraction_success_rate: flag("extraction_success"),
      grounded_claim_rate: flag("grounded_claim"),
      valid_signal_yield: f((r) => (r.auto_flags as Flags).grounded_claim && (r.auto_flags as Flags).valid_date),
      qualified_opportunity_yield: flag("qualified_opportunity"),
    };
  };

  const totalQueries = activeQueries.length;
  const estCost = braveCalls * EST_COST.brave + serperCalls * EST_COST.serper + (extractCalls - firecrawlFallbacks) * EST_COST.tavily_extract + firecrawlFallbacks * (EST_COST.tavily_extract + EST_COST.firecrawl_scrape);
  const validSignals = rows.filter((r) => (r.auto_flags as { grounded_claim: boolean; valid_date: boolean }).grounded_claim && (r.auto_flags as { valid_date: boolean }).valid_date).length;
  const qualified = rows.filter((r) => (r.auto_flags as { qualified_opportunity: boolean }).qualified_opportunity).length;

  const summary = {
    ran_at: new Date().toISOString(),
    banner: "SOURCE QUALITY VALIDATION — auto-assessed heuristic flags pending human review; costs are LIST-PRICE ESTIMATES, not billed amounts; no customer performance claims",
    policy: "Brave+Serper search → dedupe → top-3 combined → Tavily Extract (Firecrawl per-URL fallback only)",
    query_policy_version: "query-policy-v2",
    query_filter: queryFilter.length ? queryFilter : null,
    max_extractions: maxExtractions,
    freshness_days: freshnessDays,
    freshness_mode: freshnessDays ? `recency operators (≤${freshnessDays}d)` : "wide (no recency filter)",
    queries: totalQueries,
    search_calls: { brave: braveCalls, serper: serperCalls },
    extract_calls: { total: extractCalls, tavily_primary: extractCalls - firecrawlFallbacks, firecrawl_fallbacks: firecrawlFallbacks },
    search_comparison: {
      brave_avg_dated_ratio: Number((perQuery.reduce((s, p) => s + ((p.brave as { dated: number; results: number }).dated / Math.max(1, (p.brave as { results: number }).results)), 0) / totalQueries).toFixed(3)),
      serper_avg_dated_ratio: Number((perQuery.reduce((s, p) => s + ((p.serper as { dated: number; results: number }).dated / Math.max(1, (p.serper as { results: number }).results)), 0) / totalQueries).toFixed(3)),
      brave_avg_latency_ms: Math.round(perQuery.reduce((s, p) => s + (p.brave as { latency_ms: number }).latency_ms, 0) / totalQueries),
      serper_avg_latency_ms: Math.round(perQuery.reduce((s, p) => s + (p.serper as { latency_ms: number }).latency_ms, 0) / totalQueries),
      brave_only_urls: perQuery.reduce((s, p) => s + (p.brave_only as number), 0),
      serper_only_urls: perQuery.reduce((s, p) => s + (p.serper_only as number), 0),
      cross_provider_duplicates: perQuery.reduce((s, p) => s + (p.cross_provider_duplicates as number), 0),
    },
    overall: agg(rows),
    by_region: { US: agg(byRegion("US")), CO: agg(byRegion("CO")), MX: agg(byRegion("MX")) },
    cost_estimates_usd: {
      note: "published list prices, NOT billed amounts",
      total: Number(estCost.toFixed(3)),
      per_valid_signal: validSignals ? Number((estCost / validSignals).toFixed(3)) : null,
      per_qualified_opportunity: qualified ? Number((estCost / qualified).toFixed(3)) : null,
    },
  };

  const tag = freshnessDays ? `fresh${freshnessDays}` : "wide";
  writeFileSync(`ml/data/source-benchmark/results-${tag}-${stamp}.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(`ml/data/source-benchmark/summary-${tag}-${stamp}.json`, JSON.stringify({ summary, per_query: perQuery }, null, 2));
  // Only the wide run drives the admin UI's headline table; recency runs write
  // a comparison file so the original evidence is never clobbered.
  writeFileSync(freshnessDays ? `ml/data/source-benchmark/latest-recency.json` : `ml/data/source-benchmark/latest.json`, JSON.stringify({ summary, results_file: `results-${tag}-${stamp}.jsonl` }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
