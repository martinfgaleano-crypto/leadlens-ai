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

export type ResearchDimension = "trigger" | "commercial_problem" | "buyer_function" | "mechanism" | "access" | "counterevidence";
// §4: VERIFIED > SUPPORTED > INFERRED > PLAUSIBLE > UNKNOWN > NOT_FOUND. "inferred"
// means organizational logic suggests it but direct evidence is absent — it must NEVER
// render or be treated as VERIFIED.
export type EvidenceState = "verified" | "supported" | "inferred" | "plausible" | "unknown" | "not_found";
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
  // C. Buyer / decision FUNCTION — researched BEFORE access (§18: understand who owns
  //    the problem before researching how to reach them). Distinct from mechanism/access.
  if (missing.buyerFunction) {
    objs.push(base({
      id: `${co}:buyer_function`, dimension: "buyer_function",
      question: `Which function at ${co} would OWN the ${customer.triggerFamily[0]}-driven problem relevant to ${customer.service} (${customer.buyerFunctionHints.slice(0, 2).join(" / ")})?`,
      whyItMatters: `The owning function anchors the commercial path; a senior name is not the same as the owning function.`,
      supportsIf: `A company/primary source assigning the relevant work to a named function (${customer.buyerFunctionHints.slice(0, 2).join(" / ")}).`,
      weakensIf: `The relevant work appears owned by a function inconsistent with ${customer.service}.`,
      query: `${co} ${customer.buyerFunctionHints.slice(0, 3).join(" OR ")} leadership proxy`,
    }));
  }
  // B. EXTERNAL commercial mechanism — how an EXTERNAL provider participates. NOT the
  //    account's own acquisition activity (§1/§54). Only meaningful if a trigger holds.
  if (missing.mechanism) {
    objs.push(base({
      id: `${co}:mechanism`, dimension: "mechanism",
      question: `Is there evidence ${co} uses EXTERNAL providers for ${customer.service} work (not its own acquisitions, not transaction bankers/lawyers)?`,
      whyItMatters: `The account having the problem ≠ it buying external help for it; only external-advisor evidence is a mechanism.`,
      supportsIf: `Disclosures/case studies naming external ${customer.mechanismHints[0]} or professional-services procurement for integration/transformation work.`,
      weakensIf: `Evidence the work is done strictly in-house, or only transaction (bank/legal) advisors are used.`,
      query: `${co} external ${customer.mechanismHints.slice(0, 3).join(" OR ")} consultant advisor`,
    }));
  }
  // D. Commercial ACCESS / validation route — how to enter/validate. NOT a person (§55).
  if (missing.access) {
    objs.push(base({
      id: `${co}:access`, dimension: "access",
      question: `Is there a legitimate route to VALIDATE or ENTER the commercial process at ${co} (professional-services procurement, corporate development, transformation office, partner program)?`,
      whyItMatters: `A commercial approach needs a route to the owning function, not a generic contact or LinkedIn profile.`,
      supportsIf: `A professional-services procurement route, corporate-development/transformation office, or partner program relevant to ${customer.service}.`,
      weakensIf: `Only a generic contact page, switchboard, or a goods-only supplier portal.`,
      query: `${co} professional services procurement vendor corporate development transformation office`,
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

  // 2) Buyer function → mechanism → access, ONLY if a current trigger holds (adaptive,
  //    §18: understand who owns the problem before how to reach them).
  for (const o of [...byDim("buyer_function"), ...byDim("mechanism"), ...byDim("access")]) {
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

// ─── Commercial Path guards (the mandatory semantic corrections §1/§39/§54/§55) ──

/** §54 (MANDATORY): the account's OWN acquisition / M&A activity is a TRIGGER, never
 *  evidence of an EXTERNAL commercial mechanism. A mechanism is SUPPORTED only by evidence
 *  the account engages EXTERNAL providers for the relevant (post-merger-integration /
 *  transformation / operational) work. §39: investment-bank / legal / financial
 *  TRANSACTION advisors do not establish a PMI mechanism. Pure; downgrades an inflated
 *  claim. `pmiService` lets the relevance test track the customer's actual service. */
export function mechanismStateFromEvidence(text: string, claimedState: EvidenceState): { state: EvidenceState; note: string } {
  const t = (text ?? "").toLowerCase();
  const externalAdvisor = /(engag|retain|hir(e|ed|ing)|use[sd]?|work(s|ed)? with|selected|appointed|partnered)[^.]{0,50}(consult|advisor|advisory|integration partner|implementation partner|professional[- ]services|system integrator|transformation partner)/.test(t)
    || /external (consult|advisor|advisory|integration|transformation|professional[- ]services)/.test(t);
  const pmiRelevant = /(post-?merger|\bintegration\b|transformation|operational|\bpmi\b|carve-?out|synergy)/.test(t);
  const onlyTransactionAdvisor = /(investment bank|financial advis|legal counsel|law firm|\bm&a advisor|underwrit)/.test(t) && !pmiRelevant;
  const onlyAcquisitionActivity = /(acquir|acquisition|bought|purchased|is an active acquirer|acquires)/.test(t) && !externalAdvisor;
  if (onlyAcquisitionActivity) return { state: "unknown", note: "Only the account's own acquisition activity — a trigger, not an external commercial mechanism." };
  if (onlyTransactionAdvisor) return { state: "unknown", note: "Only transaction advisors (bank/legal/financial) — not a post-merger-integration mechanism." };
  if (externalAdvisor && pmiRelevant) return { state: claimedState === "verified" ? "verified" : "supported", note: "External integration/transformation advisory evidence." };
  if (externalAdvisor) return { state: "plausible", note: "External advisory evidence; relevance to the customer's service not confirmed." };
  return { state: "not_found", note: "No external-mechanism evidence found." };
}

/** §55 (MANDATORY): a discoverable PERSON / generic contact surface is NOT commercial
 *  access. Access is SUPPORTED only by a legitimate route to VALIDATE or ENTER the
 *  relevant process; a named executive or contact page alone is at most INFERRED. Pure. */
export function accessStateFromEvidence(text: string, claimedState: EvidenceState): { state: EvidenceState; note: string } {
  const t = (text ?? "").toLowerCase();
  const route = /(vendor (on-?board|registration|portal|application)|supplier (registration|portal|diversity)|professional[- ]services (procure|vendor|panel)|\brfp\b|request for proposal|procure[^.]{0,25}(consult|advisor|services)|corporate development|transformation office|integration management office|partner (program|ecosystem)|advisor panel|preferred (vendor|supplier) list)/.test(t);
  const onlyPersonOrContact = /(linkedin|\bemail\b|phone|contact (us|form|page)|home ?page|switchboard|executive profile)/.test(t) && !route;
  if (route) return { state: claimedState === "verified" ? "verified" : "supported", note: "A legitimate commercial / validation route (procurement, corp-dev, or partner program)." };
  if (onlyPersonOrContact) return { state: "inferred", note: "Only a person or generic contact surface — not a validated commercial route." };
  return { state: "not_found", note: "No commercial access route established." };
}

/** Derive the bounded, customer-specific COMMERCIAL PROBLEM the trigger may create
 *  (§19). Fact→inference→unknown kept distinct; the inference is never stated as fact. */
export function deriveCommercialProblem(customer: ResearchCustomerContext, triggerSummary: string | null): string {
  if (!triggerSummary) return `No current ${customer.triggerFamily[0]} established, so no current commercial problem for ${customer.service} is indicated.`;
  return `A current ${customer.triggerFamily[0]} MAY create ${customer.service.replace(/ \(.*\)/, "")} work (inference, not confirmed); whether that work is active and whether external support is used remains unknown.`;
}
