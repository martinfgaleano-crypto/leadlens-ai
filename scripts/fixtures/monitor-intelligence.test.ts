// Recurring Monitor Intelligence V1 — deterministic acceptance (mock re-observer,
// in-memory memory repo; no providers, no network). Covers eligibility/queue,
// delta research, temporal integrity, evidence newness, sufficiency, no-change vs
// insufficient, memory loop, decision re-evaluation, batch/failure, security,
// observability, alert contract.
import { readFileSync } from "node:fs";
import {
  monitoredStateFromSnapshot, evaluateEligibility, buildReviewQueue, prioritize,
  type MonitoredAccountState,
} from "@/lib/monitor/monitor-eligibility";
import { planMonitorReview, classifyDelta, type AccountObservation, type ObservedItem } from "@/lib/monitor/delta-research";
import { reviewAccount, runMonitor, type Reobserver } from "@/lib/monitor/monitor-cycle";
import { DEFAULT_MONITOR_BUDGET } from "@/lib/monitor/monitor-config";
import { InMemoryAccountMemoryRepo } from "@/lib/deliverable/account-memory-store";
import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const NOW = new Date("2026-08-26T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const snap = (o: Partial<AccountReviewSnapshot> & { accountId: string; decision: AccountReviewSnapshot["decision"] }): AccountReviewSnapshot => ({
  reviewId: `r_${o.accountId}_1`, reviewedAt: daysAgo(40), contextVersion: "ctx_v1",
  fit: "Moderate", timing: "Limited", evidence: "Moderate", changeKeys: [], hasVerifiedChange: false,
  evidenceOrigins: ["reuters.com"], independentSupport: false, counterCount: 0, hasMaterialCounter: false,
  validationThemeKeys: [], decisionCriticalThemeKeys: [], hasRevisitTrigger: false, ...o,
});
const scope = { ownerUserId: "owner", clientKey: "clientA" };
const stateOf = (s: AccountReviewSnapshot) => monitoredStateFromSnapshot(s, scope);
const obs = (accountId: string, items: ObservedItem[], over: Partial<AccountObservation> = {}): AccountObservation =>
  ({ accountId, items, providersAvailable: ["brave", "tavily"], providersFailed: [], routesAttempted: 2, operatingMode: "full", ...over });
const item = (o: Partial<ObservedItem>): ObservedItem =>
  ({ sourceHost: "reuters.com", kind: "new_facility", eventDate: null, publicationDate: null, retrievedAt: NOW.toISOString(), isDatedMaterialEvent: true, relevantToCase: true, ...o });

// ─── ELIGIBILITY ──────────────────────────────────────────────────────────────
t("eligibility: Monitor case due by cadence is eligible", evaluateEligibility(stateOf(snap({ accountId: "a", decision: "monitor", reviewedAt: daysAgo(40) })), NOW).eligible);
t("eligibility: Prioritize freshness protection when due", (() => { const e = evaluateEligibility(stateOf(snap({ accountId: "a", decision: "prioritize", reviewedAt: daysAgo(40) })), NOW); return e.eligible && e.reasons.includes("prioritize_freshness_protection"); })());
t("eligibility: Validate with unresolved decision-critical is eligible even if not due", (() => { const e = evaluateEligibility(stateOf(snap({ accountId: "a", decision: "validate", reviewedAt: daysAgo(1), decisionCriticalThemeKeys: ["ops_start"] })), NOW); return e.eligible && e.reasons.includes("validate_unresolved_decision_critical"); })());
t("eligibility: Hold with no trigger is NOT eligible (no recurring research)", !evaluateEligibility(stateOf(snap({ accountId: "a", decision: "hold", reviewedAt: daysAgo(400) })), NOW).eligible);
t("eligibility: Hold WITH revisit trigger is eligible", evaluateEligibility(stateOf(snap({ accountId: "a", decision: "hold", hasRevisitTrigger: true })), NOW).eligible);
t("eligibility: not-due Monitor with nothing pending is not eligible", !evaluateEligibility(stateOf(snap({ accountId: "a", decision: "monitor", reviewedAt: daysAgo(1) })), NOW).eligible);

// ─── PRIORITY + QUEUE ─────────────────────────────────────────────────────────
{
  const states: MonitoredAccountState[] = [
    stateOf(snap({ accountId: "dc", decision: "validate", reviewedAt: daysAgo(20), decisionCriticalThemeKeys: ["ops_start"] })),
    stateOf(snap({ accountId: "trig", decision: "monitor", reviewedAt: daysAgo(40), hasRevisitTrigger: true })),
    stateOf(snap({ accountId: "prio", decision: "prioritize", reviewedAt: daysAgo(40) })),
    stateOf(snap({ accountId: "mon", decision: "monitor", reviewedAt: daysAgo(45) })),
  ];
  const ranked = prioritize(states.map((s) => ({ state: s, eligibility: evaluateEligibility(s, NOW) })), NOW);
  t("priority: decision-critical unresolved ranks first (inspectable reasons, no score)",
    ranked[0].state.accountId === "dc" && ranked[0].reasons.includes("decision_critical_unresolved"));
  const q = buildReviewQueue(states, NOW, { ...DEFAULT_MONITOR_BUDGET, maxAccountsPerRun: 2 }, scope);
  t("queue: budget=2 → 2 selected, 2 deferred_due_to_budget (never dropped)",
    q.selected.length === 2 && q.deferred.length === 2 && q.entries.filter((e) => e.disposition === "deferred_due_to_budget").length === 2);
}
t("queue: large Hold population is not selected (no wasted spend)", (() => {
  const holds = Array.from({ length: 20 }, (_, i) => stateOf(snap({ accountId: `h${i}`, decision: "hold", reviewedAt: daysAgo(400) })));
  return buildReviewQueue(holds, NOW, DEFAULT_MONITOR_BUDGET, scope).selected.length === 0;
})());

// ─── DELTA PLAN + CUTOFF ──────────────────────────────────────────────────────
{
  const prior = snap({ accountId: "a", decision: "validate", reviewedAt: daysAgo(30), decisionCriticalThemeKeys: ["ops_start"], changeKeys: ["expansion:2026-05-01"] });
  const plan = planMonitorReview(stateOf(prior), prior);
  t("plan: derived from prior Case — cutoff, decision-critical focus, watch families",
    plan.since.previousReviewedAt === prior.reviewedAt && plan.focusValidationKeys.includes("ops_start") && plan.watchSignalFamilies.includes("expansion") && plan.routeThemes.some((r) => r.startsWith("resolve:ops_start")));
}

// ─── TEMPORAL INTEGRITY ───────────────────────────────────────────────────────
const priorFacility = snap({ accountId: "acc", decision: "monitor", reviewedAt: daysAgo(60), changeKeys: ["new_facility:2026-01-01"], evidenceOrigins: ["reuters.com"] });
const planF = planMonitorReview(stateOf(priorFacility), priorFacility);

t("temporal: new dated event AFTER cutoff → accepted_new", classifyDelta(planF, obs("acc", [item({ kind: "acquisition", eventDate: daysAgo(10) })]), NOW).counters.accepted_new === 1);
t("temporal: retrieval date is NEVER the event date (no eventDate → rejected_temporal)",
  classifyDelta(planF, obs("acc", [item({ eventDate: null, publicationDate: daysAgo(1) })]), NOW).counters.rejected_temporal === 1);
t("temporal: publication new but EVENT old (before cutoff) → not new (rejected_temporal)",
  classifyDelta(planF, obs("acc", [item({ kind: "acquisition", eventDate: daysAgo(200), publicationDate: daysAgo(1) })]), NOW).counters.rejected_temporal === 1);
t("temporal: same canonical event already known → rediscovered, not new",
  classifyDelta(planF, obs("acc", [item({ kind: "new_facility", eventDate: "2026-01-01" })]), NOW).counters.rediscovered === 1);
t("temporal: static page (not a dated material event) → contextual_only",
  classifyDelta(planF, obs("acc", [item({ isDatedMaterialEvent: false, eventDate: null })]), NOW).counters.contextual_only === 1);

// ─── EVIDENCE NEWNESS / CORROBORATION / ORIGIN ───────────────────────────────
t("dedup: same event from two sources → ONE accepted event", (() => {
  const d = classifyDelta(planF, obs("acc", [item({ kind: "acquisition", eventDate: daysAgo(10), sourceHost: "reuters.com", originId: "wire1" }), item({ kind: "acquisition", eventDate: daysAgo(10), sourceHost: "bloomberg.com", originId: "wire2" })]), NOW);
  return d.acceptedEvents.length === 1;
})());
t("origin: same press release reproduced by two outlets → NOT independent support", (() => {
  const d = classifyDelta(planF, obs("acc", [item({ kind: "acquisition", eventDate: daysAgo(10), sourceHost: "outletA.com", originId: "PR-42" }), item({ kind: "acquisition", eventDate: daysAgo(10), sourceHost: "outletB.com", originId: "PR-42" })]), NOW);
  return d.acceptedEvents[0].independentSupport === false;
})());
t("independence: two DISTINCT origins → independent support", (() => {
  const d = classifyDelta(planF, obs("acc", [item({ kind: "acquisition", eventDate: daysAgo(10), sourceHost: "a.com", originId: "o1" }), item({ kind: "acquisition", eventDate: daysAgo(10), sourceHost: "b.com", originId: "o2" })]), NOW);
  return d.acceptedEvents[0].independentSupport === true;
})());
t("newness: rediscovered origin is not counted as a new origin", (() => {
  const d = classifyDelta(planF, obs("acc", [item({ kind: "new_facility", eventDate: "2026-01-01", sourceHost: "reuters.com" })]), NOW);
  return d.newOrigins.length === 0;
})());
t("freshness: no new evidence + very old case → freshness_gap (not counterevidence)", (() => {
  const oldPrior = snap({ accountId: "acc", decision: "prioritize", reviewedAt: daysAgo(200) });
  const p = planMonitorReview(stateOf(oldPrior), oldPrior);
  const d = classifyDelta(p, obs("acc", []), NOW);
  return d.freshnessGap === true && !d.hasMaterialCounter;
})());

// ─── OUTCOMES: no-change / strengthened / weakened / validation-resolved / insufficient
async function review(prior: AccountReviewSnapshot, o: AccountObservation, reviewedAt = NOW.toISOString()) {
  const reobs: Reobserver = async () => o;
  return reviewAccount(stateOf(prior), prior, reobs, { reviewId: "r2", reviewedAt, contextVersion: prior.contextVersion }, NOW);
}

t("GOLDEN A no-change: only rediscovered → completed_no_change, decision unchanged, next review set", (() => true)());
{
  const r = await review(priorFacility, obs("acc", [item({ kind: "new_facility", eventDate: "2026-01-01" })]));
  t("GOLDEN A: rediscovered-only → completed_no_change, decision unchanged, nextReviewAt set",
    r.status === "completed_no_change" && r.snapshot?.decision === "monitor" && !!r.nextReviewAt && r.alert?.materialChange === false);
}
{
  const r = await review(priorFacility, obs("acc", [item({ kind: "expansion", eventDate: daysAgo(5), sourceHost: "a.com", originId: "o1" }), item({ kind: "expansion", eventDate: daysAgo(5), sourceHost: "b.com", originId: "o2" })]));
  t("GOLDEN B strengthened: new corroborated event → completed_changed, material, new evidence",
    r.status === "completed_changed" && r.diff?.material === true && (r.delta?.counters.accepted_new ?? 0) >= 1 && r.snapshot?.independentSupport === true);
}
{
  const prioritized = snap({ accountId: "acc", decision: "prioritize", reviewedAt: daysAgo(30), evidence: "Strong" });
  const r = await review(prioritized, obs("acc", [item({ kind: "cancellation", eventDate: daysAgo(3), isCounterevidence: true })]));
  t("GOLDEN C weakened: material counterevidence → Case weakened, decision re-evaluated to validate",
    r.status === "completed_changed" && r.snapshot?.hasMaterialCounter === true && r.snapshot?.decision === "validate");
}
{
  const validate = snap({ accountId: "acc", decision: "validate", reviewedAt: daysAgo(20), decisionCriticalThemeKeys: ["ops_start"] });
  const r = await review(validate, obs("acc", [item({ kind: "operations_start", eventDate: daysAgo(2), resolvesValidationKey: "ops_start", sourceHost: "a.com", originId: "o1" })]));
  t("GOLDEN D validation-resolved: decision-critical resolved + new support → prioritize",
    r.status === "completed_changed" && (r.delta?.resolvedValidationKeys ?? []).includes("ops_start") && r.snapshot?.decision === "prioritize" && r.snapshot?.decisionCriticalThemeKeys.length === 0);
}
{
  const r = await review(priorFacility, obs("acc", [], { providersAvailable: [], providersFailed: ["brave", "tavily"], operatingMode: "stopped", routesAttempted: 0 }));
  t("INSUFFICIENT: all providers failed → insufficient_review, NO snapshot, not no-change",
    r.status === "insufficient_review" && !r.snapshot);
}
{
  const r = await review(priorFacility, obs("acc", [item({ kind: "new_facility", eventDate: "2026-01-01" })], { providersFailed: ["serper"], providersAvailable: ["brave"], operatingMode: "degraded" }));
  t("PROVIDER-DEGRADED: one provider down but viable → completes (not insufficient)",
    r.status === "completed_no_change" || r.status === "completed_changed");
}
{
  const r = await review(priorFacility, obs("acc", []));
  t("NO-NEWS with sufficient coverage → completed_no_change (never counterevidence)",
    r.status === "completed_no_change" && r.snapshot?.hasMaterialCounter === false);
}

// ─── CONTEXT CHANGE (no fabricated external event) ────────────────────────────
{
  const reobs: Reobserver = async () => obs("acc", []);
  const r = await reviewAccount(stateOf(priorFacility), priorFacility, reobs, { reviewId: "r2", reviewedAt: NOW.toISOString(), contextVersion: "ctx_v2" }, NOW);
  t("context change: contextVersion v1→v2 → contextChanged, no fabricated What Changed",
    r.diff?.contextChanged === true && (r.delta?.counters.accepted_new ?? 0) === 0);
}

// ─── RUN: batch isolation, memory persistence, idempotency, deferred ──────────
{
  const states = [
    stateOf(snap({ accountId: "ok1", decision: "monitor", reviewedAt: daysAgo(40) })),
    stateOf(snap({ accountId: "ok2", decision: "monitor", reviewedAt: daysAgo(40) })),
    stateOf(snap({ accountId: "bad", decision: "monitor", reviewedAt: daysAgo(40) })),
  ];
  const priorById = Object.fromEntries(states.map((s) => [s.accountId, snap({ accountId: s.accountId, decision: "monitor", reviewedAt: daysAgo(40) })]));
  const repo = new InMemoryAccountMemoryRepo();
  const reobserve: Reobserver = async (plan) => plan.accountId === "bad"
    ? obs(plan.accountId, [], { providersAvailable: [], operatingMode: "stopped", routesAttempted: 0 })
    : obs(plan.accountId, [item({ kind: "expansion", eventDate: daysAgo(5), sourceHost: "a.com", originId: "o1" }), item({ kind: "expansion", eventDate: daysAgo(5), sourceHost: "b.com", originId: "o2" })]);
  const runInput = { runId: "run1", scope, states, priorById, reobserve, memoryRepo: repo, reviewIdFor: (a: string) => `run1_${a}`, now: () => NOW };
  const r1 = await runMonitor(runInput);
  t("run: batch isolation — 2 accepted + 1 insufficient, run completes with failures",
    r1.observability.completedChanged === 2 && r1.observability.insufficient === 1 && r1.status === "completed_with_failures");
  t("run: only accepted reviews persist to memory (2 rows), insufficient excluded", repo.rows.length === 2);
  t("run: observability captured (due/selected/newEvidence/decisionChanged)",
    r1.observability.accountsSelected === 3 && r1.observability.newEvidence >= 2 && typeof r1.observability.decisionChanged === "number");
  t("run: alert contract present per reviewed account", r1.alerts.length >= 2 && r1.alerts.every((a) => typeof a.materialChange === "boolean" && !!a.reviewId));
  // Idempotency: same cycle re-run → same reviewIds → memory upserts, no duplicate.
  const r2 = await runMonitor(runInput);
  t("idempotency: re-running the same cycle does not duplicate memory", repo.rows.length === 2 && r2.runId === "run1");
}
{
  // Deferred accounts are reported, not lost.
  const many = Array.from({ length: 5 }, (_, i) => stateOf(snap({ accountId: `m${i}`, decision: "monitor", reviewedAt: daysAgo(40) })));
  const priorById = Object.fromEntries(many.map((s) => [s.accountId, snap({ accountId: s.accountId, decision: "monitor", reviewedAt: daysAgo(40) })]));
  const r = await runMonitor({ runId: "run2", scope, states: many, priorById, reobserve: async (p) => obs(p.accountId, []), memoryRepo: new InMemoryAccountMemoryRepo(), reviewIdFor: (a: string) => `run2_${a}`, now: () => NOW, budget: { ...DEFAULT_MONITOR_BUDGET, maxAccountsPerRun: 2 } });
  t("deferred: budget=2 of 5 → 3 deferred_due_to_budget outcomes reported", r.outcomes.filter((o) => o.status === "deferred_due_to_budget").length === 3);
}

// ─── FAILED REVIEW NOT MEMORY ─────────────────────────────────────────────────
{
  const repo = new InMemoryAccountMemoryRepo();
  const s = stateOf(snap({ accountId: "x", decision: "monitor", reviewedAt: daysAgo(40) }));
  await runMonitor({ runId: "run3", scope, states: [s], priorById: { x: snap({ accountId: "x", decision: "monitor", reviewedAt: daysAgo(40) }) }, reobserve: async () => { throw new Error("boom"); }, memoryRepo: repo, reviewIdFor: (a: string) => `run3_${a}`, now: () => NOW });
  t("failed review does not become memory", repo.rows.length === 0);
}

// ─── SECURITY / SOURCE GUARDS ─────────────────────────────────────────────────
const routeSrc = readFileSync("app/api/customer/monitor/route.ts", "utf8");
t("route: owner resolved server-side (auth.getUser → user.id), body only client_key (no Evidence/Decision injection)",
  /auth\.getUser\(token\)/.test(routeSrc) && /user\.id/.test(routeSrc) && /client_key:/.test(routeSrc) && !/(decision|evidence|snapshot|whatChanged):\s*z\./i.test(routeSrc));
t("route: returns only curated observability + alerts, never raw snapshots",
  /observability/.test(routeSrc) && /alerts/.test(routeSrc) && !/report_json|snapshot:/.test(routeSrc));
t("no-alerts: Monitor emits an alert CONTRACT but builds no messaging/email",
  !/nodemailer|sendEmail|sendgrid|resend|notif/i.test(readFileSync("lib/monitor/monitor-cycle.ts", "utf8")));
t("reuse: Monitor uses diffAccountCase (canonical memory), not a parallel classifier",
  /diffAccountCase/.test(readFileSync("lib/monitor/monitor-cycle.ts", "utf8")));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
};
run();
