// ─── Intelligence Growth Index v0 ─────────────────────────────────────────────
// Versioned, honest scoring of how much LeadLens intelligence exists and how
// fast it grows. Components are computed from REAL database counts only; when
// a component has no real evidence it reports "insufficient" instead of a
// number (volume alone never inflates the index; demo data is excluded).

export const GROWTH_INDEX_VERSION = 1;
export const GROWTH_WEIGHTS = {
  data_foundation: 0.20,
  label_quality: 0.20,
  market_coverage: 0.20,
  decision_performance: 0.25,
  learning_velocity: 0.15,
} as const;

export interface GrowthComponent {
  key: keyof typeof GROWTH_WEIGHTS;
  score: number | null;        // 0–100, null = insufficient evidence
  status: "measured" | "insufficient_evidence" | "blocked_by_migration";
  details: Record<string, number | string | null>;
}

export interface GrowthIndexResult {
  version: number;
  computed_at: string;
  index: number | null;        // null until every weighted component with evidence exists
  components: GrowthComponent[];
  maturity_level: number;
  maturity_label: string;
  maturity_reason: string;
  blockers: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const ratio = (n: number, target: number) => clamp((n / target) * 100);

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function count(db: any, table: string, filter?: (q: any) => any): Promise<number | null> {
  try {
    // head:false + limit(1): count comes from the count header, rows ignored
    // (head:true false-positives on missing tables — PostgREST quirk).
    let q = db.from(table).select("id", { count: "exact", head: false }).limit(1);
    if (filter) q = filter(q);
    const { count: c, error } = await q;
    if (error) return null;
    return c ?? null;
  } catch { return null; }
}

export async function computeGrowthIndex(): Promise<GrowthIndexResult> {
  const blockers: string[] = [];
  const db = await getDb();
  const now = new Date().toISOString();
  if (!db) {
    return { version: GROWTH_INDEX_VERSION, computed_at: now, index: null, components: [], maturity_level: 0, maturity_label: "Level 0 — Stored Data", maturity_reason: "Supabase not configured.", blockers: ["Supabase not configured"] };
  }

  // ── Data Foundation (real assets) ──
  const companies = await count(db, "vault_companies");
  const signals = await count(db, "vault_signals");
  const approvedSignals = await count(db, "vault_signals", (q) => q.eq("review_status", "approved"));
  const sources = await count(db, "vault_sources");
  const mlExamples = await count(db, "ml_training_examples", (q) => q.eq("demo_only", false));
  const mlBlocked = mlExamples === null;
  const dataFoundation: GrowthComponent = {
    key: "data_foundation",
    score: companies === null ? null : clamp(0.3 * ratio(companies ?? 0, 100) + 0.3 * ratio(approvedSignals ?? 0, 100) + 0.2 * ratio(sources ?? 0, 100) + 0.2 * ratio(mlExamples ?? 0, 100)),
    status: companies === null ? "blocked_by_migration" : "measured",
    details: { companies, signals, approved_signals: approvedSignals, sources, real_ml_examples: mlExamples ?? (mlBlocked ? "blocked_by_migration_032" : 0) },
  };
  if (mlBlocked) blockers.push("Migration 032 not applied — ML tables unavailable");

  // ── Label Quality ──
  const feedbackTotal = await count(db, "opportunity_feedback");
  let withReasons: number | null = null, sentimentLabeled: number | null = null, goldLabels: number | null = null;
  try {
    const { count: c1, error: e1 } = await db.from("opportunity_feedback").select("id", { count: "exact" }).neq("reason_codes", "{}").limit(1);
    withReasons = e1 ? null : (c1 ?? 0);
    const { count: c2 } = await db.from("opportunity_feedback").select("id", { count: "exact" }).not("normalized_sentiment", "is", null).limit(1);
    sentimentLabeled = c2 ?? 0;
  } catch { /* 031 pending */ }
  goldLabels = await count(db, "ml_labels", (q) => q.eq("source_type", "human_reviewer"));
  const labelsBlocked = withReasons === null;
  if (labelsBlocked) blockers.push("Migration 031 not applied — structured feedback columns unavailable");
  const labelQuality: GrowthComponent = {
    key: "label_quality",
    score: labelsBlocked ? null : clamp(0.4 * ratio(sentimentLabeled ?? 0, 50) + 0.3 * ratio(withReasons ?? 0, 30) + 0.3 * ratio(goldLabels ?? 0, 20)),
    status: labelsBlocked ? "blocked_by_migration" : "measured",
    details: { feedback_events: feedbackTotal, with_reason_codes: withReasons, sentiment_labeled: sentimentLabeled, gold_labels: goldLabels ?? "blocked_by_migration_032" },
  };

  // ── Market Coverage (distinct segments in the Vault) ──
  let regions = 0, industries = 0;
  try {
    const { data } = await db.from("vault_companies").select("region, industry").limit(1000);
    regions = new Set((data ?? []).map((r) => r.region).filter(Boolean)).size;
    industries = new Set((data ?? []).map((r) => r.industry).filter(Boolean)).size;
  } catch { /* graceful */ }
  const marketCoverage: GrowthComponent = {
    key: "market_coverage",
    score: clamp(0.5 * ratio(regions, 5) + 0.5 * ratio(industries, 10)),
    status: "measured",
    details: { distinct_regions: regions, distinct_industries: industries },
  };

  // ── Decision Performance — REAL feedback-based only; never fixtures ──
  let usefulRate: number | null = null, ratedCount = 0;
  try {
    const { data } = await db.from("opportunity_feedback").select("normalized_sentiment").not("normalized_sentiment", "is", null).limit(500);
    const rated = (data ?? []).filter((r) => r.normalized_sentiment !== null);
    ratedCount = rated.length;
    if (rated.length >= 20) usefulRate = rated.filter((r) => r.normalized_sentiment === 1).length / rated.length;
  } catch { /* 031 pending */ }
  const decisionPerformance: GrowthComponent = {
    key: "decision_performance",
    score: usefulRate === null ? null : clamp(usefulRate * 100),
    status: usefulRate === null ? "insufficient_evidence" : "measured",
    details: { rated_feedback_events: ratedCount, minimum_required: 20, useful_rate: usefulRate, note: usefulRate === null ? "insufficient real-world evidence" : "useful rate from real customer feedback" },
  };

  // ── Learning Velocity (last 7 days) ──
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const newSignals = await count(db, "vault_signals", (q) => q.gte("created_at", weekAgo));
  const newFeedback = await count(db, "opportunity_feedback", (q) => q.gte("created_at", weekAgo));
  const newExamples = await count(db, "ml_training_examples", (q) => q.eq("demo_only", false).gte("created_at", weekAgo));
  const learningVelocity: GrowthComponent = {
    key: "learning_velocity",
    score: clamp(0.4 * ratio(newSignals ?? 0, 20) + 0.4 * ratio(newFeedback ?? 0, 20) + 0.2 * ratio(newExamples ?? 0, 20)),
    status: "measured",
    details: { new_signals_7d: newSignals, new_feedback_7d: newFeedback, new_real_examples_7d: newExamples ?? "blocked_by_migration_032" },
  };

  const components = [dataFoundation, labelQuality, marketCoverage, decisionPerformance, learningVelocity];

  // Index: weighted over MEASURED components only; null if decision performance
  // AND label quality both lack evidence (an index of pure volume would lie).
  const measured = components.filter((c) => c.score !== null);
  const measuredWeight = measured.reduce((s, c) => s + GROWTH_WEIGHTS[c.key], 0);
  const index = measured.length >= 3 && measuredWeight > 0
    ? clamp(measured.reduce((s, c) => s + (c.score! * GROWTH_WEIGHTS[c.key]), 0) / measuredWeight)
    : null;

  // ── Maturity (rule-based, demanding) ──
  let level = 0, label = "Level 0 — Stored Data", reason = "Data exists in storage.";
  const structured = !labelsBlocked && (withReasons ?? 0) > 0;
  const learnedPrefs = await count(db, "learned_preferences", (q) => q.eq("status", "inferred_validated"));
  const realModels = await count(db, "ml_models", (q) => q.eq("demo_only", false));
  if ((companies ?? 0) > 0) { level = 1; label = "Level 1 — Operational Memory"; reason = "Vault memory + anti-repetition operating."; }
  if (structured) { level = 2; label = "Level 2 — Structured Intelligence"; reason = "Structured feedback with snapshots/versions flowing."; }
  if ((learnedPrefs ?? 0) > 0) { level = 3; label = "Level 3 — Statistical Learning"; reason = "Validated observation-only preferences exist."; }
  if ((realModels ?? 0) > 0) { level = 4; label = "Level 4 — Trained Intelligence"; reason = "A model trained on real data is registered."; }
  // Level 5 requires REAL shadow lift vs baseline on customer feedback — never granted without it.
  // Level 6 is out of scope by definition until 5 is held for multiple periods.

  return { version: GROWTH_INDEX_VERSION, computed_at: now, index, components, maturity_level: level, maturity_label: label, maturity_reason: reason, blockers };
}
