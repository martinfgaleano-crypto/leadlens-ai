// ─── Company-first discovery benchmark (3 Colombian ICPs) ─────────────────────
// Runs ONLY the discovery layer (needs map → company universe → per-company
// signal search → Opportunity Test) for each ICP and reports the funnel +
// quality metrics + error taxonomy. Much cheaper than a full 7-agent pilot, so
// all three ICPs can be measured economically with REAL public discovery.
// Output: ml/data/company-first/benchmark-<ts>.json
// Run: npm run bench:company-first

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
for (const f of [".env", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
import { runCompanyFirstDiscovery } from "@/lib/discovery/company-first-discovery";
import { classifyEntity } from "@/lib/vault/entity-resolution";
import type { ICP, LeadSearchCriteria } from "@/types";

const base = { target_geography: ["Colombia"], target_market_region: "latin_america" as const, output_language: "es" as const, tone: "consultative" as const, plan: "sample" as const, lead_count: 2, target_company_size: ["mediana", "grande"] };

const ICPS: { id: string; icp: ICP; criteria: LeadSearchCriteria }[] = [
  {
    id: "icp1_gestion_flotas",
    icp: { target_industries: ["transporte de carga y logística"], target_titles: [], company_size_range: "mediana-grande", pain_points: ["control de flota", "rutas ineficientes"], disqualifiers: ["entidades públicas", "medios"], ideal_signals: ["aumento de flota", "nuevas rutas", "nuevos contratos", "expansión regional", "nuevas bodegas"] },
    criteria: { ...base, target_industries: ["transporte de carga y logística"], excluded_industries: [], buying_signals: ["aumento de flota", "nuevas rutas", "nuevos contratos", "expansión regional", "nuevas bodegas", "modernización", "inversión operacional"], disqualification_criteria: ["entidades públicas", "medios", "directorios"], offer_summary: "software de gestión de flotas para transporte de carga", value_proposition: "reduce costos operativos con visibilidad de flota y optimización de rutas", target_job_titles: [] } as unknown as LeadSearchCriteria,
  },
  {
    id: "icp2_automatizacion_logistica",
    icp: { target_industries: ["operadores logísticos y retail con centros de distribución"], target_titles: [], company_size_range: "mediana-grande", pain_points: ["capacidad de bodega", "eficiencia de picking"], disqualifiers: ["entidades públicas", "medios"], ideal_signals: ["nuevo centro de distribución", "ampliación de capacidad", "automatización", "inversión en supply chain"] },
    criteria: { ...base, target_industries: ["operadores logísticos y retail con centros de distribución"], excluded_industries: [], buying_signals: ["nuevo centro de distribución", "ampliación de bodegas", "automatización", "inversión en supply chain", "crecimiento ecommerce", "nuevos centros regionales"], disqualification_criteria: ["entidades públicas", "medios", "directorios"], offer_summary: "automatización de bodegas y software logístico", value_proposition: "aumenta capacidad y eficiencia del centro de distribución", target_job_titles: [] } as unknown as LeadSearchCriteria,
  },
  {
    id: "icp3_software_b2b_operativo",
    icp: { target_industries: ["empresas de manufactura y distribución"], target_titles: [], company_size_range: "mediana-grande", pain_points: ["complejidad operativa", "integración de sistemas"], disqualifiers: ["entidades públicas", "medios"], ideal_signals: ["expansión", "nuevas plantas", "adquisiciones", "transformación digital"] },
    criteria: { ...base, target_industries: ["empresas de manufactura y distribución"], excluded_industries: [], buying_signals: ["expansión", "nuevos mercados", "nuevas plantas", "adquisiciones", "transformación tecnológica", "crecimiento operativo", "alianzas estratégicas"], disqualification_criteria: ["entidades públicas", "medios", "directorios"], offer_summary: "software de planificación, inventarios e integración de operaciones", value_proposition: "reduce complejidad operativa en empresas en expansión", target_job_titles: [] } as unknown as LeadSearchCriteria,
  },
];

async function main() {
  const results = [];
  for (const { id, icp, criteria } of ICPS) {
    console.log(`\n=== ${id} ===`);
    const { candidates, metrics, needs } = await runCompanyFirstDiscovery(icp, criteria, "brief", 6);
    // Verify NO publisher/place/public entity leaked into emitted candidates.
    const leaks = candidates.filter((c) => classifyEntity({ name: c.company }).entity_class !== "single_company").map((c) => c.company);
    const emitted = candidates.map((c) => ({ company: c.company, signal: (c.raw_context ?? "").split("\n")[0], date: c.signal_date, url: c.source_url, confidence: c.confidence_score }));
    const reviewReady = metrics.opp_status_counts.opportunity + metrics.opp_status_counts.investigate;
    console.log(JSON.stringify({
      needs_families: needs.relevant_signal_families,
      companies: metrics.companies_verified, universe_rejected: metrics.universe_rejected,
      queries: metrics.company_signal_queries, urls: metrics.urls, extractions: metrics.extractions,
      org_rejected: metrics.org_rejected, opp: metrics.opp_status_counts,
      signal_kinds: metrics.signal_kind_counts, materiality: metrics.materiality_counts,
      rubric: metrics.rubric_verdicts, homonyms_rejected: metrics.homonyms_rejected,
      emitted: metrics.emitted, leaks: leaks.length,
      dur_s: Math.round(metrics.duration_ms / 1000), est_cost: metrics.est_cost_usd,
    }, null, 1));
    for (const e of emitted) console.log("  →", e.company, "|", e.date, "|", (e.signal ?? "").slice(0, 70));
    results.push({ id, needs, metrics, emitted, leaks, review_ready: reviewReady });
  }
  mkdirSync("ml/data/company-first", { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const out = { version: "company-first-v1", ran_at: new Date().toISOString(), results };
  writeFileSync(`ml/data/company-first/benchmark-${stamp}.json`, JSON.stringify(out, null, 2));
  const totalLeaks = results.reduce((n, r) => n + r.leaks.length, 0);
  console.log(`\nTOTAL publisher/place/public leaks in output: ${totalLeaks} (target 0)`);
  console.log(`written: ml/data/company-first/benchmark-${stamp}.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
