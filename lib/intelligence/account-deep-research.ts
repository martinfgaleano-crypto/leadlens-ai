import type { LeadCandidate, LeadSearchCriteria } from "@/types";
import {
  assessEvidenceCandidate,
  buildResearchProfile,
  planAccountResearch,
  recoverAtomicClaims,
  type EvidenceCandidate,
  type EvidenceDecision,
  type PlannedResearchQuery,
} from "./research-quality";
import { buildClientContext } from "./evidence-temporal";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";

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
  claims_recovered: number;
  counterevidence_checked: boolean;
  early_stop_reason: "sufficient_evidence" | "no_material_event" | "budget_exhausted" | "providers_unavailable";
  query_audit: Array<{ query_id: string; stage: string; provider: string; results: number; accepted: number }>;
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
  const plan = planAccountResearch(profile, context, deps.maxQueries ?? 5, criteria.buying_signals);
  const providers = deps.providers ?? await productiveProviders();
  const extract = deps.extract ?? defaultExtract;
  const seen = new Set<string>();
  const decisions: EvidenceDecision[] = [];
  const contexts: Array<{ text: string; rank: number }> = [];
  const validatedEvents: AccountDeepResearchResult["validated_events"] = [];
  const queryAudit: AccountDeepResearchTelemetry["query_audit"] = [];
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
        const decision = assessEvidenceCandidate(profile, evidence, seen);
        decisions.push(decision);
        seen.add(evidence.canonical_url);
        if (!decision.accepted) continue;
        acceptedForQuery++;
        let fullText = "";
        // Full-text budget belongs to plausible EVENTS, not identity/profile
        // pages. Identity evidence still remains accepted and auditable.
        if (pagesExtracted < maxExtractions && decision.commercial_relevance === "high") {
          const fetched = await extract(item.url).catch(() => ({ ok: false, content: null }));
          if (fetched.ok && fetched.content) {
            pagesExtracted++; fullText = relevantContentWindow(fetched.content, [candidate.company, ...criteria.buying_signals], 9000);
            try {
              const { extractEvent } = await import("@/lib/monitor/event-extraction");
              const { scrapeEventDatePhrase } = await import("@/lib/monitor/full-text-extraction");
              const sourceHost = new URL(item.url).hostname.replace(/^www\./, "").toLowerCase();
              const titleAndContent = `${item.title ?? ""}. ${fullText}`;
              const event = extractEvent({
                accountId: candidate.company, sourceHost, sourceUrl: item.url, originId: null,
                titleAndContent, eventDateRaw: scrapeEventDatePhrase(fullText),
                publicationDate: item.published_date, retrievedAt: item.retrieved_at,
              }, criteria.buying_signals).item;
              if (event.isDatedMaterialEvent && event.eventDate) validatedEvents.push({ url: item.url, source_host: sourceHost, kind: event.kind, event_date: event.eventDate, title_and_content: titleAndContent.slice(0, 2500) });
              else if (structuredExtractionCalls < 2) {
                // Existing canonical structured extractor proposes only. Its
                // proposals still pass event/date/materiality gates below.
                const { extractStructured, proposalsToObservedItems } = await import("@/lib/monitor/claim-event-extractor");
                const structured = await extractStructured(fullText, candidate.company);
                structuredExtractionCalls += structured.calls;
                if (structured.result) {
                  const proposed = proposalsToObservedItems(structured.result.events, {
                    sourceHost, sourceUrl: item.url, publicationDate: item.published_date, retrievedAt: item.retrieved_at, accountId: candidate.company,
                  }, criteria.buying_signals);
                  for (const proposedEvent of proposed) if (proposedEvent.isDatedMaterialEvent && proposedEvent.eventDate) {
                    validatedEvents.push({ url: item.url, source_host: sourceHost, kind: proposedEvent.kind, event_date: proposedEvent.eventDate, title_and_content: titleAndContent.slice(0, 2500) });
                  }
                }
              }
            } catch { /* deterministic event validation remains best-effort */ }
          }
          else extractionFailures++;
        }
        contexts.push({
          text: `${item.published_date ? `[${item.published_date}] ` : ""}${item.title ?? ""}. ${fullText || item.snippet || ""} (source: ${item.url})`,
          rank: evidenceRank(decision) + (query.stage === "current_activity" ? 5 : query.stage === "counterevidence" ? 4 : 0),
        });
      }
      queryAudit.push({ query_id: query.query_id, stage: query.stage, provider: provider.id, results: response.results.length, accepted: acceptedForQuery });
      // Counterevidence is mandatory. Even two-source positive evidence cannot
      // stop the plan before the bounded counterevidence stage has run.
      if (query.stage === "counterevidence" && hasSufficientEvidence(decisions)) break outer;
    }
    if (query.stage === "counterevidence" && !decisions.some((d) => d.accepted && d.commercial_relevance === "high" && !!d.candidate.publication_date)) {
      stoppedNoEvent = true;
      break;
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
    counterevidence_checked: queryAudit.some((q) => q.stage === "counterevidence"),
    early_stop_reason: hasSufficientEvidence(decisions) ? "sufficient_evidence" : stoppedNoEvent ? "no_material_event" : providers.length === 0 || providerCalls === providerFailures ? "providers_unavailable" : "budget_exhausted",
    query_audit: queryAudit,
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
