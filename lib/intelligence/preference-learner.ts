// ─── Preference Learner v0 — OBSERVATION MODE ONLY ───────────────────────────
// Deterministic, idempotent batch aggregation of structured feedback into
// learned_preferences rows. Runs OUTSIDE the customer request path (admin
// trigger). This module is never imported by the selector, scorer, Decision
// Engine or any customer-facing route: can_affect_ranking stays false for
// every inferred preference in this version.
//
// Method (documented, testable):
//   n_signal   = positive_obs + negative_obs   (neutral/partial recorded but
//                excluded from the proportion so partial feedback never
//                inflates confidence — conservative by design)
//   strength   = (positive_obs + 1) / (n_signal + 2)          Laplace
//   confidence = Wilson 95% lower bound of positive proportion over n_signal
//   effective  = confidence * 0.5^(days_since_last_obs / half_life_days)
//   validated  requires: n_signal >= 5 AND distinct reports >= 2 AND effective >= 0.60

import {
  FRESHNESS_ONLY_REASONS,
  LEARNING_EXCLUDED_REASONS,
  SIZE_ONLY_REASONS,
  type ReasonCode,
} from "./feedback-taxonomy";

export const LEARNER_VERSION = 1;
export const MIN_OBSERVATIONS = 5;
export const MIN_DISTINCT_REPORTS = 2;
export const MIN_EFFECTIVE_CONFIDENCE = 0.6;
const DEFAULT_HALF_LIFE_DAYS = 90;

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export interface FeedbackEventRow {
  id: string;
  user_id: string | null;
  job_id: string | null;
  search_id: string | null;
  normalized_sentiment: -1 | 0 | 1 | null;
  reason_codes: string[];
  feature_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface PreferenceAggregate {
  tenant_user_id: string;
  scope: "customer" | "monitor";
  monitor_id: string | null;
  feature_key: string;
  positive_obs: number;
  neutral_obs: number;
  negative_obs: number;
  observations: number;
  distinct_reports: Set<string>;
  first_observed_at: string;
  last_observed_at: string;
}

/** Wilson score 95% lower bound for a binomial proportion. */
export function wilsonLowerBound(successes: number, trials: number): number {
  if (trials === 0) return 0;
  const z = 1.96;
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const center = p + (z * z) / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * trials)) / trials);
  return Math.max(0, (center - margin) / denom);
}

export function decayFactor(lastObservedAt: string, halfLifeDays: number, now: Date = new Date()): number {
  const last = new Date(lastObservedAt).getTime();
  if (!Number.isFinite(last)) return 1;
  const days = Math.max(0, (now.getTime() - last) / 86_400_000);
  return Math.pow(0.5, days / halfLifeDays);
}

/** Feature keys an event contributes to, honoring reason-code semantics:
 *  - excluded reasons → no keys at all (the account was fine / info wrong / bad explanation);
 *  - not_now / weak_or_old_signal → freshness bucket ONLY;
 *  - too_small / too_large → size bucket ONLY;
 *  - otherwise → fit features (signal_type, industry, region, size, source, combo, freshness). */
export function featureKeysForEvent(event: FeedbackEventRow): string[] {
  const snap = event.feature_snapshot;
  if (!snap || event.normalized_sentiment === null) return [];
  const reasons = (event.reason_codes ?? []) as ReasonCode[];
  if (reasons.some((r) => LEARNING_EXCLUDED_REASONS.includes(r))) return [];

  const str = (k: string): string | null => (typeof snap[k] === "string" && (snap[k] as string).length > 0 ? (snap[k] as string) : null);
  const keys: string[] = [];
  const freshness = str("freshness_bucket");
  const size = str("size_bucket");

  const freshnessOnly = event.normalized_sentiment === -1 && reasons.some((r) => FRESHNESS_ONLY_REASONS.includes(r));
  const sizeOnly = event.normalized_sentiment === -1 && reasons.some((r) => SIZE_ONLY_REASONS.includes(r));

  if (freshnessOnly) {
    if (freshness) keys.push(`freshness_bucket.${freshness}`);
    return keys;
  }
  if (sizeOnly) {
    if (size) keys.push(`size_bucket.${size}`);
    return keys;
  }

  const primary = str("primary_signal_type");
  if (primary) keys.push(`signal_type.${primary}`);
  const industry = str("industry");
  if (industry) keys.push(`industry.${industry}`);
  const region = str("region");
  if (region) keys.push(`region.${region}`);
  if (size) keys.push(`size_bucket.${size}`);
  if (freshness) keys.push(`freshness_bucket.${freshness}`);
  for (const st of Array.isArray(snap.source_types) ? (snap.source_types as string[]) : []) {
    if (typeof st === "string" && st) keys.push(`source_type.${st}`);
  }
  const combo = str("combo_key");
  if (combo) keys.push(`combo.${combo}`);
  return keys;
}

/** Pure aggregation: events → full rebuilt aggregate state (idempotent by construction). */
export function aggregateEvents(events: FeedbackEventRow[]): PreferenceAggregate[] {
  const map = new Map<string, PreferenceAggregate>();
  for (const event of events) {
    if (!event.user_id || event.normalized_sentiment === null) continue;
    const keys = featureKeysForEvent(event);
    if (keys.length === 0) continue;
    const scopes: Array<{ scope: "customer" | "monitor"; monitor_id: string | null }> = [
      { scope: "customer", monitor_id: null },
    ];
    // Monitor scope only when the event is safely associated with a monitor.
    if (event.search_id) scopes.push({ scope: "monitor", monitor_id: event.search_id });

    for (const { scope, monitor_id } of scopes) {
      for (const feature_key of keys) {
        const id = `${event.user_id}|${scope}|${monitor_id ?? "-"}|${feature_key}`;
        const agg = map.get(id) ?? {
          tenant_user_id: event.user_id, scope, monitor_id, feature_key,
          positive_obs: 0, neutral_obs: 0, negative_obs: 0, observations: 0,
          distinct_reports: new Set<string>(),
          first_observed_at: event.created_at, last_observed_at: event.created_at,
        };
        if (event.normalized_sentiment === 1) agg.positive_obs++;
        else if (event.normalized_sentiment === -1) agg.negative_obs++;
        else agg.neutral_obs++;
        agg.observations++;
        if (event.job_id) agg.distinct_reports.add(event.job_id);
        if (event.created_at < agg.first_observed_at) agg.first_observed_at = event.created_at;
        if (event.created_at > agg.last_observed_at) agg.last_observed_at = event.created_at;
        map.set(id, agg);
      }
    }
  }
  return Array.from(map.values());
}

export interface ComputedPreference {
  tenant_user_id: string;
  scope: "customer" | "monitor";
  monitor_id: string | null;
  feature_key: string;
  direction: "positive" | "negative" | "neutral";
  status: "inferred_weak" | "inferred_validated";
  strength: number;
  confidence: number;
  effective_confidence: number;
  observations: number;
  positive_obs: number;
  neutral_obs: number;
  negative_obs: number;
  distinct_report_count: number;
  first_observed_at: string;
  last_observed_at: string;
  explanation: string;
}

export function computePreference(agg: PreferenceAggregate, now: Date = new Date()): ComputedPreference {
  const nSignal = agg.positive_obs + agg.negative_obs;
  const strength = (agg.positive_obs + 1) / (nSignal + 2);
  const positiveWilson = wilsonLowerBound(agg.positive_obs, nSignal);
  const negativeWilson = wilsonLowerBound(agg.negative_obs, nSignal);
  const direction: ComputedPreference["direction"] = strength > 0.55 ? "positive" : strength < 0.45 ? "negative" : "neutral";
  const confidence = direction === "negative" ? negativeWilson : positiveWilson;
  const effective = confidence * decayFactor(agg.last_observed_at, DEFAULT_HALF_LIFE_DAYS, now);
  const distinct = agg.distinct_reports.size;
  const validated = nSignal >= MIN_OBSERVATIONS && distinct >= MIN_DISTINCT_REPORTS && effective >= MIN_EFFECTIVE_CONFIDENCE;

  const featureLabel = agg.feature_key.replace(/\./g, ": ").replace(/_/g, " ");
  const explanation = direction === "neutral"
    ? `Mixed feedback on ${featureLabel} (${agg.positive_obs}+ / ${agg.negative_obs}− across ${distinct} report${distinct === 1 ? "" : "s"}) — no clear preference.`
    : `${agg.scope === "monitor" ? "This monitor" : "This customer"} rated ${direction === "positive" ? "useful" : "not useful"} ${direction === "positive" ? agg.positive_obs : agg.negative_obs} of ${nSignal} rated opportunities with ${featureLabel} (across ${distinct} report${distinct === 1 ? "" : "s"}). Observation only — not affecting ranking.`;

  return {
    tenant_user_id: agg.tenant_user_id, scope: agg.scope, monitor_id: agg.monitor_id,
    feature_key: agg.feature_key, direction,
    status: validated ? "inferred_validated" : "inferred_weak",
    strength: Number(strength.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    effective_confidence: Number(effective.toFixed(4)),
    observations: agg.observations,
    positive_obs: agg.positive_obs, neutral_obs: agg.neutral_obs, negative_obs: agg.negative_obs,
    distinct_report_count: distinct,
    first_observed_at: agg.first_observed_at, last_observed_at: agg.last_observed_at,
    explanation,
  };
}

export interface LearnerRunResult {
  ok: boolean;
  events_read: number;
  events_learnable: number;
  preferences_computed: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped_frozen_or_revoked: number;
  reason?: string;
}

/** Full rebuild-from-source run. Re-running on the same events changes nothing. */
export async function runPreferenceLearner(tenantUserId?: string): Promise<LearnerRunResult> {
  const db = await getDb();
  if (!db) return { ok: false, events_read: 0, events_learnable: 0, preferences_computed: 0, created: 0, updated: 0, unchanged: 0, skipped_frozen_or_revoked: 0, reason: "Supabase not configured" };

  let query = db.from("opportunity_feedback")
    .select("id, user_id, job_id, search_id, normalized_sentiment, reason_codes, feature_snapshot, created_at")
    .not("user_id", "is", null)
    .not("feature_snapshot", "is", null)
    .not("normalized_sentiment", "is", null)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (tenantUserId) query = query.eq("user_id", tenantUserId);
  const { data: events, error } = await query;
  if (error) {
    const migrationMissing = /column|schema cache/i.test(error.message);
    return { ok: false, events_read: 0, events_learnable: 0, preferences_computed: 0, created: 0, updated: 0, unchanged: 0, skipped_frozen_or_revoked: 0, reason: migrationMissing ? "Migration 031 not applied — intelligence columns missing." : error.message };
  }

  const rows = (events ?? []) as FeedbackEventRow[];
  const aggregates = aggregateEvents(rows);
  const now = new Date();
  const computed = aggregates.map((a) => computePreference(a, now));

  let created = 0, updated = 0, unchanged = 0, skipped = 0;
  for (const pref of computed) {
    const { data: existing } = await db.from("learned_preferences")
      .select("id, status, direction, strength, confidence, observations, positive_obs, neutral_obs, negative_obs, distinct_report_count, version, audit_trail")
      .eq("tenant_user_id", pref.tenant_user_id)
      .eq("scope", pref.scope)
      .eq("feature_key", pref.feature_key)
      .filter("monitor_id", pref.monitor_id ? "eq" : "is", pref.monitor_id)
      .maybeSingle();

    if (existing && (existing.status === "frozen" || existing.status === "revoked" || existing.status === "explicit")) {
      skipped++;
      continue; // admin holds win; explicit settings are never overwritten by inference
    }

    const material = existing && (
      existing.direction === pref.direction &&
      existing.status === pref.status &&
      existing.observations === pref.observations &&
      existing.positive_obs === pref.positive_obs &&
      existing.neutral_obs === pref.neutral_obs &&
      existing.negative_obs === pref.negative_obs &&
      existing.distinct_report_count === pref.distinct_report_count &&
      Number(existing.strength) === pref.strength
    );

    if (existing && material) { unchanged++; continue; }

    const auditEntry = {
      at: now.toISOString(), actor: "learner", learner_version: LEARNER_VERSION,
      change: existing ? "recomputed" : "created",
      observations: pref.observations, status: pref.status,
    };

    if (!existing) {
      const { error: insErr } = await db.from("learned_preferences").insert({
        ...pref,
        distinct_report_count: pref.distinct_report_count,
        can_affect_ranking: false, // NON-NEGOTIABLE in this version
        evidence_source: "customer_feedback",
        audit_trail: [auditEntry],
      });
      if (!insErr) created++;
      else console.error("[learner] insert failed:", insErr.message);
    } else {
      const trail = Array.isArray(existing.audit_trail) ? existing.audit_trail : [];
      const { error: upErr } = await db.from("learned_preferences").update({
        ...pref,
        can_affect_ranking: false,
        version: (existing.version ?? 1) + 1,
        audit_trail: [...trail.slice(-19), auditEntry],
        updated_at: now.toISOString(),
      }).eq("id", existing.id);
      if (!upErr) updated++;
      else console.error("[learner] update failed:", upErr.message);
    }
  }

  const learnable = rows.filter((r) => featureKeysForEvent(r).length > 0).length;
  console.log(`[learner] run complete: events=${rows.length} learnable=${learnable} prefs=${computed.length} created=${created} updated=${updated} unchanged=${unchanged}`);
  return { ok: true, events_read: rows.length, events_learnable: learnable, preferences_computed: computed.length, created, updated, unchanged, skipped_frozen_or_revoked: skipped };
}
