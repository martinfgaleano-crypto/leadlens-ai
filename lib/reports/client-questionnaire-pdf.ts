// ─── Client questionnaire → polished print/read PDF (client-facing) ──────────
// Aligned with the LeadLens visual system used by the internal pilot PDF.
// Cover + introduction + section dividers + questions with writing space +
// answer options + confidence checkboxes + document checklist + final review.
// No internal field names / roles / IDs. Reusable via brand config.

import { jsPDF } from "jspdf";
import {
  renderQuestionnaire, essentialCount, INTRO_COPY, SECTIONS,
  type QuestionnaireBrand, type ClientQuestion, type RenderedQuestion, AMOR_QUESTIONS,
} from "@/lib/intelligence/client-questionnaire";

export const QUESTIONNAIRE_PDF_VERSION = "client-questionnaire-pdf-v1";

const GREEN: [number, number, number] = [18, 43, 34];
const SAGE: [number, number, number] = [47, 101, 80];
const CREAM: [number, number, number] = [248, 245, 237];
const INK: [number, number, number] = [28, 39, 34];
const MUTED: [number, number, number] = [91, 105, 97];
const LINE: [number, number, number] = [214, 221, 214];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE_W = 595.28, PAGE_H = 841.89, M = 52, CONTENT_W = PAGE_W - M * 2;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "").padStart(6, "0");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function buildClientQuestionnairePdf(input: { brand: QuestionnaireBrand; questions?: ClientQuestion[]; now?: Date }): Buffer {
  const questions = input.questions ?? AMOR_QUESTIONS;
  const rendered = renderQuestionnaire(questions);
  const accent = hexToRgb(input.brand.accentHex);
  const now = input.now ?? new Date();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = M;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const footer = () => {
    setText(MUTED); doc.setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(`LeadLens · ${input.brand.clientName} · Cuestionario de contexto — documento interno del piloto, no es compromiso comercial`, M, PAGE_H - 26);
  };
  const newPage = () => { footer(); doc.addPage(); y = M; };
  const ensure = (h: number) => { if (y + h > PAGE_H - 44) newPage(); };
  const para = (text: string, size: number, color: [number, number, number], style: "normal" | "bold" | "italic" = "normal", lh = 1.35, w = CONTENT_W) => {
    doc.setFont("helvetica", style).setFontSize(size); setText(color);
    for (const ln of doc.splitTextToSize(text, w)) { ensure(size * lh); doc.text(ln, M, y); y += size * lh; }
  };

  // ── Cover ──
  setFill(GREEN); doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  setFill(accent); doc.rect(0, 300, PAGE_W, 3, "F");
  setText(WHITE); doc.setFont("helvetica", "bold").setFontSize(13); doc.text("LeadLens", M, 130);
  setText([accent[0], accent[1], accent[2]]); doc.setFontSize(11); doc.text(input.brand.clientName.toUpperCase(), M, 150);
  setText(WHITE); doc.setFont("helvetica", "bold").setFontSize(30);
  for (const ln of doc.splitTextToSize(INTRO_COPY.title, CONTENT_W)) { doc.text(ln, M, 240); }
  setText([206, 220, 210]); doc.setFont("helvetica", "normal").setFontSize(11);
  y = 340; for (const ln of doc.splitTextToSize(INTRO_COPY.purpose, CONTENT_W)) { doc.text(ln, M, y); y += 16; }
  y += 8; doc.setFont("helvetica", "italic"); doc.text(INTRO_COPY.time, M, y);
  y += 40; doc.setFont("helvetica", "normal").setFontSize(9.5); setText([180, 198, 186]);
  doc.text(`${essentialCount(questions)} preguntas esenciales · ${questions.length} en total`, M, y);
  doc.text(`Actualizado: ${now.toISOString().slice(0, 10)}`, M, y + 16);
  doc.addPage(); y = M;

  // ── Introduction / instructions ──
  para("Antes de comenzar", 16, GREEN, "bold"); y += 4;
  para("Cómo responder", 11.5, accent, "bold"); y += 2;
  for (const i of INTRO_COPY.instructions) para("•  " + i, 10.5, INK);
  y += 8; para("Confidencialidad", 11.5, accent, "bold"); y += 2;
  para(INTRO_COPY.privacy, 10.5, INK);
  y += 10; para("Prioridad de las preguntas", 11.5, accent, "bold"); y += 2;
  para("Esencial para continuar — complete primero estas.  ·  Muy útil para mejorar el análisis.  ·  Información complementaria.", 10.5, MUTED);
  y += 6; para("Puede devolvernos el documento con solo las esenciales completas.", 10.5, MUTED, "italic");

  // ── Questions by section ──
  let currentSection = "";
  for (const q of rendered) {
    if (q.sectionId !== currentSection) {
      currentSection = q.sectionId;
      const sec = SECTIONS.find((s) => s.id === q.sectionId)!;
      ensure(56); y += 14;
      setFill(CREAM); doc.roundedRect(M, y - 12, CONTENT_W, 34, 4, 4, "F");
      setFill(accent); doc.rect(M, y - 12, 4, 34, "F");
      setText(GREEN); doc.setFont("helvetica", "bold").setFontSize(13); doc.text(`${sec.id}. ${sec.title}`, M + 14, y + 4);
      setText(MUTED); doc.setFont("helvetica", "normal").setFontSize(9); doc.text(sec.intro, M + 14, y + 17, { maxWidth: CONTENT_W - 28 });
      y += 34;
    }
    ensure(150);
    // priority chip
    setText(q.phase === "essential" ? accent : MUTED); doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(q.phaseLabel.toUpperCase(), M, y); y += 12;
    para(`${q.number}. ${q.question}`, 12, INK, "bold", 1.3);
    para(`Por qué lo pedimos: ${q.why}`, 9, MUTED, "italic");
    if (q.options.length) para("Opciones: " + q.options.join("   ·   "), 9, SAGE);
    if (q.subfields.length) para("Detalle: " + q.subfields.join("   ·   "), 9, SAGE);
    if (q.unitsOrExamples) para(q.unitsOrExamples, 9, MUTED, "italic");
    if (q.sensitive) para("Puede responder un rango o marcar «Confidencial — revisar verbalmente».", 8.5, MUTED, "italic");
    y += 4;
    // answer writing box
    ensure(64); setDraw(LINE); setFill([252, 251, 246]); doc.roundedRect(M, y, CONTENT_W, 48, 3, 3, "FD");
    setText(MUTED); doc.setFontSize(7.5).setFont("helvetica", "normal"); doc.text("Respuesta:", M + 6, y + 12); y += 56;
    // confidence + evidence row
    ensure(16); doc.setFontSize(8.5); setText(INK);
    doc.text("Confianza:  ☐ Confirmado   ☐ Estimado   ☐ Por confirmar   ☐ No aplica", M, y);
    y += 12; setText(MUTED); doc.text("Evidencia (documento o URL): ______________________________________________", M, y);
    y += 14; setDraw(LINE); doc.setLineWidth(0.5); doc.line(M, y, M + CONTENT_W, y); y += 6;
  }

  // ── Documents checklist ──
  newPage(); para("Documentos de soporte", 16, GREEN, "bold"); y += 4;
  para("Marque el estado de cada documento y adjunte o enlace cuando esté disponible. Los ejemplos son frecuentes en ventas B2B; no todos son obligatorios.", 9.5, MUTED); y += 8;
  for (const d of ["Registro sanitario / INVIMA", "Ficha técnica del producto", "Información de etiquetado", "RUT", "Cámara de comercio", "Otro documento solicitado por el cliente"]) {
    ensure(30); setText(INK); doc.setFont("helvetica", "bold").setFontSize(10); doc.text("•  " + d, M, y); y += 13;
    setText(MUTED); doc.setFont("helvetica", "normal").setFontSize(8.5);
    doc.text("Estado: ☐ activo  ☐ en trámite  ☐ vencido  ☐ no disponible  ☐ no aplica     Documento/enlace: ____________", M + 12, y); y += 16;
  }

  // ── Final review ──
  newPage(); para("Revisión final", 16, GREEN, "bold"); y += 4;
  para("Antes de enviar, confirme:", 10.5, INK, "bold"); y += 2;
  for (const c of ["Completé todas las preguntas esenciales (o marqué «Por confirmar»).", "Indiqué mi nivel de confianza en cada respuesta.", "Adjunté o referencié los documentos disponibles.", "No incluí contraseñas, datos bancarios ni información confidencial ajena al piloto."]) para("☐  " + c, 10, INK);
  y += 16; para("Enviar a LeadLens para revisión. Las respuestas no se aplican automáticamente: LeadLens las revisa antes de recalcular el análisis de cuentas.", 9.5, MUTED, "italic");
  footer();

  return Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
}
