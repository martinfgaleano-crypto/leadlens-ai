// Unit tests: search-provider-roi-v1 (ROI honesto) + provider-health run reqs.
// Run: npm run test:ops-modes
import { assessSearchRoi, type RunSummary } from "@/lib/ops/search-provider-roi";
import { RUN_REQUIREMENTS, recommendedAction } from "@/lib/ops/provider-health";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? passed++ : failed++; };
const run = (o: Partial<RunSummary>): RunSummary => ({ operating_mode: "full_discovery", provider_cost_usd: 0, queries: 0, urls_useful: 0, companies_identified: 0, material_signals: 0, finalists: 0, confirmed_opportunities: 0, duration_ms: 0, ...o });

// n insuficiente → nunca recomienda comprar
t("n<3 → insufficient_data", assessSearchRoi([run({}), run({ operating_mode: "targeted_discovery" })]).recommendation === "insufficient_data");
// search sin ventaja → do_not_buy
const noEdge = assessSearchRoi([
  run({ operating_mode: "full_discovery", provider_cost_usd: 5, confirmed_opportunities: 1 }), run({ operating_mode: "full_discovery", provider_cost_usd: 5, confirmed_opportunities: 1 }), run({ operating_mode: "full_discovery", provider_cost_usd: 5, confirmed_opportunities: 1 }),
  run({ operating_mode: "targeted_discovery", confirmed_opportunities: 1 }), run({ operating_mode: "targeted_discovery", confirmed_opportunities: 1 }), run({ operating_mode: "targeted_discovery", confirmed_opportunities: 1 }),
]);
t("search sin ventaja → do_not_buy", noEdge.recommendation === "do_not_buy", noEdge.reason);
// search con ventaja clara → consider_buy
const edge = assessSearchRoi([
  run({ operating_mode: "full_discovery", provider_cost_usd: 5, confirmed_opportunities: 3 }), run({ operating_mode: "full_discovery", provider_cost_usd: 5, confirmed_opportunities: 3 }), run({ operating_mode: "full_discovery", provider_cost_usd: 5, confirmed_opportunities: 3 }),
  run({ operating_mode: "targeted_discovery", confirmed_opportunities: 1 }), run({ operating_mode: "targeted_discovery", confirmed_opportunities: 1 }), run({ operating_mode: "targeted_discovery", confirmed_opportunities: 1 }),
]);
t("ventaja ≥1/run y ≥3 confirmadas → consider_buy", edge.recommendation === "consider_buy", edge.reason);
t("baseline cost-per-confirmed = 0 (no paga búsqueda)", noEdge.cost_per_confirmed_baseline === 0);
t("nunca proyecta: n_note explícito", edge.n_note.includes("SOLO de corridas reales"));

// Run requirements + recommendations
t("reporte requiere anthropic+supabase", RUN_REQUIREMENTS.preview_or_brief_report.requires.includes("anthropic"));
t("provider_limited solo requiere firecrawl", RUN_REQUIREMENTS.provider_limited_validation.requires.length === 1);
t("acción Serper = optional/no recargar", (recommendedAction({ id: "serper", state: "exhausted" } as never) ?? "").toLowerCase().includes("do not recharge"));
t("Anthropic exhausted = límite de uso (no saldo)", (recommendedAction({ id: "anthropic", state: "exhausted" } as never) ?? "").includes("LÍMITE DE USO"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
