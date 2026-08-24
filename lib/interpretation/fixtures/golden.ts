// ─── Golden Company Interpretation fixtures (illustrative) ────────────────────
// Three canonical scenarios proving ONE schema serves distinct commercial
// objectives without a parallel product: software/manufacturing (customer),
// consulting (advisory), partnerships (partner). All are internationally neutral
// (no country hardcoded) and produce NO external facts, signals or accounts.
//
// Signal families are the CANONICAL values from lib/discovery/needs-map — this
// file reuses that ontology, it does not invent one.

import type {
  CompanyInterpretationV1,
  ContextClaim,
  ContextOrigin,
} from "../company-interpretation";

const AT = "2026-08-24T00:00:00.000Z";

function claim<T>(value: T, origin: ContextOrigin, scope: ContextClaim<T>["scope"]): ContextClaim<T> {
  return {
    value,
    origin,
    verificationStatus: origin === "user_input" ? "user_stated" : "inferred",
    scope,
    recordedAt: AT,
  };
}

// 1 ─ Software / manufacturing (international, customer objective) ─────────────
export const GOLDEN_SOFTWARE_MANUFACTURING: CompanyInterpretationV1 = {
  schemaVersion: "1",
  source: { rawInputRef: "golden:software_manufacturing", inputLanguage: "en", submittedAt: AT },
  companyContext: {
    companyDescription: claim("Provides supply-chain planning software to mid-sized manufacturers.", "user_input", "customer_company"),
    businessModel: claim("software", "llm_interpretation", "customer_company"),
    offers: [claim({ label: "Supply-chain planning software" }, "user_input", "customer_company")],
    capabilities: [claim("Supply-chain / operations planning", "llm_interpretation", "customer_company")],
  },
  commercialObjective: {
    supported: true,
    type: "identify_high_value_accounts",
    description: "Identify manufacturers where a recent operational change creates a strong reason to engage.",
    targetRelationship: "customer",
    successCondition: "A prioritized set of manufacturers with a live, relevant change to act on.",
    userConfirmed: false,
  },
  targetAccountProfile: {
    organizationTypes: ["Mid-sized manufacturers"],
    industries: ["Manufacturing"],
    size: { band: "mid-market" },
    operatingCharacteristics: ["Owns physical production / distribution operations"],
    relevantBusinessConditions: ["Expanding or reconfiguring operations"],
    inferredFromInput: true,
  },
  opportunityConditions: [
    { id: "oc_manufacturer", type: "structural", description: "Is a mid-sized manufacturer", effect: "required", observable: false, origin: "llm_interpretation" },
    { id: "oc_new_facility", type: "change_trigger", description: "Opening new facilities", effect: "increase_relevance", observable: true, suggestedSignalFamilies: ["new_facility", "expansion"], origin: "user_input" },
    { id: "oc_acquisition", type: "change_trigger", description: "Acquisition or integration activity", effect: "increase_relevance", observable: true, suggestedSignalFamilies: ["acquisition"], origin: "user_input" },
    { id: "oc_expansion", type: "change_trigger", description: "Operational expansion", effect: "increase_relevance", observable: true, suggestedSignalFamilies: ["expansion", "operational_transformation"], origin: "user_input" },
  ],
  signalHypotheses: [
    { family: "new_facility", relevanceToObjective: "New facilities imply new supply-chain planning need.", linkedConditionIds: ["oc_new_facility"], status: "hypothesis" },
    { family: "acquisition", relevanceToObjective: "Acquisitions force operational integration.", linkedConditionIds: ["oc_acquisition"], status: "hypothesis" },
    { family: "expansion", relevanceToObjective: "Operational expansion increases planning complexity.", linkedConditionIds: ["oc_expansion"], status: "hypothesis" },
  ],
  disqualifiers: [],
  exclusions: [],
  constraints: [],
  clarification: {
    blockers: [],
    nonBlockingGaps: [{ id: "gap_geo", priority: "geography", reason: "No geography stated; discovery can run globally but a region would sharpen it." }],
    contradictions: [],
  },
  certainty: "clear",
  interpretationStatus: "ready_for_confirmation",
  illustrative: true,
};

// 2 ─ Consulting / professional services (advisory objective) ─────────────────
export const GOLDEN_CONSULTING: CompanyInterpretationV1 = {
  schemaVersion: "1",
  source: { rawInputRef: "golden:consulting", inputLanguage: "en", submittedAt: AT },
  companyContext: {
    companyDescription: claim("Advises companies entering new international markets.", "user_input", "customer_company"),
    businessModel: claim("services", "llm_interpretation", "customer_company"),
    offers: [claim({ label: "Market-entry, regulatory and operating advisory" }, "user_input", "customer_company")],
    capabilities: [claim("Market entry", "user_input", "customer_company"), claim("Regulatory support", "user_input", "customer_company"), claim("Operating support", "user_input", "customer_company")],
  },
  commercialObjective: {
    supported: true,
    type: "advisory_opportunities",
    description: "Identify organizations whose recent expansion creates a need for market-entry, regulatory and operating support.",
    targetRelationship: "advisory_client",
    successCondition: "Organizations with a live expansion that maps to an advisory need.",
    userConfirmed: false,
  },
  targetAccountProfile: {
    organizationTypes: ["Organizations entering new geographies"],
    relevantBusinessConditions: ["Recent or announced international expansion"],
    inferredFromInput: true,
  },
  opportunityConditions: [
    { id: "oc_intl_expansion", type: "change_trigger", description: "Recent international expansion", effect: "required", observable: true, suggestedSignalFamilies: ["new_market", "expansion"], origin: "user_input" },
    { id: "oc_regulatory", type: "change_trigger", description: "New regulatory exposure from entering a market", effect: "increase_relevance", observable: true, suggestedSignalFamilies: ["regulatory"], origin: "llm_interpretation" },
  ],
  signalHypotheses: [
    { family: "new_market", relevanceToObjective: "Entering a new market is the core advisory trigger.", linkedConditionIds: ["oc_intl_expansion"], status: "hypothesis" },
    { family: "expansion", relevanceToObjective: "Expansion signals capacity to invest in support.", linkedConditionIds: ["oc_intl_expansion"], status: "hypothesis" },
    { family: "regulatory", relevanceToObjective: "New-market entry raises regulatory need.", linkedConditionIds: ["oc_regulatory"], status: "hypothesis" },
    { family: "partnership", relevanceToObjective: "Local partnerships often accompany market entry.", linkedConditionIds: ["oc_intl_expansion"], status: "hypothesis" },
  ],
  disqualifiers: [],
  exclusions: [],
  constraints: [],
  clarification: {
    blockers: [],
    nonBlockingGaps: [{ id: "gap_sector", priority: "target_organization", reason: "Sector focus not stated; any expanding org qualifies until narrowed." }],
    contradictions: [],
  },
  certainty: "clear",
  interpretationStatus: "ready_for_confirmation",
  illustrative: true,
};

// 3 ─ Partnerships (partner objective) ────────────────────────────────────────
export const GOLDEN_PARTNERSHIPS: CompanyInterpretationV1 = {
  schemaVersion: "1",
  source: { rawInputRef: "golden:partnerships", inputLanguage: "en", submittedAt: AT },
  companyContext: {
    companyDescription: claim("Provides enterprise software.", "user_input", "customer_company"),
    businessModel: claim("software", "user_input", "customer_company"),
    offers: [claim({ label: "Enterprise software" }, "user_input", "customer_company")],
    capabilities: [],
  },
  commercialObjective: {
    supported: true,
    type: "partnerships",
    description: "Find strategic distribution partners with strong regional reach and complementary customer relationships.",
    targetRelationship: "partner",
    successCondition: "Distribution/channel partners with reach and a complementary customer base.",
    userConfirmed: false,
  },
  targetAccountProfile: {
    organizationTypes: ["Distribution / channel partners"],
    operatingCharacteristics: ["Strong regional reach", "Complementary (non-competing) customer relationships"],
    inferredFromInput: true,
  },
  opportunityConditions: [
    { id: "oc_regional_reach", type: "structural", description: "Strong regional distribution reach", effect: "required", observable: true, suggestedSignalFamilies: ["expansion", "new_market"], origin: "user_input" },
    { id: "oc_complementary", type: "qualification", description: "Complementary customer base", effect: "increase_relevance", observable: false, origin: "user_input" },
    { id: "oc_non_competing", type: "negative_condition", description: "Directly competing offering", effect: "exclude", observable: false, origin: "llm_interpretation" },
  ],
  signalHypotheses: [
    { family: "partnership", relevanceToObjective: "Existing partnership activity signals channel appetite.", linkedConditionIds: ["oc_regional_reach"], status: "hypothesis" },
    { family: "expansion", relevanceToObjective: "Regional expansion indicates reach.", linkedConditionIds: ["oc_regional_reach"], status: "hypothesis" },
    { family: "new_market", relevanceToObjective: "New-market moves indicate distribution capability.", linkedConditionIds: ["oc_regional_reach"], status: "hypothesis" },
  ],
  disqualifiers: [
    { type: "competitive", rule: "Directly competing enterprise software vendors", severity: "exclude", origin: "llm_interpretation" },
  ],
  exclusions: [],
  constraints: [],
  clarification: { blockers: [], nonBlockingGaps: [], contradictions: [] },
  certainty: "clear",
  interpretationStatus: "ready_for_confirmation",
  illustrative: true,
};

export const GOLDEN_FIXTURES = {
  software_manufacturing: GOLDEN_SOFTWARE_MANUFACTURING,
  consulting: GOLDEN_CONSULTING,
  partnerships: GOLDEN_PARTNERSHIPS,
} as const;
