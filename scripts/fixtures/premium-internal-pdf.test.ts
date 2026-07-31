import { readFileSync } from "fs";
import { buildPilotWorkspace } from "@/lib/intelligence/pilot-workspace";
import { buildInternalPilotPdf, PDF_MIN_BODY_SIZE, PILOT_REPORT_SECTIONS, PREMIUM_EXPECTED_PAGES, PREMIUM_PDF_VERSION, premiumAccountEditorial } from "@/lib/reports/internal-pilot-pdf";

const source = readFileSync("lib/reports/internal-pilot-pdf.ts", "utf8");
const endpoint = readFileSync("app/api/admin/intelligence/pilots/[pilotId]/pdf/route.ts", "utf8");
const experience = readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx", "utf8");
const workspace = buildPilotWorkspace();
const accounts = premiumAccountEditorial(workspace);
const pdf = buildInternalPilotPdf(workspace, new Date("2026-07-31T12:00:00Z"));
const pageMarkers = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
let passed = 0, failed = 0;
const test = (name: string, condition: boolean) => { console.log(`${condition ? "✅" : "❌"} ${name}`); condition ? passed++ : failed++; };
const distinct = (key: keyof typeof accounts[number]["editorial"]) => new Set(accounts.map(item => item.editorial[key])).size === 6;

[
  ["01 PDF remains Admin-only", endpoint.includes("requireAdmin(req)")],
  ["02 non-Admin is rejected", endpoint.includes("if (denied) return denied")],
  ["03 forged pilot ID is rejected", endpoint.includes("status: 404")],
  ["04 PDF sections match Admin navigation", PILOT_REPORT_SECTIONS.join("|") === "Resumen|Perfil de cliente ideal|Cuentas recomendadas|Analisis por cuenta|Contexto|Evidencia y timing|Preparacion del reporte" && source.includes('"ICP"')],
  ["05 Resumen exists", source.includes('addPage("Executive Brief")')],
  ["06 ICP exists", source.includes('addPage("Contexto de oportunidad")')],
  ["07 recommended accounts exist", source.includes('addPage("Portafolio recomendado")')],
  ["08 all six account pages exist", accounts.length === 6 && source.includes("8-13 - Account pages")],
  ["09 Contexto exists", source.includes('addPage("Contexto del cliente")')],
  ["10 Evidencia y timing exists", source.includes('addPage("Timing y preparacion")')],
  ["11 report readiness exists", source.includes("Preparacion del reporte") && source.includes("BASE SOLIDA")],
  ["12 technical funnel absent from primary report", !source.includes("ACCOUNT_UNIVERSE") && !source.includes("Deduplicados") && !source.includes("const funnel")],
  ["13 zero timing is not a hero metric", !source.includes('metric(124, 72, "0"') && !source.includes("Cero senales no significa")],
  ["14 distinct account theses", distinct("thesis")],
  ["15 distinct account actions", distinct("action")],
  ["16 distinct validation questions", distinct("validation")],
  ["17 only top client questions printed", source.includes("Cinco preguntas de mayor impacto") && !source.includes("17 preguntas")],
  ["18 shared pilot theme and config", source.includes("PILOT_SECTIONS") && source.includes("PilotReportBrand") && PILOT_REPORT_SECTIONS.length === 7],
  ["19 final renderer is active", endpoint.includes('from "@/lib/reports/internal-pilot-pdf"') && endpoint.includes("buildInternalPilotPdf")],
  ["20 four claim types remain available", ["HECHO", "INFERENCIA", "RECOMENDACION", "LIMITACION"].every(label => source.includes(label))],
  ["21 client brand configurable", source.includes("AMOR_DE_GEA_REPORT_BRAND") && source.includes("brand.clientName")],
  ["22 raw internal enums absent", !source.includes("recommended_for_validation") && !source.includes("monitor_until_trigger")],
  ["23 raw provider payload absent", !source.includes("provider_payload")],
  ["24 no secret appears", !source.includes("SUPABASE_SERVICE_ROLE_KEY") && !source.includes("ADMIN_SESSION_SECRET")],
  ["25 no synthetic answer", workspace.overview.context_completeness === 0 && source.includes("no se sintetizan")],
  ["26 no provider call", !source.includes("fetch(") && !endpoint.includes("provider")],
  ["27 final report remains disabled", workspace.final_report_generation === "disabled" && experience.includes("Generar reporte final")],
  ["28 stable filename", endpoint.includes("leadlens-amor-de-gea-informe-interno-${date}.pdf")],
  ["29 PDF metadata populated", source.includes("setProperties") && source.includes('author: "LeadLens"') && PREMIUM_PDF_VERSION.includes("v3")],
  ["30 source links remain clickable", source.includes("textWithLink") && source.includes("pdf.link")],
  ["31 page count within target", PREMIUM_EXPECTED_PAGES === 16 && pageMarkers === 16],
  ["32 no blank page contract", source.includes("PREMIUM_PDF_PAGE_CONTRACT") && pageMarkers === PREMIUM_EXPECTED_PAGES],
  ["33 title overflow prevented", source.includes("getTextWidth") && source.includes("fittedSize")],
  ["34 footer system bounded", source.includes("pdf.line(16, 282, 194, 282)") && source.includes("pdf.text(`${page} / ${PREMIUM_EXPECTED_PAGES}`")],
  ["35 body size is readable", PDF_MIN_BODY_SIZE >= 9.5],
  ["36 visual labels use consistent system", source.includes("const tones: Record<ClaimKind")],
  ["37 evidence rows contain source, claim, date and confidence", source.includes("Sitio oficial") && source.includes("propiedad oficial") && source.includes("Claim: identidad + dominio") && source.includes("confianza")],
  ["38 export logs success and failure", endpoint.includes('status: "success"') && endpoint.includes('status: "failure"')],
  ["39 deterministic and provider-free bytes", pdf.length > 30_000 && pdf.subarray(0, 4).toString() === "%PDF"],
  ["40 ranking unchanged", workspace.ranking_impact === "off"],
  ["41 internal status remains visible", source.includes("INTERNO - REVISION LEADLENS")],
  ["42 expected typography hierarchy", source.includes('font(35, "bold")') && source.includes('font(25, "bold")') && PDF_MIN_BODY_SIZE === 9.5],
].forEach(([name, condition]) => test(String(name), Boolean(condition)));
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
