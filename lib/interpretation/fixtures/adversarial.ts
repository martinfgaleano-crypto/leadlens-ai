// ─── Adversarial Company Interpretation fixtures (illustrative) ───────────────
// These protect the truth boundary BEFORE an LLM exists. Two kinds:
//   1. WELL-FORMED but honestly-limited interpretations (ambiguous / unsupported
//      / insufficient) — they must land in needs_clarification or
//      unsupported_objective, never a confident execution-ready state.
//   2. MALFORMED interpretations that try to violate a truth boundary — the
//      validator (stageAViolations) must reject them.

import type { CompanyInterpretationV1, ContextClaim } from "../company-interpretation";

const AT = "2026-08-24T00:00:00.000Z";
const stated = (value: string, scope: ContextClaim<string>["scope"]): ContextClaim<string> =>
  ({ value, origin: "user_input", verificationStatus: "user_stated", scope, recordedAt: AT });

/** Minimal well-formed skeleton with everything empty. */
function skeleton(rawInputRef: string): CompanyInterpretationV1 {
  return {
    schemaVersion: "1",
    source: { rawInputRef, inputLanguage: "en", submittedAt: AT },
    companyContext: { offers: [], capabilities: [] },
    commercialObjective: { supported: false, requestedType: "unknown", rawObjective: "", reason: "" },
    targetAccountProfile: { organizationTypes: [], inferredFromInput: false },
    opportunityConditions: [],
    signalHypotheses: [],
    disqualifiers: [],
    exclusions: [],
    constraints: [],
    clarification: { blockers: [], nonBlockingGaps: [], contradictions: [] },
    certainty: "ambiguous",
    interpretationStatus: "needs_clarification",
    illustrative: true,
  };
}

// A ─ "We help companies grow." → objective + target both unspecific ───────────
export const ADV_HELP_COMPANIES_GROW: CompanyInterpretationV1 = {
  ...skeleton("adv:help_companies_grow"),
  companyContext: { companyDescription: stated("We help companies grow.", "customer_company"), offers: [], capabilities: [] },
  clarification: {
    blockers: [
      { id: "b_obj", priority: "commercial_objective", reason: "No concrete objective — 'grow' does not map to a supported objective." },
      { id: "b_target", priority: "target_organization", reason: "No target organization described." },
    ],
    nonBlockingGaps: [],
    contradictions: [],
  },
};

// B ─ "Jewelry in Colombia, expanding internationally." → context ok, objective/relationship unclear ─
export const ADV_JEWELRY_COLOMBIA: CompanyInterpretationV1 = {
  ...skeleton("adv:jewelry_colombia"),
  companyContext: {
    companyDescription: stated("Jewelry business in Colombia, expanding internationally.", "customer_company"),
    offers: [{ value: { label: "Jewelry" }, origin: "user_input", verificationStatus: "user_stated", scope: "customer_company", recordedAt: AT }],
    capabilities: [],
  },
  targetAccountProfile: { organizationTypes: [], geographies: [{ label: "Colombia" }], inferredFromInput: true },
  clarification: {
    blockers: [
      { id: "b_obj", priority: "commercial_objective", reason: "Expanding internationally — but seeking customers, partners, or distributors is unclear." },
    ],
    nonBlockingGaps: [{ id: "g_dest", priority: "geography", reason: "Destination markets for expansion not stated." }],
    contradictions: [],
  },
  certainty: "partially_clear",
};

// C ─ "I want investors." → UNSUPPORTED, never normalized to sales ─────────────
export const ADV_INVESTORS: CompanyInterpretationV1 = {
  ...skeleton("adv:investors"),
  commercialObjective: {
    supported: false,
    requestedType: "investors",
    rawObjective: "I want investors.",
    reason: "LeadLens finds accounts to do commercial business with (customers, clients, partners, advisory), not investors.",
  },
  clarification: { blockers: [], nonBlockingGaps: [], contradictions: [] },
  certainty: "clear",
  interpretationStatus: "unsupported_objective",
};

// D ─ "Find companies." → insufficient context ────────────────────────────────
export const ADV_FIND_COMPANIES: CompanyInterpretationV1 = {
  ...skeleton("adv:find_companies"),
  clarification: {
    blockers: [
      { id: "b_obj", priority: "commercial_objective", reason: "No objective." },
      { id: "b_target", priority: "target_organization", reason: "No target definition — 'companies' is not a profile." },
    ],
    nonBlockingGaps: [],
    contradictions: [],
  },
};

// E ─ "We sell cybersecurity software to banks but not fintechs." → clean extract + exclusion ─
export const ADV_CYBER_BANKS_NOT_FINTECH: CompanyInterpretationV1 = {
  ...skeleton("adv:cyber_banks_not_fintech"),
  companyContext: {
    companyDescription: stated("We sell cybersecurity software to banks.", "customer_company"),
    businessModel: { value: "software", origin: "llm_interpretation", verificationStatus: "inferred", scope: "customer_company", recordedAt: AT },
    offers: [{ value: { label: "Cybersecurity software" }, origin: "user_input", verificationStatus: "user_stated", scope: "customer_company", recordedAt: AT }],
    capabilities: [],
  },
  commercialObjective: { supported: true, type: "win_customers", description: "Sell cybersecurity software to banks.", targetRelationship: "customer", userConfirmed: false },
  targetAccountProfile: { organizationTypes: ["Banks"], industries: ["Banking"], exclusions: ["fintech"], inferredFromInput: true },
  disqualifiers: [{ type: "industry", rule: "fintech", severity: "exclude", origin: "user_input" }],
  opportunityConditions: [{ id: "oc_bank", type: "structural", description: "Is a bank", effect: "required", observable: false, origin: "user_input" }],
  clarification: {
    blockers: [],
    nonBlockingGaps: [
      { id: "g_geo", priority: "geography", reason: "No geography stated." },
      { id: "g_trigger", priority: "opportunity_condition", reason: "No change trigger yet — which bank changes signal need?" },
    ],
    contradictions: [],
  },
  certainty: "partially_clear",
  interpretationStatus: "ready_for_confirmation",
};

// F ─ "We are a consulting firm but do not know our ideal market yet." ─────────
export const ADV_CONSULTING_NO_MARKET: CompanyInterpretationV1 = {
  ...skeleton("adv:consulting_no_market"),
  companyContext: {
    companyDescription: stated("We are a consulting firm.", "customer_company"),
    businessModel: { value: "services", origin: "llm_interpretation", verificationStatus: "inferred", scope: "customer_company", recordedAt: AT },
    offers: [], capabilities: [],
  },
  clarification: {
    blockers: [
      { id: "b_target", priority: "target_organization", reason: "Target market undefined; LeadLens does not do open-ended market selection — it needs a target profile to investigate." },
    ],
    nonBlockingGaps: [],
    contradictions: [],
  },
  certainty: "partially_clear",
};

export const ADVERSARIAL_FIXTURES = {
  help_companies_grow: ADV_HELP_COMPANIES_GROW,
  jewelry_colombia: ADV_JEWELRY_COLOMBIA,
  investors: ADV_INVESTORS,
  find_companies: ADV_FIND_COMPANIES,
  cyber_banks_not_fintech: ADV_CYBER_BANKS_NOT_FINTECH,
  consulting_no_market: ADV_CONSULTING_NO_MARKET,
} as const;

// ─── MALFORMED: each must be REJECTED by stageAViolations ─────────────────────

/** Tries to mark a user-stated claim as externally verified. */
export const MALFORMED_EXTERNALLY_VERIFIED: CompanyInterpretationV1 = {
  ...skeleton("adv:malformed_externally_verified"),
  companyContext: {
    companyDescription: { value: "We sell logistics software.", origin: "user_input", verificationStatus: "externally_verified", scope: "customer_company", recordedAt: AT },
    offers: [], capabilities: [],
  },
  commercialObjective: { supported: true, type: "win_customers", description: "Sell logistics software.", targetRelationship: "customer", userConfirmed: false },
  targetAccountProfile: { organizationTypes: ["Manufacturers"], inferredFromInput: true },
  interpretationStatus: "ready_for_confirmation",
};

/** Tries to introduce invented (non-user) named accounts. */
export const MALFORMED_INVENTED_ACCOUNTS: CompanyInterpretationV1 = {
  ...skeleton("adv:malformed_invented_accounts"),
  commercialObjective: { supported: true, type: "win_customers", description: "x", targetRelationship: "customer", userConfirmed: false },
  targetAccountProfile: { organizationTypes: ["Manufacturers"], namedAccounts: ["Northstar Logistics"], namedAccountsOrigin: "llm_interpretation", inferredFromInput: true },
  interpretationStatus: "ready_for_confirmation",
};

/** Targets and excludes the same industry, without flagging the contradiction. */
export const MALFORMED_CONTRADICTION: CompanyInterpretationV1 = {
  ...skeleton("adv:malformed_contradiction"),
  commercialObjective: { supported: true, type: "win_customers", description: "x", targetRelationship: "customer", userConfirmed: false },
  targetAccountProfile: { organizationTypes: ["Fintechs"], industries: ["fintech"], exclusions: ["fintech"], inferredFromInput: true },
  interpretationStatus: "ready_for_confirmation",
};

/** Unsupported objective mislabeled as a normal (non-unsupported) status. */
export const MALFORMED_NORMALIZED_UNSUPPORTED: CompanyInterpretationV1 = {
  ...skeleton("adv:malformed_normalized_unsupported"),
  commercialObjective: { supported: false, requestedType: "investors", rawObjective: "I want investors.", reason: "unsupported" },
  interpretationStatus: "ready_for_confirmation", // WRONG: should be unsupported_objective
};

export const MALFORMED_FIXTURES = {
  externally_verified: MALFORMED_EXTERNALLY_VERIFIED,
  invented_accounts: MALFORMED_INVENTED_ACCOUNTS,
  contradiction: MALFORMED_CONTRADICTION,
  normalized_unsupported: MALFORMED_NORMALIZED_UNSUPPORTED,
} as const;
