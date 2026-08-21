// ─── Amor de Gea — Temporal Intelligence & Independent Corroboration V1 run ────
// Disciplined, bounded temporal + adversarial research across the 10 Amor
// accounts using ONLY the existing approved provider stack (Tavily primary for
// Colombian press + dates, Exa semantic escalation for Prioritize accounts,
// Brave backup). No new providers, no parallel scraper. Every call is logged
// (§60). Snapshots are written to a NEW immutable file — Pilot-1 history is
// never mutated (§42). Search snippets are candidates, not accepted material
// evidence (§18): acceptance requires a real published_date + Case relevance.
import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile, rename } from "fs/promises";
import { dirname } from "path";
import { tavilyProvider, braveProvider, exaProvider } from "@/lib/sources/access/providers";
import { canonicalizeUrl } from "@/lib/sources/access/provider-contract";
import type { SearchProvider, SearchResultItem } from "@/lib/sources/access/provider-contract";

loadEnvConfig(process.cwd());

const RUN_ID = "amor_temporal_corroboration_v1";
const OUT = `ml/data/evidence-temporal/${RUN_ID}.json`;
const CALL_CEILING = 40; // cost discipline (§6, §63)
const NOW = new Date().toISOString();

type Decision = "prioritize" | "validate" | "monitor";
interface Q { purpose: "support" | "adversarial" | "unknown_resolution"; provider: SearchProvider; q: string; freshness_days?: number | null }
interface Acct { name: string; decision: Decision; route: string; queries: Q[] }

// Tailored temporal queries — generated from account + Amor's objective (place
// finished botanical/wellness products into retail / spa-hospitality / corporate
// gifting) + event classes that would actually move each Case. Not "company news".
const T = tavilyProvider, B = braveProvider, E = exaProvider;
const co = { region: "co", language: "es" };

const ACCOUNTS: Acct[] = [
  // ── Prioritize (support ×2 + adversarial ×1; Exa escalation) ──
  { name: "Ser Saludable", decision: "prioritize", route: "Retail especializado", queries: [
    { purpose: "support", provider: T, q: "Ser Saludable tienda productos naturales Colombia nueva sede apertura 2025 2026", freshness_days: 540 },
    { purpose: "support", provider: E, q: "Ser Saludable Colombia wellness retailer expansion new store 2025 2026" },
    { purpose: "adversarial", provider: T, q: "Ser Saludable Colombia cierre marca propia problemas dificultades", freshness_days: 540 },
  ]},
  { name: "Masaya Collection", decision: "prioritize", route: "Hotelería y spa", queries: [
    { purpose: "support", provider: T, q: "Masaya Collection hotel Colombia nueva apertura spa bienestar 2025 2026", freshness_days: 540 },
    { purpose: "support", provider: E, q: "Masaya hotels Colombia new hotel opening wellness spa 2025 2026" },
    { purpose: "adversarial", provider: T, q: "Masaya hotel Colombia cierre venta problemas operación", freshness_days: 540 },
  ]},
  { name: "Natural + Mente", decision: "prioritize", route: "Retail especializado", queries: [
    { purpose: "support", provider: T, q: "\"Natural + Mente\" OR \"Natural y Mente\" tienda fitoterapia Colombia nueva sede ecommerce 2025 2026", freshness_days: 540 },
    { purpose: "support", provider: E, q: "Natural + Mente Colombia natural products store new marcas ecommerce 2025 2026" },
    { purpose: "adversarial", provider: T, q: "Natural + Mente Colombia cierre tienda dificultades marca propia", freshness_days: 540 },
  ]},
  // ── Validate (decision-critical unknown resolution ×2) ──
  { name: "Éteka", decision: "validate", route: "Hotelería y spa", queries: [
    { purpose: "unknown_resolution", provider: T, q: "Éteka spa Colombia productos bienestar catálogo proveedores marca 2025 2026", freshness_days: 720 },
    { purpose: "unknown_resolution", provider: B, q: "Eteka spa Colombia wellness ritual huéspedes productos" },
  ]},
  { name: "Celestino Hotel Boutique & Spa", decision: "validate", route: "Hotelería y spa", queries: [
    { purpose: "unknown_resolution", provider: T, q: "Celestino Hotel Boutique Spa Colombia amenidades productos spa apertura 2025 2026", freshness_days: 720 },
    { purpose: "unknown_resolution", provider: B, q: "Celestino Hotel Boutique Spa Colombia wellness amenities" },
  ]},
  { name: "Sinergy On", decision: "validate", route: "Regalos corporativos", queries: [
    { purpose: "unknown_resolution", provider: T, q: "Sinergy On regalos corporativos Colombia kits bienestar catálogo clientes 2025 2026", freshness_days: 720 },
    { purpose: "unknown_resolution", provider: B, q: "Sinergy On Colombia corporate gifts wellness kits" },
  ]},
  { name: "Vitálica", decision: "validate", route: "Retail especializado", queries: [
    { purpose: "unknown_resolution", provider: T, q: "Vitálica tienda productos naturales Colombia surtido marcas nueva sede 2025 2026", freshness_days: 720 },
    { purpose: "unknown_resolution", provider: B, q: "Vitalica Colombia natural products store botanical" },
  ]},
  // ── Monitor (new-trigger check ×2) ──
  { name: "Hotel Charleston Santa Teresa Spa", decision: "monitor", route: "Hotelería y spa", queries: [
    { purpose: "support", provider: T, q: "Hotel Charleston Santa Teresa Cartagena spa renovación programa bienestar 2025 2026", freshness_days: 540 },
    { purpose: "support", provider: B, q: "Charleston Santa Teresa Cartagena spa wellness new 2025" },
  ]},
  { name: "Habibi Plantitas", decision: "monitor", route: "Regalos corporativos", queries: [
    { purpose: "support", provider: T, q: "Habibi Plantitas Colombia regalos personalizados nuevos productos alianza 2025 2026", freshness_days: 540 },
    { purpose: "support", provider: B, q: "Habibi Plantitas Colombia gifts new products partnership" },
  ]},
  { name: "Funat", decision: "monitor", route: "Retail especializado", queries: [
    { purpose: "support", provider: T, q: "Funat Colombia productos naturales fitoterapia nuevo producto expansión 2025 2026", freshness_days: 540 },
    { purpose: "support", provider: B, q: "Funat Colombia natural products botanical new launch 2025" },
  ]},
];

interface CallLog {
  account: string; decision: Decision; purpose: string; provider: string; query: string;
  ok: boolean; error: string | null; latency_ms: number; result_count: number; cost_estimate_usd: number | null;
  results: Array<{ title: string | null; host: string | null; url: string; published_date: string | null; source_type: string | null }>;
}

const hostOf = (u: string): string | null => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };

async function main() {
  const started = NOW;
  let calls = 0;
  const log: CallLog[] = [];
  // priority order: prioritize → validate → monitor (§9, §51)
  const order: Decision[] = ["prioritize", "validate", "monitor"];
  const ordered = [...ACCOUNTS].sort((a, b) => order.indexOf(a.decision) - order.indexOf(b.decision));

  for (const acct of ordered) {
    for (const query of acct.queries) {
      if (calls >= CALL_CEILING) { console.error(`ceiling ${CALL_CEILING} reached`); break; }
      calls++;
      let entry: CallLog;
      try {
        const resp = await query.provider.search({
          query: query.q, region: co.region, language: co.language, max_results: 6,
          freshness_days: query.freshness_days ?? null,
          query_type: query.purpose === "adversarial" ? "signal_specific" : "company_specific",
        });
        entry = {
          account: acct.name, decision: acct.decision, purpose: query.purpose,
          provider: resp.provider, query: query.q, ok: resp.ok, error: resp.error,
          latency_ms: resp.latency_ms, result_count: resp.results.length, cost_estimate_usd: resp.cost_estimate_usd,
          results: resp.results.slice(0, 6).map((r: SearchResultItem) => ({
            title: r.title, host: hostOf(r.canonical_url), url: r.canonical_url,
            published_date: r.published_date, source_type: r.source_type,
          })),
        };
      } catch (e: any) {
        entry = { account: acct.name, decision: acct.decision, purpose: query.purpose, provider: query.provider.id,
          query: query.q, ok: false, error: String(e?.message ?? e), latency_ms: 0, result_count: 0, cost_estimate_usd: null, results: [] };
      }
      log.push(entry);
      console.error(`[${calls}] ${acct.name} · ${query.purpose} · ${entry.provider} · ok=${entry.ok} · n=${entry.result_count}${entry.error ? " · " + entry.error : ""}`);
    }
  }

  // ── discipline pass: dedupe by canonical url, flag syndication (same title across hosts) ──
  const byUrl = new Map<string, { title: string | null; host: string | null; url: string; published_date: string | null; source_type: string | null; accounts: Set<string> }>();
  const titleHosts = new Map<string, Set<string>>();
  for (const c of log) for (const r of c.results) {
    const cu = canonicalizeUrl(r.url);
    if (!byUrl.has(cu)) byUrl.set(cu, { ...r, accounts: new Set() });
    byUrl.get(cu)!.accounts.add(c.account);
    if (r.title) { const key = r.title.toLowerCase().trim(); if (!titleHosts.has(key)) titleHosts.set(key, new Set()); if (r.host) titleHosts.get(key)!.add(r.host); }
  }
  const syndicated = Array.from(titleHosts.entries()).filter(([, hosts]) => hosts.size > 1).map(([title, hosts]) => ({ title, hosts: Array.from(hosts) }));

  const out = {
    run_id: RUN_ID, run_kind: "temporal_corroboration_live", pilot_id: "amor-de-gea",
    started_at: started, finished_at: new Date().toISOString(), call_ceiling: CALL_CEILING, calls_made: calls,
    providers_used: Array.from(new Set(log.map(c => c.provider))),
    accounts_researched: ordered.map(a => a.name),
    unique_candidate_urls: byUrl.size,
    dated_candidate_urls: Array.from(byUrl.values()).filter(v => v.published_date).length,
    syndication_clusters: syndicated,
    calls: log,
    note: "Search-layer candidate acquisition. Snippets are NOT accepted as material evidence; acceptance requires verified content + real event date + Case relevance (done in evaluation stage). Pilot-1 history untouched.",
  };
  await mkdir(dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp";
  await writeFile(tmp, JSON.stringify(out, null, 2) + "\n", "utf8");
  await rename(tmp, OUT);
  console.error(`\nWROTE ${OUT} · calls=${calls} · uniqueUrls=${byUrl.size} · dated=${out.dated_candidate_urls} · syndicated=${syndicated.length}`);
  // compact stdout summary
  console.log(JSON.stringify({ calls, providers: out.providers_used, uniqueUrls: byUrl.size, dated: out.dated_candidate_urls, syndicated: syndicated.length,
    perAccount: ordered.map(a => ({ name: a.name, decision: a.decision, ok: log.filter(c => c.account === a.name && c.ok).length, err: log.filter(c => c.account === a.name && !c.ok).length, results: log.filter(c => c.account === a.name).reduce((s, c) => s + c.result_count, 0) })) }, null, 2));
}
main().catch(e => { console.error("FATAL", e?.message ?? e); process.exit(1); });
