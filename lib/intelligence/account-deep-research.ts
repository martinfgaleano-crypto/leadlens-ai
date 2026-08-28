import type { LeadCandidate, LeadSearchCriteria } from "@/types";
import {
  assessEvidenceCandidate,
  buildResearchProfile,
  planCorroborationQuery,
  planAccountResearch,
  recoverAtomicClaims,
  type EvidenceCandidate,
  type EvidenceDecision,
  type PlannedResearchQuery,
} from "./research-quality";
import { buildClientContext } from "./evidence-temporal";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import type { ExtractDeps } from "@/lib/monitor/claim-event-extractor";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";

export const ACCOUNT_DEEP_RESEARCH_VERSION = "account-deep-research-v1";

export interface AccountDeepResearchTelemetry {
  version: string;
  account: string;
  domain: string | null;
  planned_queries: number;
  executed_queries: number;
  provider_calls: number;
  provider_failures: number;
  results_seen: number;
  evidence_accepted: number;
  evidence_rejected: number;
  pages_extracted: number;
  extraction_failures: number;
  structured_extraction_calls: number;
  dated_evidence: number;
  independent_domains: number;
  corroboration_attempted: boolean;
  corroborating_domains: number;
  claims_recovered: number;
  counterevidence_checked: boolean;
  early_stop_reason: "sufficient_evidence" | "no_material_event" | "budget_exhausted" | "providers_unavailable";
  query_audit: Array<{ query_id: string; stage: string; provider: string; results: number; accepted: number }>;
  extraction_audit: Array<{ url: string; stage: string; date_phrase: string | null; signal_kind: string; materiality: string; accepted_events: number; evidence_excerpt: string }>;
}

export interface AccountDeepResearchResult {
  context: string;
  sourceUrl: string | null;
  publishedDate: string | null;
  eventDate: string | null;
  validated_events: Array<{ url: string; source_host: string; kind: string; event_date: string; title_and_content: string }>;
  decisions: EvidenceDecision[];
  telemetry: AccountDeepResearchTelemetry;
}

export interface AccountDeepResearchDeps {
  providers?: SearchProvider[];
  extract?: (url: string) => Promise<{ ok: boolean; content: string | null }>;
  now?: () => Date;
  maxQueries?: number;
  maxResultsPerQuery?: number;
  maxExtractions?: number;
  structured?: ExtractDeps;
}

/**
 * Bounded second-pass research for an ALREADY IDENTIFIED account. This is not
 * discovery and cannot add accounts. The existing research-quality plan decides
 * which evidence gaps to query; accepted evidence remains subject to entity and
 * source gates. Full text enriches accepted URLs only and never bypasses them.
 */
export async function deepenAccountResearch(
  candidate: LeadCandidate,
  criteria: LeadSearchCriteria,
  deps: AccountDeepResearchDeps = {},
): Promise<AccountDeepResearchResult> {
  const now = deps.now?.() ?? new Date();
  const profile = buildResearchProfile({
    company: candidate.company,
    domain: candidate.domain ?? null,
    country: candidate.country ?? candidate.location ?? null,
    segment: candidate.industry ?? null,
    structural_score: Math.round(candidate.confidence_score * 100),
    verified_aliases: candidate.account_identity?.aliases ?? [],
  });
  const context = buildClientContext({
    client_id: "productive_research",
    captured_at: now.toISOString(),
    region: candidate.country ?? candidate.location ?? null,
    offering: criteria.offer_summary,
    objective: "account opportunity intelligence",
    priority_segments: criteria.target_industries,
  });
  const queryBudget = deps.maxQueries ?? 5;
  // Four core stages own identity, footprint, event probe and counterevidence.
  // When a fifth slot exists it is reserved for claim-derived corroboration,
  // but spent only after a dated material event survives deterministic gates.
  const initialQueryBudget = queryBudget >= 5 ? queryBudget - 1 : queryBudget;
  const plan = planAccountResearch(profile, context, initialQueryBudget, criteria.buying_signals);
  const providers = deps.providers ?? await productiveProviders();
  const extract = deps.extract ?? defaultExtract;
  const seen = new Set<string>();
  const acceptedByCanonical = new Map<string, EvidenceDecision>();
  const extractedUrls = new Set<string>();
  const decisions: EvidenceDecision[] = [];
  const contexts: Array<{ text: string; rank: number }> = [];
  const validatedEvents: AccountDeepResearchResult["validated_events"] = [];
  const queryAudit: AccountDeepResearchTelemetry["query_audit"] = [];
  const extractionAudit: AccountDeepResearchTelemetry["extraction_audit"] = [];
  const corroboratingHosts = new Set<string>();
  let providerCalls = 0, providerFailures = 0, resultsSeen = 0, pagesExtracted = 0, extractionFailures = 0, structuredExtractionCalls = 0, stoppedNoEvent = false;
  const maxResults = deps.maxResultsPerQuery ?? 5;
  const maxExtractions = deps.maxExtractions ?? 4;

  outer: for (const query of plan.accepted) {
    for (const provider of providers) {
      providerCalls++;
      let response;
      try {
        response = await provider.search({
          query: query.query, max_results: maxResults,
          freshness_days: query.stage === "current_activity" || query.stage === "counterevidence" ? 730 : undefined,
          query_type: query.stage === "current_activity" || query.stage === "counterevidence" ? "news" : "company_specific",
          language: profile.likely_language ?? undefined,
        });
      } catch { providerFailures++; continue; }
      if (!response.ok) { providerFailures++; continue; }
      let acceptedForQuery = 0;
      resultsSeen += response.results.length;
      for (const item of response.results) {
        const evidence: EvidenceCandidate = {
          url: item.url, canonical_url: item.canonical_url, title: item.title,
          excerpt: item.snippet, provider: provider.id, source_type: item.source_type,
          publication_date: item.published_date, retrieved_at: item.retrieved_at,
        };
        const previouslyAccepted = acceptedByCanonical.get(evidence.canonical_url) ?? null;
        const decision = assessEvidenceCandidate(profile, evidence, seen);
        decisions.push(decision);
        seen.add(evidence.canonical_url);
        if (decision.accepted) acceptedByCanonical.set(evidence.canonical_url, decision);
        // Search engines commonly return the same official newsroom URL during
        // identity and current-activity stages. The duplicate remains auditable,
        // but the already-accepted URL may still be deepened once in the stage
        // that owns event retrieval. Otherwise identity consumes/poisons recall.
        const effectiveDecision = decision.accepted ? decision : previouslyAccepted;
        if (!effectiveDecision) continue;
        acceptedForQuery++;
        let fullText = "";
        // Full-text budget belongs to event/counterevidence retrieval, never to
        // identity or static-footprint pages. A duplicate URL can be extracted
        // here if it was accepted earlier but has not yet consumed the budget.
        if (pagesExtracted < maxExtractions && effectiveDecision.commercial_relevance === "high" && isEventExtractionCandidate(item.title, item.snippet) && !extractedUrls.has(item.canonical_url)) {
          const fetched = await extract(item.url).catch(() => ({ ok: false, content: null }));
          if (fetched.ok && fetched.content) {
            pagesExtracted++; extractedUrls.add(item.canonical_url); fullText = relevantContentWindow(fetched.content, [candidate.company, ...criteria.buying_signals], 9000);
            try {
              const { extractEvent } = await import("@/lib/monitor/event-extraction");
              const { scrapeEventDatePhrase } = await import("@/lib/monitor/full-text-extraction");
              const sourceHost = new URL(item.url).hostname.replace(/^www\./, "").toLowerCase();
              const titleAndContent = `${item.title ?? ""}. ${fullText}`;
              const acceptedBeforeExtraction = validatedEvents.length;
              const datePhrase = scrapeEventDatePhrase(fullText);
              const eventResult = extractEvent({
                accountId: candidate.company, sourceHost, sourceUrl: item.url, originId: null,
                titleAndContent, eventDateRaw: datePhrase,
                publicationDate: item.published_date, retrievedAt: item.retrieved_at,
              }, criteria.buying_signals);
              const event = eventResult.item;
              if (event.isDatedMaterialEvent && event.eventDate) validatedEvents.push({ url: item.url, source_host: sourceHost, kind: event.kind, event_date: event.eventDate, title_and_content: titleAndContent.slice(0, 9000) });
              else if (structuredExtractionCalls < 2) {
                // Existing canonical structured extractor proposes only. Its
                // proposals still pass event/date/materiality gates below.
                const { extractStructured, proposalsToObservedItems } = await import("@/lib/monitor/claim-event-extractor");
                const structured = await extractStructured(fullText, candidate.company, deps.structured);
                structuredExtractionCalls += structured.calls;
                const acceptedBefore = validatedEvents.length;
                if (structured.result) {
                  const proposed = proposalsToObservedItems(structured.result.events, {
                    sourceHost, sourceUrl: item.url, publicationDate: item.published_date, retrievedAt: item.retrieved_at, accountId: candidate.company,
                  }, criteria.buying_signals);
                  for (const proposedEvent of proposed) if (proposedEvent.isDatedMaterialEvent && proposedEvent.eventDate) {
                    validatedEvents.push({ url: item.url, source_host: sourceHost, kind: proposedEvent.kind, event_date: proposedEvent.eventDate, title_and_content: titleAndContent.slice(0, 9000) });
                  }
                }
                // A syntactically valid model response with zero deterministically
                // accepted events is not extraction success. Fall back to the
                // canonical text/date parser before declaring the page eventless.
                if (validatedEvents.length === acceptedBefore) {
                  const fallback = extractEvent({
                    accountId: candidate.company, sourceHost, sourceUrl: item.url, originId: null,
                    titleAndContent, eventDateRaw: scrapeEventDatePhrase(fullText),
                    publicationDate: item.published_date, retrievedAt: item.retrieved_at,
                  }, criteria.buying_signals).item;
                  if (fallback.isDatedMaterialEvent && fallback.eventDate) validatedEvents.push({
                    url: item.url, source_host: sourceHost, kind: fallback.kind,
                    event_date: fallback.eventDate, title_and_content: titleAndContent.slice(0, 9000),
                  });
                }
              }
              extractionAudit.push({
                url: item.url, stage: query.stage, date_phrase: datePhrase,
                signal_kind: eventResult.signalKind, materiality: eventResult.materiality,
                accepted_events: validatedEvents.length - acceptedBeforeExtraction,
                evidence_excerpt: diagnosticExcerpt(fullText, datePhrase),
              });
            } catch { /* deterministic event validation remains best-effort */ }
          }
          else extractionFailures++;
        }
        contexts.push({
          text: `${item.published_date ? `[${item.published_date}] ` : ""}${item.title ?? ""}. ${fullText || item.snippet || ""} (source: ${item.url})`,
          rank: evidenceRank(effectiveDecision) + (query.stage === "current_activity" ? 5 : query.stage === "counterevidence" ? 4 : 0),
        });
      }
      queryAudit.push({ query_id: query.query_id, stage: query.stage, provider: provider.id, results: response.results.length, accepted: acceptedForQuery });
      // Counterevidence is mandatory. Even two-source positive evidence cannot
      // stop the plan before the bounded counterevidence stage has run.
      if (query.stage === "counterevidence" && validatedEvents.length > 0 && hasSufficientEvidence(decisions)) break outer;
    }
    if (query.stage === "counterevidence" && validatedEvents.length === 0) {
      stoppedNoEvent = true;
      break;
    }
  }

  let corroborationAttempted = false;
  const primaryEvent = [...validatedEvents].sort((a, b) => b.event_date.localeCompare(a.event_date))[0] ?? null;
  if (primaryEvent && new Set(queryAudit.map((q) => q.query_id)).size < queryBudget) {
    corroborationAttempted = true;
    const primaryHost = primaryEvent.source_host;
    const primaryClaim = primaryEvent.title_and_content.split(".")[0]?.slice(0, 180) || primaryEvent.kind;
    const query = planCorroborationQuery(profile, {
      claim_id: `${profile.profile_id}:${primaryEvent.event_date}:${primaryEvent.kind}`,
      claim_statement: primaryClaim, known_domain: primaryHost, known_source_tier: "B",
    });
    if (query.accepted) for (const provider of providers) {
      providerCalls++;
      let response;
      try {
        response = await provider.search({ query: query.query, max_results: maxResults, freshness_days: 730, query_type: "news", language: profile.likely_language ?? undefined });
      } catch { providerFailures++; continue; }
      if (!response.ok) { providerFailures++; continue; }
      let acceptedForQuery = 0;
      resultsSeen += response.results.length;
      for (const item of response.results) {
        let host = ""; try { host = new URL(item.canonical_url).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }
        if (host === primaryHost) continue;
        const evidence: EvidenceCandidate = {
          url: item.url, canonical_url: item.canonical_url, title: item.title, excerpt: item.snippet,
          provider: provider.id, source_type: item.source_type, publication_date: item.published_date, retrieved_at: item.retrieved_at,
        };
        const decision = assessEvidenceCandidate(profile, evidence, seen);
        decisions.push(decision); seen.add(evidence.canonical_url);
        if (!decision.accepted || decision.commercial_relevance !== "high" || !corroboratesPrimaryEvent(primaryEvent.title_and_content, `${item.title ?? ""} ${item.snippet ?? ""}`)) continue;
        acceptedByCanonical.set(evidence.canonical_url, decision); corroboratingHosts.add(host); acceptedForQuery++;
        contexts.push({ text: `${item.published_date ? `[${item.published_date}] ` : ""}${item.title ?? ""}. ${item.snippet ?? ""} (source: ${item.url})`, rank: evidenceRank(decision) + 6 });
      }
      queryAudit.push({ query_id: query.query_id, stage: "corroboration", provider: provider.id, results: response.results.length, accepted: acceptedForQuery });
      if (acceptedForQuery > 0) break;
    }
  }

  const accepted = decisions.filter((d) => d.accepted);
  const claims = recoverAtomicClaims(profile, decisions, now.toISOString());
  const domains = new Set(accepted.map((d) => { try { return new URL(d.candidate.canonical_url).hostname.replace(/^www\./, ""); } catch { return null; } }).filter(Boolean));
  const best = [...accepted].sort((a, b) => evidenceRank(b) - evidenceRank(a))[0] ?? null;
  const bestEvent = validatedEvents.sort((a, b) => b.event_date.localeCompare(a.event_date))[0] ?? null;
  const telemetry: AccountDeepResearchTelemetry = {
    version: ACCOUNT_DEEP_RESEARCH_VERSION, account: candidate.company, domain: candidate.domain ?? null,
    planned_queries: plan.accepted.length, executed_queries: new Set(queryAudit.map((q) => q.query_id)).size,
    provider_calls: providerCalls, provider_failures: providerFailures, results_seen: resultsSeen,
    evidence_accepted: accepted.length, evidence_rejected: decisions.length - accepted.length,
    pages_extracted: pagesExtracted, extraction_failures: extractionFailures,
    structured_extraction_calls: structuredExtractionCalls,
    dated_evidence: accepted.filter((d) => d.candidate.publication_date).length,
    independent_domains: domains.size, claims_recovered: claims.length,
    corroboration_attempted: corroborationAttempted,
    corroborating_domains: corroboratingHosts.size,
    counterevidence_checked: queryAudit.some((q) => q.stage === "counterevidence"),
    early_stop_reason: validatedEvents.length > 0 && hasSufficientEvidence(decisions) ? "sufficient_evidence" : stoppedNoEvent || validatedEvents.length === 0 ? "no_material_event" : providers.length === 0 || providerCalls === providerFailures ? "providers_unavailable" : "budget_exhausted",
    query_audit: queryAudit, extraction_audit: extractionAudit,
  };
  return {
    context: contexts.sort((a, b) => b.rank - a.rank).slice(0, 8).map((x) => x.text).join(" | ").slice(0, 9000),
    sourceUrl: bestEvent?.url ?? best?.candidate.url ?? null,
    publishedDate: best?.candidate.publication_date ?? null,
    eventDate: bestEvent?.event_date ?? null,
    validated_events: validatedEvents,
    decisions, telemetry,
  };
}

/** Financial reporting remains useful context but must not take the scarce
 * event-extraction slot ahead of a concrete operating-change page. */
export function isEventExtractionCandidate(title: string | null, snippet: string | null): boolean {
  const heading = (title ?? "").toLowerCase();
  if (/\b(quarter(?:ly)?|full[- ]year|year[- ]to[- ]date|financial) (?:and )?(?:results?|earnings)|reports? (?:first|second|third|fourth|q[1-4]) quarter|declares? (?:a )?(?:quarterly )?dividend\b/i.test(heading)) return false;
  const hay = `${title ?? ""} ${snippet ?? ""}`;
  return /\b(new|opened?|expan(?:d|ds|ded|ding|sion)|acquir(?:e|es|ed|ing|isition)|invest(?:s|ed|ing|ment)|facility|plant|warehouse|distribution cent(?:er|re)|production line|contract|partnership|closure|cancel|suspend|nuev[ao]|abri[oó]|apertura|expansi[oó]n|adquisici[oó]n|inversi[oó]n|planta|bodega|centro de distribuci[oó]n|contrato|alianza|cierre)\b/i.test(hay);
}

function diagnosticExcerpt(text: string, anchor: string | null): string {
  const lower = text.toLowerCase();
  const index = anchor ? lower.indexOf(anchor.toLowerCase()) : -1;
  const start = index >= 0 ? Math.max(0, index - 180) : 0;
  return text.slice(start, start + 1200).replace(/\s+/g, " ").trim();
}

const CLAIM_STOP = new Set(["about", "after", "company", "expands", "expanding", "with", "from", "into", "new", "operations", "operation", "official"]);
export function corroboratesPrimaryEvent(primaryText: string, candidateText: string): boolean {
  const tokens = (value: string) => new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9-]{5,}/g)?.filter((x) => !CLAIM_STOP.has(x)) ?? []);
  const primary = tokens(primaryText.slice(0, 1200)), candidate = tokens(candidateText);
  const overlap = Array.from(candidate).filter((token) => primary.has(token)).length;
  const signal = classifySignalKind(candidateText);
  const material = classifyMateriality(candidateText);
  return overlap >= 2 && (signal.can_trigger || material.level === "high");
}

function hasSufficientEvidence(decisions: EvidenceDecision[]): boolean {
  const accepted = decisions.filter((d) => d.accepted && ["confirmed", "high_confidence"].includes(d.entity_state));
  const hosts = new Set(accepted.map((d) => { try { return new URL(d.candidate.url).hostname.replace(/^www\./, ""); } catch { return ""; } }).filter(Boolean));
  return accepted.some((d) => d.commercial_relevance === "high" && !!d.candidate.publication_date)
    && hosts.size >= 2;
}

function evidenceRank(d: EvidenceDecision): number {
  return (d.entity_state === "confirmed" ? 4 : d.entity_state === "high_confidence" ? 3 : 1)
    + (d.source_tier === "A" ? 4 : d.source_tier === "B" ? 3 : 0)
    + (d.commercial_relevance === "high" ? 3 : d.commercial_relevance === "medium" ? 1 : 0)
    + (d.candidate.publication_date ? 2 : 0);
}

async function productiveProviders(): Promise<SearchProvider[]> {
  const { braveProvider, tavilyProvider } = await import("@/lib/sources/access/providers");
  // Serper is intentionally excluded from Account Deepening while its plan is
  // exhausted. Credential presence is not provider availability; repeated 400s
  // must not consume per-account budgets or latency.
  const candidates = [braveProvider, tavilyProvider];
  const health = await Promise.all(candidates.map(async (provider) => ({ provider, health: await provider.health().catch(() => null) })));
  return health.filter((x) => x.health?.status === "available").map((x) => x.provider);
}

async function defaultExtract(url: string): Promise<{ ok: boolean; content: string | null }> {
  const { extractWithFallback } = await import("@/lib/sources/access/extractors");
  const result = await extractWithFallback(url);
  return { ok: result.ok, content: result.content };
}

/** Select event-bearing windows from long HTML/markdown instead of spending the
 * model/extractor budget on headers, cookie banners or navigation. */
export function relevantContentWindow(raw: string, terms: string[], maxChars = 9000): string {
  const clean = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const needles = [
    ...terms.flatMap((term) => term.toLowerCase().split(/\s+/).filter((token) => token.length >= 4)),
    "opened", "opens", "expansion", "expanded", "facility", "plant", "distribution center", "investment", "capacity", "inaugur", "apertura", "expansión", "inversión",
  ];
  const lower = clean.toLowerCase();
  const positions = Array.from(new Set(needles.map((needle) => lower.indexOf(needle)).filter((index) => index >= 0))).sort((a, b) => a - b);
  if (!positions.length) return clean.slice(0, maxChars);
  const windows: string[] = [];
  for (const position of positions) {
    const start = Math.max(0, position - 900), end = Math.min(clean.length, position + 2300);
    const window = clean.slice(start, end);
    if (!windows.some((existing) => existing.includes(window.slice(0, 120)))) windows.push(window);
    if (windows.join(" ").length >= maxChars) break;
  }
  return windows.join(" … ").slice(0, maxChars);
}
