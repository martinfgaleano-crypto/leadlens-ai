// Admin Operational Activity — live product-state aggregation (§9/§10/§21/§26).
// Deterministic: pure buildOperationalActivity over fixed rows at a fixed `now`.

import { buildOperationalActivity } from "../../lib/admin/operational-activity";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const ago = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const activity = buildOperationalActivity({
  intelRuns: [
    { job_id: "intel_a", created_at: ago(2) },     // 24h
    { job_id: "intel_b", created_at: ago(48) },    // 7d
    { job_id: "intel_c", created_at: ago(24 * 20) }, // 30d
    { job_id: "intel_old", created_at: ago(24 * 60) }, // >30d
    { job_id: "lead_search_x", created_at: ago(1) }, // NOT a productive intel run → excluded
  ],
  charges: [
    { analysis_key: "intel_a", created_at: ago(2) },
    { analysis_key: "intel_a", created_at: ago(2) },  // same analysis (2 companies, 1 run)
    { analysis_key: "intel_b", created_at: ago(48) },
  ],
  vault: [
    { first_seen_at: ago(3) }, { first_seen_at: ago(24 * 5) }, { first_seen_at: ago(24 * 25) }, { first_seen_at: ago(24 * 90) },
  ],
  now: NOW,
});

// ── Intelligence runs: only intel_* counted; windows nested; lead_search excluded ──
t("runs exclude non-intel job ids", activity.intelligence_runs.total === 4 && activity.intelligence_runs.distinct_runs === 4);
t("runs 24h/7d/30d windows", activity.intelligence_runs.last24h === 1 && activity.intelligence_runs.last7d === 2 && activity.intelligence_runs.last30d === 3);
t("runs last_activity_at is the most recent run", activity.intelligence_runs.last_activity_at === ago(2));

// ── Delivered evaluations: one charge = one delivered company; distinct_analyses de-dupes the run ──
t("delivered evaluations total counts every charged company", activity.delivered_evaluations.total === 3);
t("distinct_analyses de-dupes multi-company run (recovery-safe)", activity.delivered_evaluations.distinct_analyses === 2);
t("delivered 24h/7d windows", activity.delivered_evaluations.last24h === 2 && activity.delivered_evaluations.last7d === 3);

// ── Vault new companies by first_seen_at ──
t("vault new 24h/7d/30d", activity.vault_new_companies.last24h === 1 && activity.vault_new_companies.last7d === 2 && activity.vault_new_companies.last30d === 3);
t("vault total counts all with a valid first_seen", activity.vault_new_companies.total === 4);
t("vault last_write_at is the most recent first_seen", activity.vault_new_companies.last_activity_at === ago(3));

// ── Empty / malformed input → zeros + null timestamps (no fabricated data, §28) ──
const empty = buildOperationalActivity({ intelRuns: [], charges: [{ created_at: "not-a-date" }], vault: [{ first_seen_at: null }], now: NOW });
t("empty/malformed → zero totals, null timestamps", empty.intelligence_runs.total === 0 && empty.delivered_evaluations.total === 0 && empty.vault_new_companies.total === 0 && empty.intelligence_runs.last_activity_at === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
