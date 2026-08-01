// ─── Client questionnaire → polished print/read PDF (client-facing) ──────────
// LeadLens visual system. Thematic section order (A→F). Checkboxes are drawn
// vector rectangles (never Unicode glyphs). Cover, intro, questions with real
// writing space, documents checklist, responder + comments page, final review.
// Footer carries page numbers. No internal field names / roles / IDs.

import { jsPDF } from "jspdf";
import {
  renderBySection, essentialCount, INTRO_COPY, SECTIONS,
  type QuestionnaireBrand, type ClientQuestion, type RenderedQuestion, AMOR_QUESTIONS,
} from "@/lib/intelligence/client-questionnaire";

export const QUESTIONNAIRE_PDF_VERSION = "client-questionnaire-pdf-v2";

const GREEN: [number, number, number] = [18, 43, 34];
const SAGE: [number, number, number] = [47, 101, 80];
const CREAM: [number, number, number] = [248, 245, 237];
const INK: [number, number, number] = [28, 39, 34];
const MUTED: [number, number, number] = [96, 110, 102];
const LINE: [number, number, number] = [210, 218, 210];
const WHITE: [number, number, number] = [255, 255, 255];
const PAGE_W = 595.28, PAGE_H = 841.89, M = 54, CONTENT_W = PAGE_W - M * 2, BOTTOM = PAGE_H - 56;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "").padStart(6, "0");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function buildClientQuestionnairePdf(input: { brand: QuestionnaireBrand; questions?: ClientQuestion[]; now?: Date }): Buffer {
  const questions = input.questions ?? AMOR_QUESTIONS;
  const rendered = renderBySection(questions);
  const accent = hexToRgb(input.brand.accentHex);
  const now = input.now ?? new Date();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = M;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const newPage = () => { doc.addPage(); y = M; };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };
  const para = (text: string, size: number, color: [number, number, number], style: "normal" | "bold" | "italic" = "normal", lh = 1.32, indent = 0) => {
    doc.setFont("helvetica", style).setFontSize(size); setText(color);
    for (const ln of doc.splitTextToSize(text, CONTENT_W - indent)) { ensure(size * lh); doc.text(ln, M + indent, y); y += size * lh; }
  };
  const checkbox = (x: number, cy: number, label: string) => {
    setDraw(MUTED); doc.setLineWidth(0.7); doc.rect(x, cy - 7.5, 8.5, 8.5);
    setText(INK); doc.setFont("helvetica", "normal").setFontSize(8.5); doc.text(label, x + 13, cy);
    return x + 13 + doc.getTextWidth(label) + 16;
  };

  // ── Cover ──
  setFill(GREEN); doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  setFill(accent); doc.rect(M, 252, 46, 3, "F");
  setText(WHITE); doc.setFont("helvetica", "bold").setFontSize(12); doc.text("LeadLens", M, 118);
  setText(accent); doc.setFont("helvetica", "bold").setFontSize(10.5); doc.text(input.brand.clientName.toUpperCase(), M, 136);
  // title — advance y per line (no overlap)
  setText(WHITE); doc.setFont("helvetica", "bold").setFontSize(30);
  let ty = 200; for (const ln of doc.splitTextToSize(INTRO_COPY.title, CONTENT_W)) { doc.text(ln, M, ty); ty += 34; }
  setText([206, 220, 210]); doc.setFont("helvetica", "normal").setFontSize(11);
  let py = 270; for (const ln of doc.splitTextToSize(INTRO_COPY.purpose, CONTENT_W)) { doc.text(ln, M, py); py += 15.5; }
  py += 10; doc.setFont("helvetica", "italic").setFontSize(10); doc.text(INTRO_COPY.time.replace(/^Tiempo estimado: /, ""), M, py);
  setText([176, 196, 184]); doc.setFont("helvetica", "normal").setFontSize(9.5);
  doc.text(`${essentialCount(questions)} preguntas esenciales · ${questions.length} en total`, M, PAGE_H - 96);
  doc.text(`Actualizado: ${now.toISOString().slice(0, 10)}`, M, PAGE_H - 80);
  newPage();

  // ── Introduction / instructions ──
  para("Antes de comenzar", 16, GREEN, "bold"); y += 6;
  para("Cómo responder", 11, accent, "bold"); y += 2;
  for (const i of INTRO_COPY.instructions) para("•  " + i, 10, INK, "normal", 1.3, 6);
  y += 8; para("Confidencialidad", 11, accent, "bold"); y += 2;
  para(INTRO_COPY.privacy, 10, INK, "normal", 1.3, 6);
  y += 10; para("Prioridad de las preguntas", 11, accent, "bold"); y += 2;
  para("Esencial para continuar · Muy útil para mejorar el análisis · Información complementaria. Puede devolvernos el documento con solo las esenciales completas.", 9.5, MUTED, "italic", 1.3, 6);

  // ── Questions by section ──
  let currentSection = "";
  for (const q of rendered) {
    if (q.sectionId !== currentSection) {
      currentSection = q.sectionId;
      const sec = SECTIONS.find((s) => s.id === q.sectionId)!;
      ensure(52); y += 16;
      setFill(CREAM); doc.roundedRect(M, y - 13, CONTENT_W, 36, 4, 4, "F");
      setFill(accent); doc.rect(M, y - 13, 4, 36, "F");
      setText(GREEN); doc.setFont("helvetica", "bold").setFontSize(13); doc.text(`${sec.title}`, M + 15, y + 3);
      setText(MUTED); doc.setFont("helvetica", "normal").setFontSize(8.5); doc.text(sec.intro, M + 15, y + 16, { maxWidth: CONTENT_W - 30 });
      y += 40;
    }
    const boxH = q.kind === "structured" ? 66 : q.kind === "multi_select" || q.kind === "text" ? 52 : 40;
    ensure(boxH + 78);
    // priority label (drawn, no glyph)
    setText(q.phase === "essential" ? accent : MUTED); doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text(q.phaseLabel.toUpperCase(), M, y); y += 12;
    para(`${q.number}. ${q.question}`, 11.5, INK, "bold", 1.25);
    para(q.why, 8.5, MUTED, "italic", 1.25, 6);
    if (q.options.length) para("Opciones: " + q.options.join("  ·  "), 8.5, SAGE, "normal", 1.25, 6);
    if (q.subfields.length) para("Detalle: " + q.subfields.join("  ·  "), 8.5, SAGE, "normal", 1.25, 6);
    if (q.unitsOrExamples) para(q.unitsOrExamples, 8.5, MUTED, "italic", 1.25, 6);
    y += 3;
    ensure(boxH); setDraw(LINE); setFill([252, 251, 246]); doc.roundedRect(M, y, CONTENT_W, boxH, 3, 3, "FD");
    setText([170, 180, 172]); doc.setFontSize(7).setFont("helvetica", "normal"); doc.text("Respuesta", M + 7, y + 12);
    y += boxH + 10;
    ensure(14); let cx = M; cx = checkbox(cx, y, "Confirmado"); cx = checkbox(cx, y, "Estimado"); cx = checkbox(cx, y, "Por confirmar"); checkbox(cx, y, "No aplica");
    y += 13; setText(MUTED); doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text("Evidencia (documento o URL):", M, y); setDraw(LINE); doc.setLineWidth(0.5); doc.line(M + 130, y + 2, M + CONTENT_W, y + 2);
    y += 12;
  }

  // ── Documents checklist ──
  newPage(); para("Documentos de soporte", 16, GREEN, "bold"); y += 4;
  para("Marque el estado de cada documento y adjunte o enlace cuando esté disponible. Los ejemplos son frecuentes en ventas B2B; no todos son obligatorios.", 9, MUTED, "normal", 1.3); y += 8;
  for (const d of ["Registro sanitario / INVIMA", "Ficha técnica del producto", "Información de etiquetado", "RUT", "Cámara de comercio", "Otro documento solicitado por el cliente"]) {
    ensure(34); setText(INK); doc.setFont("helvetica", "bold").setFontSize(10); doc.text(d, M, y); y += 14;
    let cx = M + 6; setText(MUTED); doc.setFont("helvetica", "normal").setFontSize(8);
    cx = checkbox(cx, y, "activo"); cx = checkbox(cx, y, "en trámite"); cx = checkbox(cx, y, "vencido"); cx = checkbox(cx, y, "no disponible"); checkbox(cx, y, "no aplica");
    y += 12; doc.text("Documento o enlace:", M + 6, y); setDraw(LINE); doc.line(M + 110, y + 2, M + CONTENT_W, y + 2); y += 16;
  }

  // ── Responder details + comments ──
  newPage(); para("Datos de quien responde", 16, GREEN, "bold"); y += 8;
  const field = (label: string) => { ensure(30); setText(INK); doc.setFont("helvetica", "bold").setFontSize(9.5); doc.text(label, M, y); setDraw(LINE); doc.setLineWidth(0.5); doc.line(M + 150, y + 2, M + CONTENT_W, y + 2); y += 24; };
  field("Nombre"); field("Cargo"); field("Correo"); field("Fecha de diligenciamiento");
  y += 10; para("Comentarios generales", 11, accent, "bold"); y += 6;
  setDraw(LINE); setFill([252, 251, 246]); doc.roundedRect(M, y, CONTENT_W, 250, 3, 3, "FD"); y += 264;
  para("Documentos adjuntos (lista o enlaces)", 11, accent, "bold"); y += 6;
  setDraw(LINE); setFill([252, 251, 246]); doc.roundedRect(M, y, CONTENT_W, 120, 3, 3, "FD"); y += 130;

  // ── Final review ──
  newPage(); para("Revisión final y próximos pasos", 16, GREEN, "bold"); y += 8;
  para("Antes de enviar, confirme:", 10, INK, "bold"); y += 4;
  for (const c of ["Completé las preguntas esenciales (o marqué «Por confirmar»).", "Indiqué mi nivel de confianza en cada respuesta.", "Adjunté o referencié los documentos disponibles.", "No incluí contraseñas, datos bancarios ni información confidencial ajena al piloto."]) {
    ensure(18); checkbox(M, y, c); y += 17;
  }
  y += 12; para("Cómo devolverlo", 11, accent, "bold"); y += 4;
  para("Envíe este documento (o el archivo .xlsx) al contacto de LeadLens que le compartió el cuestionario. Las respuestas se revisan antes de usarse; no se aplican automáticamente.", 9.5, MUTED, "normal", 1.35, 6);

  // ── Footer pass (page numbers) ──
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i); setText(MUTED); doc.setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(`LeadLens · ${input.brand.clientName} · Cuestionario de contexto comercial`, M, PAGE_H - 30);
    doc.text(`Interno · Confidencial   ·   Página ${i} de ${total}`, PAGE_W - M, PAGE_H - 30, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
}
