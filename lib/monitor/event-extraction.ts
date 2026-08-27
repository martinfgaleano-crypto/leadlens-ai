// ─── Event extraction + date/materiality resolution (source → claim → event) ──
//
// Turns a raw source candidate into a temporally- and materially-validated
// ObservedItem for the delta classifier. Deterministic gates own the truth:
//   • event date is resolved ONLY from the extracted event phrase — never the
//     publication date, never the retrieval date;
//   • materiality is judged by the canonical classifiers (classifySignalKind /
//     classifyMateriality), so a recent-but-irrelevant or promotional item is
//     contextual, and a negative/reversal event is counterevidence, not a boost;
//   • an LLM may PRODUCE candidates, but nothing here trusts prose: only a dated,
//     grounded, material, case-relevant event becomes a dated material event.

import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";
import { parseEnglishDate, parseSpanishDate } from "@/lib/sources/access/date-resolver";
import type { ObservedItem } from "./delta-research";

export type TemporalPrecision = "exact_date" | "month" | "quarter" | "year" | "relative_bounded" | "unknown";

export interface EventCandidate {
  accountId: string;
  sourceHost: string;
  sourceUrl: string;
  originId?: string | null;
  /** Title + extracted body used by the deterministic classifiers. */
  titleAndContent: string;
  /** The EVENT phrase/date the extractor found (e.g. "March 2026", "hace 2 meses",
   *  "2026-03-04"). NOT the publication date. */
  eventDateRaw?: string | null;
  publicationDate?: string | null;
  retrievedAt: string;
  kindHint?: string | null;
  resolvesValidationKey?: string | null;
}

export interface ResolvedEventDate {
  eventDate: string | null;
  precision: TemporalPrecision;
  basis: "iso" | "absolute_text" | "relative_anchored" | "none";
  rangeStart?: string | null;
  rangeEnd?: string | null;
}

const ISO_FULL = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/;
const ISO_MONTH = /^\s*(\d{4})-(\d{2})\s*$/;
const YEAR_ONLY = /^\s*(\d{4})\s*$/;
const QUARTER = /\bq([1-4])\s*(\d{4})\b|\b(primer|segundo|tercer|cuarto)\s+trimestre\s+(?:de\s+)?(\d{4})\b/i;
const Q_MAP: Record<string, number> = { primer: 1, segundo: 2, tercer: 3, cuarto: 4 };
const RELATIVE = /\b(last month|el mes pasado|earlier this year|este a[ñn]o|a principios de|hace\s+\d+\s+(d[ií]as?|semanas?|meses?|a[ñn]os?)|\d+\s+(weeks?|months?|days?)\s+ago|two weeks ago)\b/i;
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, abr: 4, ago: 8, dic: 12,
};
const MONTH_YEAR = /\b([a-zA-Zábéíóúáéíóú]+)\.?\s+(?:de\s+)?(\d{4})\b/;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Resolve an event date ONLY from the event phrase. Publication/retrieval dates
 *  are never used as the event date (relative phrases may be ANCHORED to the
 *  publication date, which is defensible). Conservative: never invents exactness. */
export function resolveEventDate(candidate: EventCandidate): ResolvedEventDate {
  const raw = (candidate.eventDateRaw ?? "").trim();
  if (!raw) return { eventDate: null, precision: "unknown", basis: "none" };

  let m: RegExpMatchArray | null;
  if ((m = raw.match(ISO_FULL))) return { eventDate: `${m[1]}-${m[2]}-${m[3]}`, precision: "exact_date", basis: "iso" };
  if ((m = raw.match(ISO_MONTH))) return { eventDate: `${m[1]}-${m[2]}-01`, precision: "month", basis: "iso" };
  if ((m = raw.match(QUARTER))) {
    const q = m[1] ? Number(m[1]) : Q_MAP[(m[3] ?? "").toLowerCase()];
    const y = m[2] ?? m[4];
    if (q && y) return { eventDate: `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`, precision: "quarter", basis: "absolute_text" };
  }
  // Absolute textual dates WITH a day (English/Spanish month names).
  const abs = parseEnglishDate(raw) ?? parseSpanishDate(raw);
  if (abs) {
    const hasDay = /\b\d{1,2}\b.*\b\d{4}\b|\b\d{4}\b.*\b\d{1,2}\b/.test(raw) && /\d{1,2}/.test(raw.replace(/\d{4}/, ""));
    return { eventDate: abs, precision: hasDay ? "exact_date" : "month", basis: "absolute_text" };
  }
  // Month + year with NO day ("March 2026", "marzo de 2026") → month precision.
  if ((m = raw.match(MONTH_YEAR))) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) return { eventDate: `${m[2]}-${pad2(mo)}-01`, precision: "month", basis: "absolute_text" };
  }
  if ((m = raw.match(YEAR_ONLY))) return { eventDate: `${m[1]}-01-01`, precision: "year", basis: "absolute_text" };
  // Relative phrase → anchor to publication date if present; else unknown.
  if (RELATIVE.test(raw) && candidate.publicationDate) {
    const anchor = parseEnglishDate(candidate.publicationDate) ?? parseSpanishDate(candidate.publicationDate) ?? (ISO_FULL.test(candidate.publicationDate.trim()) ? candidate.publicationDate.trim() : null);
    if (anchor) {
      const at = new Date(`${anchor}T00:00:00Z`);
      const lower = raw.toLowerCase();
      if (/last month|el mes pasado/.test(lower)) {
        const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1));
        const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 0));
        const rangeStart = start.toISOString().slice(0, 10), rangeEnd = end.toISOString().slice(0, 10);
        return { eventDate: rangeStart, rangeStart, rangeEnd, precision: "relative_bounded", basis: "relative_anchored" };
      }
      const weeks = lower.match(/(?:hace\s+)?(\d+)\s+(?:semanas?|weeks?)(?:\s+ago)?/) ?? (lower.includes("two weeks ago") ? (["", "2"] as unknown as RegExpMatchArray) : null);
      if (weeks) {
        const center = new Date(at.getTime() - Number(weeks[1]) * 7 * 86_400_000);
        const start = new Date(center.getTime() - 3 * 86_400_000), end = new Date(center.getTime() + 3 * 86_400_000);
        const rangeStart = start.toISOString().slice(0, 10), rangeEnd = end.toISOString().slice(0, 10);
        return { eventDate: rangeStart, rangeStart, rangeEnd, precision: "relative_bounded", basis: "relative_anchored" };
      }
      if (/earlier this year|este a[ñn]o/.test(lower)) {
        const rangeStart = `${at.getUTCFullYear()}-01-01`, rangeEnd = anchor;
        return { eventDate: rangeStart, rangeStart, rangeEnd, precision: "relative_bounded", basis: "relative_anchored" };
      }
    }
  }
  return { eventDate: null, precision: "unknown", basis: "none" };
}

// Stem-matched (no trailing boundary) so "cancels"/"cancellation"/"suspended" match.
const NEGATIVE_KIND = /\b(cancel|cancelaci|closure|cierre|shutdown|reversal|reversi|paus|suspend|layoff|despido|withdraw|retiro|shut down|postpon|delay|halt|divest|discontinu|exit(?:ed|s|ing)? (?:the )?market|clos(?:ed|es|ing) (?:its|the))/i;

export interface ExtractedEvent {
  item: ObservedItem;
  precision: TemporalPrecision;
  materiality: "high" | "medium" | "low";
  signalKind: string;
  canTrigger: boolean;
  reason: string;
}

/**
 * Extract a validated event from a raw candidate. Returns an ObservedItem the
 * delta classifier can consume. `isDatedMaterialEvent` is true ONLY when the item
 * can trigger (a real corporate change, not a metric/marketing/reference page),
 * is materially relevant, and has a defensible event date.
 */
export function extractEvent(candidate: EventCandidate, watchFamilies: string[] = [], opts: { assumeTriggering?: boolean } = {}): ExtractedEvent {
  const sk = classifySignalKind(candidate.titleAndContent);
  const mat = classifyMateriality(candidate.titleAndContent);
  const date = resolveEventDate(candidate);
  const isNegative = NEGATIVE_KIND.test(candidate.titleAndContent) || (candidate.kindHint ? NEGATIVE_KIND.test(candidate.kindHint) : false);

  // Whether this is an EVENT (vs metric/static) may be asserted by an upstream
  // structured extractor (LLM classification is allowed for event-vs-metric); the
  // verb-based deterministic classifier is the fallback. Materiality + date remain
  // deterministic regardless.
  const triggering = opts.assumeTriggering === true || sk.can_trigger;
  // Material relative to the Case: a triggering corporate change of non-low
  // materiality (a negative/reversal event is material as counterevidence).
  const material = (mat.level === "high" || mat.level === "medium" || isNegative);
  const isDatedMaterialEvent = triggering && material && date.eventDate !== null;
  // Relevance: the event family is watched OR it is high materiality / negative.
  const kind = candidate.kindHint || sk.kind;
  const relevantToCase = watchFamilies.length === 0 || watchFamilies.includes(kind) || mat.level === "high" || isNegative;

  const reason = !sk.can_trigger ? `non-triggering (${sk.kind})`
    : date.eventDate === null ? "no defensible event date"
    : !material ? `immaterial (${mat.level})`
    : isNegative ? "material counterevidence" : `material ${sk.kind}`;

  const item: ObservedItem = {
    sourceHost: candidate.sourceHost.toLowerCase(), sourceUrl: candidate.sourceUrl, originId: candidate.originId ?? null,
    kind, eventDate: date.eventDate, publicationDate: candidate.publicationDate ?? null, retrievedAt: candidate.retrievedAt,
    isDatedMaterialEvent, relevantToCase,
    resolvesValidationKey: candidate.resolvesValidationKey ?? null,
    isCounterevidence: isNegative,
  };
  return { item, precision: date.precision, materiality: mat.level, signalKind: sk.kind, canTrigger: sk.can_trigger, reason };
}

/** Batch extract → ObservedItems. Pure. */
export function extractEvents(candidates: EventCandidate[], watchFamilies: string[] = []): { items: ObservedItem[]; extractions: ExtractedEvent[] } {
  const extractions = candidates.map((c) => extractEvent(c, watchFamilies));
  return { items: extractions.map((e) => e.item), extractions };
}
