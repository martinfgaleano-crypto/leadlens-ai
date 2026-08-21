// ─── Temporal Intelligence Real-World Validation Benchmark V1 ─────────────────
// Validates the EXISTING temporal + corroboration system against a deliberately
// evidence-richer universe: 12 real mid-market/enterprise operating companies
// (6 Colombia, 6 US) evaluated through ONE synthetic client lens (Asteron
// Systems — enterprise logistics & operations software).
//
// Integrity: the 12 accounts were selected FIRST by structural criteria (sector,
// operational intensity, public visibility) — NOT because any event was known
// (§8/§12/§101). Same provider stack, no new providers, no Apollo, no parallel
// scraper. Every call + every candidate's rejecting gate is logged (§37/§38).
// Snapshot is immutable and separate from Amor (§75/§97).
import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile, rename } from "fs/promises";
import { dirname } from "path";
import { tavilyProvider, braveProvider, exaProvider } from "@/lib/sources/access/providers";
import { canonicalizeUrl } from "@/lib/sources/access/provider-contract";
import type { SearchProvider, SearchResultItem } from "@/lib/sources/access/provider-contract";

loadEnvConfig(process.cwd());

const RUN_ID = "temporal_benchmark_v1";
const OUT = `ml/data/benchmark/${RUN_ID}.json`;
const CALL_CEILING = 60;
const NOW = new Date().toISOString();
const T = tavilyProvider, B = braveProvider, E = exaProvider;

// ── Client lens (synthetic; reuses the landing Asteron objective) ──
export const CLIENT = {
  name: "Asteron Systems",
  sells: "Enterprise logistics & operations software (WMS/TMS/orchestration) for multi-site operators.",
  objective: "Find enterprise accounts where operational expansion creates a credible near-term software opportunity.",
  attractive_when: "The account is scaling physical operations — new distribution centers, terminals, plants, facilities, capacity, or acquisitions — which strains existing tooling and creates a near-term systems need.",
  buyers: "VP/Director of Operations, Supply Chain, Logistics, IT/Digital.",
  stronger_timing_from: ["new DC / warehouse / terminal", "new plant / facility opening", "capacity expansion", "acquisition / merger integration", "ERP/WMS/TMS modernization", "large hiring in operations"],
};

// ── The universe: selected first, by structural reason (NOT by known events) ──
interface Acct { name: string; country: "CO" | "US"; sector: string; scale: string; reason: string; site?: string;
  queries: Array<{ purpose: "support" | "adversarial"; provider: SearchProvider; q: string; freshness_days?: number | null }> }

const q = (purpose: "support" | "adversarial", provider: SearchProvider, s: string, fd: number | null = 540) => ({ purpose, provider, q: s, freshness_days: fd });

const ACCOUNTS: Acct[] = [
  // ── Colombia (6) ──
  { name: "Quala S.A.", country: "CO", sector: "Consumer goods manufacturing", scale: "Large private (enterprise)", reason: "Multi-plant Colombian CPG multinational; operationally intensive manufacturing+distribution across LatAm.", site: "quala.com.co",
    queries: [ q("support", T, "Quala S.A. Colombia nueva planta expansión capacidad inversión centro distribución 2025 2026"), q("support", E, "Quala consumer goods Colombia new plant expansion investment 2025 2026"), q("adversarial", T, "Quala Colombia cierre planta despidos problemas retiro mercado", 540) ] },
  { name: "Coordinadora Mercantil", country: "CO", sector: "Logistics / parcel", scale: "Large national (enterprise)", reason: "National Colombian logistics/courier operator; multi-terminal network — core Asteron operational profile.", site: "coordinadora.com",
    queries: [ q("support", T, "Coordinadora logística Colombia nuevo centro logístico expansión inversión tecnología 2025 2026"), q("support", E, "Coordinadora logistics Colombia new hub distribution center technology 2025 2026"), q("adversarial", T, "Coordinadora Colombia cierre problemas huelga pérdidas", 540) ] },
  { name: "Crystal S.A.S.", country: "CO", sector: "Textile & apparel manufacturing", scale: "Mid-large (enterprise)", reason: "Vertically-integrated Medellín textile manufacturer + retail distribution; multi-plant operations.", site: "grupocrystal.com.co",
    queries: [ q("support", T, "Crystal S.A.S. textil Colombia expansión planta nueva tienda inversión 2025 2026"), q("support", E, "Crystal textile Colombia new plant expansion investment 2025 2026"), q("adversarial", T, "Crystal textil Colombia cierre despidos crisis dificultades", 540) ] },
  { name: "Alianza Team", country: "CO", sector: "Food ingredients manufacturing", scale: "Mid-large (enterprise)", reason: "B2B edible oils/fats manufacturer + distributor across the Americas; plant-heavy operations.", site: "alianzateam.com",
    queries: [ q("support", T, "Alianza Team alimentos Colombia nueva planta expansión capacidad inversión 2025 2026"), q("support", E, "Alianza Team food ingredients new plant expansion Latin America 2025 2026"), q("adversarial", T, "Alianza Team Colombia cierre problemas pérdidas dificultades", 540) ] },
  { name: "Grupo BIOS", country: "CO", sector: "Agro-industrial / animal nutrition", scale: "Large (enterprise)", reason: "Colombian agroindustrial holding (animal nutrition, protein); many plants + logistics footprint.", site: "grupobios.co",
    queries: [ q("support", T, "Grupo BIOS agroindustrial Colombia nueva planta expansión inversión centro 2025 2026"), q("support", E, "Grupo BIOS agroindustrial Colombia new plant expansion investment 2025 2026"), q("adversarial", T, "Grupo BIOS Colombia cierre problemas dificultades pérdidas", 540) ] },
  { name: "Tecnoglass", country: "CO", sector: "Glass & aluminum manufacturing", scale: "Mid-cap (NYSE: TGLS)", reason: "Barranquilla architectural-glass manufacturer, export-oriented; capital-intensive plant operations.", site: "tecnoglass.com",
    queries: [ q("support", T, "Tecnoglass Barranquilla new plant expansion capacity investment 2025 2026"), q("support", E, "Tecnoglass manufacturing new facility expansion capacity 2025 2026"), q("adversarial", T, "Tecnoglass problems layoffs plant closure lawsuit decline", 540) ] },
  // ── United States (6) ──
  { name: "Saia Inc.", country: "US", sector: "LTL freight / logistics", scale: "Mid-cap (NASDAQ: SAIA)", reason: "Less-than-truckload carrier expanding terminal network; classic multi-site logistics operator.", site: "saia.com",
    queries: [ q("support", T, "Saia LTL new terminal opening expansion facility 2025 2026"), q("support", E, "Saia freight new terminals network expansion 2025 2026"), q("adversarial", T, "Saia LTL terminal closures layoffs volume decline problems", 540) ] },
  { name: "US Foods", country: "US", sector: "Foodservice distribution", scale: "Large-cap (NYSE: USFD)", reason: "National foodservice distributor; distribution-center network central to Asteron's profile.", site: "usfoods.com",
    queries: [ q("support", T, "US Foods new distribution center opening expansion facility 2025 2026"), q("support", E, "US Foods new distribution center warehouse expansion 2025 2026"), q("adversarial", T, "US Foods distribution center closure layoffs problems decline", 540) ] },
  { name: "Encompass Health", country: "US", sector: "Healthcare facilities", scale: "Large-cap (NYSE: EHC)", reason: "Operator of rehabilitation hospitals opening new facilities; facility growth = operations tooling need.", site: "encompasshealth.com",
    queries: [ q("support", T, "Encompass Health new hospital opening facility expansion 2025 2026"), q("support", E, "Encompass Health new rehabilitation hospital opening expansion 2025 2026"), q("adversarial", T, "Encompass Health hospital closure problems layoffs decline", 540) ] },
  { name: "Watsco", country: "US", sector: "HVAC distribution", scale: "Large-cap (NYSE: WSO)", reason: "Largest US HVAC/R distributor; many locations + digital-ops modernization program.", site: "watsco.com",
    queries: [ q("support", T, "Watsco new location distribution acquisition technology expansion 2025 2026"), q("support", E, "Watsco HVAC distribution new location acquisition expansion 2025 2026"), q("adversarial", T, "Watsco problems location closure decline layoffs", 540) ] },
  { name: "Mueller Industries", country: "US", sector: "Metals manufacturing", scale: "Mid/large-cap (NYSE: MLI)", reason: "Copper/brass manufacturer with multiple plants; capacity investments common.", site: "muellerindustries.com",
    queries: [ q("support", T, "Mueller Industries new plant expansion facility acquisition capacity 2025 2026"), q("support", E, "Mueller Industries manufacturing new facility expansion acquisition 2025 2026"), q("adversarial", T, "Mueller Industries plant closure layoffs problems decline", 540) ] },
  { name: "GXO Logistics", country: "US", sector: "Contract logistics / warehousing", scale: "Large-cap (NYSE: GXO)", reason: "Pure-play contract logistics; continuously opening/automating warehouses — prime Asteron profile.", site: "gxo.com",
    queries: [ q("support", T, "GXO Logistics new warehouse site opening contract expansion automation 2025 2026"), q("support", E, "GXO Logistics new warehouse contract win site opening automation 2025 2026"), q("adversarial", T, "GXO Logistics site closure contract loss layoffs problems", 540) ] },
];

const hostOf = (u: string): string | null => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };

interface Cand { title: string | null; host: string | null; url: string; published_date: string | null; source_type: string | null; snippet: string | null }
interface CallLog { account: string; country: string; purpose: string; provider: string; query: string; ok: boolean; error: string | null; latency_ms: number; result_count: number; cost_estimate_usd: number | null; results: Cand[] }

async function main() {
  let calls = 0; const log: CallLog[] = [];
  for (const acct of ACCOUNTS) {
    for (let j = 0; j < acct.queries.length; j++) {
      const query = acct.queries[j];
      if (calls >= CALL_CEILING) { console.error("ceiling reached"); break; }
      calls++;
      // Slot routing (proven by probe): Brave 'news' carries real article dates
      // + independent publishers; Tavily 'general' adds identity/breadth; Exa's
      // company category only yields crawl-date artifacts, so it is not used.
      // slot 0 = Brave (dated support), slot 1 = Tavily (breadth), slot 2 = Brave (dated adversarial).
      const provider: SearchProvider = j === 1 ? T : B;
      const isNews = provider === B;
      let entry: CallLog;
      try {
        const resp = await provider.search({ query: query.q, region: acct.country === "CO" ? "co" : "us", language: acct.country === "CO" ? "es" : "en", max_results: 6, freshness_days: isNews ? (query.freshness_days ?? 540) : null, query_type: isNews ? "news" : "company_specific" });
        entry = { account: acct.name, country: acct.country, purpose: query.purpose, provider: resp.provider, query: query.q, ok: resp.ok, error: resp.error, latency_ms: resp.latency_ms, result_count: resp.results.length, cost_estimate_usd: resp.cost_estimate_usd,
          results: resp.results.slice(0, 6).map((r: SearchResultItem) => ({ title: r.title, host: hostOf(r.canonical_url), url: r.canonical_url, published_date: r.published_date, source_type: r.source_type, snippet: r.snippet ? r.snippet.slice(0, 240) : null })) };
      } catch (e: any) {
        entry = { account: acct.name, country: acct.country, purpose: query.purpose, provider: provider.id, query: query.q, ok: false, error: String(e?.message ?? e), latency_ms: 0, result_count: 0, cost_estimate_usd: null, results: [] };
      }
      log.push(entry);
      console.error(`[${calls}] ${acct.name} · ${query.purpose} · ${entry.provider} · ok=${entry.ok} · n=${entry.result_count}${entry.error ? " · " + entry.error : ""}`);
    }
  }
  const byUrl = new Map<string, Cand>();
  for (const c of log) for (const r of c.results) { const cu = canonicalizeUrl(r.url); if (!byUrl.has(cu)) byUrl.set(cu, r); }
  let cost = 0; for (const c of log) if (c.cost_estimate_usd != null) cost += c.cost_estimate_usd;
  const out = { run_id: RUN_ID, run_kind: "temporal_real_world_benchmark", client: CLIENT,
    universe: ACCOUNTS.map(a => ({ name: a.name, country: a.country, sector: a.sector, scale: a.scale, reason: a.reason, site: a.site })),
    started_at: NOW, finished_at: new Date().toISOString(), call_ceiling: CALL_CEILING, calls_made: calls, exposed_cost_usd: Number(cost.toFixed(4)),
    calls_by_provider: log.reduce((m: any, c) => (m[c.provider] = (m[c.provider] || 0) + 1, m), {}),
    unique_candidate_urls: byUrl.size, dated_candidate_urls: Array.from(byUrl.values()).filter(v => v.published_date).length,
    calls: log, note: "Discovery layer. Candidates are adjudicated in the evaluation stage against identity/temporal/materiality/client-relevance/independence gates. Amor untouched." };
  await mkdir(dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp"; await writeFile(tmp, JSON.stringify(out, null, 2) + "\n", "utf8"); await rename(tmp, OUT);
  console.error(`\nWROTE ${OUT} · calls=${calls} · cost=$${out.exposed_cost_usd} · uniqueUrls=${byUrl.size} · dated=${out.dated_candidate_urls}`);
  console.log(JSON.stringify({ calls, cost: out.exposed_cost_usd, byProvider: out.calls_by_provider, uniqueUrls: byUrl.size, dated: out.dated_candidate_urls }, null, 2));
}
main().catch(e => { console.error("FATAL", e?.message ?? e); process.exit(1); });
