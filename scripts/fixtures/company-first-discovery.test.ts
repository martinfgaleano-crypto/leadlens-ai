// Unit tests for the company-first discovery deterministic core:
// needs-map fallback shape + Opportunity Test fail-closed behavior.
// Run: npm run test:company-first

import { opportunityTest, type OpportunityInput } from "@/lib/discovery/opportunity-test";
import { buildNeedsMap } from "@/lib/discovery/needs-map";
import type { ICP, LeadSearchCriteria } from "@/types";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };
const daysIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

const good: OpportunityInput = {
  company: "Coordinadora", company_from_universe: true,
  signal_summary: "Coordinadora inauguró un nuevo centro de distribución en Bogotá",
  signal_type: "new_facility", signal_date: daysIso(20), date_confidence: "high",
  source_url: "https://www.coordinadora.com/sala-prensa/nuevo-cedi", source_type: "company_website",
  company_in_content: true, grounded: true, matches_needs_family: true, geography_confirmed: true, region_required: true,
};

// Happy path
t("empresa correcta + evento reciente + relación → opportunity", opportunityTest(good).status === "opportunity");

// Hard blockers → reject
t("publisher/place como empresa → reject", opportunityTest({ ...good, company: "Colombia" }).status === "reject");
t("señal no asociada a la empresa → reject", opportunityTest({ ...good, company_in_content: false }).status === "reject");
t("sin fuente → reject", opportunityTest({ ...good, source_url: null }).status === "reject");
t("sin evento → reject", opportunityTest({ ...good, signal_summary: null }).status === "reject");
t("claim no fundado → reject", opportunityTest({ ...good, grounded: false }).status === "reject");
t("sin fecha válida → reject", opportunityTest({ ...good, signal_date: null, date_confidence: "none" }).status === "reject");
t("señal > 180 días → reject", opportunityTest({ ...good, signal_date: daysIso(200) }).status === "reject");
t("sin relación comercial → reject", opportunityTest({ ...good, matches_needs_family: false }).status === "reject");
t("reject nombra hard blockers", opportunityTest({ ...good, company: "Bogotá" }).hard_blockers.length > 0);

// Soft flags → monitor / investigate (never opportunity)
t("señal 100 días → monitor (no opportunity)", opportunityTest({ ...good, signal_date: daysIso(100) }).status === "monitor");
t("fecha baja confianza → monitor", opportunityTest({ ...good, date_confidence: "low" }).status === "monitor");
t("empresa fuera del universo → investigate", opportunityTest({ ...good, company_from_universe: false }).status === "investigate");

// LLM never rescues a hard blocker (pure function: identity always re-checked)
t("nombre de medio con fecha perfecta → sigue reject", opportunityTest({ ...good, company: "Revista Turbo" }).status === "reject");

// New hard gates (page-type, materiality, homonym/geography)
t("página de referencia (wikipedia) → reject", opportunityTest({ ...good, source_url: "https://es.wikipedia.org/wiki/Coordinadora" }).status === "reject");
t("sin verbo de evento (solo nombre) → reject", opportunityTest({ ...good, matches_needs_family: false }).status === "reject");
t("homónimo extranjero (geo no confirmada) → reject", opportunityTest({ ...good, geography_confirmed: false }).status === "reject");
t("geo no requerida (EN) ignora el check", opportunityTest({ ...good, geography_confirmed: false, region_required: false }).status === "opportunity");

// Needs map fallback shape (no LLM)
(async () => {
  const icp: ICP = { target_industries: ["logística"], target_titles: [], company_size_range: "50-500", pain_points: [], disqualifiers: ["entidades públicas"], ideal_signals: ["nueva bodega", "crecimiento de flota"] };
  const criteria = { target_industries: ["logística"], target_geography: ["Colombia"], target_company_size: ["50-500"], buying_signals: ["nueva bodega", "crecimiento de flota"], disqualification_criteria: ["entidades públicas"], offer_summary: "software de flotas", value_proposition: "reduce costos", output_language: "es", target_market_region: "latin_america" } as unknown as LeadSearchCriteria;
  const orig = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const map = await buildNeedsMap(icp, criteria);
  if (orig) process.env.ANTHROPIC_API_KEY = orig;
  t("needs map: versión presente", map.version === "needs-map-v1");
  t("needs map: familias no vacías", map.relevant_signal_families.length > 0);
  t("needs map: señales observables desde ICP", map.observable_signals.includes("nueva bodega"));
  t("needs map: disqualifiers preservados", map.disqualifiers.includes("entidades públicas"));

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})();
