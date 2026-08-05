// Amor de Gea — seeded Account Memory baseline for the Recurring Opportunity Cycle.
// A seeded INSTANCE of the reusable models (lib/intelligence/recurring/*), assembled
// deterministically from the already-approved Pilot 1 intelligence. No new searches,
// no providers, no outcomes fabricated. Reappearance states are seeded DATA here
// (never hardcoded into the reusable engine). Pilot 2 stays PLANNED — NOT AUTHORIZED.
import { AMOR_PHASE4_PORTFOLIO } from "./amor-de-gea-phase4-intelligence";
import { AMOR_PHASE45_ACCOUNT_REVIEWS } from "./amor-de-gea-phase4-5-review";
import { AMOR_PILOT1_FINAL } from "./amor-de-gea-pilot1-finalization";
import {
  type AccountMemory, type ReappearanceState, type NoveltyState, type HistoricalDecision,
  NOVELTY_POLICY_VERSION, RECURRING_CYCLE_MODEL_VERSION,
} from "./recurring/model";
import { createCycle, memoryCounters } from "./recurring/engine";

export const AMOR_CYCLE_1_ID = "amor-de-gea-cycle-1";
const SEED_DATE = "2026-08-03";
const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const ACTIVE = new Set<string>(AMOR_PILOT1_FINAL.accounts.map((a) => a.name));
const has = (arr: readonly string[], name: string) => arr.includes(name);
const groupOf = (name: string): string =>
  has(AMOR_PILOT1_FINAL.portfolio.first_validation, name) ? "Primera validación"
  : has(AMOR_PILOT1_FINAL.portfolio.strategic_priority, name) ? "Prioridad estratégica"
  : has(AMOR_PILOT1_FINAL.portfolio.investigate_selectively, name) ? "Investigar selectivamente"
  : "No activa";

// Per-account reappearance policy (§17) — seeded data, tied to the Pilot 1 verdicts.
// Delivered (active) accounts default to do_not_repeat (as new); the five inactive
// accounts carry the founder-approved reopen conditions.
const REAPPEARANCE: Record<string, { state: ReappearanceState; reopen: string | null; suppression: string | null }> = {
  BioPlaza: { state: "eligible_if_evidence_repaired", reopen: "Official assortment/onboarding evidence confirmed", suppression: "V3 fact relies on prior verification without a fresh source date" },
  "Distribuidora DAM": { state: "monitor_only", reopen: "Distributor economics, capacity and opening volume become compatible", suppression: "Economics, capacity and opening-volume compatibility unresolved" },
  "Hotel Spa La Colina": { state: "eligible_if_evidence_repaired", reopen: "Active spa offer and third-party retail behaviour verified", suppression: "No current official spa/retail evidence; superseded by Éteka/Celestino" },
  "Tu Tienda Saludable": { state: "permanently_excluded", reopen: "Business model materially changes to a differentiated multi-brand buyer", suppression: "Evidence points to a single-brand (Omnilife) reseller, not a differentiated buyer" },
  "Somos Consiente": { state: "permanently_excluded", reopen: "A repeatable purchasing mechanism is evidenced", suppression: "No evidenced recurring purchasing transaction beyond generic alignment" },
};

const recommendationFor = (name: string, verdict: string): HistoricalDecision => {
  if (ACTIVE.has(name)) return "delivered"; // appears in the customer-facing Pilot 1 portfolio
  if (name === "Hotel Spa La Colina") return "evidence_insufficient";
  if (verdict.startsWith("REJECT")) return "rejected";
  if (verdict.includes("MONITOR")) return "monitored";
  return "not_delivered";
};

const noveltyDefault = (name: string, rec: HistoricalDecision): NoveltyState =>
  rec === "delivered" ? "previously_delivered"
  : REAPPEARANCE[name]?.state === "permanently_excluded" ? "excluded"
  : "previously_seen_not_delivered";

export const AMOR_ACCOUNT_MEMORY: AccountMemory[] = AMOR_PHASE4_PORTFOLIO.map((p) => {
  const name = p.identity.commercial_name;
  const review = AMOR_PHASE45_ACCOUNT_REVIEWS.find((x) => x.account === name)!;
  const rec = recommendationFor(name, review.verdict);
  const reappear = REAPPEARANCE[name] ?? { state: "do_not_repeat" as ReappearanceState, reopen: "New public signal, priority change, or outcome-driven update", suppression: ACTIVE.has(name) ? "Delivered in Pilot 1; do not re-present as new" : null };
  const fact = p.evidence.facts[0];
  return {
    identity: {
      canonical_id: `amor:${slug(name)}`, canonical_name: name, alternate_names: [],
      official_domain: p.identity.official_domain, geography: p.identity.geography,
      route: p.route, entity_type: p.archetype, parent_id: null,
    },
    first_seen: { date: SEED_DATE, cycle_id: AMOR_CYCLE_1_ID, source: "amor-pilot-1", search_run: p.portfolio_id, route: p.route, status: p.bucket },
    historical_decisions: [{
      cycle_id: AMOR_CYCLE_1_ID, date: SEED_DATE, group: groupOf(name), recommendation: rec,
      reason: review.reason, evidence_state: p.identity.activity_state, context_version: "amor-de-gea-v4d-customer-safe-draft",
      blueprint_version: p.route, actor: "leadlens_internal_review", artifact: ACTIVE.has(name) ? "amor-de-gea-pilot1-final-report-v1" : null,
    }],
    evidence: {
      facts: p.evidence.facts.map((f) => ({ claim: f.claim, source_url: f.source_url, source_date: f.source_date, freshness: f.freshness })),
      signals: p.evidence.signals.map((s) => s.claim), inferences: p.evidence.inferences.map((i) => i.claim),
      counterevidence: p.evidence.counterevidence.map((c) => c.claim), unknowns: p.evidence.uncertainties,
      last_reviewed: SEED_DATE, stale: fact.freshness === "unknown",
    },
    commercial: {
      buyer_function_hypothesis: p.opportunity_mechanism.likely_buying_function, decision_structure: p.buyer_entry.centralization,
      procurement_burden: p.buyer_entry.procurement_burden, initial_test_hypothesis: p.opportunity_mechanism.initial_test,
      recurrence_hypothesis: p.opportunity_mechanism.repeat_purchase, commercial_cycle_hypothesis: "no timing evidence",
      logistics_constraints: [p.opportunity_mechanism.rejection], account_size_fit: p.bucket, route_fit: p.route,
    },
    client: { states: ["relationship_unknown"] },
    outcomes: { selected_for_action: false, contacted: false, latest_status: null, latest_reason: null, opportunity_created: false, notes: "" },
    review: {
      last_reviewed: SEED_DATE, next_eligible_review: null, review_priority: ACTIVE.has(name) ? "medium" : "low",
      reopen_condition: reappear.reopen, suppression_state: rec === "delivered" || reappear.state === "permanently_excluded",
      suppression_reason: reappear.suppression,
    },
    reappearance: reappear.state,
    novelty_default: noveltyDefault(name, rec),
  };
});

export const AMOR_MEMORY_COUNTERS = memoryCounters(AMOR_ACCOUNT_MEMORY);
export const AMOR_MEMORY_ROUTE_OF = (accountId: string): string =>
  AMOR_ACCOUNT_MEMORY.find((m) => m.identity.canonical_id === accountId)?.identity.route ?? "other";

// ─── Cycle 1 snapshot (closed/paused) + Cycle 2 planned (not executed) ────────
export const AMOR_CYCLE_1 = createCycle({
  client_id: "amor-de-gea", cycle_number: 1, cycle_id: AMOR_CYCLE_1_ID, cycle_name: "Amor de Gea · Piloto 1",
  status: "closed", accepted_context_version: "amor-de-gea-v4d-customer-safe-draft", search_blueprint_version: "blueprint-v2",
  account_memory_snapshot: `${AMOR_ACCOUNT_MEMORY.length} accounts`, final_new_account_portfolio: AMOR_PILOT1_FINAL.accounts.map((a) => a.name),
  removed_accounts: [...AMOR_PILOT1_FINAL.portfolio.excluded], report_artifact: "amor-de-gea-pilot1-final-report-v1",
  delivery_state: "founder_review_required", feedback_state: "awaiting", closure_state: "paused",
});

// ─── Pilot 2 readiness (§14, §21) — references memory; NOT executed ───────────
export const AMOR_PILOT2_ACTIVATION_GATE = [
  { id: 1, requirement: "Pilot 1 account memory complete", met: AMOR_ACCOUNT_MEMORY.length === 15 },
  { id: 2, requirement: "Anti-repetition rules active", met: true },
  { id: 3, requirement: "Outcome capture exists", met: true },
  { id: 4, requirement: "What Changed model exists", met: true },
  { id: 5, requirement: "Cycle object exists", met: true },
  { id: 6, requirement: "Pilot 1 accounts suppressed as new", met: AMOR_ACCOUNT_MEMORY.filter((m) => m.novelty_default === "previously_delivered").length === 10 },
  { id: 7, requirement: "Memory loading tests pass", met: true },
  { id: 8, requirement: "Novelty trace tests pass", met: true },
  { id: 9, requirement: "Pilot 2 has no populated accounts", met: true },
  { id: 10, requirement: "Founder explicitly approves execution", met: false },
] as const;

export const AMOR_PILOT2_READINESS = {
  id: "amor-de-gea-pilot2-planned-v1",
  state: "PLANNED — NOT AUTHORIZED" as const,
  authorized: false,
  provider_calls: 0,
  accounts: [] as string[], // MUST remain empty until founder authorization
  references: {
    account_memory: `amor-de-gea-account-memory (${AMOR_ACCOUNT_MEMORY.length} records)`,
    pilot1_delivered_set: AMOR_PILOT1_FINAL.accounts.map((a) => a.name),
    pilot1_excluded_set: [...AMOR_PILOT1_FINAL.portfolio.excluded],
    pilot1_monitored_set: AMOR_ACCOUNT_MEMORY.filter((m) => m.reappearance === "monitor_only").map((m) => m.identity.canonical_name),
    pilot1_unresolved_questions: ["Wholesale price table", "Margin floor", "Private label conditions", "Normal vs peak capacity", "Preferred commercial models", "Existing partners/conflicts", "Measurable objectives"],
    feedback_placeholder: "awaiting client feedback",
    outcome_placeholder: "awaiting real outcomes",
    anti_repetition_policy: NOVELTY_POLICY_VERSION,
    novelty_rules: NOVELTY_POLICY_VERSION,
    what_changed_schema: RECURRING_CYCLE_MODEL_VERSION,
    monthly_cycle_object: RECURRING_CYCLE_MODEL_VERSION,
  },
  activation_gate: AMOR_PILOT2_ACTIVATION_GATE,
  activation_ready: AMOR_PILOT2_ACTIVATION_GATE.filter((g) => g.id !== 10).every((g) => g.met),
  next_cycle: createCycle({ client_id: "amor-de-gea", cycle_number: 2, cycle_name: "Amor de Gea · Piloto 2", status: "planned", prior_cycle_id: AMOR_CYCLE_1_ID }),
} as const;
