// Unit tests: segment-universe-v1 (extract, dedupe, status, junk, budget, replay).
import { discoverSegmentUniverse, segmentsForRun, canonicalDomain, normalizeName, extractCompanyName, type SearchFn } from "@/lib/discovery/segment-universe";
let p = 0, f = 0; const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// Pure helpers
t("canonicalDomain quita www", canonicalDomain("https://www.serSaludable.com/x") === "sersaludable.com");
t("normalizeName quita sufijos legales/tildes", normalizeName("Alimentós Sostenibles S.A.S") === "alimentossostenibles");
t("extractCompanyName recorta tagline", extractCompanyName("BioPlaza | Productos Saludables") === "BioPlaza");
t("extractCompanyName rechaza '10 mejores...'", extractCompanyName("10 mejores tiendas saludables de Cali") === null);

// Deterministic stub search: each query returns hits (some junk, some dupes).
const HITS: Record<string, { title: string; url: string }[]> = {
  retail: [
    { title: "Ser Saludable | Tienda", url: "https://sersaludable.com" },
    { title: "Ser Saludable — sede norte", url: "https://sersaludable.com/norte" }, // dup domain
    { title: "BioPlaza Productos Saludables", url: "https://bioplaza.com.co" },
    { title: "Las 10 mejores tiendas naturales", url: "https://paginasamarillas.com.co/x" }, // directory
    { title: "BioPlaza", url: "https://instagram.com/bioplaza" }, // social + dup name
  ],
  hospitality: [
    { title: "GHL Hoteles", url: "https://ghlhoteles.com" },
    { title: "Movich Hotels", url: "https://movichhotels.com" },
    { title: "Compra GHL en Mercadolibre", url: "https://mercadolibre.com.co/ghl" }, // marketplace
  ],
};
const search: SearchFn = async (_q, seg) => HITS[seg] ?? [];

(async () => {
  const segs = segmentsForRun(["retail", "hospitality"]);
  const r = await discoverSegmentUniverse(segs, search, { region: "Valle del Cauca", maxQueriesPerSegment: 1, costPerQuery: 0.01, costCeilingUsd: 1, now: (() => { let n = 0; return () => (n += 1); })() });

  t("directorio excluido", r.companies.every(c => !/paginasamarillas/.test(c.source_url ?? "")));
  t("marketplace excluido", r.companies.every(c => !/mercadolibre/.test(c.source_url ?? "")));
  t("dedupe por dominio (Ser Saludable una sola vez)", r.companies.filter(c => c.domain === "sersaludable.com").length === 1);
  t("social excluido y BioPlaza no duplicado", r.companies.filter(c => /bioplaza/i.test(c.company)).length === 1 && r.companies.every(c => !/instagram/.test(c.source_url ?? "")));
  t("dominio oficial → verified high", r.companies.find(c => c.domain === "sersaludable.com")?.status === "verified");
  t("segment_distribution poblado", Object.keys(r.segment_distribution).length >= 1);
  t("excluidos contados", r.excluded_company_count >= 2);
  t("verified_company_count coherente", r.verified_company_count === r.companies.filter(c => c.status === "verified").length);
  t("reason codes incluyen included_in_universe", r.companies.every(c => c.reason_codes.includes("included_in_universe")));
  t("provider_used registrado", r.provider_used.includes("search"));
  t("no abortó con ceiling holgado", r.aborted_on_budget === false);

  // Verification hardening: headline/reference titles must NOT be verified.
  const HITS2: Record<string, { title: string; url: string }[]> = {
    retail: [
      { title: "Fithub", url: "https://fithub.com.co" },                                   // real brand → verified
      { title: "Tres restaurantes saludables para comer en Bogotá", url: "https://revistadiners.com.co/x" }, // article on media host
      { title: "grupo in English", url: "https://collinsdictionary.com/grupo" },            // dictionary host
      { title: "49+ Best Wellness Retreats in Colombia", url: "https://retreat.guru/co" },   // listing host
      { title: "Boutique Hotels in Colombia", url: "https://hilton.com/co" },                // global chain host
    ],
  };
  const search2: SearchFn = async (_q, seg) => HITS2[seg] ?? [];
  const rv = await discoverSegmentUniverse(segmentsForRun(["retail"]), search2, { maxQueriesPerSegment: 1, costCeilingUsd: 1 });
  t("marca real → verified", rv.companies.some(c => /fithub/i.test(c.company) && c.status === "verified"));
  t("host de medios/dictionary/global-chain → excluido", rv.verified_company_count === 1);
  t("título-artículo no entra como verified", rv.companies.every(c => c.status !== "verified" || /fithub/i.test(c.company)));

  // Budget abort
  const rb = await discoverSegmentUniverse(segs, search, { maxQueriesPerSegment: 3, costPerQuery: 0.5, costCeilingUsd: 0.4 });
  t("budget abort cuando se supera el ceiling", rb.aborted_on_budget === true);
  t("abort preserva artefacto parcial", Array.isArray(rb.companies));

  // Replay determinism
  const a = await discoverSegmentUniverse(segs, search, { maxQueriesPerSegment: 1, now: (() => { let n = 0; return () => (n += 1); })() });
  const b = await discoverSegmentUniverse(segs, search, { maxQueriesPerSegment: 1, now: (() => { let n = 0; return () => (n += 1); })() });
  t("replay determinista (mismas empresas y orden)", JSON.stringify(a.companies.map(c => c.company)) === JSON.stringify(b.companies.map(c => c.company)));

  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
