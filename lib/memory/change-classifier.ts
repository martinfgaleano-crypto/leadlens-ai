/**
 * Change Classifier — "What Changed Since Last Report" v0.
 *
 * Phase 1A (unchanged): simple ChangeTag from Account Memory only.
 *   Runs after applyAccountMemoryHints, before Source Layer.
 *   Functions: classifyAccountChange, applyChangeTagsToLeads.
 *
 * Phase 1B: richer ChangeType from AM + current EQ/freshness.
 *   Runs inside applyChangeSinceLastReportToReport, after all pipeline stages.
 *   Functions: classifyRichAccountChange, applyChangeSinceLastReportToReport.
 *
 * Phase 2 (this update): true previous snapshot comparison.
 *   When a previous completed snapshot is available (passed from pipeline.ts),
 *   previous_* fields are populated from actual prior run data instead of being null.
 *   Enables true deltas: definitive signal_became_stale, fresh_signal_added,
 *   priority_increased / priority_decreased, repeated_no_change.
 *   Functions: buildPreviousOpportunityMap.
 *
 * v0 scope limitation (documented):
 *   snapshot_reports.user_id is always null in the current schema — no per-customer
 *   scope exists. getPreviousCompletedSnapshot returns the latest completed snapshot
 *   across all users (safe for single-tenant / pre-launch). Once user_id is written,
 *   the pipeline must pass it to scope the lookup per customer.
 *
 * Rules enforced (from spec):
 *   1. do_not_show always wins (but those leads never reach us — filtered by AM hints).
 *   2. Negative feedback → excluded_by_feedback, not a positive change type.
 *   3. repeated_no_change cannot be a meaningful positive change.
 *   4. insufficient evidence → no fresh_signal_added, no priority_increased.
 *   5. Low evidence alone does not make priority_increased.
 *   6. No signal_date → no fresh_signal_added.
 *   7. Context-only source cannot trigger fresh_signal_added.
 *   8. vault_negative_match → priority_decreased, not excluded_by_feedback.
 *   9. Score/ranking order is not changed.
 *  10. No personal data introduced.
 *
 * Never throws. Never changes fit_score, category, ranking, or Evidence Quality.
 */

import type {
  ProcessedLead,
  AccountMemoryState,
  ChangeTag,
  ChangeType,
  LeadLensReport,
  LearningMetadata,
  RecommendedActionType,
  EvidenceQualityLevel,
  SourceFreshness,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCORE_DELTA_THRESHOLD = 1.5; // matches classifyAccountNovelty threshold

/** Feedback signals that represent explicit user rejection. */
const NEGATIVE_FEEDBACK_SIGNALS = new Set<string>([
  "not_useful", "irrelevant", "wrong_fit", "exclude_similar",
]);

// ─── Customer-facing labels ───────────────────────────────────────────────────

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  new_account:               "New this cycle",
  new_evidence:              "New evidence found",
  fresh_signal_added:        "Fresh signal added",
  signal_became_stale:       "Signal appears stale",
  priority_increased:        "Priority increased",
  priority_decreased:        "Priority decreased",
  repeated_with_new_evidence:"Seen before, new evidence",
  repeated_no_change:        "No meaningful change",
  excluded_by_feedback:      "Excluded based on your feedback",
  revived_account:           "Back on the radar",
  still_relevant:            "Still relevant",
  no_meaningful_change:      "No meaningful change",
};

// ─── Previous snapshot data ───────────────────────────────────────────────────

/**
 * Extracted per-account state from the most recent previous completed snapshot.
 * Populated by buildPreviousOpportunityMap when a previous snapshot is available.
 */
export interface PreviousOpportunitySnapshot {
  previous_evidence_quality: EvidenceQualityLevel | null;
  previous_source_freshness: SourceFreshness | null;
  previous_signal_date: string | null;
  previous_action: RecommendedActionType | null;
  previous_fit_score: number | null;
  previous_category: string | null;
}

// ─── Domain / company normalization (local — avoids circular dep with account-memory) ─

function normalizeDomainKey(domain: string | undefined | null): string | undefined {
  if (!domain) return undefined;
  const cleaned = domain
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();
  return cleaned || undefined;
}

function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a lookup map from a previous report's opportunities.
 * Key: normalized domain (preferred) OR normalized company name (fallback).
 * Sources identity data from processed_leads.candidate; state data from ranked_opportunities.
 */
export function buildPreviousOpportunityMap(
  prevReport: LeadLensReport,
): Map<string, PreviousOpportunitySnapshot> {
  const map = new Map<string, PreviousOpportunitySnapshot>();

  try {
    // Index ranked_opportunities by lead_id for O(1) lookup
    const rankByLeadId = new Map<string, {
      evidence_quality: EvidenceQualityLevel | undefined;
      source_freshness: SourceFreshness | undefined;
      signal_date: string | null | undefined;
      recommended_action: RecommendedActionType | undefined;
      fit_score: number;
      category: string;
    }>();

    for (const opp of prevReport.ranked_opportunities ?? []) {
      rankByLeadId.set(opp.lead_id, {
        evidence_quality:  opp.evidence_quality,
        source_freshness:  opp.current_source_freshness ?? (opp as unknown as Record<string, unknown>).source_freshness as SourceFreshness | undefined,
        signal_date:       opp.current_signal_date ?? null,
        recommended_action: opp.recommended_action,
        fit_score:         opp.fit_score,
        category:          opp.category,
      });
    }

    // Walk processed_leads for identity (domain + company)
    for (const lead of prevReport.processed_leads ?? []) {
      const rank = rankByLeadId.get(lead.id);
      if (!rank) continue;

      const snap: PreviousOpportunitySnapshot = {
        previous_evidence_quality: (lead.learning?.evidence_quality as EvidenceQualityLevel | undefined) ?? rank.evidence_quality ?? null,
        previous_source_freshness: (lead.learning?.source_freshness as SourceFreshness | undefined) ?? rank.source_freshness ?? null,
        previous_signal_date:      (lead.learning?.signal_date as string | null | undefined) ?? rank.signal_date ?? null,
        previous_action:           rank.recommended_action ?? null,
        previous_fit_score:        rank.fit_score,
        previous_category:         rank.category,
      };

      const domain = normalizeDomainKey(lead.candidate.domain);
      const company = normalizeCompanyKey(lead.candidate.company);

      // Domain is the preferred key (more reliable)
      if (domain) map.set(domain, snap);
      // Always register by company as fallback (may overwrite if two companies share a domain name — acceptable)
      if (!map.has(company)) map.set(company, snap);
    }
  } catch {
    // best-effort — return partial map rather than nothing
  }

  return map;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function categoryRank(category: string | null | undefined): number {
  switch (category) {
    case "HOT":     return 4;
    case "WARM":    return 3;
    case "COLD":    return 2;
    case "DISCARD": return 1;
    default:        return 0;
  }
}

function isNegativeFeedback(signal: string | null | undefined): boolean {
  return Boolean(signal && NEGATIVE_FEEDBACK_SIGNALS.has(signal));
}

/** Higher = more aggressive recommended action. Used to detect true priority shifts. */
function actionRank(action: RecommendedActionType | null | undefined): number {
  switch (action) {
    case "send_outreach_now":      return 5;
    case "validate_source_first":  return 4;
    case "monitor_for_new_signal": return 3;
    case "enrich_manually":        return 2;
    case "add_to_watchlist":       return 1;
    case "exclude":                return 0;
    default:                       return -1;
  }
}

// ─── Phase 1A: core classifier (Account Memory only) ─────────────────────────

export interface ChangeClassification {
  tag: ChangeTag;
  score_delta: number | null;
  prev_category: string | null;
  prev_score: number | null;
}

export function classifyAccountChange(
  memoryState: AccountMemoryState | undefined,
  currentCategory: string,
  currentFitScore: number,
  prevCategory: string | null | undefined,
  prevFitScore: number | null | undefined,
): ChangeClassification {
  const prev_score    = prevFitScore ?? null;
  const prev_category = prevCategory ?? null;
  const score_delta   = prev_score !== null
    ? Math.round((currentFitScore - prev_score) * 10) / 10
    : null;

  if (!memoryState || memoryState === "new_opportunity") {
    return { tag: "new", score_delta: null, prev_category: null, prev_score: null };
  }

  const currentRank = categoryRank(currentCategory);
  const prevRank    = categoryRank(prev_category);

  switch (memoryState) {
    case "reactivated_with_new_signal":
      return { tag: "promoted", score_delta, prev_category, prev_score };

    case "upgraded_priority": {
      const crossedUp = prevRank > 0 && currentRank > prevRank;
      return { tag: crossedUp ? "promoted" : "score_up", score_delta, prev_category, prev_score };
    }

    case "downgraded_priority": {
      const crossedDown = prevRank > 0 && currentRank < prevRank;
      return { tag: crossedDown ? "demoted" : "score_down", score_delta, prev_category, prev_score };
    }

    case "dropped":
      return { tag: "demoted", score_delta, prev_category, prev_score };

    case "previously_seen": {
      if (score_delta !== null) {
        if (score_delta >= SCORE_DELTA_THRESHOLD) {
          const crossedUp = prevRank > 0 && currentRank > prevRank;
          return { tag: crossedUp ? "promoted" : "score_up", score_delta, prev_category, prev_score };
        }
        if (score_delta <= -SCORE_DELTA_THRESHOLD) {
          const crossedDown = prevRank > 0 && currentRank < prevRank;
          return { tag: crossedDown ? "demoted" : "score_down", score_delta, prev_category, prev_score };
        }
      }
      return { tag: "unchanged", score_delta, prev_category, prev_score };
    }

    case "repeated_without_new_signal":
    default:
      return { tag: "unchanged", score_delta, prev_category, prev_score };
  }
}

// ─── Phase 1A: lead-level annotation ─────────────────────────────────────────

export function applyChangeTagsToLeads(leads: ProcessedLead[]): ProcessedLead[] {
  try {
    return leads.map(lead => {
      if (!lead.learning) return lead;
      try {
        const cls = classifyAccountChange(
          lead.learning.account_memory_state,
          lead.qualification.category,
          lead.qualification.fit_score,
          lead.learning.account_memory_last_category ?? null,
          lead.learning.account_memory_last_fit_score ?? null,
        );
        return {
          ...lead,
          learning: {
            ...lead.learning,
            change_tag:           cls.tag,
            change_score_delta:   cls.score_delta,
            change_prev_category: cls.prev_category,
            change_prev_score:    cls.prev_score,
          },
        };
      } catch {
        return lead;
      }
    });
  } catch {
    return leads;
  }
}

// ─── Phase 1B: rich change classification ────────────────────────────────────

export interface RichChangeClassification {
  change_type: ChangeType;
  change_label: string;
  change_reason: string;
  client_visible: boolean;
  suppression_reason?: string;
  // "previous_*" are null in v0 — no snapshot comparison available yet.
  previous_action: RecommendedActionType | null;
  current_action: RecommendedActionType | null;
  previous_evidence_quality: EvidenceQualityLevel | null;
  current_evidence_quality: EvidenceQualityLevel | null;
  previous_source_freshness: SourceFreshness | null;
  current_source_freshness: SourceFreshness | null;
  previous_signal_date: string | null;
  current_signal_date: string | null;
}

/**
 * Classify an account's commercial change type using all available evidence.
 * Runs after EQ and Source Layer — has access to full current learning state.
 * When prev is provided (Phase 2), uses true deltas from previous snapshot.
 *
 * Priority order (highest wins):
 *   1. excluded_by_feedback    — negative feedback signal on record
 *   2. new_account             — no AM record
 *   3. revived_account         — reactivated_with_new_signal + seen before
 *   4. fresh_signal_added      — fresh + signal_date (new in this run or signal changed)
 *   5. signal_became_stale     — was fresh/recent, now stale (definitive with prev; proxy without)
 *   6. priority_increased      — action improved vs previous, or promoted/score_up + evidence
 *   7. priority_decreased      — action degraded vs previous, or demoted/score_down or vault neg
 *   8. repeated_no_change      — same EQ+freshness+action as prev (definitive) or AM proxy
 *   9. new_evidence            — seen before + quality evidence + fresh/recent
 *  10. repeated_with_new_evidence — seen before + fresh signal this run
 *  11. still_relevant          — vault positive + quality evidence
 *  12. no_meaningful_change    — catch-all
 */
export function classifyRichAccountChange(
  learning: LearningMetadata,
  currentAction: RecommendedActionType | undefined,
  prev: PreviousOpportunitySnapshot | null = null,
): RichChangeClassification {
  // Pull fields from learning (all set by previous pipeline stages)
  const am_state       = learning.account_memory_state;
  const times_seen     = learning.account_memory_times_seen ?? 0;
  const prev_category  = learning.account_memory_last_category ?? null;
  const feedback_sig   = learning.account_memory_last_feedback_signal ?? null;
  const change_tag     = learning.change_tag ?? "unchanged";
  const score_delta_str = learning.change_score_delta != null
    ? `${learning.change_score_delta > 0 ? "+" : ""}${learning.change_score_delta}`
    : "n/a";

  // Current state (set by Source Layer + EQ)
  const curr_eq          = learning.evidence_quality ?? null;
  const curr_freshness   = learning.source_freshness ?? null;
  const curr_signal_date = learning.signal_date ?? null;
  const curr_source_cnt  = learning.source_count ?? 0;
  const is_context_only  = learning.is_context_only ?? true;  // conservative default
  const vault_neg        = learning.vault_negative_match ?? false;
  const vault_pos        = learning.vault_positive_match ?? false;
  const curr_action      = currentAction ?? null;

  // Previous state — from snapshot when available (Phase 2), null otherwise (Phase 1B proxy)
  const prev_action:    RecommendedActionType | null = prev?.previous_action    ?? null;
  const prev_eq:        EvidenceQualityLevel | null  = prev?.previous_evidence_quality ?? null;
  const prev_freshness: SourceFreshness | null       = prev?.previous_source_freshness ?? null;
  const prev_sig_date:  string | null                = prev?.previous_signal_date ?? null;

  // True action delta — only valid when both values are known
  const curr_action_rank = actionRank(curr_action);
  const prev_action_rank = actionRank(prev_action);
  const has_action_delta = prev_action !== null && curr_action !== null;
  const action_improved  = has_action_delta && curr_action_rank > prev_action_rank;
  const action_degraded  = has_action_delta && curr_action_rank < prev_action_rank;

  const base = {
    previous_action:           prev_action,
    current_action:            curr_action,
    previous_evidence_quality: prev_eq,
    current_evidence_quality:  curr_eq,
    previous_source_freshness: prev_freshness,
    current_source_freshness:  curr_freshness,
    previous_signal_date:      prev_sig_date,
    current_signal_date:       curr_signal_date,
  } as const;

  // ── 1. Negative feedback wins ────────────────────────────────────────────────
  if (isNegativeFeedback(feedback_sig)) {
    return {
      ...base,
      change_type:       "excluded_by_feedback",
      change_label:      CHANGE_TYPE_LABELS["excluded_by_feedback"],
      change_reason:     `Previous feedback signal: "${feedback_sig}"`,
      client_visible:    false,
      suppression_reason:`Feedback: ${feedback_sig}`,
    };
  }

  // ── 2. New account ───────────────────────────────────────────────────────────
  if (!am_state || am_state === "new_opportunity") {
    return {
      ...base,
      change_type:  "new_account",
      change_label: CHANGE_TYPE_LABELS["new_account"],
      change_reason:"No previous record in Account Memory for this client",
      client_visible: true,
    };
  }

  // ── 3. Revived account ───────────────────────────────────────────────────────
  if (am_state === "reactivated_with_new_signal") {
    const evidenceNote = (curr_eq && curr_eq !== "insufficient")
      ? ` with ${curr_eq} evidence`
      : "";
    return {
      ...base,
      change_type:  "revived_account",
      change_label: CHANGE_TYPE_LABELS["revived_account"],
      change_reason:`Was ${prev_category ?? "lower priority"}, now returned at higher priority${evidenceNote}`,
      client_visible: true,
    };
  }

  // ── 4. Fresh signal added ────────────────────────────────────────────────────
  // Rules: signal_date required, must not be context-only, seen before, not insufficient EQ.
  // Phase 2 refinement: if prev had no signal_date and current does, this is definitive.
  // Phase 1B proxy: fresh + timing source + seen before (signal_date may have existed before too).
  const signal_date_is_new = prev !== null
    ? (prev_sig_date === null && curr_signal_date !== null)
    : false; // proxy: can't be sure without prev data
  if (
    curr_freshness === "fresh"   &&
    curr_signal_date !== null    &&
    !is_context_only             &&
    times_seen >= 1              &&
    curr_eq !== "insufficient"
  ) {
    const sourceNote = learning.source_type ? ` via ${learning.source_type}` : "";
    const certainty  = signal_date_is_new ? "New fresh signal dated" : "Fresh signal dated";
    return {
      ...base,
      change_type:  "fresh_signal_added",
      change_label: CHANGE_TYPE_LABELS["fresh_signal_added"],
      change_reason:`${certainty} ${curr_signal_date}${sourceNote} (seen ${times_seen}x before)`,
      client_visible: true,
    };
  }

  // ── 5. Signal became stale ───────────────────────────────────────────────────
  // Phase 2: definitive when prev was fresh/recent and current is stale.
  // Phase 1B proxy: currently stale + timing source + seen multiple times.
  const freshness_degraded = prev !== null &&
    (prev_freshness === "fresh" || prev_freshness === "recent") &&
    curr_freshness === "stale";
  if (
    curr_freshness === "stale" &&
    !is_context_only           &&
    (freshness_degraded || times_seen >= 2)
  ) {
    const reason = freshness_degraded
      ? `Was ${prev_freshness} last report; now stale (${learning.freshness_label ?? "outdated"})`
      : `Seen ${times_seen}x; current signal is stale (${learning.freshness_label ?? "outdated"})`;
    return {
      ...base,
      change_type:       "signal_became_stale",
      change_label:      CHANGE_TYPE_LABELS["signal_became_stale"],
      change_reason:     reason,
      client_visible:    true,
      suppression_reason:"Stale signal — verify before acting",
    };
  }

  // ── 6. Priority increased ────────────────────────────────────────────────────
  // Phase 2: definitive action improvement (e.g. monitor → send_outreach_now).
  // Phase 1B proxy: AM promoted/score_up + evidence support (not context-only, not insufficient).
  if (
    action_improved ||
    (
      (change_tag === "promoted" || change_tag === "score_up") &&
      curr_eq !== "insufficient"                              &&
      !is_context_only
    )
  ) {
    const direction = action_improved
      ? `Action upgraded from "${prev_action}" to "${curr_action}"`
      : change_tag === "promoted" ? "Category improved" : "Score increased";
    return {
      ...base,
      change_type:  "priority_increased",
      change_label: CHANGE_TYPE_LABELS["priority_increased"],
      change_reason:`${direction} from ${prev_category ?? "previous"} (Δ${score_delta_str}) with ${curr_eq ?? "some"} evidence`,
      client_visible: true,
    };
  }

  // ── 7. Priority decreased ────────────────────────────────────────────────────
  // Phase 2: definitive action degradation; Phase 1B proxy: AM demoted/score_down or vault neg.
  if (action_degraded || change_tag === "demoted" || change_tag === "score_down" || vault_neg) {
    const direction = action_degraded
      ? `Action downgraded from "${prev_action}" to "${curr_action}"`
      : change_tag === "demoted" ? "Category dropped"
      : change_tag === "score_down" ? "Score decreased"
      : "Vault negative pattern";
    return {
      ...base,
      change_type:       "priority_decreased",
      change_label:      CHANGE_TYPE_LABELS["priority_decreased"],
      change_reason:     `${direction} from ${prev_category ?? "previous"} (Δ${score_delta_str})`,
      client_visible:    true,
      suppression_reason: (action_degraded || change_tag === "demoted") ? "Priority decreased since last report" : undefined,
    };
  }

  // ── 8. Repeated no change ────────────────────────────────────────────────────
  // Phase 2: definitive when EQ, freshness, AND action are identical to previous.
  // Phase 1B proxy: AM repeated_without_new_signal + no fresh signal + weak EQ.
  const definitively_unchanged = prev !== null &&
    prev_eq === curr_eq &&
    prev_freshness === curr_freshness &&
    prev_action === curr_action;
  if (
    definitively_unchanged ||
    (
      am_state === "repeated_without_new_signal" &&
      curr_freshness !== "fresh"                 &&
      (curr_eq === "low" || curr_eq === "insufficient" || curr_eq == null)
    )
  ) {
    return {
      ...base,
      change_type:       "repeated_no_change",
      change_label:      CHANGE_TYPE_LABELS["repeated_no_change"],
      change_reason:     definitively_unchanged
        ? `Same EQ (${curr_eq}), freshness (${curr_freshness}), and action as previous report`
        : `Seen ${times_seen}x with no new signal or evidence improvement`,
      client_visible:    false,
      suppression_reason:"No new evidence since last report",
    };
  }

  // ── 9. New evidence (proxy: seen before + quality evidence + fresh/recent) ────
  if (
    times_seen >= 1                                          &&
    curr_source_cnt >= 1                                     &&
    !is_context_only                                         &&
    (curr_eq === "high" || curr_eq === "medium")             &&
    (curr_freshness === "fresh" || curr_freshness === "recent") &&
    am_state !== "repeated_without_new_signal"
  ) {
    return {
      ...base,
      change_type:  "new_evidence",
      change_label: CHANGE_TYPE_LABELS["new_evidence"],
      change_reason:`${curr_source_cnt} source(s), evidence: ${curr_eq}, freshness: ${curr_freshness}`,
      client_visible: true,
    };
  }

  // ── 10. Repeated with new evidence ───────────────────────────────────────────
  if (times_seen >= 1 && curr_freshness === "fresh" && curr_signal_date !== null) {
    return {
      ...base,
      change_type:  "repeated_with_new_evidence",
      change_label: CHANGE_TYPE_LABELS["repeated_with_new_evidence"],
      change_reason:`Seen ${times_seen}x before; fresh signal found dated ${curr_signal_date}`,
      client_visible: true,
    };
  }

  // ── 11. Still relevant (vault positive + quality evidence) ───────────────────
  if (vault_pos && (curr_eq === "high" || curr_eq === "medium")) {
    return {
      ...base,
      change_type:  "still_relevant",
      change_label: CHANGE_TYPE_LABELS["still_relevant"],
      change_reason:`Positive vault pattern match; ${curr_eq} evidence, seen ${times_seen}x`,
      client_visible: true,
    };
  }

  // ── 12. No meaningful change (catch-all) ─────────────────────────────────────
  return {
    ...base,
    change_type:       "no_meaningful_change",
    change_label:      CHANGE_TYPE_LABELS["no_meaningful_change"],
    change_reason:     `Seen ${times_seen}x; no commercially meaningful change detected`,
    client_visible:    false,
    suppression_reason:"No significant change since last report",
  };
}

// ─── Phase 1A + 1B + 2 combined: report-level annotation ─────────────────────

export function applyChangeSinceLastReportToReport(
  report: LeadLensReport,
  prevReport: LeadLensReport | null = null,
): LeadLensReport {
  try {
    if (!report.ranked_opportunities?.length) return report;

    // Build lookup by lead_id
    const leadMap = new Map(
      (report.processed_leads ?? []).map(l => [l.id, l])
    );

    // Phase 2: build previous opportunity map keyed by domain/company when prev available
    const prevOppMap = prevReport ? buildPreviousOpportunityMap(prevReport) : null;

    // Phase 1A counts (preserved)
    let new_count = 0, promoted_count = 0, demoted_count = 0;
    let score_up_count = 0, score_down_count = 0, unchanged_count = 0;

    // Phase 1B counts
    const by_type: Partial<Record<ChangeType, number>> = {};
    let client_visible_count = 0;

    // Pre-compute rich classifications (keyed by lead_id)
    const richMap = new Map<string, RichChangeClassification>();
    for (const opp of report.ranked_opportunities) {
      const lead = leadMap.get(opp.lead_id);
      const lm = lead?.learning;
      if (!lm) continue;
      try {
        // Phase 2: look up previous data by domain (primary) or company (fallback)
        let prevSnap: PreviousOpportunitySnapshot | null = null;
        if (prevOppMap) {
          const domain = normalizeDomainKey(lead.candidate.domain);
          const company = normalizeCompanyKey(lead.candidate.company);
          prevSnap = (domain && prevOppMap.get(domain)) || prevOppMap.get(company) || null;
        }
        richMap.set(opp.lead_id, classifyRichAccountChange(lm, opp.recommended_action, prevSnap));
      } catch {
        // best-effort per lead
      }
    }

    // Patch ranked_opportunities
    const patched = report.ranked_opportunities.map(opp => {
      const lm = leadMap.get(opp.lead_id)?.learning;

      // Phase 1A counts
      const tag = lm?.change_tag;
      if (tag) {
        switch (tag) {
          case "new":        new_count++;        break;
          case "promoted":   promoted_count++;   break;
          case "demoted":    demoted_count++;    break;
          case "score_up":   score_up_count++;   break;
          case "score_down": score_down_count++; break;
          case "unchanged":  unchanged_count++;  break;
        }
      }

      const cls = richMap.get(opp.lead_id);

      // Phase 1B counts
      if (cls) {
        by_type[cls.change_type] = (by_type[cls.change_type] ?? 0) + 1;
        if (cls.client_visible) client_visible_count++;
      }

      return {
        ...opp,
        // Phase 1A fields (preserved)
        ...(lm?.change_tag !== undefined ? {
          change_tag:           lm.change_tag,
          change_score_delta:   lm.change_score_delta   ?? null,
          change_prev_category: lm.change_prev_category ?? null,
        } : {}),
        // Phase 1B fields
        ...(cls ? {
          change_type:                cls.change_type,
          change_label:               cls.change_label,
          change_reason:              cls.change_reason,
          client_visible:             cls.client_visible,
          suppression_reason:         cls.suppression_reason,
          previous_action:            cls.previous_action,
          current_action:             cls.current_action,
          previous_evidence_quality:  cls.previous_evidence_quality,
          current_evidence_quality:   cls.current_evidence_quality,
          previous_source_freshness:  cls.previous_source_freshness,
          current_source_freshness:   cls.current_source_freshness,
          previous_signal_date:       cls.previous_signal_date,
          current_signal_date:        cls.current_signal_date,
        } : {}),
      };
    });

    // Patch processed_leads too (richer fields written back to learning)
    const patchedLeads = (report.processed_leads ?? []).map(lead => {
      const cls = richMap.get(lead.id);
      if (!cls || !lead.learning) return lead;
      return {
        ...lead,
        learning: {
          ...lead.learning,
          change_type:               cls.change_type,
          change_label:              cls.change_label,
          change_reason:             cls.change_reason,
          client_visible:            cls.client_visible,
          suppression_reason:        cls.suppression_reason,
          previous_action:           cls.previous_action,
          current_action:            cls.current_action,
          previous_evidence_quality: cls.previous_evidence_quality,
          current_evidence_quality:  cls.current_evidence_quality,
          previous_source_freshness: cls.previous_source_freshness,
          current_source_freshness:  cls.current_source_freshness,
          previous_signal_date:      cls.previous_signal_date,
          current_signal_date:       cls.current_signal_date,
        },
      };
    });

    return {
      ...report,
      processed_leads:      patchedLeads,
      ranked_opportunities: patched,
      change_summary: {
        new_count,
        promoted_count,
        demoted_count,
        score_up_count,
        score_down_count,
        unchanged_count,
        by_type,
        client_visible_count,
      },
    };
  } catch {
    return report;
  }
}
