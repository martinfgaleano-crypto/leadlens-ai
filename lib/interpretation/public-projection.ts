// ─── Public interpretation projection (browser-safe) ─────────────────────────
//
// The narrow shape the client receives. It deliberately does NOT include prompts,
// provider metadata, internal diagnostics, raw claim provenance, or the full
// contract. It distinguishes WHAT YOU TOLD LEADLENS from WHAT LEADLENS INFERRED,
// and never implies external verification or that research ran.

import type { CompanyInterpretationV1 } from "./company-interpretation";
import type { InterpretMeta, InterpretResult } from "./interpret-service";

export type PublicInterpretationStatus =
  | "ready_for_confirmation"
  | "needs_clarification"
  | "unsupported_objective"
  | "draft";

export interface PublicInterpretation {
  status: PublicInterpretationStatus;
  /** true = a real interpretation of the user's own words (not a canned demo). */
  isReal: boolean;
  mode: InterpretMeta["mode"];
  /** WHAT YOU TOLD LEADLENS */
  told: {
    summary: string | null;
    offer: string | null;
    target: string[];
    geographies: string[];
    exclusions: string[];
  };
  /** WHAT LEADLENS INFERRED (never verified) */
  inferred: {
    objectiveLabel: string | null;
    objectiveType: string | null;
    relationship: string | null;
    businessModel: string | null;
    signalsToWatch: string[];      // hypotheses, not signals
    opportunityConditions: string[];
    /** Possible go-to-market approaches to EVALUATE — hypotheses, not
     *  recommendations, never specific markets/companies. */
    routesToEvaluate: string[];
  };
  /** Decision-relevant unknowns still to define. */
  gaps: string[];
  /** Still unclear */
  clarification: {
    question: string | null;
    priority: string | null;
  };
  /** Honest reason when the objective is out of scope. */
  unsupportedReason: string | null;
  disclosure: string;
}

const OBJECTIVE_LABEL: Record<string, string> = {
  win_customers: "Win new customers",
  business_development: "Business development",
  identify_high_value_accounts: "Identify high-value accounts",
  partnerships: "Find strategic partners",
  advisory_opportunities: "Find advisory opportunities",
};

const RELATIONSHIP_LABEL: Record<string, string> = {
  customer: "customers", client: "clients", partner: "partners", advisory_client: "advisory clients",
};

export function toPublicInterpretation(result: InterpretResult): PublicInterpretation {
  const { interpretation: i, meta } = result;
  const obj = i.commercialObjective;
  // Every path (LLM or deterministic) interprets the user's OWN words — none is a
  // canned demo answer — so the result is always a real interpretation of input.
  const isReal = true;
  const supported = obj.supported;

  return {
    status: statusOf(i),
    isReal,
    mode: meta.mode,
    told: {
      summary: i.companyContext.companyDescription?.value ?? null,
      offer: i.companyContext.offers[0]?.value.label ?? null,
      target: i.targetAccountProfile.organizationTypes,
      geographies: (i.targetAccountProfile.geographies ?? []).map((g) => g.label),
      exclusions: i.targetAccountProfile.exclusions ?? [],
    },
    inferred: {
      objectiveLabel: supported ? (OBJECTIVE_LABEL[obj.type] ?? obj.type) : null,
      objectiveType: supported ? obj.type : null,
      relationship: supported ? (RELATIONSHIP_LABEL[obj.targetRelationship] ?? obj.targetRelationship) : null,
      businessModel: i.companyContext.businessModel?.value ?? null,
      signalsToWatch: i.signalHypotheses.map((h) => h.relevanceToObjective),
      opportunityConditions: i.opportunityConditions.filter((c) => c.type === "change_trigger").map((c) => c.description),
      routesToEvaluate: meta.routesToEvaluate ?? [],
    },
    gaps: (meta.openGaps && meta.openGaps.length ? meta.openGaps : i.clarification.nonBlockingGaps.map((g) => g.reason)).slice(0, 4),
    clarification: {
      question: i.clarification.nextQuestion?.question ?? null,
      priority: i.clarification.blockers[0]?.priority ?? null,
    },
    unsupportedReason: !supported ? obj.reason : null,
    disclosure:
      i.interpretationStatus === "unsupported_objective"
        ? "Based on what you told us. LeadLens does not run this kind of search."
        : "Based on what you told us. No external account research has run yet.",
  };
}

function statusOf(i: CompanyInterpretationV1): PublicInterpretationStatus {
  switch (i.interpretationStatus) {
    case "unsupported_objective": return "unsupported_objective";
    case "needs_clarification": return "needs_clarification";
    case "ready_for_confirmation":
    case "confirmed": return "ready_for_confirmation";
    default: return "draft";
  }
}
