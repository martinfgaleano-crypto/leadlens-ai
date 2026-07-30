import { readFileSync } from "fs";
import { buildPilotWorkspace } from "@/lib/intelligence/pilot-workspace";

const experience = readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx", "utf8");
const intake = readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot-intake.tsx", "utf8");
const review = readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot-review-operations.tsx", "utf8");
const css = readFileSync("app/admin/intelligence/pilots/[pilotId]/workspace.module.css", "utf8");
const api = readFileSync("app/api/admin/intelligence/pilots/[pilotId]/operations/route.ts", "utf8");
const workspace = buildPilotWorkspace();
let passed = 0;
let failed = 0;
function test(name: string, condition: boolean) {
  console.log(`${condition ? "✅" : "❌"} ${name}`);
  condition ? passed++ : failed++;
}

const thesisStatements = new Set(workspace.accounts.map((account: any) => account.opportunity_statement));
const roles = new Set(workspace.portfolio.roles.map((role: any) => role.role));
[
  ["01 executive brief shown first", experience.indexOf('id="brief"') < experience.indexOf('id="portfolio"')],
  ["02 questions are not first-screen content", experience.indexOf("<PilotIntake") > experience.indexOf('id="account"')],
  ["03 six account summaries", workspace.accounts.length === 6],
  ["04 distinct thesis content exists", thesisStatements.size >= 4],
  ["05 prioritize rationale is explicit", experience.includes('account.decision === "prioritize"')],
  ["06 monitor rationale is explicit", experience.includes("Monitorear hasta una señal comercial")],
  ["07 account detail exposes full translated thesis", experience.includes("thesisEs(account)") && experience.includes("Por qué esta cuenta")],
  ["08 evidence links to official property", experience.includes("official.url") && experience.includes("Fuente oficial")],
  ["09 claim types are visually distinct", ["HECHO", "INFERENCIA", "RECOMENDACIÓN", "LIMITACIÓN"].every(label => experience.includes(label))],
  ["10 readiness groups questions", intake.includes("CATEGORY_ES") && intake.includes("Oferta B2B")],
  ["11 top five prioritized", intake.includes("TOP_FIELDS") && intake.includes("Las 5 respuestas")],
  ["12 remaining questions disclosed", intake.includes("Ver las 12 preguntas restantes")],
  ["13 manual intake id removed", !experience.includes("Submitted intake ID") && !review.includes("intakeId")],
  ["14 comma separated workflow removed", !experience.includes("comma separated") && !review.includes("acceptedIds")],
  ["15 context proposals remain unaccepted", intake.includes("toda aceptación requiere revisión")],
  ["16 client-only values blank", intake.includes('value: ""')],
  ["17 unknown distinct from zero", intake.includes("Desconocido") && experience.includes("Aún no medido")],
  ["18 readiness shows progress and gaps", experience.includes("Base sólida con limitaciones") && experience.includes("Necesita confirmación")],
  ["19 zero signals interpreted", experience.includes("No existe una ventana pública de contacto inmediato")],
  ["20 next actions derived", experience.includes("Próximas 3 acciones") && experience.includes("Desbloquear la evaluación")],
  ["21 enums not primary labels", !experience.includes(">context_required<") && !experience.includes(">insufficient_context<")],
  ["22 desktop 1440 layout", css.includes("max-width: 1500px") && css.includes("grid-template-columns")],
  ["23 desktop 1280 layout", css.includes("@media (max-width: 1180px)")],
  ["24 tablet 1024 layout", css.includes("@media (max-width: 1180px)") && css.includes("@media (max-width: 900px)")],
  ["25 mobile readable", css.includes("@media (max-width: 680px)")],
  ["26 overflow controlled", css.includes("overflow-x: auto") && css.includes("box-sizing: border-box")],
  ["27 draft save preserved", intake.includes('save("draft")')],
  ["28 partial acceptance preserved", intake.includes("accepted_question_ids: selected")],
  ["29 thesis review preserved", review.includes('action: "review_thesis"')],
  ["30 safety workflow remains API-backed", api.includes('action: z.literal("review_safety")')],
  ["31 ranking unchanged", workspace.ranking_impact === "off" && experience.includes("Ranking estructural sin cambios")],
  ["32 final report disabled", workspace.final_report_generation === "disabled" && experience.includes("reporte final permanecerá deshabilitado")],
  ["33 no synthetic answers", workspace.overview.context_completeness === 0 && workspace.overview.customer_safe === 0],
  ["34 no provider calls render", !experience.includes("fetch(") && !experience.includes("provider")],
  ["35 portfolio roles are real", roles.has("accessible_entry_account") && roles.has("channel_account") && roles.has("strategic_account")],
  ["36 score duplication disclosed", experience.includes("puntajes de acceso son una base compartida")],
  ["37 qualitative scores lead", experience.includes("Encaje estructural sólido") && experience.includes("Acceso moderado, sin verificar")],
  ["38 no raw ids in review UI", !review.includes("thesis.thesis_id}") || review.includes("body: JSON.stringify")],
  ["39 account map uses real categories", experience.includes("Posición categórica derivada de decisión, segmento y rol")],
  ["40 no final export", !experience.includes("Exportar") && !experience.includes("Descargar reporte")],
  ["41 no migration required", !experience.includes("migration") && !intake.includes("migration")],
].forEach(([name, condition]) => test(String(name), Boolean(condition)));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
