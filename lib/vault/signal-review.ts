// ─── Vault signal governance: rights, evidence tiers, review state machine ────
// Human review turns pending provider-search signals into governed intelligence.
// Append-only audit trail; every decision has reviewer + timestamp + reasons and
// is revocable. Effects on the coarse vault_signals.review_status are applied
// only for terminal decisions; the fine governance state lives in the reviews
// table. Rights gate customer display; evidence tier + blocking rules gate
// approval. Never auto-approves; never deletes rejected intelligence.

export const RIGHTS_STATUSES = [
  "metadata_only", "link_and_summary_allowed", "short_excerpt_allowed",
  "customer_display_allowed", "internal_only", "restricted", "unknown",
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

/** Rights that permit showing a link + our own summary to a customer. */
const CUSTOMER_DISPLAY_RIGHTS: RightsStatus[] = ["link_and_summary_allowed", "short_excerpt_allowed", "customer_display_allowed"];

export const EVIDENCE_TIERS = ["A", "B", "C", "D", "E"] as const;
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export const REVIEW_DECISIONS = [
  "approved", "approved_monitor_only", "quarantined", "rejected", "duplicate", "in_review", "revoked",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REASON_CODES = [
  "correct_company", "wrong_company", "valid_date", "invalid_date", "grounded_claim",
  "unsupported_claim", "valid_signal", "generic_mention", "stale_signal", "continuing_signal",
  "duplicate_event", "syndicated_source", "insufficient_evidence", "rights_unknown",
  "rights_restricted", "customer_display_allowed", "monitor_only", "contradiction",
  "qualified_opportunity", "not_actionable",
] as const;
export type ReviewReasonCode = (typeof REASON_CODES)[number];

export type ReviewOrigin = "human" | "ai_assisted" | "system_auto";

export interface ReviewInput {
  signalId: string;
  reviewerId: string;
  /** Who adjudicated. AI reviews must NEVER be recorded as human. */
  origin?: ReviewOrigin;                     // default "human" (UI path)
  reviewerAgent?: string | null;             // e.g. "claude-fable-5" when ai_assisted
  policyVersion?: string | null;
  confidence?: number | null;
  requiresHumanConfirmation?: boolean;
  decision: ReviewDecision;
  rightsStatus?: RightsStatus | null;
  evidenceTier?: EvidenceTier | null;
  verdicts?: { company_match?: boolean; date_valid?: boolean; claim?: boolean; signal?: boolean; opportunity?: boolean };
  reasonCodes?: string[];
  note?: string | null;
  duplicateClusterId?: string | null;
  canonicalSignalId?: string | null;
}

export interface ReviewResult { ok: boolean; signalId: string; effective_status: string; customer_eligible: boolean; reason?: string }

/** Blocking rules — cannot be customer-approved when any holds. */
export function customerApprovalBlocked(input: {
  evidenceTier?: EvidenceTier | null; rightsStatus?: RightsStatus | null;
  verdicts?: ReviewInput["verdicts"]; reasonCodes?: string[];
}): string | null {
  const rc = input.reasonCodes ?? [];
  if (input.verdicts?.company_match === false || rc.includes("wrong_company")) return "company mismatch";
  if (input.verdicts?.date_valid === false || rc.includes("invalid_date")) return "invalid/future date";
  if (input.verdicts?.claim === false || rc.includes("unsupported_claim")) return "unsupported claim";
  if (rc.includes("contradiction")) return "unresolved contradiction";
  if (input.evidenceTier === "E") return "evidence tier E";
  if (input.rightsStatus === "restricted" || input.rightsStatus === "internal_only" || input.rightsStatus === "metadata_only") return "rights do not allow customer display";
  if (input.rightsStatus && !CUSTOMER_DISPLAY_RIGHTS.includes(input.rightsStatus)) return "rights unresolved for customer display";
  return null;
}

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

/** Append a review decision (audit trail) and apply terminal effects.
 *  - approved (customer): signal.review_status=approved + source rights=permitted
 *    ONLY when rights allow customer display and no blocking rule holds.
 *  - approved_monitor_only: signal.review_status=approved, source rights left as-is
 *    (not customer-permitted → selector's customer path won't surface it).
 *  - quarantined/rejected/duplicate: signal.review_status=rejected (data kept).
 *  - revoked: signal.review_status=pending_review (reversible). */
export async function reviewVaultSignal(input: ReviewInput): Promise<ReviewResult> {
  const db = await getDb();
  if (!db) return { ok: false, signalId: input.signalId, effective_status: "unknown", customer_eligible: false, reason: "Supabase not configured" };
  if (!input.reviewerId) return { ok: false, signalId: input.signalId, effective_status: "unknown", customer_eligible: false, reason: "reviewer identity required" };
  if (!REVIEW_DECISIONS.includes(input.decision)) return { ok: false, signalId: input.signalId, effective_status: "unknown", customer_eligible: false, reason: "invalid decision" };

  // Prior version for audit continuity.
  const { data: prior } = await db.from("vault_signal_reviews").select("review_version").eq("signal_id", input.signalId).order("reviewed_at", { ascending: false }).limit(1).maybeSingle();
  const version = (prior?.review_version ?? 0) + 1;

  const block = (input.decision === "approved")
    ? customerApprovalBlocked({ evidenceTier: input.evidenceTier, rightsStatus: input.rightsStatus, verdicts: input.verdicts, reasonCodes: input.reasonCodes })
    : null;
  // A customer approval that is blocked is downgraded to monitor-only, never silently promoted.
  const effectiveDecision: ReviewDecision = block ? "approved_monitor_only" : input.decision;

  const { error: insErr } = await db.from("vault_signal_reviews").insert({
    signal_id: input.signalId,
    reviewer_user_id: input.reviewerId,
    review_status: effectiveDecision,
    rights_status: input.rightsStatus ?? null,
    evidence_tier: input.evidenceTier ?? null,
    company_match_verdict: input.verdicts?.company_match ?? null,
    date_verdict: input.verdicts?.date_valid ?? null,
    claim_verdict: input.verdicts?.claim ?? null,
    signal_verdict: input.verdicts?.signal ?? null,
    opportunity_verdict: input.verdicts?.opportunity ?? null,
    duplicate_cluster_id: input.duplicateClusterId ?? null,
    canonical_signal_id: input.canonicalSignalId ?? null,
    reason_codes: (input.reasonCodes ?? []).slice(0, 12),
    reviewer_note: input.note ?? null,
    review_version: version,
    // Origin columns (036). AI-assisted is explicit and always flagged for
    // human confirmation; pre-036 DBs fail here → caller sees migration hint.
    review_origin: input.origin ?? "human",
    reviewer_agent: input.reviewerAgent ?? null,
    review_policy_version: input.policyVersion ?? null,
    review_confidence: input.confidence ?? null,
    requires_human_confirmation: input.origin === "ai_assisted" ? true : (input.requiresHumanConfirmation ?? false),
  });
  if (insErr) {
    const originMissing = /review_origin|reviewer_agent|schema cache/i.test(insErr.message) && (input.origin ?? "human") === "human";
    if (originMissing) {
      // Pre-036 fallback for HUMAN reviews only: retry without origin columns.
      // AI-assisted reviews fail closed — they must never be recorded unmarked.
      const { error: retryErr } = await db.from("vault_signal_reviews").insert({
        signal_id: input.signalId, reviewer_user_id: input.reviewerId, review_status: effectiveDecision,
        rights_status: input.rightsStatus ?? null, evidence_tier: input.evidenceTier ?? null,
        company_match_verdict: input.verdicts?.company_match ?? null, date_verdict: input.verdicts?.date_valid ?? null,
        claim_verdict: input.verdicts?.claim ?? null, signal_verdict: input.verdicts?.signal ?? null,
        opportunity_verdict: input.verdicts?.opportunity ?? null,
        duplicate_cluster_id: input.duplicateClusterId ?? null, canonical_signal_id: input.canonicalSignalId ?? null,
        reason_codes: (input.reasonCodes ?? []).slice(0, 12), reviewer_note: input.note ?? null, review_version: version,
      });
      if (retryErr) return { ok: false, signalId: input.signalId, effective_status: "unknown", customer_eligible: false, reason: retryErr.message.slice(0, 120) };
    } else {
      const missing = /relation|does not exist|schema cache/i.test(insErr.message);
      const aiBlocked = (input.origin ?? "human") !== "human" && /review_origin|schema cache|column/i.test(insErr.message);
      return { ok: false, signalId: input.signalId, effective_status: "unknown", customer_eligible: false, reason: aiBlocked ? "Migration 036 required for AI-assisted reviews (origin must be recorded)" : missing ? "Migration 034 not applied" : insErr.message.slice(0, 120) };
    }
  }

  // Apply terminal effects on the coarse signal status + source rights.
  let signalStatus: "approved" | "rejected" | "pending_review" = "pending_review";
  let customerEligible = false;
  if (effectiveDecision === "approved" || effectiveDecision === "approved_monitor_only") signalStatus = "approved";
  else if (effectiveDecision === "quarantined" || effectiveDecision === "rejected" || effectiveDecision === "duplicate") signalStatus = "rejected";
  else if (effectiveDecision === "revoked") signalStatus = "pending_review";

  if (effectiveDecision !== "in_review") {
    const { updateVaultSignalReviewStatus } = await import("@/lib/storage/vault-store");
    await updateVaultSignalReviewStatus(input.signalId, signalStatus as "approved" | "rejected" | "pending_review");
  }

  // Rights decision on the linked source: only a customer-eligible approval sets
  // the source usage rights to permitted (the reviewer's explicit rights call).
  if (effectiveDecision === "approved" && !block && input.rightsStatus && CUSTOMER_DISPLAY_RIGHTS.includes(input.rightsStatus)) {
    const { data: sig } = await db.from("vault_signals").select("source_id").eq("id", input.signalId).maybeSingle();
    if (sig?.source_id) {
      await db.from("vault_sources").update({ usage_rights_status: "permitted" }).eq("id", sig.source_id);
      customerEligible = true;
    }
  }
  // Revoke resets source rights back to unverified.
  if (effectiveDecision === "revoked") {
    const { data: sig } = await db.from("vault_signals").select("source_id").eq("id", input.signalId).maybeSingle();
    if (sig?.source_id) await db.from("vault_sources").update({ usage_rights_status: "unverified" }).eq("id", sig.source_id);
  }

  return { ok: true, signalId: input.signalId, effective_status: effectiveDecision, customer_eligible: customerEligible, reason: block ?? undefined };
}
