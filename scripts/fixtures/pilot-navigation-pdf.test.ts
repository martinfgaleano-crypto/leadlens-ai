import { readFileSync } from "fs";
import { buildPilotWorkspace } from "@/lib/intelligence/pilot-workspace";
import { ACCOUNT_UNIVERSE, ICP, PILOT_SECTIONS, recommendations } from "@/lib/intelligence/pilot-intelligence";
import { buildInternalPilotPdf } from "@/lib/reports/internal-pilot-pdf";

const experience = readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx", "utf8");
const nested = readFileSync("app/admin/intelligence/pilots/[pilotId]/[section]/page.tsx", "utf8");
const landing = readFileSync("app/admin/intelligence/pilots/[pilotId]/page.tsx", "utf8");
const legacy = readFileSync("app/admin/pilot/page.tsx", "utf8");
const command = readFileSync("app/admin/intelligence/page.tsx", "utf8");
const admin = readFileSync("app/admin/_components/AdminLayout.tsx", "utf8");
const endpoint = readFileSync("app/api/admin/intelligence/pilots/[pilotId]/pdf/route.ts", "utf8");
const pdfSource = readFileSync("lib/reports/internal-pilot-pdf.ts", "utf8");
const workspace = buildPilotWorkspace();
const recs = recommendations(workspace);
const pdf = buildInternalPilotPdf(workspace, new Date("2026-07-30T12:00:00Z"));
let passed = 0, failed = 0;
const test = (name: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${name}`); ok ? passed++ : failed++; };

[
  ["01 canonical hierarchy visible", admin.includes("Piloto · Amor de Gea") && experience.includes("Volver al Command Center")],
  ["02 breadcrumbs complete", ["Admin", "Intelligence", "Pilotos", "Amor de Gea"].every(x => experience.includes(x))],
  ["03 active tab strong", experience.includes("aria-current") && experience.includes("activeTab")],
  ["04 canonical defaults Resumen", landing.includes('activeSection="overview"')],
  ["05 URL-backed tabs", nested.includes("isPilotSection") && PILOT_SECTIONS.length === 7],
  ["06 direct routes supported", experience.includes("/icp") && experience.includes("/accounts")],
  ["07 legacy redirects", legacy.includes('redirect("/admin/intelligence/pilots/amor-de-gea")')],
  ["08 no legacy blank state", !legacy.includes("Loading") && !legacy.includes("return null")],
  ["09 Command Center opens pilot", command.includes("Abrir piloto") && command.includes("/admin/intelligence/pilots/amor-de-gea")],
  ["10 pilot returns Command Center", experience.includes("Volver al Command Center")],
  ["11 ICP visible", experience.includes("Qué está buscando LeadLens") && !!ICP.summary],
  ["12 ICP dimensions", ICP.dimensions.length === 10 && experience.includes("ICP.dimensions")],
  ["13 provenance", experience.includes("Cómo se derivó") && ICP.provenance.facts.length > 0],
  ["14 unknowns", experience.includes("PREGUNTA ABIERTA") && ICP.provenance.questions.length > 0],
  ["15 universe funnel", experience.includes("Universo analizado") && ACCOUNT_UNIVERSE.raw === 252],
  ["16 controlled shortlist", ACCOUNT_UNIVERSE.controlled === 6 && experience.includes("muestra controlada")],
  ["17 recommendations visible", experience.includes("Cuentas recomendadas")],
  ["18 individual rationale", recs.every(rec => rec.rationale.length > 40)],
  ["19 deterministic order", recommendations(workspace).map(x => x.account.account_id).join() === recs.map(x => x.account.account_id).join()],
  ["20 not timing-only", pdfSource.includes("encaje") && pdfSource.includes("claridad del caso") || experience.includes("valor de aprendizaje")],
  ["21 monitor distinguished", recs.filter(x => x.state === "monitor_until_trigger").length === 2],
  ["22 PDF button visible", experience.includes("Descargar informe interno en PDF")],
  ["23 PDF labeled internal", experience.includes("PDF interno")],
  ["24 final report disabled", experience.includes("Generar reporte final") && experience.includes("disabled")],
  ["25 endpoint Admin-only", endpoint.includes("requireAdmin(req)")],
  ["26 non-Admin rejected by gate", endpoint.includes("if (denied) return denied")],
  ["27 forged pilot rejected", endpoint.includes("Piloto no encontrado") && endpoint.includes("status: 404")],
  ["28 internal notice", pdfSource.includes("INTERNO - REVISION LEADLENS") && pdfSource.includes("REVISION INTERNA")],
  ["29 PDF contains ICP", pdfSource.includes("Contexto de oportunidad") && pdfSource.includes("Donde puede encajar")],
  ["30 PDF contains accounts", pdfSource.includes("Portafolio recomendado")],
  ["31 PDF contains six profiles", pdfSource.includes("accounts.forEach") && pdfSource.includes("Cuenta ${index + 1} / 6")],
  ["32 evidence references", pdfSource.includes("official_properties")],
  ["33 limitations", pdfSource.includes("Metodologia y limites") && pdfSource.includes("Limitaciones del piloto")],
  ["34 no raw enums in PDF", !pdfSource.includes("recommended_for_validation")],
  ["35 no secrets", !pdfSource.includes("SUPABASE_SERVICE_ROLE_KEY")],
  ["36 stable filename", endpoint.includes("leadlens-amor-de-gea-informe-interno-${date}.pdf")],
  ["37 export logged", endpoint.includes("internal_pilot_pdf_exported")],
  ["38 no provider calls", !pdfSource.includes("fetch(") && !endpoint.includes("provider")],
  ["39 no synthetic answers", workspace.overview.context_completeness === 0],
  ["40 ranking unchanged", workspace.ranking_impact === "off"],
  ["41 valid PDF bytes", pdf.length > 10_000 && pdf.subarray(0, 4).toString() === "%PDF"],
  ["42 six recommendations", recs.length === 6],
  ["43 methodology versioned", recs.every(x => x.methodology_version === "amor-recommendation-contract-v1")],
  ["44 final lock intact", workspace.final_report_generation === "disabled"],
  ["45 no migration dependency", !endpoint.includes("migration")],
  ["46 private cache", endpoint.includes('"Cache-Control": "private, no-store"')],
  ["47 internal response status", endpoint.includes("internal-not-customer-safe")],
].forEach(([name, ok]) => test(String(name), Boolean(ok)));
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
