// ─── Company Interpretation V1 — Stage A ingestion contract ───────────────────
//
// PURPOSE
// This is the INGESTION contract for LeadLens "Company Interpretation" (Stage A):
// it turns a customer's free description of their business + commercial intent
// into a STRUCTURED, PROVENANCED, CONFIRMABLE commercial context that can later
// configure LeadLens intelligence execution (Stage B).
//
// HARD TRUTH BOUNDARIES (enforced by validators below + tests):
//   • MEMORY ≠ EVIDENCE. USER CONTEXT ≠ VERIFIED FACT.
//   • USER CONFIRMATION ≠ EXTERNAL VERIFICATION.
//   • INTERPRETATION (Stage A) ≠ INTELLIGENCE EXECUTION (Stage B).
//   • SIGNAL HYPOTHESIS ≠ SIGNAL. LLM OUTPUT ≠ PRODUCT TRUTH.
//
// Stage A MAY produce: USER_CONTEXT, SYSTEM_INFERENCE, CONFIGURATION,
// SIGNAL_HYPOTHESIS. Stage A MUST NEVER produce: FACT, SIGNAL, EVIDENCE,
// ACCOUNT_FIT, FINAL_TIMING, ACCOUNT_DECISION, ACCOUNT_RANK, or any
// EXTERNAL_VERIFICATION. It configures research; it never creates account
// intelligence.
//
// This file is TYPES + PURE VALIDATORS only. No LLM, no providers, no network,
// no persistence, no account discovery. The eventual guarded LLM interpretation
// service (Phase 2) and confirmation/execution adapter (Phase 3) are NOT built
// here — this contract exists so that later implementation cannot contaminate
// LeadLens intelligence.
//
// REUSE (no parallel ontology):
//   • SignalFamily / SIGNAL_FAMILIES — canonical, from lib/discovery/needs-map.
//   • LandingInterpretationLocale — canonical input-language set.
//   • The truth vocabulary is aligned with lib/intelligence/os-contracts
//     (CLAIM_KINDS: fact | signal | inference | hypothesis | …): Stage A only
//     ever corresponds to the "inference"/"hypothesis" side — never "fact" or
//     "signal", which require external observation Stage A does not perform.

import type { SignalFamily } from "@/lib/discovery/needs-map";
import { SIGNAL_FAMILIES } from "@/lib/discovery/needs-map";
import type { LandingInterpretationLocale } from "@/lib/landing/landing-interpretation";

export const COMPANY_INTERPRETATION_SCHEMA_VERSION = "1" as const;

// ─── Provenance: where a claim came from and how sure we are it is TRUE ────────

/** How a piece of interpreted context entered the system. */
export const CONTEXT_ORIGINS = ["user_input", "user_edit", "llm_interpretation", "system_normalization"] as const;
export type ContextOrigin = (typeof CONTEXT_ORIGINS)[number];

/**
 * Verification status describes how confident we are that a claim is TRUE ABOUT
 * THE WORLD — NOT how confidently text maps to configuration.
 *
 * Stage A can only ever reach up to "user_confirmed" or "inferred". Only Stage B
 * intelligence execution (real retrieval + corroboration) can ever assign
 * "externally_verified". The split is the whole point: the system must always be
 * able to distinguish "the customer says X" from "LeadLens verified X".
 */
export const STAGE_A_VERIFICATION_STATUSES = ["user_stated", "user_confirmed", "inferred"] as const;
export type StageAVerificationStatus = (typeof STAGE_A_VERIFICATION_STATUSES)[number];
export type VerificationStatus = StageAVerificationStatus | "externally_verified";

/** The part of the interpretation a claim describes. */
export const CONTEXT_SCOPES = ["customer_company", "commercial_objective", "target_account", "qualification"] as const;
export type ContextScope = (typeof CONTEXT_SCOPES)[number];

export interface ContextSourceRef {
  inputId: string;
  /** Verbatim span of raw input this claim was read from, when available. */
  textSpan?: string;
}

/** A single interpreted claim carrying its own provenance. */
export interface ContextClaim<T> {
  value: T;
  origin: ContextOrigin;
  sourceRef?: ContextSourceRef;
  /** ids of other claims this was derived from (for inference chains). */
  derivedFrom?: string[];
  verificationStatus: VerificationStatus;
  scope: ContextScope;
  recordedAt: string; // ISO
}

// ─── Commercial objective (controlled scope) ──────────────────────────────────

/** The relationship LeadLens is helping the customer build with target orgs. */
export const TARGET_RELATIONSHIPS = ["customer", "client", "partner", "advisory_client"] as const;
export type TargetRelationship = (typeof TARGET_RELATIONSHIPS)[number];

/** Commercial objectives LeadLens supports at launch. Deliberately small. */
export const SUPPORTED_OBJECTIVE_TYPES = [
  "win_customers",
  "business_development",
  "identify_high_value_accounts",
  "partnerships",
  "advisory_opportunities",
] as const;
export type SupportedObjectiveType = (typeof SUPPORTED_OBJECTIVE_TYPES)[number];

/** Objectives explicitly OUT of scope for launch. Represented honestly — never
 *  silently normalized into a supported objective. */
export const UNSUPPORTED_OBJECTIVE_TYPES = [
  "investors",
  "m_and_a",
  "acquisition_target",
  "procurement",
  "hiring",
  "generic_research",
  "competitive_intelligence",
] as const;
export type UnsupportedObjectiveType = (typeof UNSUPPORTED_OBJECTIVE_TYPES)[number];

export type CommercialObjectiveDraft =
  | {
      supported: true;
      type: SupportedObjectiveType;
      description: string;
      targetRelationship: TargetRelationship;
      successCondition?: string;
      userConfirmed: boolean;
    }
  | {
      supported: false;
      /** Best guess at what the user actually asked for (or "unknown"). */
      requestedType: UnsupportedObjectiveType | "unknown";
      rawObjective: string;
      /** Honest, user-facing reason LeadLens does not serve this today. */
      reason: string;
    };

// ─── Business model / company context ─────────────────────────────────────────

export const BUSINESS_MODELS = ["software", "services", "product", "distribution", "platform", "other"] as const;
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

export interface OfferDefinition {
  label: string;
  description?: string;
}

export interface CompanyContext {
  companyDescription?: ContextClaim<string>;
  businessModel?: ContextClaim<BusinessModel>;
  offers: ContextClaim<OfferDefinition>[];
  capabilities: ContextClaim<string>[];
}

// ─── Target account profile (DESCRIPTORS, not discovered accounts) ────────────

export interface GeographyScope {
  label: string;
  /** Optional normalized region key (kept loose — geo taxonomy is not owned here). */
  regionKey?: string;
}

/**
 * Whether the target organization universe is KNOWN or must be DISCOVERED.
 *   • "defined"            — the user stated a usable target (e.g. "regional banks").
 *   • "partial"            — some descriptors, but the universe needs narrowing.
 *   • "discovery_required" — the user legitimately does NOT know the target yet
 *                            (e.g. exploring international expansion). This is a
 *                            VALID configuration state, never a user error: the
 *                            target universe is itself part of what LeadLens would
 *                            discover. It must NOT force a target clarification.
 */
export const TARGET_DEFINITION_STATUSES = ["defined", "partial", "discovery_required"] as const;
export type TargetDefinitionStatus = (typeof TARGET_DEFINITION_STATUSES)[number];

/**
 * Describes the KIND of organization Discovery should later investigate. It does
 * NOT contain discovered accounts. `namedAccounts` is the only place real
 * organization names may appear, and ONLY when the USER explicitly supplied them
 * as seeds — never invented by interpretation. `candidateOrganizationTypes` are
 * HYPOTHESES to investigate when the target is discovery-required — never
 * confirmed targets.
 */
export interface TargetAccountProfileDraft {
  organizationTypes: string[];
  industries?: string[];
  size?: { min?: number; max?: number; band?: string };
  geographies?: GeographyScope[];
  operatingCharacteristics?: string[];
  relevantBusinessConditions?: string[];
  /** User-supplied seed accounts only. Provenance says who put them here. */
  namedAccounts?: string[];
  namedAccountsOrigin?: ContextOrigin;
  exclusions?: string[];
  inferredFromInput: boolean;
  /** KNOWN vs DISCOVERY-REQUIRED. Defaults to "defined" when organizationTypes
   *  are present; "discovery_required" when the target is legitimately unknown. */
  definitionStatus?: TargetDefinitionStatus;
  /** Candidate organization types to INVESTIGATE (hypotheses) when the target is
   *  discovery-required. Distinct from organizationTypes (user-stated/confirmed). */
  candidateOrganizationTypes?: string[];
  /** What LeadLens would need to DETERMINE (markets, routes, org types). */
  discoveryNeeds?: string[];
}

// ─── Opportunity conditions (ICP vs Timing kept separate) ─────────────────────

export const OPPORTUNITY_CONDITION_TYPES = ["structural", "change_trigger", "qualification", "negative_condition"] as const;
export type OpportunityConditionType = (typeof OPPORTUNITY_CONDITION_TYPES)[number];

export const OPPORTUNITY_CONDITION_EFFECTS = ["increase_relevance", "required", "decrease_relevance", "exclude"] as const;
export type OpportunityConditionEffect = (typeof OPPORTUNITY_CONDITION_EFFECTS)[number];

/**
 * What must be true — or must CHANGE — for an account to become more relevant.
 * A structural condition ("is a manufacturer") is NOT a change trigger ("opened
 * a new facility"); LeadLens must never collapse ICP into Timing.
 */
export interface OpportunityCondition {
  id: string;
  type: OpportunityConditionType;
  description: string;
  effect: OpportunityConditionEffect;
  observable: boolean;
  /** Canonical signal families this condition could later be observed through. */
  suggestedSignalFamilies?: SignalFamily[];
  origin: ContextOrigin;
}

// ─── Signal hypotheses (HYPOTHESES — never signals) ───────────────────────────

/**
 * A TYPE of external change worth OBSERVING later. It is a hypothesis about what
 * to look for — never an observed signal. There is intentionally no field that
 * could carry an observation (no observed_at, no evidence, no source): Stage A
 * cannot represent a Signal. `status` is the literal "hypothesis".
 */
export interface SignalHypothesis {
  family: SignalFamily; // canonical, reused from needs-map
  relevanceToObjective: string;
  linkedConditionIds: string[];
  status: "hypothesis";
}

// ─── Negative configuration ───────────────────────────────────────────────────

export const DISQUALIFIER_TYPES = [
  "geography",
  "industry",
  "size",
  "business_model",
  "competitive",
  "existing_customer",
  "operating_requirement",
  "custom",
] as const;
export type DisqualifierType = (typeof DISQUALIFIER_TYPES)[number];

export const DISQUALIFIER_SEVERITIES = ["exclude", "strong_negative"] as const;
export type DisqualifierSeverity = (typeof DISQUALIFIER_SEVERITIES)[number];

/** Customer/commercial configuration — NOT counterevidence about an account. */
export interface Disqualifier {
  type: DisqualifierType;
  rule: string;
  severity: DisqualifierSeverity;
  origin: ContextOrigin;
}

export interface ExclusionRule {
  rule: string;
  origin: ContextOrigin;
}

export interface QualificationConstraint {
  label: string;
  detail?: string;
  origin: ContextOrigin;
}

export interface StakeholderHypothesis {
  role: string;
  rationale?: string;
  status: "hypothesis";
}

export interface SuppliedCommercialEconomics {
  /** All optional and user-supplied; economics never blocks execution. */
  averageDealValue?: number;
  currency?: string;
  salesCycleDays?: number;
  notes?: string;
  origin: ContextOrigin;
}

// ─── Clarification ────────────────────────────────────────────────────────────

export const CLARIFICATION_PRIORITIES = [
  "commercial_objective",
  "target_organization",
  "geography",
  "opportunity_condition",
  "hard_exclusion",
  "route_preference",
  "other",
] as const;

/**
 * Deterministic QUALITY GATE (§10): a clarification is legitimate only if it asks
 * for something UNIQUELY KNOWN TO THE USER — never for a research conclusion
 * LeadLens is expected to discover (the best market, the target companies, the
 * ideal partners, the accounts to prioritize). Returns true if the clarification
 * is asking for a research conclusion and must be REJECTED.
 */
export function isResearchConclusionClarification(priority: ClarificationPriority, reason: string): boolean {
  if (priority === "target_organization") return true; // "which organizations should LeadLens look at" is a conclusion
  return /\b(best|top|right|ideal) (market|markets|countr|compan|account|partner|organi[sz]ation)|which (companies|accounts|organizations|markets|countries|partners)|who should (we|leadlens) (research|find|target)|find (the )?companies\b/i.test(reason);
}
export type ClarificationPriority = (typeof CLARIFICATION_PRIORITIES)[number];

export interface ClarificationGap {
  id: string;
  priority: ClarificationPriority;
  /** Why answering this could materially change discovery/qualification/evidence. */
  reason: string;
}

export interface Contradiction {
  id: string;
  description: string;
  /** Claim ids / field paths in tension. */
  between: string[];
}

export interface ClarificationQuestion {
  gapId: string;
  question: string;
}

export interface ClarificationState {
  blockers: ClarificationGap[];
  nonBlockingGaps: ClarificationGap[];
  contradictions: Contradiction[];
  nextQuestion?: ClarificationQuestion;
}

// ─── Interpretation certainty (maps-to-config, NOT truth) ─────────────────────

/** How confidently the text maps to configuration. This is NOT a claim about
 *  how true the user's statement is, and it is NOT a fake precision gauge. */
export const INTERPRETATION_CERTAINTIES = ["clear", "partially_clear", "ambiguous", "conflicting"] as const;
export type InterpretationCertainty = (typeof INTERPRETATION_CERTAINTIES)[number];

export const INTERPRETATION_STATUSES = [
  "draft",
  "needs_clarification",
  "ready_for_confirmation",
  "confirmed",
  "unsupported_objective",
] as const;
export type InterpretationStatus = (typeof INTERPRETATION_STATUSES)[number];

// ─── The contract ─────────────────────────────────────────────────────────────

export interface CompanyInterpretationV1 {
  schemaVersion: typeof COMPANY_INTERPRETATION_SCHEMA_VERSION;

  source: {
    rawInputRef: string;
    inputLanguage: LandingInterpretationLocale;
    submittedAt: string; // ISO
    sessionId?: string;
  };

  companyContext: CompanyContext;
  commercialObjective: CommercialObjectiveDraft;
  targetAccountProfile: TargetAccountProfileDraft;
  opportunityConditions: OpportunityCondition[];
  signalHypotheses: SignalHypothesis[];
  disqualifiers: Disqualifier[];
  exclusions: ExclusionRule[];
  constraints: QualificationConstraint[];
  stakeholderHypotheses?: StakeholderHypothesis[];
  economics?: SuppliedCommercialEconomics;

  clarification: ClarificationState;
  certainty: InterpretationCertainty;
  interpretationStatus: InterpretationStatus;

  confirmation?: {
    confirmedAt: string;
    confirmedBy: "user";
    confirmedFields: string[];
  };

  /** Marks the whole object as illustrative (fixtures / demo), never live intel. */
  illustrative?: boolean;
}

// ─── Runtime guards / pure validators (truth-boundary enforcement) ────────────

export const isSupportedObjectiveType = (v: string): v is SupportedObjectiveType =>
  (SUPPORTED_OBJECTIVE_TYPES as readonly string[]).includes(v);

export const isValidSignalFamily = (v: string): v is SignalFamily =>
  (SIGNAL_FAMILIES as readonly string[]).includes(v);

export const isStageAVerificationStatus = (v: string): v is StageAVerificationStatus =>
  (STAGE_A_VERIFICATION_STATUSES as readonly string[]).includes(v);

/** Every ContextClaim reachable from an interpretation, with a field path. */
export function collectContextClaims(interp: CompanyInterpretationV1): Array<{ path: string; claim: ContextClaim<unknown> }> {
  const out: Array<{ path: string; claim: ContextClaim<unknown> }> = [];
  const push = (path: string, c?: ContextClaim<unknown>) => { if (c) out.push({ path, claim: c }); };
  const cc = interp.companyContext;
  push("companyContext.companyDescription", cc.companyDescription);
  push("companyContext.businessModel", cc.businessModel);
  cc.offers.forEach((o, i) => push(`companyContext.offers[${i}]`, o));
  cc.capabilities.forEach((o, i) => push(`companyContext.capabilities[${i}]`, o));
  return out;
}

/**
 * Returns a list of TRUTH-BOUNDARY violations. An empty array means the
 * interpretation respects Stage A boundaries. Any non-empty result means the
 * object is trying to claim something Stage A is not allowed to claim, and must
 * be rejected before it can influence intelligence.
 */
export function stageAViolations(interp: CompanyInterpretationV1): string[] {
  const errs: string[] = [];

  // 1. No claim produced in Stage A may be externally verified.
  for (const { path, claim } of collectContextClaims(interp)) {
    if (!isStageAVerificationStatus(claim.verificationStatus)) {
      errs.push(`${path}: verificationStatus "${claim.verificationStatus}" is not producible in Stage A (external verification requires Stage B).`);
    }
    // A user cannot have "confirmed" something that did not originate from a user act.
    if (claim.verificationStatus === "user_confirmed" && claim.origin !== "user_input" && claim.origin !== "user_edit") {
      errs.push(`${path}: "user_confirmed" requires a user origin, got "${claim.origin}".`);
    }
    // "inferred" is a system/LLM act, never a user statement.
    if (claim.verificationStatus === "inferred" && claim.origin !== "llm_interpretation" && claim.origin !== "system_normalization") {
      errs.push(`${path}: "inferred" requires an inference origin, got "${claim.origin}".`);
    }
  }

  // 2. Signal hypotheses must remain hypotheses over canonical families.
  interp.signalHypotheses.forEach((h, i) => {
    if (h.status !== "hypothesis") errs.push(`signalHypotheses[${i}]: status must be "hypothesis".`);
    if (!isValidSignalFamily(h.family)) errs.push(`signalHypotheses[${i}]: "${h.family}" is not a canonical signal family.`);
  });

  // 3. Named target accounts may only exist when the USER supplied them.
  const named = interp.targetAccountProfile.namedAccounts ?? [];
  if (named.length > 0) {
    const o = interp.targetAccountProfile.namedAccountsOrigin;
    if (o !== "user_input" && o !== "user_edit") {
      errs.push(`targetAccountProfile.namedAccounts: present without a user origin — Stage A must not discover or invent account names.`);
    }
  }

  // 4. include/exclude contradiction: an industry cannot be both targeted and excluded.
  const industries = (interp.targetAccountProfile.industries ?? []).map((s) => s.toLowerCase().trim());
  const excluded = [
    ...(interp.targetAccountProfile.exclusions ?? []),
    ...interp.disqualifiers.filter((d) => d.type === "industry").map((d) => d.rule),
    ...interp.exclusions.map((e) => e.rule),
  ].map((s) => s.toLowerCase().trim());
  for (const ind of industries) {
    if (ind && excluded.includes(ind)) {
      const flagged = interp.clarification.contradictions.some((c) => c.description.toLowerCase().includes(ind));
      if (!flagged) errs.push(`target/exclude contradiction on "${ind}" is neither resolved nor flagged as a contradiction.`);
    }
  }

  // 5. Unsupported objective must be represented as unsupported (not normalized).
  if (!interp.commercialObjective.supported && interp.interpretationStatus !== "unsupported_objective") {
    errs.push(`commercialObjective is unsupported but interpretationStatus is "${interp.interpretationStatus}".`);
  }

  return errs;
}

export const hasBlockers = (interp: CompanyInterpretationV1): boolean => interp.clarification.blockers.length > 0;
