// ─── Shadow preference scoring v0 (ADMIN-ONLY, OBSERVATION-ONLY) ─────────────
// Computes what the Customer/Monitor Preference Adjustment WOULD have been for
// a report's opportunities, using only inferred_validated learned preferences.
// Caps: ±5 per preference, ±10 total. Never reorders anything customer-facing;
// can_affect_ranking stays false; the kill switch INTELLIGENCE_RANKING_ENABLED
// exists for the future activation sprint and is not read by any ranking code.

export const SHADOW_PREFERENCE_VERSION = 1;
export const PER_PREFERENCE_CAP = 5;
export const TOTAL_CAP = 10;

export interface ShadowPreferenceAdjustment {
  company_key: string;
  adjustments: Array<{ feature_key: string; scope: string; points: number; explanation: string }>;
  total_adjustment: number;      // capped ±10
  note: string;
}

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

/** Feature keys present in a real snapshot (mirror of the learner's key space). */
function snapshotFeatureKeys(snap: Record<string, unknown>): string[] {
  const keys: string[] = [];
  const s = (k: string) => (typeof snap[k] === "string" && (snap[k] as string).length > 0 ? (snap[k] as string) : null);
  const primary = s("primary_signal_type"); if (primary) keys.push(`signal_type.${primary}`);
  const industry = s("industry"); if (industry) keys.push(`industry.${industry}`);
  const region = s("region"); if (region) keys.push(`region.${region}`);
  const size = s("size_bucket"); if (size) keys.push(`size_bucket.${size}`);
  const fresh = s("freshness_bucket"); if (fresh) keys.push(`freshness_bucket.${fresh}`);
  const combo = s("combo_key"); if (combo) keys.push(`combo.${combo}`);
  return keys;
}

export async function computeShadowPreferenceAdjustments(
  tenantUserId: string,
  monitorId: string | null,
  opportunities: Array<{ company_key: string; feature_snapshot: Record<string, unknown> }>,
): Promise<{ ok: boolean; reason?: string; rows: ShadowPreferenceAdjustment[] }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "Supabase not configured", rows: [] };

  const { data: prefs, error } = await db.from("learned_preferences")
    .select("feature_key, scope, monitor_id, direction, strength, effective_confidence, max_rank_impact, explanation")
    .eq("tenant_user_id", tenantUserId)
    .eq("status", "inferred_validated");
  if (error) {
    return { ok: false, reason: /relation|does not exist|schema cache/i.test(error.message) ? "blocked_by_migration_031" : error.message.slice(0, 80), rows: [] };
  }

  // Monitor-scoped preferences win over customer-scoped for the same feature.
  const byFeature = new Map<string, { feature_key: string; scope: string; direction: string; effective_confidence: number; max_rank_impact: number; explanation: string | null }>();
  for (const p of prefs ?? []) {
    if (p.scope === "monitor" && p.monitor_id !== monitorId) continue;
    const existing = byFeature.get(p.feature_key);
    if (!existing || (p.scope === "monitor" && existing.scope === "customer")) {
      byFeature.set(p.feature_key, p as never);
    }
  }

  const rows = opportunities.map((opp) => {
    const keys = snapshotFeatureKeys(opp.feature_snapshot);
    const adjustments: ShadowPreferenceAdjustment["adjustments"] = [];
    for (const key of keys) {
      const pref = byFeature.get(key);
      if (!pref) continue;
      const magnitude = Math.min(PER_PREFERENCE_CAP, Math.round((pref.effective_confidence ?? 0) * (pref.max_rank_impact ?? PER_PREFERENCE_CAP)));
      if (magnitude === 0) continue;
      const points = pref.direction === "positive" ? magnitude : pref.direction === "negative" ? -magnitude : 0;
      if (points === 0) continue;
      adjustments.push({ feature_key: key, scope: pref.scope, points, explanation: pref.explanation ?? `${key}: ${pref.direction} validated preference` });
    }
    const raw = adjustments.reduce((s, a) => s + a.points, 0);
    const total = Math.max(-TOTAL_CAP, Math.min(TOTAL_CAP, raw));
    return {
      company_key: opp.company_key,
      adjustments,
      total_adjustment: total,
      note: "SHADOW ONLY — would-have-been adjustment; customer ranking unchanged.",
    };
  });

  return { ok: true, rows };
}
