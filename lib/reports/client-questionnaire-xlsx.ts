// ─── Client questionnaire → editable XLSX (primary client format) ────────────
// Premium, form-style workbook (NOT a horizontal database grid). Each question
// is a vertical block: header · por qué · opciones · Respuesta · Confianza ·
// Evidencia · Notas — answer cells genuinely blank (never "" or 0), obvious and
// unlocked; label cells locked. One visible sheet per thematic section, plus
// Inicio (cover), Esenciales (dashboard with links + live status), Documentos,
// Resumen (live completion formulas). Technical keys live only in a very-hidden
// _meta sheet + hidden completion columns. No macros.

import ExcelJS from "exceljs";
import {
  renderBySection, importKeyMap, essentialCount, INTRO_COPY, SECTIONS, SECTION_SHEET,
  CONFIDENCE_OPTIONS, CLIENT_QUESTIONNAIRE_SCHEMA_VERSION,
  type QuestionnaireBrand, type ClientQuestion, type RenderedQuestion, AMOR_QUESTIONS,
} from "@/lib/intelligence/client-questionnaire";

export const QUESTIONNAIRE_XLSX_VERSION = "client-questionnaire-xlsx-v2";
export const REQUIRED_SHEETS = ["Inicio", "Esenciales", "Oferta B2B", "Precios y condiciones", "Capacidad y cobertura", "Cumplimiento", "Estrategia comercial", "Prioridades", "Documentos", "Resumen"] as const;

const ANSWER_FILL = "FFFCFBF6";
const LABEL_ARGB = "FF5B6961";
const THIN = { style: "thin" as const, color: { argb: "FFD6DDD6" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function guide(q: RenderedQuestion): string {
  const parts: string[] = [];
  if (q.options.length) parts.push("Opciones: " + q.options.join(" · "));
  if (q.subfields.length) parts.push("Detalle: " + q.subfields.join(" · "));
  if (q.unitsOrExamples) parts.push(q.unitsOrExamples);
  return parts.join("\n");
}

interface BlockRef { number: number; answer: string; done: string; ess: string; sheet: string }

function addBlock(ws: ExcelJS.Worksheet, q: RenderedQuestion, accent: string): BlockRef {
  const label = (cell: ExcelJS.Cell, text: string) => {
    cell.value = text; cell.font = { size: 9, bold: true, color: { argb: LABEL_ARGB } };
    cell.alignment = { vertical: "top", horizontal: "right", wrapText: true }; cell.protection = { locked: true };
  };
  const editable = (cell: ExcelJS.Cell) => {
    cell.protection = { locked: false }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ANSWER_FILL } };
    cell.border = BORDER; cell.alignment = { vertical: "top", wrapText: true };
  };
  // header
  const h = ws.addRow([`${q.number}.  ${q.question}`]); ws.mergeCells(h.number, 1, h.number, 3);
  const hc = ws.getCell(h.number, 1);
  hc.font = { size: 11, bold: true, color: { argb: "FF122B22" } }; hc.alignment = { vertical: "middle", wrapText: true };
  hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F6F2" } }; hc.protection = { locked: true };
  hc.border = { left: { style: "thick", color: { argb: "FF" + accent } } }; h.height = 30;
  // priority + why
  const w = ws.addRow(["", `${q.phaseLabel} · ${q.why}`]); ws.mergeCells(w.number, 2, w.number, 3);
  const wc = ws.getCell(w.number, 2); wc.font = { size: 8.5, italic: true, color: { argb: "FF606E66" } };
  wc.alignment = { vertical: "top", wrapText: true }; wc.protection = { locked: true }; w.height = 26;
  // guide
  const g = guide(q);
  if (g) {
    const gr = ws.addRow(["Opciones / ejemplo", g]); ws.mergeCells(gr.number, 2, gr.number, 3);
    label(ws.getCell(gr.number, 1), "Opciones / ejemplo");
    const gc = ws.getCell(gr.number, 2); gc.font = { size: 8.5, color: { argb: "FF2F6550" } };
    gc.alignment = { vertical: "top", wrapText: true }; gc.protection = { locked: true }; gr.height = Math.min(60, 16 + g.length / 6);
  }
  // answer (blank)
  const a = ws.addRow(["Respuesta"]); ws.mergeCells(a.number, 2, a.number, 3);
  label(ws.getCell(a.number, 1), "Respuesta"); editable(ws.getCell(a.number, 2)); a.height = 40;
  ws.getCell(a.number, 5).value = { formula: `IF(TRIM(B${a.number})="","",1)`, result: undefined };
  if (q.phase === "essential") ws.getCell(a.number, 6).value = { formula: `IF(TRIM(B${a.number})="","",1)`, result: undefined };
  // confidence (blank + dropdown)
  const c = ws.addRow(["Confianza"]); label(ws.getCell(c.number, 1), "Confianza");
  const cc = ws.getCell(c.number, 2); editable(cc);
  cc.dataValidation = { type: "list", allowBlank: true, formulae: [`"${CONFIDENCE_OPTIONS.join(",")}"`] }; c.height = 20;
  // evidence
  const e = ws.addRow(["Evidencia"]); ws.mergeCells(e.number, 2, e.number, 3);
  label(ws.getCell(e.number, 1), "Evidencia (doc/URL)"); editable(ws.getCell(e.number, 2)); e.height = 20;
  // notes
  const n = ws.addRow(["Notas"]); ws.mergeCells(n.number, 2, n.number, 3);
  label(ws.getCell(n.number, 1), "Notas"); editable(ws.getCell(n.number, 2)); n.height = 26;
  ws.addRow([]); // spacer
  return { number: q.number, answer: `'${ws.name}'!B${a.number}`, done: `'${ws.name}'!E${a.number}`, ess: `'${ws.name}'!F${a.number}`, sheet: ws.name };
}

function newSectionSheet(wb: ExcelJS.Workbook, name: string, intro: string, accent: string): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 20 }, { width: 48 }, { width: 48 }, { width: 2 }, { width: 9 }, { width: 9 }];
  ws.getColumn(5).hidden = true; ws.getColumn(6).hidden = true;
  const t = ws.addRow([name]); ws.mergeCells(t.number, 1, t.number, 3);
  const tc = ws.getCell(t.number, 1); tc.font = { size: 15, bold: true, color: { argb: "FF122B22" } }; t.height = 24;
  const s = ws.addRow(["", intro]); ws.mergeCells(s.number, 2, s.number, 3);
  ws.getCell(s.number, 2).font = { size: 9, italic: true, color: { argb: "FF606E66" } }; ws.addRow([]);
  return ws;
}

export function buildClientQuestionnaireXlsx(input: { brand: QuestionnaireBrand; questions?: ClientQuestion[] }): Promise<Buffer> {
  const questions = input.questions ?? AMOR_QUESTIONS;
  const rendered = renderBySection(questions);
  const accent = input.brand.accentHex.replace(/^#/, "").toUpperCase().padStart(6, "0").slice(0, 6);
  const wb = new ExcelJS.Workbook();
  wb.creator = "LeadLens"; wb.company = "LeadLens"; wb.created = new Date();

  // 1) Inicio (cover)
  const inicio = wb.addWorksheet("Inicio", { views: [{ showGridLines: false }] });
  inicio.columns = [{ width: 3 }, { width: 104 }];
  const put = (text: string, o: Partial<ExcelJS.Font> = {}, h = 16) => { const r = inicio.addRow(["", text]); const c = r.getCell(2); c.value = text; c.font = { size: 11, ...o }; c.alignment = { wrapText: true, vertical: "top" }; c.protection = { locked: true }; r.height = h; };
  put(`LeadLens · ${input.brand.clientName}`, { bold: true, size: 16, color: { argb: "FF" + accent } }, 24);
  put(INTRO_COPY.title, { bold: true, size: 13 }, 22);
  put(INTRO_COPY.purpose, {}, 44); put(INTRO_COPY.time, { italic: true }, 28);
  put("Cómo responder:", { bold: true }, 20);
  for (const i of INTRO_COPY.instructions) put("•  " + i);
  put(INTRO_COPY.privacy, { color: { argb: "FF8A5A00" } }, 30);
  put("Secciones de este cuestionario:", { bold: true }, 20);
  for (const s of SECTIONS) put(`•  ${s.title} — ${s.intro}`);
  put(`Preguntas esenciales: ${essentialCount(questions)} de ${questions.length}. Complete primero las esenciales (hoja «Esenciales»).`, { bold: true }, 24);
  put("Vea su avance en la hoja «Resumen».", { italic: true, color: { argb: "FF606E66" } });
  put(`Última actualización: ${new Date().toISOString().slice(0, 10)}`, { italic: true, color: { argb: "FF606E66" } });

  // 2) placeholder for Esenciales (built after section sheets so links resolve)
  const ess = wb.addWorksheet("Esenciales", { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });

  // 3–8) One sheet per section, in thematic order
  const refs: BlockRef[] = [];
  const bySection = new Map<string, RenderedQuestion[]>();
  for (const q of rendered) { (bySection.get(q.sectionId) ?? bySection.set(q.sectionId, []).get(q.sectionId)!).push(q); }
  for (const sec of SECTIONS) {
    const sheetName = SECTION_SHEET[sec.id];
    const ws = newSectionSheet(wb, sheetName, sec.intro, accent);
    for (const q of bySection.get(sec.id) ?? []) refs.push(addBlock(ws, q, accent));
  }

  // 2b) Build Esenciales dashboard now
  ess.columns = [{ width: 6 }, { width: 64 }, { width: 22 }, { width: 16 }, { width: 16 }];
  const eh = ess.addRow(["N°", "Pregunta esencial", "Sección", "Estado", "Ir a la respuesta"]);
  eh.height = 24; eh.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + accent } }; c.alignment = { vertical: "middle" }; });
  ess.addRow(["", "Complete estas primero. El estado se actualiza al escribir la respuesta.", "", "", ""]);
  ess.addRow([]);
  const essQ = rendered.filter((q) => q.phase === "essential");
  for (const q of essQ) {
    const ref = refs.find((r) => r.number === q.number)!;
    const row = ess.addRow([q.number, q.question, q.sectionTitle, "", ""]);
    row.alignment = { wrapText: true, vertical: "top" };
    ess.getCell(row.number, 4).value = { formula: `IF(${ref.done}=1,"Respondida","Pendiente")`, result: undefined };
    ess.getCell(row.number, 5).value = { text: "Abrir", hyperlink: `#${ref.answer}` };
    ess.getCell(row.number, 5).font = { color: { argb: "FF" + accent }, underline: true };
  }

  // 9) Documentos
  const docs = wb.addWorksheet("Documentos", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  docs.columns = [{ width: 44 }, { width: 22 }, { width: 16 }, { width: 32 }, { width: 30 }];
  const dh = docs.addRow(["Documento o certificación", "Estado", "Vencimiento", "Documento o enlace", "Notas"]);
  dh.height = 22; dh.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + accent } }; });
  const estados = ["activo", "en trámite", "vencido", "no disponible", "no aplica"];
  for (const d of ["Registro sanitario / INVIMA", "Ficha técnica del producto", "Información de etiquetado", "RUT", "Cámara de comercio", "Otro documento solicitado por el cliente"]) {
    const r = docs.addRow([d]); r.height = 22; docs.getCell(r.number, 1).protection = { locked: true };
    for (const col of [2, 3, 4, 5]) { const c = docs.getCell(r.number, col); c.protection = { locked: false }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ANSWER_FILL } }; c.border = BORDER; }
    docs.getCell(r.number, 2).dataValidation = { type: "list", allowBlank: true, formulae: [`"${estados.join(",")}"`] };
  }

  // 10) Resumen (live completion formulas)
  const resumen = wb.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  resumen.columns = [{ width: 3 }, { width: 40 }, { width: 16 }];
  const sheetNames = SECTIONS.map((s) => `'${SECTION_SHEET[s.id]}'`);
  const sumCount = (col: string) => sheetNames.map((n) => `COUNT(${n}!${col}:${col})`).join("+");
  const countIf = (val: string) => sheetNames.map((n) => `COUNTIF(${n}!B:B,"${val}")`).join("+");
  const R = (label: string, formulaOrNum: string | number, bold = false, pct = false) => {
    const r = resumen.addRow(["", label, ""]);
    const lc = r.getCell(2); lc.font = { size: 11, bold }; lc.protection = { locked: true };
    const vc = r.getCell(3); vc.value = typeof formulaOrNum === "number" ? formulaOrNum : { formula: formulaOrNum, result: undefined };
    vc.font = { size: 11, bold: true, color: { argb: "FF122B22" } }; if (pct) vc.numFmt = "0%"; vc.protection = { locked: true };
  };
  const rTitle = resumen.addRow(["", "Resumen de avance", ""]); rTitle.getCell(2).font = { size: 15, bold: true, color: { argb: "FF122B22" } }; resumen.addRow([]);
  R("Preguntas totales", questions.length, true);
  R("Respondidas", sumCount("E"));
  R("Pendientes", `${questions.length}-(${sumCount("E")})`);
  R("Avance", `(${sumCount("E")})/${questions.length}`, false, true);
  R("Esenciales respondidas", sumCount("F"));
  R("Esenciales pendientes", `${essentialCount(questions)}-(${sumCount("F")})`, true);
  R("Marcadas «Por confirmar»", countIf("Por confirmar"));
  R("Marcadas «No aplica»", countIf("No aplica"));
  R("Documentos con estado", `COUNTA(Documentos!B2:B7)`);

  // _meta (very hidden) — import contract, never client-facing
  const meta = wb.addWorksheet("_meta", { state: "veryHidden" });
  meta.columns = [{ width: 24 }, { width: 40 }, { width: 8 }];
  meta.addRow(["schema_version", CLIENT_QUESTIONNAIRE_SCHEMA_VERSION]);
  meta.addRow(["client", input.brand.clientName]);
  meta.addRow(["question_key", "internal_fields", "n"]);
  for (const k of importKeyMap(questions)) meta.addRow([k.key, k.internal_fields, k.number]);

  // Sanitation: no cell may serialize as an empty string (renders as a stray
  // value in some spreadsheet apps). Convert every "" to a genuinely blank cell.
  for (const ws of wb.worksheets) ws.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: true }, (c) => { if (c.value === "") c.value = null; }));

  return wb.xlsx.writeBuffer().then((ab) => Buffer.from(ab as ArrayBuffer));
}
