// Unit tests: reusable pilot client-context questionnaire export.
import {
  buildPilotQuestionnaireRows, buildPilotQuestionnaireCsv, questionnaireFilename,
  type QuestionnaireQuestion,
} from "@/lib/intelligence/pilot-questionnaire";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// Sample mirrors the shape of workspace.questions (IntakeQuestion).
const questions: QuestionnaireQuestion[] = [
  { field: "product_formats", category: "offer", priority: "critical_blocker", text: "Which formats?", who_should_answer: "client product lead", answer_format: "multi-select", document_can_answer: true },
  { field: "business_model", category: "strategic", priority: "high_leverage", text: "Which model, with a, comma?", who_should_answer: "client commercial lead", answer_format: "multi-select", document_can_answer: true },
  { field: "sales_cycle_tolerance", category: "commercial", priority: "important", text: "What cycle?", who_should_answer: "client leadership", answer_format: "range", document_can_answer: false },
  { field: "minimum_order", category: "economic", priority: "critical_blocker", text: "Min order?", who_should_answer: "client operations", answer_format: "numeric", document_can_answer: true },
];

const rows = buildPilotQuestionnaireRows(questions);

// 1. Critical questions come first (deterministic priority order).
t("1 criticals ordered first", rows[0].prioridad === "Crítica" && rows[1].prioridad === "Crítica" && rows[2].prioridad === "Alta" && rows[3].prioridad === "Importante");
// 2. Within priority, stable by field (minimum_order < product_formats).
t("2 stable within priority (field asc)", rows[0].campo === "minimum_order" && rows[1].campo === "product_formats");
// 3. Spanish question text used for known fields (not the English `text`).
t("3 Spanish text for known field", /pedido mínimo/i.test(rows[0].pregunta) && !/Min order/.test(rows[0].pregunta));
// 4. Every question is present (no drops).
t("4 all questions exported", rows.length === questions.length);
// 5. Evidence requirement reflects document_can_answer.
t("5 evidence requirement mapped", rows.find(r => r.campo === "minimum_order")!.evidencia_requerida.includes("Documento") && rows.find(r => r.campo === "sales_cycle_tolerance")!.evidencia_requerida.includes("Confirmación explícita"));

const csv = buildPilotQuestionnaireCsv({ clientName: "Amor de Gea", questions });
// 6. Deterministic (same input ⇒ identical CSV).
t("6 deterministic CSV", csv === buildPilotQuestionnaireCsv({ clientName: "Amor de Gea", questions }));
// 7. UTF-8 BOM + CRLF + header row.
t("7 BOM + header", csv.charCodeAt(0) === 0xFEFF && csv.includes("Respuesta del cliente") && csv.includes("\r\n"));
// 8. CSV escaping: a comma/quote in a cell is quoted (unknown field → raw text).
const csvEsc = buildPilotQuestionnaireCsv({ clientName: "x", questions: [{ field: "unknown_x", priority: "important", text: 'Has a, comma and "quotes"' }] });
t("8 comma/quote escaped", csvEsc.includes('"Has a, comma and ""quotes"""'));
// 9. Answer columns are blank (never fabricated) — 4 trailing empty cells.
t("9 answer columns blank", buildPilotQuestionnaireCsv({ clientName: "x", questions: [questions[3]] }).trim().split("\r\n")[1].endsWith(",,,,"));
// 10. Reusable with arbitrary/empty question sets (no crash, header only).
t("10 empty set ⇒ header only", buildPilotQuestionnaireCsv({ clientName: "New Client", questions: [] }).trim().split("\r\n").length === 1);
// 11. Filename slug is safe + client-specific.
t("11 filename slug", questionnaireFilename("Amor de Gea", "2026-07-28") === "leadlens-amor-de-gea-cuestionario-contexto-2026-07-28.csv");
t("11b filename fallback", questionnaireFilename("", "2026-07-28").includes("piloto"));
// 12. Unknown field falls back to its own text (reusability for future fields).
t("12 unknown field fallback text", buildPilotQuestionnaireRows([{ field: "brand_new_field", priority: "important", text: "Custom question?" }])[0].pregunta === "Custom question?");

console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
