import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromAmorPilot } from "@/lib/deliverable/adapters";
import { orderByAttention } from "@/lib/deliverable/deliverable-view-model";
import { toClientCanvasVM } from "@/lib/deliverable/client-canvas-vm";
import { renderPortableHtml } from "@/lib/deliverable/portable/render-portable";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => boolean) {
  try { assert.equal(fn(), true); passed += 1; console.log(`✅ ${name}`); }
  catch { failed += 1; console.error(`❌ ${name}`); }
}

const raw = JSON.parse(readFileSync("output/amor-pilot1-deliverable.data.json", "utf8"));
const vm = fromAmorPilot(raw);
const html = renderPortableHtml(vm);
const workspace = readFileSync("components/deliverable/OpportunityWorkspace.tsx", "utf8");
const landing = readFileSync("app/demo-pipeline/page.tsx", "utf8");

const mixed = [
  { decision: "validate" as const, rank: 1, name: "legacy-first" },
  { decision: "hold" as const, rank: 1, name: "hold" },
  { decision: "prioritize" as const, rank: 9, name: "priority-late" },
  { decision: "monitor" as const, rank: 1, name: "monitor" },
  { decision: "prioritize" as const, rank: 2, name: "priority-early" },
];
const ordered = orderByAttention(mixed);

test("1 decision state always precedes legacy rank", () => ordered.map((x) => x.decision).join(",") === "prioritize,prioritize,validate,monitor,hold");
test("2 explicit rank only breaks ties inside one decision", () => ordered[0].name === "priority-early" && ordered[1].name === "priority-late");
test("3 Amor Canvas uses canonical attention ordering", () => toClientCanvasVM(vm).landscape.slice(0, 3).every((x) => x.decision === "prioritize"));
test("4 Amor objective comes from success.objective", () => toClientCanvasVM(vm).objective === raw.success.objective);
test("5 product description is separated from objective", () => vm.commercialContext?.clientDescription === raw.readiness.strengths[0] && vm.commercialContext?.objective !== vm.commercialContext?.clientDescription);
test("6 legacy Amor facts are classified static context", () => vm.accounts.every((a) => a.whatChanged.every((c) => c.kind === "static_context")));
test("7 static facts are not rendered as Qué cambió", () => html.includes("Evidencia actual") && !html.includes('<p class="pt-label pt-label-accent">Qué cambió</p>'));
test("8 single-source Amor cases never claim corroboration", () => vm.accounts.every((a) => a.sources.length <= 1 && a.evidence.corroborated !== true) && vm.coverage?.corroborated === 0);
test("9 canonical portable tabs are in canonical order", () => /Resumen[\s\S]*Casos de oportunidad[\s\S]*Evidencia[\s\S]*Comparar[\s\S]*Inteligencia del portafolio/.test(html));
test("10 Methodology is a secondary utility", () => !/data-tab="method"/.test(html) && html.includes("Cómo leer este portafolio"));
test("11 Downloads are secondary utilities", () => !/data-tab="downloads"/.test(html) && html.lastIndexOf('<div class="pt-utils">') > html.indexOf("</main>"));
test("12 Portfolio Intelligence V0 admits absent patterns", () => html.includes("Todavía no se establecieron patrones transversales"));
test("13 no synthetic pattern leaks into Amor", () => !toClientCanvasVM(vm).patterns.length);
test("14 mixed-language generated summary is gone", () => !html.includes("Focus sharpened to") && html.includes("El enfoque se precisó en"));
test("15 Spanish system strengths are localized", () => !/>Strong<|>Moderate<|>Limited</.test(html));
test("16 portable tabs have keyboard semantics", () => html.includes('role="tab"') && html.includes('e.key===\"ArrowRight\"'));
test("17 workspace CSS uses deterministic style insertion", () => /style dangerouslySetInnerHTML/.test(workspace) && !/<style>\{CSS\}<\/style>/.test(workspace));
test("18 landing CSS uses deterministic style insertion", () => /style dangerouslySetInnerHTML/.test(landing));
test("19 suppressHydrationWarning is not used", () => !workspace.includes("suppressHydrationWarning") && !landing.includes("suppressHydrationWarning"));
test("20 client Canvas architecture remains client-first", () => html.includes('class="pt-client">Amor de Gea<') && vm.accounts.length === 10);
test("21 workspace renders one secondary utility area", () => (workspace.match(/<UtilityBar vm=/g) ?? []).length === 1);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
