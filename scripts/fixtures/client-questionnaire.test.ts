// Behavioral tests: professional client questionnaire (model + XLSX + PDF).
import ExcelJS from "exceljs";
import {
  renderQuestionnaire, essentialCount, importKeyMap, SECTIONS, AMOR_QUESTIONS, AMOR_QUESTIONNAIRE_BRAND,
} from "@/lib/intelligence/client-questionnaire";
import { buildClientQuestionnaireXlsx, REQUIRED_SHEETS } from "@/lib/reports/client-questionnaire-xlsx";
import { buildClientQuestionnairePdf } from "@/lib/reports/client-questionnaire-pdf";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// Internal identifiers that must NEVER appear on client-facing outputs.
const INTERNAL_TOKENS = [
  "account_size_constraints", "delivery_radius", "distribution_capability", "fulfillment_constraints",
  "sales_cycle_tolerance", "price_positioning", "product_formats", "production_capacity", "minimum_order",
  "white_label_capacity", "current_partnerships", "preferred_deal_type", "business_model", "company_stage",
  "critical_blocker", "high_leverage", "client operations", "client commercial lead", "client leadership", "methodology_version", "pilot_id",
];

// ── Model ──
const rendered = renderQuestionnaire();
t("model: 17 questions", rendered.length === 17);
t("model: essential-first ordering", rendered.slice(0, essentialCount()).every((q) => q.phase === "essential") && rendered[essentialCount()].phase !== "essential");
t("model: 9 essential questions", essentialCount() === 9);
t("model: 6 sections A–F present", new Set(rendered.map((q) => q.sectionId)).size === 6 && SECTIONS.length === 6);
t("model: select questions carry options", rendered.filter((q) => q.kind === "single_select" || q.kind === "multi_select").every((q) => q.options.length >= 2));
t("model: sensitive questions carry units/examples framing", rendered.filter((q) => q.sensitive).every((q) => q.unitsOrExamples.length > 0 || q.subfields.length > 0));
t("model: NO internal tokens in client-facing text", rendered.every((q) => {
  const blob = [q.question, q.why, q.phaseLabel, ...q.options, ...q.subfields, q.unitsOrExamples].join(" ").toLowerCase();
  return !INTERNAL_TOKENS.some((tok) => blob.includes(tok.toLowerCase()));
}));
t("model: client priority labels (not internal enums)", rendered.every((q) => ["Esencial para continuar", "Muy útil para mejorar el análisis", "Información complementaria"].includes(q.phaseLabel)));
// import contract covers all 17 internal fields via keys
const keys = importKeyMap();
const coveredFields = new Set(keys.flatMap((k) => k.internal_fields.split("|").filter(Boolean)));
t("import: keys present + cover 17 internal fields", keys.length === 17 && coveredFields.size === 17 && keys.every((k) => k.key.length > 0));

(async () => {
  // ── XLSX ──
  const xlsx = await buildClientQuestionnaireXlsx({ brand: AMOR_QUESTIONNAIRE_BRAND });
  t("xlsx: non-trivial buffer", xlsx.length > 8000);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
  const sheetNames = wb.worksheets.map((w) => w.name);
  t("xlsx: all required sheets present", REQUIRED_SHEETS.every((s) => sheetNames.includes(s)));
  const meta = wb.getWorksheet("_meta");
  t("xlsx: _meta sheet hidden + carries import keys", !!meta && meta.state === "veryHidden" && meta.getCell("A1").value === "schema_version");

  const topic = wb.getWorksheet("Oferta y precios")!;
  // header frozen
  t("xlsx: header frozen", Array.isArray(topic.views) && topic.views[0]?.state === "frozen");
  // find a data row (row 2) — answer cells editable, confidence dropdown present
  const answerCell = topic.getCell("F2"); // Respuesta
  const confCell = topic.getCell("G2");   // Confianza
  t("xlsx: answer cells editable (locked=false)", answerCell.protection?.locked === false && (answerCell.value === null || answerCell.value === undefined || answerCell.value === ""));
  t("xlsx: confidence data validation present", (confCell as unknown as { dataValidation?: { type?: string } }).dataValidation?.type === "list");
  // no internal tokens anywhere on client-facing sheets
  let leak = "";
  for (const ws of wb.worksheets) {
    if (ws.name === "_meta") continue;
    ws.eachRow((row) => row.eachCell((c) => {
      const v = String(c.value ?? "").toLowerCase();
      for (const tok of INTERNAL_TOKENS) if (v.includes(tok.toLowerCase())) leak = `${ws.name}:${tok}`;
    }));
  }
  t("xlsx: NO internal tokens on client sheets", leak === "", leak);
  // no prefilled answers on topic sheets
  let prefilled = false;
  for (const name of ["Oferta y precios", "Capacidad y cumplimiento", "Estrategia comercial"]) {
    const ws = wb.getWorksheet(name)!;
    ws.eachRow((row, i) => { if (i > 1) for (const col of [6, 8, 9]) if (String(row.getCell(col).value ?? "").trim() !== "") prefilled = true; });
  }
  t("xlsx: no prefilled answers", !prefilled);

  // ── PDF ──
  const pdf = buildClientQuestionnairePdf({ brand: AMOR_QUESTIONNAIRE_BRAND, now: new Date("2026-07-28T00:00:00Z") });
  const pdfStr = pdf.toString("latin1");
  t("pdf: valid %PDF + substantial", pdfStr.startsWith("%PDF") && pdf.length > 12000);
  const pages = (pdfStr.match(/\/Type\s*\/Page[^s]/g) || []).length;
  t("pdf: 8–12 pages", pages >= 8 && pages <= 12, `pages=${pages}`);
  t("pdf: includes intro + review copy", pdfStr.includes("Antes de comenzar") && pdfStr.includes("Revisión final"));
  t("pdf: NO internal tokens", !INTERNAL_TOKENS.some((tok) => pdfStr.includes(tok)));
  t("pdf: deterministic for same input", buildClientQuestionnairePdf({ brand: AMOR_QUESTIONNAIRE_BRAND, now: new Date("2026-07-28T00:00:00Z") }).length === pdf.length);

  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
