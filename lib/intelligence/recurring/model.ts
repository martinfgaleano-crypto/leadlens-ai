// Recurring Opportunity Cycle V1 — reusable models.
// Turns LeadLens from one-time reports into a recurring account-opportunity
// system: Account Memory, memory events, outcomes, anti-repetition/novelty,
// What Changed, and the monthly Opportunity Cycle. Client-agnostic; Amor de Gea
// is a seeded instance (see amor-de-gea-account-memory.ts), never hardcoded here.

// ─── Enumerations (const arrays → union types; arrays let tests assert coverage) ──
export const MEMORY_EVENT_TYPES = [
  "account_discovered", "identity_resolved", "account_qualified", "account_prioritized",
  "account_lowered", "account_excluded", "account_monitored", "account_delivered",
  "client_relationship_recorded", "outcome_recorded", "buyer_path_confirmed",
  "buyer_path_rejected", "evidence_added", "evidence_expired", "evidence_contradicted",
  "signal_detected", "signal_expired", "blocker_added", "blocker_resolved",
  "account_reopened", "account_suppressed", "account_reconsidered", "account_removed",
  "client_feedback_applied",
] as const;
export type MemoryEventType = (typeof MEMORY_EVENT_TYPES)[number];

export const HISTORICAL_DECISIONS = [
  "included", "prioritized", "investigated", "monitored", "excluded",
  "evidence_insufficient", "rejected", "delivered", "not_delivered",
] as const;
export type HistoricalDecision = (typeof HISTORICAL_DECISIONS)[number];

export const CLIENT_RELATIONSHIP_STATES = [
  "known_to_client", "previously_contacted", "active_conversation", "current_client",
  "former_client", "partner", "excluded_by_client", "client_interested",
  "client_not_interested", "relationship_unknown",
] as const;
export type ClientRelationshipState = (typeof CLIENT_RELATIONSHIP_STATES)[number];

// Outcome taxonomy (§7), grouped.
export const OUTCOME_STATUS_GROUPS = {
  pre_action: ["recommended", "selected", "deferred", "rejected_by_client", "conflict", "already_known", "already_in_progress"],
  action: ["contacted", "no_contact", "introduction_requested", "validation_started"],
  response: ["no_response", "positive_response", "neutral_response", "negative_response", "referred_to_other_person"],
  commercial: ["meeting_scheduled", "meeting_completed", "buyer_confirmed", "procurement_confirmed", "pilot_requested", "proposal_requested", "sample_requested", "opportunity_opened", "test_started", "order_received", "lost", "paused"],
} as const;
export type OutcomeStatusGroup = keyof typeof OUTCOME_STATUS_GROUPS;
export const OUTCOME_STATUSES = Object.values(OUTCOME_STATUS_GROUPS).flat();
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export const OUTCOME_REASONS = [
  "price_objection", "margin_objection", "volume_objection", "procurement_objection",
  "timing_objection", "product_fit_objection", "claims_objection", "logistics_objection",
  "documentation_objection", "buyer_path_wrong", "route_wrong", "recurrence_weak",
  "no_third_party_products", "account_too_large", "account_too_small",
  "wrong_business_model", "other",
] as const;
export type OutcomeReason = (typeof OUTCOME_REASONS)[number];

// Anti-repetition / novelty (§9–§10).
export const NOVELTY_STATES = [
  "genuinely_new", "previously_seen_not_delivered", "previously_delivered",
  "monitored_update", "reconsidered", "reopened", "suppressed", "excluded",
  "client_known", "duplicate_identity",
] as const;
export type NoveltyState = (typeof NOVELTY_STATES)[number];

export const MEANINGFUL_CHANGES = [
  "new_public_signal", "material_business_change", "new_route", "new_opportunity_mechanism",
  "prior_blocker_resolved", "prior_evidence_repaired", "client_requests_reconsideration",
  "outcome_changes_interpretation", "procurement_becomes_viable", "buyer_path_clearer",
  "meaningful_timing_event", "route_priority_change",
] as const;
export type MeaningfulChange = (typeof MEANINGFUL_CHANGES)[number];

// Reappearance policy (§17) — generic states, seeded per-account, never hardcoded here.
export const REAPPEARANCE_STATES = [
  "do_not_repeat", "monitor_only", "eligible_if_signal", "eligible_if_client_requests",
  "eligible_if_evidence_repaired", "eligible_if_blocker_resolved", "eligible_next_cycle",
  "permanently_excluded",
] as const;
export type ReappearanceState = (typeof REAPPEARANCE_STATES)[number];

// What Changed (§11).
export const CHANGE_TYPES = {
  account: ["new_account", "removed_account", "promoted_account", "lowered_account", "monitored_account", "reopened_account", "suppressed_account"],
  evidence: ["new_official_evidence", "stale_evidence", "contradictory_evidence", "stronger_identity", "weaker_identity", "blocker_resolved", "blocker_added"],
  commercial: ["buyer_path_confirmed", "buyer_path_rejected", "procurement_easier", "procurement_harder", "initial_test_clarified", "recurrence_strengthened", "recurrence_weakened", "route_validated", "route_weakened"],
  client: ["client_interested", "client_rejected", "account_already_known", "active_relationship", "conflict", "feedback_changed_priority", "outcome_changed_search_rules"],
  signal: ["active_signal", "signal_expired", "new_timing_evidence", "timing_removed", "no_meaningful_change"],
} as const;
export type ChangeCategory = keyof typeof CHANGE_TYPES;
export type ChangeType = (typeof CHANGE_TYPES)[ChangeCategory][number];

// Opportunity Cycle (§13).
export const CYCLE_STATES = [
  "planned", "context_review", "memory_loaded", "outcomes_loaded", "search_ready",
  "searching", "reviewing", "portfolio_ready", "report_ready", "founder_review",
  "ready_for_delivery", "delivered", "feedback_pending", "closed", "failed",
] as const;
export type CycleState = (typeof CYCLE_STATES)[number];

export const ROUTES = ["specialty_retail", "hospitality_spa", "gifting_cobranding", "distribution", "other"] as const;
export type Route = (typeof ROUTES)[number];

// ─── Record shapes ──────────────────────────────────────────────────────────
export interface AccountIdentity {
  canonical_id: string;
  canonical_name: string;
  alternate_names: string[];
  official_domain: string | null;
  geography: string | null;
  route: string;
  entity_type: string;
  parent_id: string | null;
}
export interface HistoricalDecisionRecord {
  cycle_id: string; date: string; group: string; recommendation: HistoricalDecision;
  reason: string; evidence_state: string; context_version: string | null;
  blueprint_version: string | null; actor: string; artifact: string | null;
}
export interface EvidenceMemory {
  facts: { claim: string; source_url: string | null; source_date: string | null; freshness: string }[];
  signals: string[]; inferences: string[]; counterevidence: string[]; unknowns: string[];
  last_reviewed: string | null; stale: boolean;
}
export interface CommercialMemory {
  buyer_function_hypothesis: string | null; decision_structure: string | null;
  procurement_burden: string | null; initial_test_hypothesis: string | null;
  recurrence_hypothesis: string | null; commercial_cycle_hypothesis: string | null;
  logistics_constraints: string[]; account_size_fit: string | null; route_fit: string | null;
}
export interface OutcomeMemorySummary {
  selected_for_action: boolean; contacted: boolean; latest_status: OutcomeStatus | null;
  latest_reason: OutcomeReason | null; opportunity_created: boolean; notes: string;
}
export interface ReviewMemory {
  last_reviewed: string | null; next_eligible_review: string | null;
  review_priority: "low" | "medium" | "high"; reopen_condition: string | null;
  suppression_state: boolean; suppression_reason: string | null;
}
export interface AccountMemory {
  identity: AccountIdentity;
  first_seen: { date: string; cycle_id: string; source: string; search_run: string | null; route: string; status: string };
  historical_decisions: HistoricalDecisionRecord[];
  evidence: EvidenceMemory;
  commercial: CommercialMemory;
  client: { states: ClientRelationshipState[] };
  outcomes: OutcomeMemorySummary;
  review: ReviewMemory;
  reappearance: ReappearanceState;
  novelty_default: NoveltyState;
}

export interface AccountMemoryEvent {
  event_id: string; account_id: string; tenant_id: string | null; client_id: string;
  cycle_id: string; event_type: MemoryEventType; timestamp: string; actor: string;
  source: string; previous_state: string | null; new_state: string | null;
  reason: string; evidence_ref?: string | null; note?: string;
}

export interface AccountOutcome {
  outcome_id: string; account_id: string; cycle_id: string; client_id: string;
  tenant_id: string | null; actor: string; outcome_date: string; primary_status: OutcomeStatus;
  status_group: OutcomeStatusGroup; reason_code: OutcomeReason | null;
  secondary_reason: OutcomeReason | null; notes: string; evidence_or_statement: string;
  follow_up_date: string | null; confidence: "low" | "medium" | "high";
  changes_future_recommendation: boolean; buyer_path?: "confirmed" | "rejected" | null;
  route_hypothesis?: "supported" | "unsupported" | null;
}

export interface NoveltyDecisionTrace {
  canonical_id: string; prior_appearances: string[]; prior_delivery_state: string;
  prior_exclusion_state: string; prior_outcomes: OutcomeStatus[]; prior_evidence: string;
  latest_meaningful_change: MeaningfulChange | null; novelty_decision: NoveltyState;
  eligible_as_new: boolean; eligible_as_update: boolean; eligible_as_reconsidered: boolean;
  suppression_reason: string | null; rule_applied: string;
}

export interface WhatChangedItem {
  account: string; category: ChangeCategory; change_type: ChangeType;
  previous_state: string; current_state: string; evidence: string; reason: string;
  effect_on_priority: string; effect_on_next_action: string; customer_safe_wording: string;
}
export interface WhatChanged {
  cycle_id: string; prior_cycle_id: string | null;
  internal: { items: WhatChangedItem[]; rule_ids: string[]; generated_from: "rules" };
  customer_safe: { changes: { what: string; why_it_matters: string; recommendation: string; uncertainty: string }[] };
}

export interface LearningRecommendation {
  id: string; type:
    "increase_route_priority" | "reduce_route_priority" | "strengthen_buyer_path" |
    "weaken_buyer_path" | "increase_procurement_penalty" | "reduce_procurement_penalty" |
    "add_exclusion_rule" | "add_validation_question" | "change_evidence_requirement" |
    "change_initial_test_assumptions" | "change_recurrence_expectations";
  supporting_outcomes: string[]; account_count: number; cycle_refs: string[];
  confidence: "low" | "medium" | "high"; counterevidence: string; proposed_change: string;
  human_approval_required: true;
}
export interface RouteLearning {
  route: Route; accounts_recommended: number; accounts_selected: number;
  accounts_contacted: number; response_rate: number | null; buyer_path_confirmed: number;
  objections: OutcomeReason[]; opportunities: number; tests: number; orders: number;
  losses: number; common_blockers: OutcomeReason[]; evidence_quality: string;
  learning: LearningRecommendation[]; status: "measured" | "awaiting_real_outcomes";
}

export interface OpportunityCycle {
  cycle_id: string; tenant_id: string | null; client_id: string; cycle_number: number;
  cycle_name: string; start_date: string | null; end_date: string | null; status: CycleState;
  prior_cycle_id: string | null; accepted_context_version: string | null;
  search_blueprint_version: string | null; account_memory_snapshot: string | null;
  feedback_snapshot: string | null; outcome_snapshot: string | null;
  novelty_policy_version: string; monitored_account_set: string[]; new_candidate_set: string[];
  final_new_account_portfolio: string[]; updated_prior_accounts: string[];
  removed_accounts: string[]; what_changed: string | null; action_briefs: string[];
  report_artifact: string | null; delivery_state: string; feedback_state: string;
  closure_state: string;
}

export const NOVELTY_POLICY_VERSION = "novelty-policy-v1";
export const RECURRING_CYCLE_MODEL_VERSION = "recurring-opportunity-cycle-v1";
