// Recurring Opportunity Cycle V1 — deterministic engine.
// Pure functions: no I/O, no provider calls, no ranking mutation. Learning only
// *recommends* (human approval required). Novelty is fully traceable.
import {
  type AccountMemory, type AccountMemoryEvent, type AccountOutcome, type MemoryEventType,
  type NoveltyDecisionTrace, type NoveltyState, type MeaningfulChange, type OpportunityCycle,
  type OutcomeStatus, type OutcomeStatusGroup, type OutcomeReason, type Route, type RouteLearning,
  type WhatChanged, type WhatChangedItem, OUTCOME_STATUS_GROUPS, OUTCOME_STATUSES, OUTCOME_REASONS,
  MEANINGFUL_CHANGES, NOVELTY_POLICY_VERSION, ROUTES,
} from "./model";

const sha = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
};

export const statusGroupOf = (status: OutcomeStatus): OutcomeStatusGroup => {
  for (const [group, list] of Object.entries(OUTCOME_STATUS_GROUPS)) {
    if ((list as readonly string[]).includes(status)) return group as OutcomeStatusGroup;
  }
  throw new Error(`unknown outcome status ${status}`);
};

// ─── Outcome validation (§7) — deterministic; never fabricates ────────────────
export interface OutcomeInput {
  account_id: string; cycle_id: string; client_id: string; tenant_id?: string | null;
  actor: string; outcome_date: string; primary_status: string; reason_code?: string | null;
  secondary_reason?: string | null; notes?: string; evidence_or_statement?: string;
  follow_up_date?: string | null; confidence?: string; changes_future_recommendation?: boolean;
  buyer_path?: "confirmed" | "rejected" | null; route_hypothesis?: "supported" | "unsupported" | null;
}
export type OutcomeValidation = { ok: true; outcome: AccountOutcome } | { ok: false; errors: string[] };

export function validateOutcome(input: OutcomeInput): OutcomeValidation {
  const errors: string[] = [];
  if (!input.account_id) errors.push("account_id required");
  if (!input.cycle_id) errors.push("cycle_id required");
  if (!input.client_id) errors.push("client_id required");
  if (!input.actor) errors.push("actor required");
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.outcome_date ?? "")) errors.push("outcome_date must be ISO date");
  if (!(OUTCOME_STATUSES as readonly string[]).includes(input.primary_status)) errors.push(`invalid primary_status '${input.primary_status}'`);
  if (input.reason_code && !(OUTCOME_REASONS as readonly string[]).includes(input.reason_code)) errors.push(`invalid reason_code '${input.reason_code}'`);
  if (input.secondary_reason && !(OUTCOME_REASONS as readonly string[]).includes(input.secondary_reason)) errors.push(`invalid secondary_reason '${input.secondary_reason}'`);
  const confidence = input.confidence ?? "medium";
  if (!["low", "medium", "high"].includes(confidence)) errors.push("invalid confidence");
  if ((input.notes ?? "").length > 4000) errors.push("notes too long");
  if (errors.length) return { ok: false, errors };
  const status = input.primary_status as OutcomeStatus;
  const outcome: AccountOutcome = {
    outcome_id: `outcome_${sha(`${input.account_id}:${input.cycle_id}:${input.outcome_date}:${status}`)}`,
    account_id: input.account_id, cycle_id: input.cycle_id, client_id: input.client_id,
    tenant_id: input.tenant_id ?? null, actor: input.actor, outcome_date: input.outcome_date,
    primary_status: status, status_group: statusGroupOf(status),
    reason_code: (input.reason_code as OutcomeReason) ?? null,
    secondary_reason: (input.secondary_reason as OutcomeReason) ?? null,
    notes: input.notes ?? "", evidence_or_statement: input.evidence_or_statement ?? "",
    follow_up_date: input.follow_up_date ?? null, confidence: confidence as "low" | "medium" | "high",
    changes_future_recommendation: Boolean(input.changes_future_recommendation),
    buyer_path: input.buyer_path ?? null, route_hypothesis: input.route_hypothesis ?? null,
  };
  return { ok: true, outcome };
}

export function buildMemoryEvent(e: Omit<AccountMemoryEvent, "event_id">): AccountMemoryEvent {
  return { ...e, event_id: `evt_${sha(`${e.account_id}:${e.cycle_id}:${e.event_type}:${e.timestamp}`)}` };
}
// Append-only: never overwrite; return a new, time-sorted array.
export function appendEvents(log: AccountMemoryEvent[], events: AccountMemoryEvent[]): AccountMemoryEvent[] {
  const seen = new Set(log.map((x) => x.event_id));
  const out = [...log];
  for (const e of events) if (!seen.has(e.event_id)) { seen.add(e.event_id); out.push(e); }
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ─── Anti-repetition / novelty (§9–§10) — every decision fully traced ─────────
export function decideNovelty(
  candidate: { canonical_id: string },
  memory: AccountMemory | null,
  meaningfulChange: MeaningfulChange | null = null,
  clientRequestsReconsideration = false,
): NoveltyDecisionTrace {
  // Genuinely new: no prior memory record at all.
  if (!memory) {
    return {
      canonical_id: candidate.canonical_id, prior_appearances: [], prior_delivery_state: "none",
      prior_exclusion_state: "none", prior_outcomes: [], prior_evidence: "none",
      latest_meaningful_change: null, novelty_decision: "genuinely_new", eligible_as_new: true,
      eligible_as_update: false, eligible_as_reconsidered: false, suppression_reason: null,
      rule_applied: "R1:no-prior-memory→genuinely_new",
    };
  }
  const appearances = memory.historical_decisions.map((d) => d.cycle_id);
  const delivered = memory.historical_decisions.some((d) => d.recommendation === "delivered");
  const excluded = memory.reappearance === "permanently_excluded" ||
    memory.historical_decisions.some((d) => d.recommendation === "rejected");
  const priorOutcomes = memory.outcomes.latest_status ? [memory.outcomes.latest_status] : [];
  const base = {
    canonical_id: candidate.canonical_id, prior_appearances: appearances,
    prior_delivery_state: delivered ? "delivered" : "not_delivered",
    prior_exclusion_state: excluded ? "excluded" : "none", prior_outcomes: priorOutcomes,
    prior_evidence: memory.evidence.stale ? "stale" : "current",
    latest_meaningful_change: meaningfulChange,
  };
  // Permanently excluded → suppressed unless the seeded reopen condition is met by a change.
  if (memory.reappearance === "permanently_excluded") {
    return { ...base, novelty_decision: "excluded", eligible_as_new: false, eligible_as_update: false, eligible_as_reconsidered: false, suppression_reason: memory.review.suppression_reason ?? "permanently_excluded", rule_applied: "R2:permanently_excluded→excluded" };
  }
  // Client-requested reconsideration is an explicit meaningful change.
  // (permanently_excluded already returned above.)
  if (clientRequestsReconsideration) {
    return { ...base, latest_meaningful_change: "client_requests_reconsideration", novelty_decision: "reconsidered", eligible_as_new: false, eligible_as_update: false, eligible_as_reconsidered: true, suppression_reason: null, rule_applied: "R3:client_requests_reconsideration→reconsidered" };
  }
  // A meaningful change (and rediscovery is NOT one) can promote to update/reopen.
  const isMeaningful = meaningfulChange !== null && (MEANINGFUL_CHANGES as readonly string[]).includes(meaningfulChange);
  if (delivered) {
    if (isMeaningful) {
      return { ...base, novelty_decision: "monitored_update", eligible_as_new: false, eligible_as_update: true, eligible_as_reconsidered: false, suppression_reason: null, rule_applied: `R4:delivered+meaningful_change(${meaningfulChange})→monitored_update` };
    }
    return { ...base, novelty_decision: "previously_delivered", eligible_as_new: false, eligible_as_update: false, eligible_as_reconsidered: false, suppression_reason: "already delivered; no meaningful change (rediscovery is not a change)", rule_applied: "R5:delivered+no_change→previously_delivered(suppressed_as_new)" };
  }
  // Seen but not delivered: eligible for reconsideration only with a meaningful change.
  if (isMeaningful) {
    return { ...base, novelty_decision: "reconsidered", eligible_as_new: false, eligible_as_update: false, eligible_as_reconsidered: true, suppression_reason: null, rule_applied: `R6:seen_not_delivered+meaningful_change(${meaningfulChange})→reconsidered` };
  }
  return { ...base, novelty_decision: "previously_seen_not_delivered", eligible_as_new: false, eligible_as_update: false, eligible_as_reconsidered: false, suppression_reason: "seen before without delivery; no meaningful change", rule_applied: "R7:seen_not_delivered+no_change→previously_seen_not_delivered(suppressed_as_new)" };
}

// ─── What Changed (§11–§12) ───────────────────────────────────────────────────
export function buildWhatChanged(cycle_id: string, prior_cycle_id: string | null, items: WhatChangedItem[]): WhatChanged {
  const rule_ids = items.map((i) => `WC:${i.category}:${i.change_type}`);
  return {
    cycle_id, prior_cycle_id,
    internal: { items, rule_ids, generated_from: "rules" },
    customer_safe: {
      changes: items.map((i) => ({
        what: i.customer_safe_wording, why_it_matters: i.reason,
        recommendation: i.effect_on_next_action, uncertainty: "Sujeto a confirmación de relación y validación comercial.",
      })),
    },
  };
}
// Customer-safe output must never leak internal codes.
const INTERNAL_TOKEN = /(WC:|R\d:|rule_applied|blueprint|compiler|provider|confidence|counterevidence|reason_code|_objection)/i;
export function isCustomerSafe(wc: WhatChanged): boolean {
  return wc.customer_safe.changes.every((c) => !INTERNAL_TOKEN.test(`${c.what} ${c.why_it_matters} ${c.recommendation} ${c.uncertainty}`));
}

// ─── Route-level learning (§18–§19) — never rewrites ranking, only recommends ──
export function aggregateRouteLearning(route: Route, outcomes: AccountOutcome[]): RouteLearning {
  const r = outcomes.filter((o) => o.route_hypothesis !== undefined);
  if (outcomes.length === 0) {
    return { route, accounts_recommended: 0, accounts_selected: 0, accounts_contacted: 0, response_rate: null, buyer_path_confirmed: 0, objections: [], opportunities: 0, tests: 0, orders: 0, losses: 0, common_blockers: [], evidence_quality: "unknown", learning: [], status: "awaiting_real_outcomes" };
  }
  const accounts = new Set(outcomes.map((o) => o.account_id));
  const contacted = outcomes.filter((o) => o.primary_status === "contacted").length;
  const responses = outcomes.filter((o) => o.status_group === "response").length;
  const positive = outcomes.filter((o) => o.primary_status === "positive_response").length;
  const objections = Array.from(new Set(outcomes.map((o) => o.reason_code).filter((x): x is OutcomeReason => Boolean(x))));
  return {
    route, accounts_recommended: accounts.size, accounts_selected: outcomes.filter((o) => o.primary_status === "selected").length,
    accounts_contacted: contacted, response_rate: contacted ? Math.round((responses / contacted) * 100) / 100 : null,
    buyer_path_confirmed: outcomes.filter((o) => o.buyer_path === "confirmed").length, objections,
    opportunities: outcomes.filter((o) => o.primary_status === "opportunity_opened").length,
    tests: outcomes.filter((o) => o.primary_status === "test_started").length,
    orders: outcomes.filter((o) => o.primary_status === "order_received").length,
    losses: outcomes.filter((o) => o.primary_status === "lost").length,
    common_blockers: objections, evidence_quality: positive > 0 ? "supported" : "unproven", learning: [], status: "measured",
  };
}
// Per-route report. `routeOf` maps an account_id to its Route (from Account Memory).
export function routeLearningReport(outcomes: AccountOutcome[], routeOf: (accountId: string) => Route): RouteLearning[] {
  return ROUTES.map((route) => aggregateRouteLearning(route, outcomes.filter((o) => routeOf(o.account_id) === route)));
}

// ─── Identity consolidation (§16) — deterministic; conservative ───────────────
export interface ConsolidationDecision { merged: boolean; canonical_id: string; aliases: string[]; confidence: "low" | "medium" | "high"; evidence: string; rejected_reason: string | null; }
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const domainRoot = (d: string | null) => (d ?? "").toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
const SOCIAL = /(instagram|facebook|linkedin|tiktok|twitter|x)\.com/;
export function consolidateIdentity(
  a: { canonical_id: string; canonical_name: string; official_domain: string | null; aliases?: string[] },
  b: { canonical_id: string; canonical_name: string; official_domain: string | null },
): ConsolidationDecision {
  const da = domainRoot(a.official_domain), db = domainRoot(b.official_domain);
  // Same official (non-social) domain → high-confidence merge.
  if (da && db && da === db && !SOCIAL.test(da)) {
    return { merged: true, canonical_id: a.canonical_id, aliases: Array.from(new Set([...(a.aliases ?? []), b.canonical_name])), confidence: "high", evidence: `shared official domain ${da}`, rejected_reason: null };
  }
  // Names similar but domains differ (or social only) → do NOT merge on name alone.
  if (norm(a.canonical_name) === norm(b.canonical_name) && da && db && da !== db) {
    return { merged: false, canonical_id: a.canonical_id, aliases: a.aliases ?? [], confidence: "low", evidence: `same normalized name but different domains (${da} vs ${db})`, rejected_reason: "name match with conflicting domains is insufficient to merge" };
  }
  if (norm(a.canonical_name) === norm(b.canonical_name) && (!da || !db)) {
    return { merged: false, canonical_id: a.canonical_id, aliases: a.aliases ?? [], confidence: "low", evidence: "name match without a confirmable shared domain", rejected_reason: "insufficient evidence to merge on name similarity alone" };
  }
  return { merged: false, canonical_id: a.canonical_id, aliases: a.aliases ?? [], confidence: "low", evidence: "no shared domain and no exact normalized-name match", rejected_reason: "distinct entities" };
}

// ─── Cycle (§13) ──────────────────────────────────────────────────────────────
export function createCycle(input: Partial<OpportunityCycle> & { client_id: string; cycle_number: number }): OpportunityCycle {
  return {
    cycle_id: input.cycle_id ?? `cycle_${input.client_id}_${input.cycle_number}`, tenant_id: input.tenant_id ?? null,
    client_id: input.client_id, cycle_number: input.cycle_number, cycle_name: input.cycle_name ?? `Ciclo ${input.cycle_number}`,
    start_date: input.start_date ?? null, end_date: input.end_date ?? null, status: input.status ?? "planned",
    prior_cycle_id: input.prior_cycle_id ?? null, accepted_context_version: input.accepted_context_version ?? null,
    search_blueprint_version: input.search_blueprint_version ?? null, account_memory_snapshot: input.account_memory_snapshot ?? null,
    feedback_snapshot: input.feedback_snapshot ?? null, outcome_snapshot: input.outcome_snapshot ?? null,
    novelty_policy_version: input.novelty_policy_version ?? NOVELTY_POLICY_VERSION,
    monitored_account_set: input.monitored_account_set ?? [], new_candidate_set: input.new_candidate_set ?? [],
    final_new_account_portfolio: input.final_new_account_portfolio ?? [], updated_prior_accounts: input.updated_prior_accounts ?? [],
    removed_accounts: input.removed_accounts ?? [], what_changed: input.what_changed ?? null, action_briefs: input.action_briefs ?? [],
    report_artifact: input.report_artifact ?? null, delivery_state: input.delivery_state ?? "none",
    feedback_state: input.feedback_state ?? "none", closure_state: input.closure_state ?? "open",
  };
}

// ─── Memory counters (for the readiness view) ─────────────────────────────────
export function memoryCounters(memory: AccountMemory[]) {
  const delivered = memory.filter((m) => m.historical_decisions.some((d) => d.recommendation === "delivered"));
  const suppressed = memory.filter((m) => m.review.suppression_state);
  const monitored = memory.filter((m) => m.reappearance === "monitor_only" || m.historical_decisions.some((d) => d.recommendation === "monitored"));
  return {
    total: memory.length, delivered: delivered.length, suppressed: suppressed.length,
    monitored: monitored.length, excluded: memory.filter((m) => m.reappearance === "permanently_excluded").length,
    reappearance_breakdown: memory.reduce<Record<string, number>>((acc, m) => { acc[m.reappearance] = (acc[m.reappearance] ?? 0) + 1; return acc; }, {}),
  };
}
