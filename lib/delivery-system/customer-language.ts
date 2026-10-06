// ─── Customer-language sanitizer (customer-language-v1) ──────────────────────
//
// A generic, deterministic presentation-layer filter that guarantees no internal
// engineering vocabulary reaches a customer-facing deliverable. It fixes PROSE
// presentation only — it never changes a canonical decision, evidence, a count,
// or research truth. Applied at the renderer boundary to text fields that may
// carry baked analyst/LLM/pipeline strings (decision rationale, next steps,
// thesis, validation prose, source labels, executive summary).
//
// It removes/maps four classes of defect, generically (NOT customer-specific):
//   1. internal reason/action codes (snake_case enums) → customer prose;
//   2. opaque numeric scores (`7.5/10`, "average score", "highest-scoring");
//   3. legacy decision taxonomies (HOT/WARM/COLD, act-now/investigate/reserve/
//      reject) that would read as a second decision system;
//   4. for an English deliverable, the bounded Spanish analyst rationale
//      templates emitted by the (frozen) opportunity-case layer.
//
// For a Spanish deliverable (`es: true`) the Spanish rationale is correct and is
// left intact; only codes/scores/legacy-taxonomy are still mapped (into Spanish).

export const CUSTOMER_LANGUAGE_VERSION = "customer-language-v1";

/** Forbidden tokens for customer-delivery QA (case-insensitive). A clean
 *  deliverable must contain none of these. Exported so the QA gate and the
 *  renderer share ONE definition. The `/10` score form is matched by regex in
 *  `hasForbiddenCustomerLanguage` rather than listed here. */
export const FORBIDDEN_CUSTOMER_TOKENS: readonly string[] = [
  "validate_source_first", "monitor_for_new_signal", "send_outreach_now", "act_now",
  "validate_first", "low_priority", "highest-scoring", "highest scoring",
  "average score", "\\bWARM\\b", "\\bHOT\\b", "\\bCOLD\\b", "\\bact now\\b",
  "encaje ", "sin señal temporal", "sin independencia confirmada", "señal temporal verificada",
  "Source URL unavailable",
];

const SCORE_RE = /\b\d{1,2}(?:\.\d+)?\s*\/\s*10\b/g;

// Internal snake_case reason/action codes → customer prose (language-aware).
function codeMap(es: boolean): Array<[RegExp, string]> {
  return [
    [/\bvalidate_source_first\b/gi, es ? "verificar primero la señal comercial de forma independiente y confirmar la relevancia de categoría" : "independently verify the commercial signal and confirm category relevance"],
    [/\bmonitor_for_new_signal\b/gi, es ? "monitorear una nueva señal comercial o de categoría antes de invertir esfuerzo" : "monitor for a new commercial or category-specific signal before committing outreach"],
    [/\bsend_outreach_now\b/gi, es ? "preparar contacto comercial" : "prepare commercial outreach"],
    [/\bact_now\b/gi, es ? "priorizar" : "prioritize"],
    [/\bvalidate_first\b/gi, es ? "validar" : "validate"],
    [/\blow_priority\b/gi, es ? "baja prioridad" : "low priority"],
    [/\bexclude\b/gi, es ? "sin pursuit activo recomendado con la evidencia actual" : "no active pursuit recommended under the current evidence"],
  ];
}

// Legacy decision taxonomies that would read as a competing decision system.
function legacyTaxonomy(es: boolean): Array<[RegExp, string]> {
  return [
    [/\bact now\b/gi, es ? "priorizar" : "prioritize"],
    [/\binvestigate\b/gi, es ? "validar" : "validate"],
    [/\breserve\b/gi, es ? "monitorear" : "monitor"],
    [/\breject\b/gi, es ? "en espera" : "hold"],
    [/\b(HOT|WARM|COLD)\b/g, ""],
  ];
}

// Bounded Spanish analyst rationale templates → English (EN deliverables only).
const ES_RATIONALE_TO_EN: Array<[RegExp, string]> = [
  [/\bencaje estructural es moderado y está respaldado por una fuente oficial, pero permanece sin confirmar\b/gi, "structural fit is moderate and supported by an official source but remains unconfirmed"],
  [/\bNo existe evidencia de intención de compra ni de timing actual\b/gi, "There is no evidence of buying intent or current timing"],
  [/\bsin señal temporal verificada\b/gi, "no verified timing signal"],
  [/\bseñal temporal verificada\b/gi, "a verified timing signal"],
  [/\bevidencia con soporte independiente explícito\b/gi, "evidence with explicit independent support"],
  [/\bevidencia con una sola fuente\b/gi, "evidence from a single source"],
  [/\bevidencia sin independencia confirmada\b/gi, "evidence without confirmed independence"],
  [/\bevidencia sin fuente enlazada\b/gi, "evidence with no linked source"],
  [/\bqueda por resolver\b/gi, "open question"],
  [/\bencaje\b/gi, "fit"],
  // Spanish connector left between the (now-translated) timing and evidence clauses
  // of the frozen rationale template ("... signal y evidence ...").
  [/\s+y\s+(evidence)\b/gi, " and $1"],
];

const PLACEHOLDER_SOURCE_RE = /\bSource URL unavailable\b/gi;

/** Normalize one customer-facing string. Returns "" for an input that is only a
 *  placeholder once cleaned (caller decides whether to drop it). */
export function toCustomerText(input: string | null | undefined, opts: { es?: boolean } = {}): string {
  if (!input) return input ?? "";
  const es = opts.es ?? false;
  let out = String(input);

  for (const [re, prose] of codeMap(es)) out = out.replace(re, prose);
  out = out.replace(SCORE_RE, "");
  out = out.replace(/\bhighest[-\s]scoring\b/gi, es ? "de mayor prioridad" : "top-priority");
  out = out.replace(/\baverage score\b/gi, es ? "evaluación agregada" : "overall assessment");
  if (!es) for (const [re, en] of ES_RATIONALE_TO_EN) out = out.replace(re, en);
  for (const [re, canon] of legacyTaxonomy(es)) out = out.replace(re, canon);
  out = out.replace(PLACEHOLDER_SOURCE_RE, es ? "Referencia contextual" : "Contextual reference");

  // Cleanup artifacts left by removals: empty parens, doubled spaces, space before
  // punctuation, a dangling leading separator, and ", ," style gaps.
  out = out
    .replace(/\(\s*[,;]?\s*\)/g, "")
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/^[\s,;:·—-]+/, "")
    .trim();
  return out;
}

/** True if a string still contains any forbidden customer-delivery token. Used
 *  by the renderer (defense in depth) and the QA gate (authoritative check). */
export function hasForbiddenCustomerLanguage(input: string | null | undefined): string[] {
  if (!input) return [];
  const hits: string[] = [];
  for (const tok of FORBIDDEN_CUSTOMER_TOKENS) {
    const re = new RegExp(tok, tok.startsWith("\\b") ? "g" : "gi");
    if (re.test(input)) hits.push(tok.replace(/\\b/g, ""));
  }
  if (SCORE_RE.test(input)) hits.push("/10");
  SCORE_RE.lastIndex = 0;
  return hits;
}
