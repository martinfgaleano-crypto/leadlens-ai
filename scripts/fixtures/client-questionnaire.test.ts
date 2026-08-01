// Behavioral tests: professional client questionnaire (model + XLSX + PDF).
import ExcelJS from "exceljs";
import {
  renderBySection, essentialCount, importKeyMap, SECTIONS, AMOR_QUESTIONS, AMOR_QUESTIONNAIRE_BRAND,
} from "@/lib/intelligence/client-questionnaire";
import { buildClientQuestionnaireXlsx, REQUIRED_SHEETS } from "@/lib/reports/client-questionnaire-xlsx";
import { buildClientQuestionnairePdf } from "@/lib/reports/client-questionnaire-pdf";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

const INTERNAL_TOKENS = [
  "account_size_constraints", "delivery_radius", "distribution_capability", "fulfillment_constraints",
  "sales_cycle_tolerance", "price_positioning", "product_formats", "production_capacity", "minimum_order",
  "white_label_capacity", "current_partnerships", "preferred_deal_type", "business_model", "company_stage",
  "customization_capacity", "certifications",
  "critical_blocker", "high_leverage", "client operations", "client commercial lead", "client leadership", "methodology_version", "pilot_id",
];

// ── Model ──
const rendered = renderBySection();
t("model: 17 questions, thematic (section A→F) order", rendered.length === 17 && rendered[0].sectionId === "A" && rendered[16].sectionId === "F");
t("model: 9 essential", essentialCount() === 9);
t("model: 6 sections", new Set(rendered.map((q) => q.sectionId)).size === 6 && SECTIONS.length === 6);
t("model: NO internal tokens in client text", rendered.every((q) => {
  const blob = [q.question, q.why, q.phaseLabel, ...q.options, ...q.subfields, q.unitsOrExamples].join(" ").toLowerCase();
  return !INTERNAL_TOKENS.some((tok) => blob.includes(tok.toLowerCase()));
}));
t("model: pilot objectives promoted (not «Información complementaria»)", rendered.find((q) => /objetivos más importantes/.test(q.question))!.phaseLabel === "Muy útil para mejorar el análisis");
t("model: minimum order has monthly/frequency/pilot guidance", (() => { const q = rendered.find((x) => /pedido mínimo/i.test(x.question))!; return /mensual/i.test(q.subfields.join(" ")) && /frecuencia/i.test(q.subfields.join(" ")) && /piloto/i.test(q.subfields.join(" ")); })());
t("model: customization vs marca blanca distinguished", (() => { const c = rendered.find((x) => /personalizar el producto/i.test(x.question))!; const w = rendered.find((x) => /marca blanca/i.test(x.question))!; return /co-branding/i.test(c.options.join(" ")) && /marca del cliente/i.test(w.why); })());
t("import: keys cover 17 internal fields", (() => { const k = importKeyMap(); return k.length === 17 && new Set(k.flatMap((x) => x.internal_fields.split("|").filter(Boolean))).size === 17; })());

(async () => {
  // ── XLSX ──
  const xlsx = await buildClientQuestionnaireXlsx({ brand: AMOR_QUESTIONNAIRE_BRAND });
  t("xlsx: non-trivial", xlsx.length > 10000);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
  const names = wb.worksheets.map((w) => w.name);
  t("xlsx: 10 required visible sheets", REQUIRED_SHEETS.every((s) => names.includes(s)));
  const meta = wb.getWorksheet("_meta");
  t("xlsx: _meta very hidden", !!meta && meta.state === "veryHidden");

  // no literal 0 anywhere on visible sheets; and no empty-string answer artifacts
  let zero = "", emptyStr = 0, unlockedBlank = 0, dropdown = false;
  for (const ws of wb.worksheets) {
    if (ws.state === "veryHidden") continue;
    ws.eachRow({ includeEmpty: true }, (row, ri) => row.eachCell({ includeEmpty: true }, (c, ci) => {
      if (c.value === 0) zero = `${ws.name}:r${ri}c${ci}`;
      if (c.value === "") emptyStr++;
      if (c.protection?.locked === false && (c.value === null || c.value === undefined)) unlockedBlank++;
      if ((c as unknown as { dataValidation?: { type?: string } }).dataValidation?.type === "list") dropdown = true;
    }));
  }
  t("xlsx: NO literal 0 on visible sheets", zero === "", zero);
  t("xlsx: NO empty-string answer cells", emptyStr === 0, `count=${emptyStr}`);
  t("xlsx: has blank unlocked answer cells", unlockedBlank >= 40);
  t("xlsx: confidence/estado dropdowns present", dropdown);

  // no internal tokens on visible sheets; no visible helper column shows values
  let leak = "";
  for (const ws of wb.worksheets) {
    if (ws.state === "veryHidden") continue;
    ws.eachRow((row) => row.eachCell((c) => { const v = String(c.value ?? "").toLowerCase(); for (const tok of INTERNAL_TOKENS) if (v.includes(tok.toLowerCase())) leak = `${ws.name}:${tok}`; }));
  }
  t("xlsx: NO internal tokens on visible sheets", leak === "", leak);
  const sec = wb.getWorksheet("Oferta B2B")!;
  t("xlsx: helper columns E/F hidden", sec.getColumn(5).hidden === true && sec.getColumn(6).hidden === true);
  // Resumen formulas + Esenciales links
  const resumen = wb.getWorksheet("Resumen")!; let hasFormula = false;
  resumen.eachRow((r) => r.eachCell((c) => { if ((c.value as { formula?: string })?.formula) hasFormula = true; }));
  t("xlsx: Resumen has live completion formulas", hasFormula);
  const es = wb.getWorksheet("Esenciales")!; let hasLink = false, hasStatusFormula = false;
  es.eachRow((r) => r.eachCell((c) => { const v = c.value as { hyperlink?: string; formula?: string }; if (v?.hyperlink) hasLink = true; if (v?.formula) hasStatusFormula = true; }));
  t("xlsx: Esenciales links to answers + live status", hasLink && hasStatusFormula);

  // ── PDF ──
  const pdf = buildClientQuestionnairePdf({ brand: AMOR_QUESTIONNAIRE_BRAND, now: new Date("2026-07-28T00:00:00Z") });
  const s = pdf.toString("latin1");
  t("pdf: valid %PDF + substantial", s.startsWith("%PDF") && pdf.length > 12000);
  const pages = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  t("pdf: 8–12 pages", pages >= 8 && pages <= 12, `pages=${pages}`);
  t("pdf: cover title emitted once", (s.match(/Cuestionario de contexto comercial/g) || []).length >= 1 && (s.match(/\(Cuestionario de contexto comercial\)/g) || []).length <= 2);
  t("pdf: no ☐/□/☑ glyphs", !/[☐☑☒□]/.test(s));
  t("pdf: includes intro + review + responder page", s.includes("Antes de comenzar") && s.includes("Revisi") && s.includes("Datos de quien responde"));
  t("pdf: final comments area present", s.includes("Comentarios generales"));
  t("pdf: NO internal tokens", !INTERNAL_TOKENS.some((tok) => s.includes(tok)));
  t("pdf: deterministic", buildClientQuestionnairePdf({ brand: AMOR_QUESTIONNAIRE_BRAND, now: new Date("2026-07-28T00:00:00Z") }).length === pdf.length);

  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
