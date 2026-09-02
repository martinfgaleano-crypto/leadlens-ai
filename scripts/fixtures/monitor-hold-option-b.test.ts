// Repeat Value / Monitor V1 — frozen Intelligence Option B for decision-critical HOLD scheduling.
// A HOLD is scheduler-reviewable ONLY when it carries an UNRESOLVED decision-critical validation
// requirement (a stable canonical theme key derived from STRUCTURED validationDetails, never prose).
// Decision stays HOLD; the path is trigger-based (no cadence); a resolved requirement removes
// eligibility (no permanent loop). Deterministic contract-level fixtures — not a natural-Intelligence
// claim.

import { snapshotAccountReview, type AccountReviewSnapshot } from "../../lib/deliverable/account-memory";
import { monitoredStateFromSnapshot, evaluateEligibility } from "../../lib/monitor/monitor-eligibility";
import type { AccountBriefVM, DecisionState } from "../../lib/deliverable/deliverable-view-model";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const SCOPE = { ownerUserId: "owner-a", clientKey: "ctx:1" };
const NOW = new Date("2026-09-02T12:00:00.000Z");
const reviewedAt = new Date("2026-08-01T00:00:00.000Z").toISOString();

// Build a MonitoredAccountState from a raw snapshot, then evaluate scheduler eligibility.
function snap(o: Partial<AccountReviewSnapshot> & { decision: DecisionState }): AccountReviewSnapshot {
  return {
    reviewId: "r1", reviewedAt, contextVersion: "1", accountId: "acme",
    fit: "Moderate", timing: "Limited", evidence: "Moderate",
    changeKeys: [], hasVerifiedChange: false, evidenceOrigins: ["reuters.com"], independentSupport: false,
    counterCount: 0, hasMaterialCounter: false, validationThemeKeys: [], decisionCriticalThemeKeys: [],
    hasRevisitTrigger: false, monitorReason: null, revisitTrigger: null, ...o,
  } as AccountReviewSnapshot;
}
const elig = (s: AccountReviewSnapshot) => evaluateEligibility(monitoredStateFromSnapshot(s, SCOPE), NOW);

// ── CASE 1 — NORMAL HOLD (no decision-critical key) → NOT eligible via this path ──
const c1 = elig(snap({ decision: "hold", decisionCriticalThemeKeys: [] }));
t("CASE 1 normal HOLD → not eligible", c1.eligible === false && c1.reasons.includes("hold_no_recurring_research"));
t("CASE 1 HOLD has no cadence clock (nextEligibleAt null)", c1.nextEligibleAt === null);

// ── CASE 2 — QUALIFYING HOLD (unresolved decision-critical) → eligible, decision stays HOLD ──
const s2 = snap({ decision: "hold", decisionCriticalThemeKeys: ["confirm-procurement-ownership"] });
const c2 = elig(s2);
t("CASE 2 qualifying HOLD → eligible", c2.eligible === true && c2.reasons.includes("validate_unresolved_decision_critical"));
t("CASE 2 decision remains HOLD (eligibility ≠ decision)", s2.decision === "hold");
t("CASE 2 trigger-based, not cadence (nextEligibleAt null)", c2.nextEligibleAt === null);

// ── CASE 3 — RESOLVED REQUIREMENT → eligibility disappears (latest snapshot has no key) ──
// The scheduler reads the LATEST accepted snapshot; after Review #2 resolves the requirement the
// newer snapshot carries decisionCriticalThemeKeys=[], so this path stops matching.
const c3 = elig(snap({ decision: "hold", reviewId: "r2", decisionCriticalThemeKeys: [] }));
t("CASE 3 resolved requirement → not eligible (no permanent loop)", c3.eligible === false);

// ── CASE 4 — PROSE ONLY → zero authority ──
// Structured validationDetails drive decision-critical keys; free-text validations/prose never do.
function vm(decision: DecisionState, opts: Partial<AccountBriefVM>): AccountBriefVM {
  return {
    id: "acme", company: "Acme", domain: "acme.example.com", geography: "United States", rank: 1, decision,
    decisionNote: decision, thesis: null, segment: null, industry: null, location: null, accountRole: null,
    opportunityType: null, opportunityDescriptor: null,
    dimensions: [{ label: "Fit", value: "Moderate" }, { label: "Timing", value: "Limited" }],
    evidence: { strength: "Moderate", corroborated: false } as AccountBriefVM["evidence"],
    whatChanged: [], sources: [{ label: "Reuters", url: "https://reuters.com/x" }], validations: [], limitations: [],
    nextStep: null, freshness: null, counterSignals: [], revisitWhen: null, monitorIdentity: null,
    ...opts,
  } as AccountBriefVM;
}
const meta = { reviewId: "r", reviewedAt, contextVersion: "1" };
// Prose-only: a free-text validation string with NO structured decision-critical flag.
const proseSnap = snapshotAccountReview(vm("hold", { validations: ["Validate procurement ownership before acting."] }), meta);
t("CASE 4 prose validation yields NO decision-critical key", proseSnap.decisionCriticalThemeKeys.length === 0);
t("CASE 4 prose-only HOLD → not eligible", elig(proseSnap).eligible === false);

// Structured decision-critical requirement DOES produce a key → eligible (proves derivation source).
const structuredSnap = snapshotAccountReview(vm("hold", {
  validationDetails: [{ question: "Confirm regional procurement ownership", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }],
}), meta);
t("structured decision-critical requirement yields a stable key", structuredSnap.decisionCriticalThemeKeys.length === 1);
t("structured decision-critical HOLD → eligible", elig(structuredSnap).eligible === true);

// ── Regression: non-HOLD behavior unchanged ──
t("generic HOLD stays trigger-only (unchanged)", elig(snap({ decision: "hold" })).eligible === false);
t("MONITOR due by cadence still eligible", elig(snap({ decision: "monitor" })).eligible === true);
t("VALIDATE with unresolved decision-critical still eligible", elig(snap({ decision: "validate", decisionCriticalThemeKeys: ["k"] })).eligible === true);

// ── Tenant isolation: eligibility is per-state; one account's key never affects another ──
const other = elig(snap({ decision: "hold", accountId: "beta", decisionCriticalThemeKeys: [] }));
t("tenant/account isolation: sibling HOLD without key stays not eligible", other.eligible === false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
