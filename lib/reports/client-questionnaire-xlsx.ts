// ─── Client questionnaire → editable XLSX (primary client format) ────────────
// Premium, reusable workbook. Sheets: Inicio (intro/instructions), Esenciales
// (index of must-answer), three topic sheets with editable answer cells + a
// Confianza dropdown, Documentos checklist, Resumen, and a very-hidden _meta
// sheet holding the import keys (never shown to the client). No internal field
// names / roles / IDs appear on client sheets. Answer cells are blank. No macros.

import ExcelJS from "exceljs";
import {
  renderQuestionnaire, importKeyMap, essentialCount, INTRO_COPY, SECTIONS,
  CONFIDENCE_OPTIONS, CLIENT_QUESTIONNAIRE_SCHEMA_VERSION,
  type QuestionnaireBrand, type ClientQuestion, type RenderedQuestion, AMOR_QUESTIONS,
} from "@/lib/intelligence/client-questionnaire";

export const QUESTIONNAIRE_XLSX_VERSION = "client-questionnaire-xlsx-v1";
export const REQUIRED_SHEETS = ["Inicio", "Esenciales", "Oferta y precios", "Capacidad y cumplimiento", "Estrategia comercial", "Documentos", "Resumen"] as const;

const HEADER = ["N°", "Prioridad", "Pregunta", "Por qué lo pedimos", "Opciones / ejemplo", "Respuesta", "Confianza", "Evidencia (documento o URL)", "Notas"];
const TOPIC_OF_SECTION: Record<string, string> = { A: "Oferta y precios", B: "Oferta y precios", C: "Capacidad y cumplimiento", D: "Capacidad y cumplimiento", E: "Estrategia comercial", F: "Estrategia comercial" };
const ANSWER_COLS = new Set([6, 7, 8, 9]); // Respuesta, Confianza, Evidencia, Notas

function guideText(q: RenderedQuestion): string {
  const parts: string[] = [];
  if (q.options.length) parts.push("Opciones: " + q.options.join(" · "));
  if (q.subfields.length) parts.push("Detallar: " + q.subfields.join(" · "));
  if (q.unitsOrExamples) parts.push(q.unitsOrExamples);
  if (q.sensitive) parts.push("Puede responder un rango o marcar «Confidencial — revisar verbalmente».");
  return parts.join("\n");
}

function styleHeaderRow(ws: ExcelJS.Worksheet, accentHex: string) {
  const row = ws.getRow(1);
  row.height = 26;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + accentHex } };
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function addQuestionSheet(wb: ExcelJS.Workbook, name: string, rows: RenderedQuestion[], accentHex: string) {
  const ws = wb.addWorksheet(name, { properties: { defaultRowHeight: 18 } });
  ws.columns = [
    { width: 5 }, { width: 16 }, { width: 46 }, { width: 34 }, { width: 40 },
    { width: 34 }, { width: 16 }, { width: 28 }, { width: 26 },
  ];
  ws.addRow(HEADER);
  styleHeaderRow(ws, accentHex);
  // essential first within the sheet
  const ordered = [...rows].sort((a, b) => (a.phase === "essential" ? 0 : 1) - (b.phase === "essential" ? 0 : 1) || a.number - b.number);
  for (const q of ordered) {
    const r = ws.addRow([q.number, q.phaseLabel, q.question, q.why, guideText(q), "", "", "", ""]);
    r.alignment = { vertical: "top", wrapText: true };
    r.eachCell({ includeEmpty: true }, (c, col) => {
      c.protection = { locked: !ANSWER_COLS.has(col) };
      if (!ANSWER_COLS.has(col)) c.font = { size: 10.5, color: { argb: "FF1C2722" } };
      if (ANSWER_COLS.has(col)) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFDF6" } };
    });
    if (q.phase === "essential") r.getCell(2).font = { bold: true, color: { argb: "FF" + accentHex } };
    // Confianza dropdown (short list → valid Excel data validation)
    r.getCell(7).dataValidation = { type: "list", allowBlank: true, formulae: [`"${CONFIDENCE_OPTIONS.join(",")}"`] };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADER.length } };
  return ws;
}

export function buildClientQuestionnaireXlsx(input: { brand: QuestionnaireBrand; questions?: ClientQuestion[] }): Promise<Buffer> {
  const questions = input.questions ?? AMOR_QUESTIONS;
  const rendered = renderQuestionnaire(questions);
  const accent = input.brand.accentHex.replace(/^#/, "").toUpperCase().padStart(6, "0").slice(0, 6);
  const wb = new ExcelJS.Workbook();
  wb.creator = "LeadLens"; wb.company = "LeadLens"; wb.created = new Date();

  // 1) Inicio
  const inicio = wb.addWorksheet("Inicio");
  inicio.columns = [{ width: 3 }, { width: 100 }];
  const put = (text: string, opts: Partial<ExcelJS.Font> = {}, height = 18) => {
    const r = inicio.addRow(["", text]); r.getCell(2).font = { size: 11, ...opts }; r.getCell(2).alignment = { wrapText: true, vertical: "top" }; r.height = height; return r;
  };
  put(`LeadLens · ${input.brand.clientName}`, { bold: true, size: 16, color: { argb: "FF" + accent } }, 24);
  put(INTRO_COPY.title, { bold: true, size: 13 }, 22);
  put(INTRO_COPY.purpose, {}, 46); put(INTRO_COPY.time, { italic: true }, 30);
  put("Cómo responder:", { bold: true }, 20);
  for (const i of INTRO_COPY.instructions) put("•  " + i);
  put(INTRO_COPY.privacy, { color: { argb: "FF8A5A00" } }, 30);
  put("Secciones:", { bold: true }, 20);
  for (const s of SECTIONS) put(`${s.id}. ${s.title} — ${s.intro}`);
  put(`Preguntas esenciales: ${essentialCount(questions)} de ${questions.length}. Complete primero las esenciales.`, { bold: true }, 22);
  put(`Última actualización: ${new Date().toISOString().slice(0, 10)}`, { italic: true, color: { argb: "FF5B6961" } });

  // 2) Esenciales — index of must-answer questions (answered in their topic sheet)
  const ess = wb.addWorksheet("Esenciales");
  ess.columns = [{ width: 5 }, { width: 60 }, { width: 26 }, { width: 20 }];
  ess.addRow(["N°", "Pregunta esencial", "Sección", "Responder en la hoja"]);
  styleHeaderRow(ess, accent);
  for (const q of rendered.filter((x) => x.phase === "essential")) {
    ess.addRow([q.number, q.question, `${q.sectionId}. ${q.sectionTitle}`, TOPIC_OF_SECTION[q.sectionId]]).alignment = { wrapText: true, vertical: "top" };
  }

  // 3-5) Topic sheets
  for (const topic of ["Oferta y precios", "Capacidad y cumplimiento", "Estrategia comercial"]) {
    addQuestionSheet(wb, topic, rendered.filter((q) => TOPIC_OF_SECTION[q.sectionId] === topic), accent);
  }

  // 6) Documentos checklist
  const docs = wb.addWorksheet("Documentos");
  docs.columns = [{ width: 44 }, { width: 22 }, { width: 16 }, { width: 30 }, { width: 30 }];
  docs.addRow(["Documento o certificación", "Estado", "Vencimiento", "Documento o enlace", "Notas"]);
  styleHeaderRow(docs, accent);
  const docExamples = ["Registro sanitario / INVIMA", "Ficha técnica del producto", "Información de etiquetado", "RUT", "Cámara de comercio", "Otro documento solicitado por el cliente"];
  const estados = ["activo", "en trámite", "vencido", "no disponible", "no aplica"];
  for (const d of docExamples) {
    const r = docs.addRow([d, "", "", "", ""]);
    r.getCell(1).protection = { locked: true };
    for (const col of [2, 3, 4, 5]) { r.getCell(col).protection = { locked: false }; r.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFDF6" } }; }
    r.getCell(2).dataValidation = { type: "list", allowBlank: true, formulae: [`"${estados.join(",")}"`] };
  }

  // 7) Resumen para LeadLens
  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [{ width: 3 }, { width: 60 }];
  const rput = (t: string, b = false) => { const r = resumen.addRow(["", t]); r.getCell(2).font = { size: 11, bold: b }; r.getCell(2).alignment = { wrapText: true }; };
  rput("Resumen para LeadLens", true);
  rput(`Preguntas totales: ${questions.length}`);
  rput(`Preguntas esenciales: ${essentialCount(questions)}`);
  rput("Marque «Por confirmar» en Confianza para lo que quede pendiente.");
  rput("Adjunte o enlace documentos en la hoja «Documentos».");
  rput("Las respuestas quedan sujetas a revisión de LeadLens antes de recalcular el análisis.");

  // 8) _meta (very hidden) — import contract, never client-facing
  const meta = wb.addWorksheet("_meta", { state: "veryHidden" });
  meta.columns = [{ width: 24 }, { width: 40 }, { width: 8 }];
  meta.addRow(["schema_version", CLIENT_QUESTIONNAIRE_SCHEMA_VERSION, ""]);
  meta.addRow(["client", input.brand.clientName, ""]);
  meta.addRow(["question_key", "internal_fields", "n"]);
  for (const k of importKeyMap(questions)) meta.addRow([k.key, k.internal_fields, k.number]);

  return wb.xlsx.writeBuffer().then((ab) => Buffer.from(ab as ArrayBuffer));
}
