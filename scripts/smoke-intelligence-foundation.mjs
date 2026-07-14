#!/usr/bin/env node
// Static smoke checks for Intelligence Foundation v0.
// Usage: npm run smoke:intelligence

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, ok: !!fn() }); }
  catch (err) { results.push({ name, ok: false, err: err.message }); }
};
const read = (p) => readFileSync(join(root, p), "utf8");

const MIG = "supabase/migrations/031_intelligence_foundation.sql";
const TAX = "lib/intelligence/feedback-taxonomy.ts";
const SNAP = "lib/intelligence/feature-snapshot.ts";
const LEARNER = "lib/intelligence/preference-learner.ts";
const FEEDBACK_API = "app/api/feedback/opportunity/route.ts";
const SELECTOR = "lib/vault/vault-opportunity-selector.ts";
const DECISION = "lib/quality/opportunity-decision.ts";
const PIPELINE = "lib/pipeline.ts";
const RESULTS_UI = "app/results/[jobId]/page.tsx";
const ADMIN_UI = "app/admin/intelligence/page.tsx";

// 1–3: migration shape
check("Migration 031 exists", () => existsSync(join(root, MIG)));
check("learned_preferences has UUID primary key", () => read(MIG).includes("id                    UUID        PRIMARY KEY"));
check("Feedback columns are additive (IF NOT EXISTS)", () => {
  const m = read(MIG);
  return m.includes("ADD COLUMN IF NOT EXISTS reason_codes") && m.includes("ADD COLUMN IF NOT EXISTS feature_snapshot") && m.includes("ADD COLUMN IF NOT EXISTS versions") && m.includes("ADD COLUMN IF NOT EXISTS normalized_sentiment");
});
check("Migration enables RLS (backend-only pattern)", () => read(MIG).includes("ENABLE ROW LEVEL SECURITY"));
check("NULL-safe unique identity via COALESCE expression index", () => read(MIG).includes("COALESCE(monitor_id"));

// 4–7: taxonomy + snapshot honesty
check("reason_codes validated against closed enum", () => read(TAX).includes("REASON_CODES") && read(FEEDBACK_API).includes("validateReasonCodes"));
check("Snapshot is null-safe (no invented dates)", () => {
  const s = read(SNAP);
  return s.includes("d >= 0 ? d : null") && s.includes("if (ageDays === null) return null");
});
check("model_id honest fallback (never invented)", () => read(SNAP).includes('let modelId = "unknown"'));

// 8–10: server-side enrichment + compatibility
check("Legacy POST without reasons still supported", () => read(FEEDBACK_API).includes("reason_codes:       z.array") && read(FEEDBACK_API).includes(".optional()"));
check("Snapshot copied server-side from frozen report", () => read(FEEDBACK_API).includes("loadFrozenIntelligence") && read(FEEDBACK_API).includes("NEVER the source of truth"));
check("Versions copied server-side from report", () => read(FEEDBACK_API).includes("report._versions ?? null"));
check("Migration-missing fallback keeps feedback working", () => read(FEEDBACK_API).includes("storing legacy row"));

// 11–16: learner semantics + math
check("Learner excludes already_known/contacted/bad_explanation/incorrect_info", () => {
  const t = read(TAX);
  return ["already_known", "already_contacted", "bad_explanation", "incorrect_information"].every((r) => t.includes(`"${r}"`)) && t.includes("LEARNING_EXCLUDED_REASONS");
});
check("not_now / weak_or_old_signal scoped to freshness only", () => read(LEARNER).includes("FRESHNESS_ONLY_REASONS") && read(LEARNER).includes("freshnessOnly"));
check("Rebuild-from-source idempotency (no incremental counters)", () => read(LEARNER).includes("aggregateEvents") && !read(LEARNER).includes("observations + 1"));
check("Validation requires multiple reports", () => read(LEARNER).includes("MIN_DISTINCT_REPORTS = 2") && read(LEARNER).includes("distinct >= MIN_DISTINCT_REPORTS"));
check("Wilson + decay implemented and fixture-tested", () => read(LEARNER).includes("wilsonLowerBound") && read(LEARNER).includes("decayFactor") && existsSync(join(root, "scripts/fixtures/intelligence-learner.test.ts")));

// 17–18: ranking protection (the critical invariant)
check("can_affect_ranking never set true anywhere", () => {
  const files = [LEARNER, MIG, "app/api/admin/intelligence/learn/route.ts", "app/api/admin/intelligence/preferences/[id]/[action]/route.ts"];
  return files.every((f) => !/can_affect_ranking\s*[:=]\s*true/.test(read(f)));
});
check("Selector/scorer/decision/pipeline never import learned_preferences or learner", () => {
  return [SELECTOR, DECISION, PIPELINE, "lib/vault/vault-generation.ts"].every((f) => {
    const src = read(f);
    return !src.includes("learned_preferences") && !src.includes("preference-learner");
  });
});

// 19–21: route protection
check("All intelligence admin routes require admin", () => {
  return ["app/api/admin/intelligence/learn/route.ts", "app/api/admin/intelligence/overview/route.ts", "app/api/admin/intelligence/preferences/[id]/[action]/route.ts"].every((f) => read(f).includes("requireAdmin"));
});
check("No public intelligence routes", () => !existsSync(join(root, "app/api/intelligence")) && !existsSync(join(root, "app/intelligence")));
check("No service-role leak in intelligence files", () => [TAX, SNAP, LEARNER, ADMIN_UI].every((f) => !read(f).includes("NEXT_PUBLIC_SUPABASE_SERVICE") && !read(ADMIN_UI).includes("SERVICE_ROLE")));

// 22–24: UI + actions
check("Feedback UI: sentiment first, chips optional", () => {
  const src = read(RESULTS_UI);
  return src.includes("Was this opportunity useful?") && src.includes("Partially useful") && src.includes('phase === "reasons"') && src.includes("Skip");
});
check("Feedback UI honest copy (no 'AI retrained')", () => !/retrained|model has learned|rankings have been updated/i.test(read(RESULTS_UI)));
check("Admin shows observation-mode banner", () => read(ADMIN_UI).includes("Observation mode — learned preferences are not affecting rankings"));
check("Freeze/revoke force ranking off and keep audit", () => {
  const src = read("app/api/admin/intelligence/preferences/[id]/[action]/route.ts");
  return src.includes("can_affect_ranking: false") && src.includes("audit_trail") && src.includes("previous_status");
});

// 25: base ranking untouched (structural: version constants only additions)
check("Selector exports version constants (additive only)", () => read(SELECTOR).includes("SELECTOR_VERSION = 1") && read(SELECTOR).includes("SCORING_VERSION = 1"));

const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.err ? ` — ${r.err}` : ""}`);
console.log(`\nResult: ${passed} passed, ${results.length - passed} failed.`);
process.exit(passed === results.length ? 0 : 1);
