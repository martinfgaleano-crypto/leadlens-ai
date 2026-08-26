// ─── Full-text escalation: snippet triage → fetch → extract → validate ────────
//
// Improves recurring-research recall WITHOUT weakening truth standards. A search
// result is fetched in full ONLY when its snippet is promising (a possible dated
// material event) and lacks sufficient context. The fetched page is UNTRUSTED
// external content: instruction-like lines are neutralized (prompt-injection
// defense) before any structured extraction, and the deterministic event gates
// (`extractEvent`) remain the sole authority — no raw model/page text becomes
// Evidence. Bounded by a fetch/extraction budget.

import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";
import { extractEvent, type EventCandidate } from "./event-extraction";
import type { ObservedItem } from "./delta-research";

export interface SearchCandidate {
  accountId: string;
  sourceHost: string;
  sourceUrl: string;
  title: string | null;
  snippet: string | null;
  publishedDate: string | null;
  retrievedAt: string;
}

export interface FullTextBudget {
  maxFetchesPerAccount: number;
  maxContentChars: number;
  fetchTimeoutMs: number;
}

export const DEFAULT_FULLTEXT_BUDGET: FullTextBudget = { maxFetchesPerAccount: 4, maxContentChars: 20_000, fetchTimeoutMs: 15_000 };

/** DI page fetcher — the real one is extractWithFallback (Tavily→Firecrawl). */
export type PageFetcher = (url: string) => Promise<{ ok: boolean; content: string | null }>;

export interface EscalationMetrics {
  triaged: number;
  fetched: number;
  fetchFailures: number;
  eventsProposed: number;
  eventsAccepted: number;
  eventDateResolved: number;
  eventDateUnknown: number;
  materialityRejected: number;
  injectionNeutralized: number;
}

// Instruction-like phrases an injected page might contain, aimed at an AI reader.
const INJECTION_PHRASE = /\b(ignore (?:all |the )?(?:previous|above|prior) (?:instructions?|prompts?)|disregard (?:the )?(?:above|previous)|system prompt|you are now|act as|do not follow|new instructions?:|assistant:|prompt:)\b/gi;

/** Neutralize untrusted page content: strip instruction-like PHRASES inline
 *  (keeping the surrounding factual text as DATA), and cap length. */
export function neutralizePageContent(raw: string, maxChars: number): { text: string; neutralized: boolean } {
  const neutralized = INJECTION_PHRASE.test(raw);
  INJECTION_PHRASE.lastIndex = 0;
  const text = raw.replace(INJECTION_PHRASE, " ").replace(/[<>]/g, " ").replace(/\s+/g, " ").slice(0, maxChars);
  return { text, neutralized };
}

const PUB_MARKER = /(publish|publicad|posted|updated|actualiz|fecha de public)/i;
/** Find an EVENT date phrase, skipping dates adjacent to a publication marker
 *  ("Published August 2026" is NOT the event date). Conservative: null if every
 *  date phrase is publication-adjacent. */
export function scrapeEventDatePhrase(text: string): string | null {
  const re = new RegExp(EVENT_DATE_PHRASE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    if (!PUB_MARKER.test(before)) return m[0];
  }
  return null;
}

// Negative/reversal snippets are material as COUNTEREVIDENCE and deserve a fetch
// even though they are not a positive triggering change.
const NEGATIVE_SNIPPET = /\b(cancel|cancelaci|closure|cierre|shutdown|reversal|reversi|paus|suspend|delay|aplaz|layoff|despido|withdraw|retiro)/i;

/** A snippet is worth a full fetch when it plausibly describes a dated material
 *  corporate change (positive OR negative), not obvious noise. */
export function snippetIsPromising(candidate: SearchCandidate): boolean {
  const hay = `${candidate.title ?? ""}. ${candidate.snippet ?? ""}`;
  const negative = NEGATIVE_SNIPPET.test(hay);
  const sk = classifySignalKind(hay);
  const mat = classifyMateriality(hay);
  if (!sk.can_trigger && !negative) return false;    // metric / marketing / reference → skip
  if (mat.level === "low" && !negative) return false; // immaterial → skip
  return true;                                        // promising: escalate to full text
}

const EVENT_DATE_PHRASE = /\b\d{4}-\d{2}-\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}\b|\bq[1-4]\s*\d{4}\b/i;

/**
 * Escalate promising candidates: fetch full text (bounded), neutralize it, and run
 * the canonical event gates over the fuller content. Returns validated ObservedItems
 * + a funnel metric. Non-promising candidates are triaged out (no fetch cost).
 */
export async function escalateAndExtract(
  candidates: SearchCandidate[],
  fetchPage: PageFetcher,
  watchFamilies: string[] = [],
  budget: FullTextBudget = DEFAULT_FULLTEXT_BUDGET,
): Promise<{ items: ObservedItem[]; metrics: EscalationMetrics }> {
  const metrics: EscalationMetrics = { triaged: candidates.length, fetched: 0, fetchFailures: 0, eventsProposed: 0, eventsAccepted: 0, eventDateResolved: 0, eventDateUnknown: 0, materialityRejected: 0, injectionNeutralized: 0 };
  const items: ObservedItem[] = [];

  for (const c of candidates) {
    const snippetText = `${c.title ?? ""}. ${c.snippet ?? ""}`.trim();
    // Non-promising → extract from the snippet only (cheap, usually contextual).
    if (!snippetIsPromising(c) || metrics.fetched >= budget.maxFetchesPerAccount) {
      const e = extractEvent(snippetCandidate(c, snippetText), watchFamilies);
      if (!e.item.isDatedMaterialEvent) metrics.materialityRejected++;
      items.push(e.item);
      continue;
    }
    // Promising → full-text fetch.
    metrics.fetched++;
    let content: string | null = null;
    try { const r = await fetchPage(c.sourceUrl); content = r.ok ? r.content : null; } catch { content = null; }
    if (!content) { metrics.fetchFailures++; items.push(extractEvent(snippetCandidate(c, snippetText), watchFamilies).item); continue; }

    const { text, neutralized } = neutralizePageContent(content, budget.maxContentChars);
    if (neutralized) metrics.injectionNeutralized++;
    const candidate: EventCandidate = {
      accountId: c.accountId, sourceHost: c.sourceHost, sourceUrl: c.sourceUrl, originId: null,
      titleAndContent: `${snippetText}. ${text}`,
      eventDateRaw: scrapeEventDatePhrase(text),
      publicationDate: c.publishedDate, retrievedAt: c.retrievedAt,
    };
    metrics.eventsProposed++;
    const e = extractEvent(candidate, watchFamilies);
    if (e.item.eventDate) metrics.eventDateResolved++; else metrics.eventDateUnknown++;
    if (e.item.isDatedMaterialEvent) metrics.eventsAccepted++; else metrics.materialityRejected++;
    items.push(e.item);
  }
  return { items, metrics };
}

function snippetCandidate(c: SearchCandidate, titleAndContent: string): EventCandidate {
  return {
    accountId: c.accountId, sourceHost: c.sourceHost, sourceUrl: c.sourceUrl, originId: null,
    titleAndContent, eventDateRaw: scrapeEventDatePhrase(titleAndContent),
    publicationDate: c.publishedDate, retrievedAt: c.retrievedAt,
  };
}
