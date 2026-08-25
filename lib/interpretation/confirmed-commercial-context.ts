// ─── Confirmed Commercial Context V1 — the Stage A → Stage B execution config ──
//
// CompanyInterpretationV1 is DRAFT: it carries ambiguity, provenance,
// clarification, contradictions, unsupported objectives and unconfirmed
// inference. It is NOT what LeadLens should execute.
//
// ConfirmedCommercialContextV1 is the STABLE, user-approved execution
// configuration derived from a confirmed interpretation. It is the object a
// future execution adapter will translate into canonical LeadLens execution
// structures (and, for presentation, project down to CommercialContextVM /
// DeliverableViewModel). It is deliberately smaller and calmer than the draft:
// no clarification state, no contradictions, no unconfirmed inference paths.
//
// This file is TYPES + a PURE confirmation GATE. It does NOT:
//   • call any research provider or LLM,
//   • run any pipeline or discover any account,
//   • persist anything, or
//   • wire into real execution.
// The execution adapter (Phase 3) is intentionally left as a documented boundary
// (see `EXECUTION_ADAPTER_BOUNDARY`), not implemented.

import type {
  CompanyInterpretationV1,
  CommercialObjectiveDraft,
  CompanyContext,
  TargetAccountProfileDraft,
  OpportunityCondition,
  SignalHypothesis,
  Disqualifier,
  QualificationConstraint,
} from "./company-interpretation";
import { stageAViolations, hasBlockers } from "./company-interpretation";

export const CONFIRMED_COMMERCIAL_CONTEXT_SCHEMA_VERSION = "1" as const;

/** Only a SUPPORTED, user-confirmed objective can reach execution config. */
export type ConfirmedObjective = Extract<CommercialObjectiveDraft, { supported: true }>;

export interface ConfirmedCommercialContextV1 {
  schemaVersion: typeof CONFIRMED_COMMERCIAL_CONTEXT_SCHEMA_VERSION;

  contextId: string;
  version: number;
  /** Versioning: a customer changing its target market is a NEW context version,
   *  distinct from an account's situation changing. Historical intelligence can
   *  later record which context version produced it. */
  effectiveFrom: string; // ISO
  supersedes?: { contextId: string; version: number };

  clientId?: string;

  objective: ConfirmedObjective;
  companyProfile: CompanyContext;
  targetAccountProfile: TargetAccountProfileDraft;
  opportunityConditions: OpportunityCondition[];
  disqualifiers: Disqualifier[];
  signalHypotheses: SignalHypothesis[];
  qualificationConstraints: QualificationConstraint[];

  confirmedAt: string; // ISO
  /** Human-readable summary of where this context came from (provenance roll-up),
   *  so downstream never mistakes user context for external verification. */
  provenanceSummary: string;

  illustrative?: boolean;
}

// ─── Execution readiness (§14) ────────────────────────────────────────────────
//
// The MINIMUM usable context before Stage B may execute. Deliberately does NOT
// require buyer persona, economics, exact size, stakeholder map, a detailed
// signal taxonomy, or named accounts — those improve intelligence without
// blocking it.

export interface ExecutionReadiness {
  ready: boolean;
  missing: string[];
}

// A target is "defined enough to execute" when descriptors are present OR the
// target is legitimately DISCOVERY-REQUIRED (the user need not know it — LeadLens
// would discover the universe; §5/§7 outcome B). It is NOT ready only when the
// target is unknown AND no discovery configuration exists.
const targetAccountDefined = (t: TargetAccountProfileDraft): boolean =>
  (t.organizationTypes?.length ?? 0) > 0 ||
  (t.industries?.length ?? 0) > 0 ||
  (t.namedAccounts?.length ?? 0) > 0 ||
  t.definitionStatus === "discovery_required";

export function executionReadiness(interp: CompanyInterpretationV1): ExecutionReadiness {
  const missing: string[] = [];

  // 1. Supported, present commercial objective.
  if (!interp.commercialObjective.supported) missing.push("commercial_objective_supported");

  // 2. A target account DEFINITION (descriptors — not discovered accounts).
  if (!targetAccountDefined(interp.targetAccountProfile)) missing.push("target_account_definition");

  // 3. Geography ONLY where materially necessary — a blocker gap tagged
  //    "geography" means the interpretation itself judged it material.
  if (interp.clarification.blockers.some((b) => b.priority === "geography")) missing.push("geography_where_material");

  // 4. At least one usable opportunity condition OR qualification constraint.
  if (interp.opportunityConditions.length === 0 && interp.constraints.length === 0) {
    missing.push("opportunity_condition_or_qualification");
  }

  // 5. Outstanding blockers always keep context out of execution.
  if (hasBlockers(interp)) missing.push("open_blockers");

  // Truth-boundary violations are never execution-ready.
  if (stageAViolations(interp).length > 0) missing.push("truth_boundary_violation");

  return { ready: missing.length === 0, missing };
}

// ─── Confirmation gate (Stage A → Stage B) ────────────────────────────────────

export type ConfirmationResult =
  | { ok: true; context: ConfirmedCommercialContextV1 }
  | { ok: false; reason: string; missing: string[] };

export interface ConfirmationOptions {
  contextId: string;
  version?: number;
  clientId?: string;
  effectiveFrom?: string;
  supersedes?: { contextId: string; version: number };
}

/**
 * PURE gate: produce a ConfirmedCommercialContextV1 from a confirmed
 * interpretation — or refuse. This is the ONLY doorway from Stage A to Stage B
 * config, and it refuses whenever:
 *   • the objective is unsupported,
 *   • blockers remain,
 *   • the interpretation is not confirmed / ready,
 *   • it is not execution-ready, or
 *   • any truth-boundary violation exists.
 *
 * It does NOT execute Stage B; it only produces the configuration Stage B would
 * later consume. No provider, no pipeline, no persistence.
 */
export function confirmInterpretation(
  interp: CompanyInterpretationV1,
  opts: ConfirmationOptions,
): ConfirmationResult {
  if (!interp.commercialObjective.supported) {
    return { ok: false, reason: "unsupported_objective", missing: ["commercial_objective_supported"] };
  }
  if (interp.interpretationStatus !== "confirmed" && interp.interpretationStatus !== "ready_for_confirmation") {
    return { ok: false, reason: `interpretation not confirmable (status=${interp.interpretationStatus})`, missing: ["confirmation"] };
  }
  const readiness = executionReadiness(interp);
  if (!readiness.ready) {
    return { ok: false, reason: "not_execution_ready", missing: readiness.missing };
  }

  const objective = interp.commercialObjective; // narrowed to supported above
  const confirmedAt = interp.confirmation?.confirmedAt ?? new Date(interp.source.submittedAt).toISOString();

  const context: ConfirmedCommercialContextV1 = {
    schemaVersion: CONFIRMED_COMMERCIAL_CONTEXT_SCHEMA_VERSION,
    contextId: opts.contextId,
    version: opts.version ?? 1,
    effectiveFrom: opts.effectiveFrom ?? confirmedAt,
    supersedes: opts.supersedes,
    clientId: opts.clientId,
    objective,
    companyProfile: interp.companyContext,
    targetAccountProfile: interp.targetAccountProfile,
    opportunityConditions: interp.opportunityConditions,
    disqualifiers: interp.disqualifiers,
    signalHypotheses: interp.signalHypotheses,
    qualificationConstraints: interp.constraints,
    confirmedAt,
    provenanceSummary:
      "Derived from user-confirmed Company Interpretation. Contains USER CONTEXT and SYSTEM INFERENCE only — no externally verified facts, signals or evidence.",
    illustrative: interp.illustrative,
  };
  return { ok: true, context };
}

// ─── Execution adapter boundary ───────────────────────────────────────────────
//
// The adapter that translates ConfirmedCommercialContextV1 into the canonical
// LeadLens execution commercial context now lives in `execution-context-adapter`
// (adaptConfirmedContext / adaptInterpretation). It is where Stage B begins, and
// it keeps these rules (enforced by execution-context-adapter.test.ts):
//   • no raw prose dependency,
//   • no USER_CONTEXT entering the Evidence path as fact,
//   • no query generation (owned downstream),
//   • no anonymous Account Memory writes,
//   • real research only AFTER this confirmation gate has passed.
export const EXECUTION_ADAPTER_BOUNDARY =
  "ConfirmedCommercialContextV1 → adaptConfirmedContext (execution-context-adapter) → canonical CommercialContext." as const;
