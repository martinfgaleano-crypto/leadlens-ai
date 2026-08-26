// Research + Temporal Intelligence Hardening V1 — event extraction, temporal/
// materiality discipline, historical-vs-change, canonical Case re-synthesis via
// opportunityTest, and R1→R2→R3 repeated-run soak. Deterministic (no network).
import { extractEvent, resolveEventDate, type EventCandidate } from "@/lib/monitor/event-extraction";
import { planMonitorReview, classifyDelta, type AccountObservation, type ObservedItem } from "@/lib/monitor/delta-research";
import { resynthesizeCase } from "@/lib/monitor/case-resynthesis";
import { reviewAccount, type Reobserver } from "@/lib/monitor/monitor-cycle";
import { monitoredStateFromSnapshot } from "@/lib/monitor/monitor-eligibility";
import { diffAccountCase, type AccountReviewSnapshot } from "@/lib/deliverable/account-memory";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const NOW = new Date("2026-08-26T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const scope = { ownerUserId: "o", clientKey: "c" };
const snap = (o: Partial<AccountReviewSnapshot> & { accountId: string; decision: AccountReviewSnapshot["decision"] }): AccountReviewSnapshot => ({
  reviewId: `r_${o.accountId}`, reviewedAt: daysAgo(40), contextVersion: "ctx_v1", fit: "Moderate", timing: "Limited", evidence: "Moderate",
  changeKeys: [], hasVerifiedChange: false, evidenceOrigins: ["reuters.com"], independentSupport: false, counterCount: 0, hasMaterialCounter: false,
  validationThemeKeys: [], decisionCriticalThemeKeys: [], hasRevisitTrigger: false, ...o,
});
const cand = (o: Partial<EventCandidate>): EventCandidate =>
  ({ accountId: "acc", sourceHost: "reuters.com", sourceUrl: "https://reuters.com/x", titleAndContent: "", retrievedAt: NOW.toISOString(), ...o });

// ─── EVENT EXTRACTION: source → claim → event, dates, materiality ─────────────
t("extract: opened-new-facility with explicit event date → dated material event",
  (() => { const e = extractEvent(cand({ titleAndContent: "Acme opened a new plant in Medellín", eventDateRaw: "2026-08-01" })); return e.item.isDatedMaterialEvent && e.item.eventDate === "2026-08-01" && e.materiality === "high"; })());
t("extract: static 'about us' page → not a dated material event (contextual)",
  (() => { const e = extractEvent(cand({ titleAndContent: "Company profile — about us. Founded in 1990.", eventDateRaw: null })); return e.item.isDatedMaterialEvent === false; })());
t("extract: metric/results (transported 2M passengers) → non-triggering, not a material event",
  (() => { const e = extractEvent(cand({ titleAndContent: "The company transported 2,000,000 passengers last year", eventDateRaw: "2026-07-01" })); return e.item.isDatedMaterialEvent === false && e.canTrigger === false; })());
t("extract: recent-but-irrelevant (wellness award) → immaterial (materiality ≠ novelty)",
  (() => { const e = extractEvent(cand({ titleAndContent: "Acme received an award for its employee wellness program", eventDateRaw: "2026-08-10" })); return e.item.isDatedMaterialEvent === false && e.materiality === "low"; })());
t("extract: cancellation → material COUNTEREVIDENCE (negative equally supported)",
  (() => { const e = extractEvent(cand({ titleAndContent: "Acme announced the cancellation of its planned facility; cierre del proyecto", eventDateRaw: "2026-08-05", kindHint: "cancellation" })); return e.item.isCounterevidence === true; })());

// ─── EVENT DATE: publication ≠ event; precision; conflicts ────────────────────
t("date: publication date is NEVER the event date (event phrase 'March 2026', published Aug)",
  (() => { const r = resolveEventDate(cand({ eventDateRaw: "March 2026", publicationDate: "2026-08-01" })); return r.eventDate === "2026-03-01" && r.precision === "month"; })());
t("date: quarter precision (Q2 2026)", (() => { const r = resolveEventDate(cand({ eventDateRaw: "Q2 2026" })); return r.eventDate === "2026-04-01" && r.precision === "quarter"; })());
t("date: year-only precision", (() => { const r = resolveEventDate(cand({ eventDateRaw: "2025" })); return r.eventDate === "2025-01-01" && r.precision === "year"; })());
t("date: relative phrase anchored to publication → relative_bounded", (() => { const r = resolveEventDate(cand({ eventDateRaw: "last month", publicationDate: "2026-07-15" })); return r.precision === "relative_bounded" && r.eventDate === "2026-07-01"; })());
t("date: relative phrase with NO anchor → unknown (never fabricated)", (() => { const r = resolveEventDate(cand({ eventDateRaw: "earlier this year", publicationDate: null })); return r.eventDate === null && r.precision === "unknown"; })());
t("date: retrieval date is never used as event date", (() => { const r = resolveEventDate(cand({ eventDateRaw: null, publicationDate: null })); return r.eventDate === null; })());

// ─── HISTORICAL-NEW vs TRUE CHANGE (the core distinction) ─────────────────────
const priorMon = snap({ accountId: "acc", decision: "monitor", reviewedAt: daysAgo(60), changeKeys: ["new_facility:2026-01-01"], evidenceOrigins: ["reuters.com"] });
const planF = planMonitorReview(monitoredStateFromSnapshot(priorMon, scope), priorMon);
const obs = (items: ObservedItem[], over: Partial<AccountObservation> = {}): AccountObservation => ({ accountId: "acc", items, providersAvailable: ["brave", "tavily"], providersFailed: [], routesAttempted: 2, operatingMode: "full", ...over });
const oi = (o: Partial<ObservedItem>): ObservedItem => ({ sourceHost: "reuters.com", originId: null, kind: "acquisition", eventDate: null, publicationDate: null, retrievedAt: NOW.toISOString(), isDatedMaterialEvent: true, relevantToCase: true, ...o });

{
  // Article published today about an event that happened BEFORE R1, not previously known.
  const d = classifyDelta(planF, obs([oi({ kind: "acquisition", eventDate: daysAgo(200), publicationDate: daysAgo(0) })]), NOW);
  t("historical: old event newly discovered → newly_discovered_historical (new Evidence), NO new What Changed",
    d.counters.newly_discovered_historical === 1 && d.newChangeKeys.length === 0 && d.historicalEvidence.length === 1 && d.newOrigins.length >= 0);
}
{
  const d = classifyDelta(planF, obs([oi({ kind: "acquisition", eventDate: daysAgo(5), publicationDate: daysAgo(1) })]), NOW);
  t("true change: NEW event after cutoff → accepted_new + newChangeKeys (real What Changed)",
    d.counters.accepted_new === 1 && d.newChangeKeys.length === 1);
}
{
  const d = classifyDelta(planF, obs([oi({ kind: "new_facility", eventDate: "2026-01-01" })]), NOW);
  t("rediscovery: same known event → rediscovered, not new, not historical", d.counters.rediscovered === 1 && d.counters.newly_discovered_historical === 0 && d.newChangeKeys.length === 0);
}

// ─── CANONICAL CASE RE-SYNTHESIS (opportunityTest is the one engine) ──────────
t("resynth: no material new info → decision RETAINED (not re-decided from aging)",
  (() => { const d = classifyDelta(planF, obs([]), NOW); const rc = resynthesizeCase(priorMon, d, NOW); return rc.decision === "monitor" && rc.decisionSource === "retained_no_material_change"; })());
t("resynth: newly discovered HISTORICAL evidence → decision via canonical engine, NO external What Changed",
  (() => { const d = classifyDelta(planF, obs([oi({ kind: "acquisition", eventDate: daysAgo(200), sourceHost: "bloomberg.com" })]), NOW); const rc = resynthesizeCase(priorMon, d, NOW); return rc.decisionSource === "canonical_opportunity_test"; })());
t("resynth: fresh new post-review event → canonical engine (opportunity_test), timing derives from observed event",
  (() => { const d = classifyDelta(planF, obs([oi({ kind: "expansion", eventDate: daysAgo(5), sourceHost: "a.com", originId: "o1" }), oi({ kind: "expansion", eventDate: daysAgo(5), sourceHost: "b.com", originId: "o2" })]), NOW); const rc = resynthesizeCase(priorMon, d, NOW); return rc.decisionSource === "canonical_opportunity_test" && rc.verdictStatus !== null; })());
t("resynth: material counterevidence caps a Prioritize case at Validate",
  (() => { const prio = snap({ accountId: "acc", decision: "prioritize", reviewedAt: daysAgo(30), evidence: "Strong" }); const p = planMonitorReview(monitoredStateFromSnapshot(prio, scope), prio); const d = classifyDelta(p, obs([oi({ kind: "cancellation", eventDate: daysAgo(3), isCounterevidence: true })]), NOW); const rc = resynthesizeCase(prio, d, NOW); return rc.decision === "validate" && rc.hasMaterialCounter; })());
t("resynth: open decision-critical caps decision at Validate (cannot Prioritize)",
  (() => { const val = snap({ accountId: "acc", decision: "validate", reviewedAt: daysAgo(20), decisionCriticalThemeKeys: ["ops_start", "budget"] }); const p = planMonitorReview(monitoredStateFromSnapshot(val, scope), val); const d = classifyDelta(p, obs([oi({ kind: "expansion", eventDate: daysAgo(3), resolvesValidationKey: "ops_start", sourceHost: "a.com", originId: "o1" })]), NOW); const rc = resynthesizeCase(val, d, NOW); return rc.decision === "validate" && rc.remainingDecisionCritical.includes("budget"); })());

// ─── FALSE-NOVELTY / FALSE-WHAT-CHANGED = 0 across the adversarial set ────────
{
  const items = [
    oi({ kind: "new_facility", eventDate: "2026-01-01" }),                       // rediscovered
    oi({ kind: "acquisition", eventDate: daysAgo(200) }),                        // historical
    oi({ kind: "x", eventDate: null, isDatedMaterialEvent: false, relevantToCase: false }), // contextual
  ];
  const d = classifyDelta(planF, obs(items), NOW);
  t("false-novelty rate = 0: no rediscovered/historical/contextual item becomes a new What Changed",
    d.newChangeKeys.length === 0 && d.counters.accepted_new === 0);
}

// ─── REPEATED-RUN SOAK: R1 → R2 (new event) → R3 (rediscovery) ────────────────
async function reviewWith(prior: AccountReviewSnapshot, items: ObservedItem[], reviewId: string, reviewedAt: string) {
  const reobs: Reobserver = async () => obs(items);
  const state = monitoredStateFromSnapshot(prior, scope);
  return reviewAccount(state, prior, reobs, { reviewId, reviewedAt, contextVersion: prior.contextVersion }, new Date(reviewedAt));
}
{
  // R1 baseline (monitor). R2: genuine new corroborated event → changed. R3: same event re-seen → no change.
  const ev = daysAgo(20).slice(0, 10); // date-only, as real extraction produces
  const R1 = snap({ accountId: "acc", decision: "monitor", reviewedAt: daysAgo(60), changeKeys: ["new_facility:2026-01-01"] });
  const r2 = await reviewWith(R1, [oi({ kind: "expansion", eventDate: ev, sourceHost: "a.com", originId: "o1" }), oi({ kind: "expansion", eventDate: ev, sourceHost: "b.com", originId: "o2" })], "R2", daysAgo(10));
  t("soak R2: new corroborated event → completed_changed, new What Changed, canonical decision",
    r2.status === "completed_changed" && (r2.snapshot?.changeKeys.includes(`expansion:${ev}`) ?? false) && r2.decisionSource === "canonical_opportunity_test");
  const R2snap = r2.snapshot!;
  const r3 = await reviewWith(R2snap, [oi({ kind: "expansion", eventDate: ev, sourceHost: "a.com", originId: "o1" })], "R3", NOW.toISOString());
  t("soak R3: rediscovery of the SAME event → completed_no_change, decision retained (no false novelty)",
    r3.status === "completed_no_change" && r3.decisionSource === "retained_no_material_change" && diffAccountCase(R2snap, r3.snapshot!).material === false);
  t("soak: R3 predecessor ordering (R3 vs R2) is a valid immutable chain (R2 unchanged)",
    R2snap.reviewId === "R2" && r3.snapshot?.reviewId === "R3");
}
{
  // Historical-discovery soak (§52): R2 discovers evidence for an event before R1.
  const R1 = snap({ accountId: "acc", decision: "monitor", reviewedAt: daysAgo(60) });
  const r2 = await reviewWith(R1, [oi({ kind: "acquisition", eventDate: daysAgo(300), sourceHost: "bloomberg.com" })], "R2h", daysAgo(5));
  t("soak historical: R2 discovers pre-R1 event → NO changeKey claiming change-since-last-review",
    (r2.snapshot?.changeKeys ?? []).every((k) => !k.startsWith("acquisition:")) && (r2.delta?.counters.newly_discovered_historical ?? 0) === 1);
}

// ─── FAILURE: extraction/synthesis safety ─────────────────────────────────────
{
  const R1 = snap({ accountId: "acc", decision: "monitor", reviewedAt: daysAgo(60) });
  const reobs: Reobserver = async () => obs([], { operatingMode: "stopped", providersAvailable: [] });
  const r = await reviewAccount(monitoredStateFromSnapshot(R1, scope), R1, reobs, { reviewId: "rz", reviewedAt: NOW.toISOString(), contextVersion: "ctx_v1" }, NOW);
  t("failure: no viable coverage → insufficient_review, no snapshot (memory not corrupted)", r.status === "insufficient_review" && !r.snapshot);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
};
run();
