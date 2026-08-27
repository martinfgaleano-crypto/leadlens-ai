// ─── Delta research plan + temporal delta-evidence classification ─────────────
//
// Monitor does NOT rerun broad initial research. From the previous accepted Case
// it builds a targeted MonitorReviewPlan (what could materially change the Case),
// then classifies re-observations against a strict temporal cutoff. This is where
// the temporal-integrity doctrines live: retrieval date ≠ event date, publication
// date ≠ event date, rediscovered ≠ new, two URLs ≠ independent, aging ≠
// counterevidence.

import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";
import type { MonitorableAccountIdentity } from "@/lib/deliverable/account-memory";
import type { MonitoredAccountState } from "./monitor-eligibility";
import { EVIDENCE_FRESHNESS_DAYS } from "./monitor-config";

const DAY_MS = 86_400_000;
const kindOf = (changeKey: string): string => changeKey.split(":")[0];

export interface MonitorReviewPlan {
  accountId: string;
  identity: MonitorableAccountIdentity;
  identityRequiresValidation: boolean;
  since: { previousReviewId: string; previousReviewedAt: string; contextVersion: string };
  focusValidationKeys: string[];
  revisitTriggerActive: boolean;
  watchSignalFamilies: string[];
  knownOrigins: string[];
  knownChangeKeys: string[];
  /** Conceptual research THEMES (not provider query strings). */
  routeThemes: string[];
}

/** Build a targeted plan from the previous accepted Case. Deterministic. */
export function planMonitorReview(state: MonitoredAccountState, prior: AccountReviewSnapshot): MonitorReviewPlan {
  const families = Array.from(new Set(prior.changeKeys.map(kindOf).filter(Boolean)));
  const themes: string[] = [];
  // Decision-critical unknowns drive the most targeted themes.
  for (const k of state.unresolvedDecisionCritical) themes.push(`resolve:${k}`);
  for (const f of families) themes.push(`change:${f}`);
  if (prior.hasRevisitTrigger) themes.push("revisit_trigger");
  if (themes.length === 0) themes.push("case_freshness");
  return {
    accountId: state.accountId,
    identity: state.identity,
    identityRequiresValidation: state.identity.confidence === "ambiguous" || !state.identity.canonicalName,
    since: { previousReviewId: prior.reviewId, previousReviewedAt: prior.reviewedAt, contextVersion: prior.contextVersion },
    focusValidationKeys: state.unresolvedDecisionCritical,
    revisitTriggerActive: prior.hasRevisitTrigger,
    watchSignalFamilies: families,
    knownOrigins: prior.evidenceOrigins,
    knownChangeKeys: prior.changeKeys,
    routeThemes: Array.from(new Set(themes)),
  };
}

// ─── Re-observation contract (DI — the real re-observer reuses provider arch) ──

export interface ObservedItem {
  sourceHost: string;
  sourceUrl?: string;
  /** Wire/press-release/company-statement id. Same origin ⇒ NOT independent. */
  originId?: string | null;
  kind: string;
  eventDate?: string | null;
  publicationDate?: string | null;
  retrievedAt: string;
  isDatedMaterialEvent: boolean;
  relevantToCase: boolean;
  resolvesValidationKey?: string | null;
  isCounterevidence?: boolean;
}

export interface AccountObservation {
  accountId: string;
  items: ObservedItem[];
  providersAvailable: string[];
  providersFailed: string[];
  routesAttempted: number;
  operatingMode: "full" | "degraded" | "stopped";
  queryIdentities?: string[];
  metrics?: {
    searchResultsConsidered: number;
    pagesEscalated: number;
    pagesFetched: number;
    fetchFailures: number;
    llmExtractionCalls: number;
    claimsProposed: number;
    eventsProposed: number;
    eventsAccepted: number;
    temporalRejects: number;
    materialityRejects: number;
  };
}

export type DeltaDisposition =
  | "accepted_new"                 // NEW dated material event AFTER the cutoff (true external change)
  | "newly_discovered_historical"  // dated material event BEFORE the cutoff, not previously known
  | "rediscovered"                 // same canonical event already in the prior Case
  | "rejected_temporal"            // no defensible event date
  | "rejected_duplicate"
  | "contextual_only";

export interface ClassifiedItem { item: ObservedItem; disposition: DeltaDisposition; changeKey?: string; reason: string }

export interface AcceptedEvent {
  changeKey: string;
  kind: string;
  eventDate: string;
  origins: string[];
  independentSupport: boolean;
  isCounterevidence: boolean;
}

export interface DeltaEvidenceResult {
  classified: ClassifiedItem[];
  counters: { discovered: number; accepted_new: number; newly_discovered_historical: number; rediscovered: number; rejected_temporal: number; rejected_duplicate: number; contextual_only: number };
  /** True EXTERNAL changes after the cutoff → drive What Changed / new changeKeys. */
  acceptedEvents: AcceptedEvent[];
  /** Newly discovered HISTORICAL events (before cutoff) → new Evidence only, NEVER
   *  "the account changed since last review". */
  historicalEvidence: AcceptedEvent[];
  newChangeKeys: string[];
  newOrigins: string[];
  resolvedValidationKeys: string[];
  hasMaterialCounter: boolean;
  freshnessGap: boolean;
}

/**
 * Classify each observation against the plan's temporal cutoff and known state.
 * The event date is ONLY item.eventDate — never retrievedAt, never publicationDate.
 * Publication newer than the event does not make an old event "new".
 */
export function classifyDelta(plan: MonitorReviewPlan, obs: AccountObservation, now: Date): DeltaEvidenceResult {
  const cutoff = new Date(plan.since.previousReviewedAt).getTime();
  const known = new Set(plan.knownChangeKeys);
  const knownOrigins = new Set(plan.knownOrigins.map((h) => h.toLowerCase()));
  const classified: ClassifiedItem[] = [];
  type Grp = { kind: string; eventDate: string; origins: Set<string>; originIds: Set<string>; isCounter: boolean };
  const acceptedByKey = new Map<string, Grp>();
  const historicalByKey = new Map<string, Grp>();
  const addTo = (m: Map<string, Grp>, changeKey: string, item: ObservedItem, eventDate: string) => {
    const g = m.get(changeKey) ?? { kind: item.kind, eventDate, origins: new Set<string>(), originIds: new Set<string>(), isCounter: false };
    g.origins.add(item.sourceHost.toLowerCase());
    if (item.originId) g.originIds.add(item.originId);
    if (item.isCounterevidence) g.isCounter = true;
    m.set(changeKey, g);
  };

  for (const item of obs.items) {
    // 1. Not a dated material event (static page / metric) → contextual only.
    if (!item.isDatedMaterialEvent || !item.relevantToCase) {
      classified.push({ item, disposition: "contextual_only", reason: !item.isDatedMaterialEvent ? "not a dated material event" : "not relevant to the current Case" });
      continue;
    }
    // 2. Event date is REQUIRED and is item.eventDate only. Publication/retrieval
    //    never substitute for it.
    const eventDate = item.eventDate ?? null;
    if (!eventDate) {
      classified.push({ item, disposition: "rejected_temporal", reason: "no defensible event date (retrieval/publication date is not the event date)" });
      continue;
    }
    const changeKey = `${item.kind}:${eventDate}`;
    const et = new Date(eventDate).getTime();
    // 3. Already known → rediscovered (new retrieval time is not novelty).
    if (known.has(changeKey)) {
      classified.push({ item, disposition: "rediscovered", changeKey, reason: "same canonical event already in the prior accepted Case" });
      continue;
    }
    // 4. Event predates the cutoff and was NOT previously known → newly discovered
    //    HISTORICAL information: new Evidence, but NOT a change since last review.
    if (et <= cutoff) {
      classified.push({ item, disposition: "newly_discovered_historical", changeKey, reason: "material event predates the previous review but was not previously known (new evidence, not new external change)" });
      addTo(historicalByKey, changeKey, item, eventDate);
      continue;
    }
    // 5. Accepted new material event after the cutoff (true external change).
    classified.push({ item, disposition: "accepted_new", changeKey, reason: "new dated material event after the previous review" });
    addTo(acceptedByKey, changeKey, item, eventDate);
  }

  const toEvents = (m: Map<string, Grp>): AcceptedEvent[] => Array.from(m.entries()).map(([changeKey, g]) => ({
    changeKey, kind: g.kind, eventDate: g.eventDate,
    origins: Array.from(g.origins),
    // Independent support requires ≥2 DISTINCT origin ids (same wire/press release
    // reproduced by two outlets is ONE origin, not independent corroboration).
    independentSupport: g.originIds.size >= 2,
    isCounterevidence: g.isCounter,
  }));
  const acceptedEvents = toEvents(acceptedByKey);
  const historicalEvidence = toEvents(historicalByKey);

  const counters = {
    discovered: obs.items.length,
    accepted_new: classified.filter((c) => c.disposition === "accepted_new").length,
    newly_discovered_historical: classified.filter((c) => c.disposition === "newly_discovered_historical").length,
    rediscovered: classified.filter((c) => c.disposition === "rediscovered").length,
    rejected_temporal: classified.filter((c) => c.disposition === "rejected_temporal").length,
    rejected_duplicate: classified.filter((c) => c.disposition === "rejected_duplicate").length,
    contextual_only: classified.filter((c) => c.disposition === "contextual_only").length,
  };

  // What Changed / new changeKeys come ONLY from true post-review external events.
  const newChangeKeys = acceptedEvents.map((e) => e.changeKey);
  // New Evidence origins may come from post-review events AND newly discovered
  // historical evidence (both add support), minus already-known origins.
  const newOrigins = Array.from(new Set([...acceptedEvents, ...historicalEvidence].flatMap((e) => e.origins))).filter((h) => !knownOrigins.has(h));
  // A decision-critical validation can be resolved by a NEW post-review event OR
  // by newly discovered historical evidence (both are grounded new evidence).
  const resolvedValidationKeys = Array.from(new Set(
    obs.items.filter((i) => {
      if (!i.resolvesValidationKey || !plan.focusValidationKeys.includes(i.resolvesValidationKey)) return false;
      const disp = classified.find((c) => c.item === i)?.disposition;
      return disp === "accepted_new" || disp === "newly_discovered_historical";
    }).map((i) => i.resolvesValidationKey as string),
  ));
  const hasMaterialCounter = acceptedEvents.some((e) => e.isCounterevidence);

  // Aging ALONE is not counterevidence — only a freshness gap that may motivate a
  // validate/next review. It applies only when nothing new was accepted.
  const ageDays = (now.getTime() - cutoff) / DAY_MS;
  const freshnessGap = counters.accepted_new === 0 && ageDays > EVIDENCE_FRESHNESS_DAYS;

  return { classified, counters, acceptedEvents, historicalEvidence, newChangeKeys, newOrigins, resolvedValidationKeys, hasMaterialCounter, freshnessGap };
}
