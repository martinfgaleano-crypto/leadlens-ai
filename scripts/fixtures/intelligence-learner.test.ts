// Deterministic fixture test for the Intelligence Foundation: learner math
// (Wilson lower bound, decay, thresholds), reason-code semantics, aggregation
// idempotency and feature-snapshot honesty. No DB, no network, no AI.
// Run: npm run test:intelligence
import { aggregateEvents, computePreference, featureKeysForEvent, wilsonLowerBound, decayFactor, type FeedbackEventRow } from "@/lib/intelligence/preference-learner";
import { buildOpportunityFeatureSnapshot, comboKey, sizeBucket, freshnessBucket } from "@/lib/intelligence/feature-snapshot";
import { normalizeSentiment, validateReasonCodes } from "@/lib/intelligence/feedback-taxonomy";

const now = new Date("2026-07-13T12:00:00Z");
const snap = (over: Record<string, unknown> = {}) => ({
  schema_version: 1, company_key: "demo_co", primary_signal_type: "expansion",
  signal_types: ["expansion", "hiring"], freshness_bucket: "fresh", industry: "logistics",
  region: "latam", size_bucket: "50_200", source_types: ["vault"], combo_key: "expansion+hiring", ...over,
});
const ev = (i: number, sent: -1 | 0 | 1 | null, over: Partial<FeedbackEventRow> = {}): FeedbackEventRow => ({
  id: `e${i}`, user_id: "u1", job_id: over.job_id ?? `job-${i}`, search_id: "m1",
  normalized_sentiment: sent, reason_codes: [], feature_snapshot: snap(), created_at: "2026-07-10T00:00:00Z", ...over,
});

const checks: [string, boolean][] = [];
const ck = (n: string, ok: boolean) => checks.push([n, ok]);

ck("Wilson(0,0)=0", wilsonLowerBound(0, 0) === 0);
ck("Wilson(2,2) small-sample humility < 0.6", wilsonLowerBound(2, 2) < 0.6);
ck("Wilson(8,9) strong > 0.55", wilsonLowerBound(8, 9) > 0.55);
ck("decay: fresh ≈ 1", Math.abs(decayFactor("2026-07-13T00:00:00Z", 90, now) - 1) < 0.01);
ck("decay: 90d = 0.5", Math.abs(decayFactor("2026-04-14T12:00:00Z", 90, now) - 0.5) < 0.01);
ck("sentiment: useful=1 partial=0 not=-1", normalizeSentiment("useful") === 1 && normalizeSentiment("partially_useful") === 0 && normalizeSentiment("not_useful") === -1);
ck("sentiment: operational=null", ["contacted","replied","meeting_booked","add_to_vault","exclude_similar"].every((s) => normalizeSentiment(s) === null));
ck("legacy mapping documented", normalizeSentiment("irrelevant") === -1 && normalizeSentiment("generic") === -1);
ck("reason validation rejects unknown", validateReasonCodes(["nonsense"]).ok === false);
ck("reason validation dedupes", (() => { const r = validateReasonCodes(["not_now","not_now"]); return r.ok && r.codes.length === 1; })());
ck("excluded reasons → no keys", featureKeysForEvent(ev(1, -1, { reason_codes: ["already_known"] })).length === 0);
ck("bad_explanation → no keys", featureKeysForEvent(ev(2, -1, { reason_codes: ["bad_explanation"] })).length === 0);
ck("not_now → freshness only", (() => { const k = featureKeysForEvent(ev(3, -1, { reason_codes: ["not_now"] })); return k.length === 1 && k[0] === "freshness_bucket.fresh"; })());
ck("weak_or_old_signal → freshness only", featureKeysForEvent(ev(4, -1, { reason_codes: ["weak_or_old_signal"] })).every((k) => k.startsWith("freshness_bucket.")));
ck("too_small → size only", featureKeysForEvent(ev(5, -1, { reason_codes: ["too_small"] })).every((k) => k.startsWith("size_bucket.")));
ck("plain negative → fit features incl combo", featureKeysForEvent(ev(6, -1)).includes("combo.expansion+hiring") && featureKeysForEvent(ev(6, -1)).includes("industry.logistics"));
ck("no snapshot → no keys", featureKeysForEvent(ev(7, 1, { feature_snapshot: null })).length === 0);
ck("null sentiment → no keys", featureKeysForEvent(ev(8, null)).length === 0);

const single = aggregateEvents([ev(1, 1, { job_id: "j1" }), ev(2, 1, { job_id: "j1" }), ev(3, 1, { job_id: "j1" }), ev(4, 1, { job_id: "j1" }), ev(5, 1, { job_id: "j1" })]);
ck("single-report never validates (shows why: distinct reports < 2)", computePreference(single.find((a) => a.feature_key === "signal_type.expansion" && a.scope === "monitor")!, now).status === "inferred_weak");

const multi = aggregateEvents([1,2,3,4,5,6,7].map((i) => ev(i, 1, { job_id: i <= 4 ? "j1" : "j2", created_at: "2026-07-12T00:00:00Z" })));
const pMulti = computePreference(multi.find((a) => a.feature_key === "signal_type.expansion" && a.scope === "monitor")!, now);
ck("7 positives across 2 reports validates", pMulti.status === "inferred_validated" && pMulti.direction === "positive");
ck("explanation is human-readable", pMulti.explanation.includes("rated useful") && pMulti.explanation.includes("Observation only"));

const mixed = aggregateEvents([ev(1, 1), ev(2, -1), ev(3, 1, { job_id: "j2" }), ev(4, 0, { job_id: "j2" })]);
const pMixed = computePreference(mixed.find((a) => a.feature_key === "signal_type.expansion" && a.scope === "customer")!, now);
ck("partial counts as neutral not positive", pMixed.neutral_obs === 1 && pMixed.positive_obs === 2);
ck("small mixed sample stays weak (shows why: n<5)", pMixed.status === "inferred_weak");

const old = aggregateEvents([1,2,3,4,5,6].map((i) => ev(i, 1, { job_id: i <= 3 ? "j1" : "j2", created_at: "2025-12-01T00:00:00Z" })));
const pOld = computePreference(old.find((a) => a.feature_key === "signal_type.expansion" && a.scope === "monitor")!, now);
ck("old feedback decays below validation (shows why: effective<0.6)", pOld.status === "inferred_weak" && pOld.effective_confidence < 0.6);

const a1 = aggregateEvents([ev(1, 1), ev(2, -1)]).map((a) => computePreference(a, now));
const a2 = aggregateEvents([ev(1, 1), ev(2, -1)]).map((a) => computePreference(a, now));
ck("rebuild is deterministic (idempotent)", JSON.stringify(a1) === JSON.stringify(a2));
ck("no monitor id → customer scope only", aggregateEvents([ev(1, 1, { search_id: null as unknown as string })]).every((a) => a.scope === "customer"));

const lead = { id: "x", candidate: { id: "x", company: "Thin Co", source: "vault", confidence_score: 0.5 }, enrichment: {}, qualification: { fit_score: 5, category: "WARM" }, outreach: {} } as never;
const s = buildOpportunityFeatureSnapshot(lead, undefined, now);
ck("snapshot null-safe: no invented dates/types", s.signal_date === null && s.signal_age_days === null && s.freshness_bucket === null && s.primary_signal_type === null && s.combo_key === null);
ck("combo needs 2+ valid types", comboKey(["hiring"]) === null && comboKey(["hiring", "expansion"]) === "expansion+hiring" && comboKey(["other", "unknown"]) === null);
ck("size bucket parses ranges", sizeBucket("11-50 employees") === "lt_50" && sizeBucket(null) === null);
ck("freshness bucket boundaries", freshnessBucket(30) === "fresh" && freshnessBucket(31) === "recent" && freshnessBucket(91) === "stale" && freshnessBucket(null) === null);

let pass = 0;
for (const [n, ok] of checks) { console.log(`${ok ? "✅" : "❌"} ${n}`); if (ok) pass++; }
console.log(`\n${pass}/${checks.length} passed`);
process.exit(pass === checks.length ? 0 : 1);
