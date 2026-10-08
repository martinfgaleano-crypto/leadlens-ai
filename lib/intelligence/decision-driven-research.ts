// ─── Decision-driven research (decision-driven-research-v1) ──────────────────
//
// The narrow mechanism the Decision-Driven Research P0 tests: take an account's
// decision-critical GAPS (from its canonical case + Path to Prioritize), turn them
// into a BOUNDED set of customer-context-specific research OBJECTIVES, research them
// ADAPTIVELY (trigger first; pursue mechanism/access only if a current trigger holds),
// and feed the grounded results back into the EXISTING decision authority
// (`synthesizeCase`) — never a new decision rule (§32).
//
// This is NOT a general autonomous research agent (§62). It is pure/deterministic
// except for the injected `research` dependency, which does the actual evidence
// fetching. Bounded, observable, fail-closed: an objective that cannot be grounded
// resolves to EVIDENCE_NOT_FOUND / PROVIDER_FAILURE, never to a fabricated answer.

import type { Strength } from "@/lib/deliverable/deliverable-view-model";
import type { CanonicalCaseInput } from "@/lib/monitor/canonical-case";

export const DECISION_DRIVEN_RESEARCH_VERSION = "decision-driven-research-v1";

export type ResearchDimension = "trigger" | "mechanism" | "buyer_function" | "access" | "counterevidence";
export type EvidenceState = "verified" | "supported" | "plausible" | "unknown" | "not_found";
export type ObjectiveStatus = "resolved" | "partial" | "evidence_not_found" | "provider_failure" | "skipped_adaptive" | "unattempted";

/** Customer-context inputs that make the research agenda SPECIFIC to this customer's
 *  service — not a generic company-research checklist (§36). Derived from the customer,
 *  never hardcoded to one account. */
export interface ResearchCustomerContext {
  service: string;                 // what the customer sells
  triggerFamily: string[];         // the commercial triggers that create demand for THIS service
  mechanismHints: string[];        // plausible commercial mechanisms for THIS service
  buyerFunctionHints: string[];    // functions that would own the problem for THIS service
  geography: string;
}

export interface ResearchObjective {
  id: string;
  dimension: ResearchDimension;
  question: string;                // customer-facing decision-critical question
  whyItMatters: string;
  supportsIf: string;              // evidence that would SUPPORT the opportunity
  weakensIf: string;               // evidence that would WEAKEN it (counterevidence prompt)
  query: string;                   // the targeted research query for the injected researcher
  status: ObjectiveStatus;
  state: EvidenceState;
  result: string | null;
  sources: Array<{ url: string | null; title: string | null; date: string | null }>;
  dated: string | null;            // dated evidence (ISO) when applicable
  changedDecision: boolean;
}

/** A grounded research result for one objective, returned by the injected researcher.
 *  `state: "not_found"` / a `failure` is a first-class honest outcome. */
export interface ResearchFinding {
  state: EvidenceState;
  result: string;
  sources: Array<{ url: string | null; title: string | null; date: string | null }>;
  dated?: string | null;
  failure?: "evidence_not_found" | "provider_failure" | null;
}

export interface ResearchAgendaInput {
  account: { company: string; domain: string | null };
  customer: ResearchCustomerContext;
  /** The decision-critical gaps for this account (missing dimensions). */
  missing: { trigger: boolean; mechanism: boolean; buyerFunction: boolean; access: boolean };
  /** Open decision-critical questions carried from the canonical case. */
  openDecisionCritical: string[];
  fit: Strength | null;
}

const MAX_OBJECTIVES = 5;

/** Derive a bounded, customer-context-specific research agenda from the decision gaps.
 *  Pure/deterministic. Always includes a counterevidence objective for the trigger. */
export function deriveResearchObjectives(input: ResearchAgendaInput): ResearchObjective[] {
  const { account, customer, missing } = input;
  const co = account.company;
  const trig = customer.triggerFamily.slice(0, 3).join(" OR ");
  const objs: ResearchObjective[] = [];
  const base = (o: Omit<ResearchObjective, "status" | "state" | "result" | "sources" | "dated" | "changedDecision">): ResearchObjective =>
    ({ ...o, status: "unattempted", state: "unknown", result: null, sources: [], dated: null, changedDecision: false });

  // A. Current trigger / why-now — always first (the opportunity gate).
  if (missing.trigger) {
    objs.push(base({
      id: `${co}:trigger`, dimension: "trigger",
      question: `Is there a current, dated ${customer.triggerFamily[0]} at ${co} that would create demand for ${customer.service}?`,
      whyItMatters: `Structural fit is not an opportunity; a current ${customer.triggerFamily[0]} is the "why now".`,
      supportsIf: `A dated, recent ${customer.triggerFamily[0]} (last ~18–24 months).`,
      weakensIf: `No such event, or the most recent one is old and the work appears complete.`,
      query: `${co} ${trig}`,
    }));
    // E. Counterevidence paired to the trigger (stale / already-complete / in-house).
    objs.push(base({
      id: `${co}:counter`, dimension: "counterevidence",
      question: `Does evidence suggest a ${customer.triggerFamily[0]} at ${co} is stale, already handled internally, or otherwise not a live opportunity for ${customer.service}?`,
      whyItMatters: `A skeptical buyer asks whether the trigger is old or handled in-house.`,
      supportsIf: `Nothing indicating the work is complete or internal.`,
      weakensIf: `The event is old, integration appears complete, or an in-house/incumbent capability is evident.`,
      query: `${co} ${customer.triggerFamily[0]} completed integration internal team`,
    }));
  }
  // B. Commercial mechanism — only meaningful if there is a reason to engage.
  if (missing.mechanism) {
    objs.push(base({
      id: `${co}:mechanism`, dimension: "mechanism",
      question: `How could ${customer.service} actually be sold into ${co} (${customer.mechanismHints.slice(0, 2).join(" / ")})?`,
      whyItMatters: `Fit without a route to do business is not actionable.`,
      supportsIf: `Evidence of ${customer.mechanismHints[0]} or an external-advisor engagement route.`,
      weakensIf: `Evidence the work is kept strictly in-house with no external route.`,
      query: `${co} ${customer.mechanismHints.slice(0, 3).join(" OR ")}`,
    }));
  }
  // C/D. Buyer function + access — combined objective (who owns it + how to enter).
  if (missing.buyerFunction || missing.access) {
    objs.push(base({
      id: `${co}:access`, dimension: "access",
      question: `Which function at ${co} would own this (${customer.buyerFunctionHints.slice(0, 2).join(" / ")}), and is there a legitimate route to reach it?`,
      whyItMatters: `A commercial approach needs the owning function and an entry route, not a generic contact.`,
      supportsIf: `A named/visible owning function and a public commercial or corporate-development route.`,
      weakensIf: `No identifiable owning function or route.`,
      query: `${co} ${customer.buyerFunctionHints.slice(0, 3).join(" OR ")} leadership`,
    }));
  }
  return objs.slice(0, MAX_OBJECTIVES);
}

/** Run the agenda adaptively and bounded. Trigger is researched first; mechanism/
 *  buyer/access are SKIPPED (skipped_adaptive) when no current trigger holds — we do
 *  not chase a route for an opportunity that does not currently exist (§18/§19). */
export async function runResearchAgenda(
  objectives: ResearchObjective[],
  deps: { research: (o: ResearchObjective) => Promise<ResearchFinding> },
): Promise<{ objectives: ResearchObjective[]; attempted: number; resolved: number; unresolved: number; triggerCurrent: boolean }> {
  const byDim = (d: ResearchDimension) => objectives.filter((o) => o.dimension === d);
  let attempted = 0;
  const apply = (o: ResearchObjective, f: ResearchFinding) => {
    o.state = f.state; o.result = f.result; o.sources = f.sources; o.dated = f.dated ?? null;
    o.status = f.failure === "provider_failure" ? "provider_failure"
      : f.failure === "evidence_not_found" || f.state === "not_found" ? "evidence_not_found"
      : f.state === "verified" || f.state === "supported" ? "resolved" : "partial";
  };

  // 1) Trigger + its counterevidence first.
  for (const o of [...byDim("trigger"), ...byDim("counterevidence")]) { attempted++; apply(o, await deps.research(o)); }
  const trigger = byDim("trigger")[0];
  const counter = byDim("counterevidence")[0];
  const triggerCurrent = Boolean(trigger && (trigger.state === "verified" || trigger.state === "supported") && Boolean(trigger.dated)
    && !(counter && (counter.state === "verified" || counter.state === "supported")));

  // 2) Mechanism + access ONLY if a current trigger holds (adaptive, §18).
  for (const o of [...byDim("mechanism"), ...byDim("access"), ...byDim("buyer_function")]) {
    if (!triggerCurrent) { o.status = "skipped_adaptive"; o.state = "unknown"; o.result = "Not researched: no current trigger established, so there is no live opportunity whose route is worth investigating yet."; continue; }
    attempted++; apply(o, await deps.research(o));
  }

  const resolved = objectives.filter((o) => o.status === "resolved").length;
  const unresolved = objectives.filter((o) => o.status === "evidence_not_found" || o.status === "provider_failure" || o.status === "partial").length;
  return { objectives, attempted, resolved, unresolved, triggerCurrent };
}

/** Map the researched objectives onto a fresh canonical-case input (better INPUTS to
 *  the existing authority, §32). Pure. The caller runs `synthesizeCase` on the result. */
export function applyFindingsToCaseInput(before: CanonicalCaseInput, objectives: ResearchObjective[]): CanonicalCaseInput {
  const dim = (d: ResearchDimension) => objectives.find((o) => o.dimension === d);
  const trigger = dim("trigger"), mechanism = dim("mechanism"), access = dim("access"), counter = dim("counterevidence");
  const triggerCurrent = Boolean(trigger && (trigger.state === "verified" || trigger.state === "supported") && trigger.dated);
  const counterMaterial = Boolean(counter && (counter.state === "verified" || counter.state === "supported"));
  const mechanismOk = Boolean(mechanism && (mechanism.state === "verified" || mechanism.state === "supported"));
  const accessOk = Boolean(access && (access.state === "verified" || access.state === "supported"));

  const open = new Set(before.openDecisionCritical);
  // Resolve/keep decision-critical questions based on what was established.
  if (triggerCurrent) open.delete(Array.from(open).find((q) => /why now|trigger|current/i.test(q)) ?? "");
  if (!mechanismOk && mechanism) open.add(`Confirm the commercial mechanism: ${mechanism.question}`);
  if (!accessOk && access) open.add(`Confirm the owning function and access route: ${access.question}`);

  // Source host from the grounded evidence (a dated trigger without a source cannot
  // clear the opportunity test). Prefer the trigger's source, then mechanism/access.
  const firstHost = ([trigger, mechanism, access].flatMap((o) => o?.sources ?? []).map((s) => s.url).find((u): u is string => Boolean(u)));
  let sourceHost = before.sourceHost;
  if (triggerCurrent && firstHost) { try { sourceHost = new URL(firstHost).host; } catch { /* keep prior */ } }

  return {
    ...before,
    sourceHost,
    // A current, dated trigger is the material event + timing signal.
    materialEvent: triggerCurrent || before.materialEvent,
    signalKind: triggerCurrent ? (trigger!.dimension) : before.signalKind,
    signalDate: triggerCurrent ? (trigger!.dated ?? before.signalDate) : before.signalDate,
    dateConfidence: triggerCurrent ? "high" : before.dateConfidence,
    hasPostReviewEvent: triggerCurrent || before.hasPostReviewEvent,
    hasMaterialCounter: counterMaterial || before.hasMaterialCounter,
    // A verified mechanism + access is channel access; a current trigger with a plausible
    // (not verified) route is a strategic route to VALIDATE — never asserted as access.
    channelAccessVerified: (mechanismOk && accessOk) || before.channelAccessVerified,
    currentActionabilityVerified: (mechanismOk && accessOk) || before.currentActionabilityVerified,
    strategicRouteValidatable: (triggerCurrent && !(mechanismOk && accessOk)) || before.strategicRouteValidatable,
    openDecisionCritical: Array.from(open).filter(Boolean),
  };
}
