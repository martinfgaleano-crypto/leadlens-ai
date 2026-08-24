// Account Memory / Living Opportunity Cases V1 — deterministic diff contract.
// Controlled SYNTHETIC multi-review timeline around a Saia-like Case (NOT actual
// Saia history, §39). Covers §108-125 + locale independence + idempotency.
import { snapshotAccountReview, diffAccountCase, orderReviews, sinceLastReview, snapshotFingerprint } from "../../lib/deliverable/account-memory";
import { diffPortfolioIntelligence, buildPortfolioIntelligence } from "../../lib/deliverable/portfolio-intelligence";
import type { AccountBriefVM, DeliverableViewModel } from "../../lib/deliverable/deliverable-view-model";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

const acct = (o: Partial<AccountBriefVM>): AccountBriefVM => ({
  id: o.id ?? "saia", rank: null, company: o.company ?? "Saia Inc.", segment: null, geography: null, domain: null,
  accountRole: o.accountRole ?? "Potential Customer", opportunityType: o.opportunityType ?? "Capacity Expansion",
  decision: o.decision ?? "monitor", decisionNote: null, thesis: null, whyItMatters: null,
  dimensions: o.dimensions ?? [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Limited" }, { label: "Evidence", value: "Limited" }],
  whatChanged: o.whatChanged ?? [], evidence: o.evidence ?? { sourceCount: 0, datedCount: 0, corroborated: null, latestAge: null, strength: "Limited" },
  sources: o.sources ?? [], counterSignals: o.counterSignals ?? [], limitations: [], validations: o.validations ?? [],
  validationDetails: o.validationDetails, nextStep: null, revisitWhen: o.revisitWhen ?? null, freshness: null, confidence: null,
});

const rev = (id: string, at: string, ctx = "asteron-v1") => ({ reviewId: id, reviewedAt: at, contextVersion: ctx });

// ── T1: structural Fit, no verified change, Monitor, revisit trigger, systems validation open (§41)
const T1 = snapshotAccountReview(acct({
  decision: "monitor",
  dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Limited" }, { label: "Evidence", value: "Limited" }],
  whatChanged: [{ event: "No verified recent change", date: null, age: null, source: null, kind: "unknown" }],
  revisitWhen: "A new US terminal is announced",
  validations: ["Confirm current planning systems / vendor"],
  validationDetails: [{ question: "Confirm current planning systems / vendor", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }],
}), rev("r1", "2026-03-01"));

// ── T2 base Case (reused so idempotency/aging fixtures are genuinely identical) ──
const saiaT2Case = (extra: Partial<AccountBriefVM> = {}): AccountBriefVM => acct({
  decision: "prioritize",
  dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Strong" }, { label: "Evidence", value: "Strong" }],
  whatChanged: [{ event: "Opened new terminals in Duluth and Columbia", date: "2026-06-20", age: "2mo", source: "freightwaves.com", kind: "true_change" }],
  evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "2mo", strength: "Strong" },
  sources: [{ label: "freightwaves.com", url: null, date: "2026-06-22", age: "2mo", relation: "direct", claim: null }, { label: "globenewswire.com", url: null, date: "2026-05-21", age: "3mo", relation: "corroborating", claim: null }],
  revisitWhen: "A new US terminal is announced",
  validations: ["Confirm current planning systems / vendor"],
  validationDetails: [{ question: "Confirm current planning systems / vendor", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }],
  ...extra,
});
// verified terminal expansion, Timing Strong, corroborated (2 origins), Prioritize (§42)
const T2 = snapshotAccountReview(saiaT2Case(), rev("r2", "2026-06-28"));

// ── T3: decision-critical validation resolved, new material counterevidence appears (§43)
const T3 = snapshotAccountReview(acct({
  decision: "validate",
  dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Strong" }, { label: "Evidence", value: "Strong" }],
  whatChanged: [{ event: "Opened new terminals in Duluth and Columbia", date: "2026-06-20", age: "5mo", source: "freightwaves.com", kind: "true_change" }],
  evidence: { sourceCount: 3, datedCount: 1, corroborated: true, latestAge: "1mo", strength: "Strong" },
  sources: [{ label: "freightwaves.com", url: null, date: "2026-06-22", age: "5mo", relation: "direct", claim: null }, { label: "globenewswire.com", url: null, date: "2026-05-21", age: "6mo", relation: "corroborating", claim: null }, { label: "ttnews.com", url: null, date: "2026-09-01", age: "1mo", relation: "corroborating", claim: null }],
  counterSignals: ["Tonnage decline and job cuts reported across the network"],
  revisitWhen: "A new US terminal is announced",
  validations: [],  // systems validation resolved
}), rev("r3", "2026-10-01"));

// §108 first review → no memory
t("§108 first review yields no Since-Last-Review module", sinceLastReview(diffAccountCase(null, T1), false) === null);
t("§108 first review diff flagged isFirstReview", diffAccountCase(null, T1).isFirstReview === true);

// §109/§121 identical review → no change (idempotency by fingerprint + reviewId)
{
  const T2b = snapshotAccountReview(saiaT2Case(), rev("r2b", "2026-06-29"));
  const d = diffAccountCase(T2, T2b);
  t("§109 identical intelligence → isSameReview (no change)", d.isSameReview === true && d.material === false);
  t("§121 same reviewId ingested twice → no duplicate memory", diffAccountCase(T2, T2).isSameReview === true);
  t("§109 fingerprint equal for equal intelligence", snapshotFingerprint(T2) === snapshotFingerprint(T2b));
}

// T1 → T2 core transitions
const d12 = diffAccountCase(T1, T2);
t("§112 new verified event detected as New Since Last Review", d12.newChangeKeys.length === 1);
t("§110 new independent evidence detected as Evidence Added", d12.evidenceAdded.length === 2 && d12.independentSupportAdded === true);
t("§113 Timing Unknown/Limited → Strong = strengthened", d12.timing.direction === "strengthened");
t("§114 Decision Monitor → Prioritize with material drivers", d12.decision.changed && d12.decision.from === "monitor" && d12.decision.to === "prioritize" && d12.decision.drivers.includes("new_material_change") && d12.decision.drivers.includes("new_corroboration"));
t("§31 revisit trigger recognized as met (Monitor + trigger + new change)", d12.revisitTriggerMet === true);
t("§20 no aggregate-score driver used", !JSON.stringify(d12.decision.drivers).match(/score/i));

// §111 duplicate evidence (same origins) is NOT new evidence
{
  const T2same = snapshotAccountReview(acct({ decision: "prioritize", whatChanged: [{ event: "Opened new terminals", date: "2026-06-20", age: "3mo", source: "freightwaves.com", kind: "true_change" }], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "3mo", strength: "Strong" }, sources: [{ label: "freightwaves.com", url: null, date: "2026-06-22", age: "3mo", relation: "direct", claim: null }, { label: "globenewswire.com", url: null, date: "2026-05-21", age: "4mo", relation: "corroborating", claim: null }], dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Strong" }, { label: "Evidence", value: "Strong" }] }), rev("r2c", "2026-09-15"));
  const d = diffAccountCase(T2, T2same);
  t("§111 re-fetched same origins ⇒ 0 evidence added", d.evidenceAdded.length === 0);
  t("§21/§111 same dated event ⇒ 0 new change", d.newChangeKeys.length === 0);
}

// T2 → T3: validation resolved + counterevidence weakens
const d23 = diffAccountCase(T2, T3);
t("§115 open decision-critical validation → Resolved", d23.validationResolved.includes("systems") && d23.decisionCriticalResolved.includes("systems"));
t("§116 new material counterevidence detected (Case weakened)", d23.counterevidenceAdded === true);
t("§88 decision transition references concrete drivers", d23.decision.changed && d23.decision.drivers.includes("counterevidence_added") && d23.decision.drivers.includes("decision_critical_resolved"));

// §117 staleness alone is not counterevidence (T2→T2-older: only ages change)
{
  // identical canonical intelligence; only ages (non-canonical) differ
  const T2older = snapshotAccountReview(saiaT2Case({ evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "9mo", strength: "Strong" }, sources: [{ label: "freightwaves.com", url: null, date: "2026-06-22", age: "9mo", relation: "direct", claim: null }, { label: "globenewswire.com", url: null, date: "2026-05-21", age: "10mo", relation: "corroborating", claim: null }] }), rev("r2d", "2027-03-01"));
  const d = diffAccountCase(T2, T2older);
  t("§117 aging alone (same origins/strengths) ⇒ not counterevidence, not weakened", !d.counterevidenceAdded && d.evidenceStrength.direction === "unchanged" && d.material === false);
}

// §118 client-objective change distinguished from account change
{
  const T2ctx = snapshotAccountReview(acct({ decision: "validate", whatChanged: [{ event: "Opened new terminals", date: "2026-06-20", age: "2mo", source: "freightwaves.com", kind: "true_change" }], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "2mo", strength: "Strong" }, sources: [{ label: "freightwaves.com", url: null, date: "2026-06-22", age: "2mo", relation: "direct", claim: null }, { label: "globenewswire.com", url: null, date: "2026-05-21", age: "3mo", relation: "corroborating", claim: null }], dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Strong" }, { label: "Evidence", value: "Strong" }] }), rev("r2e", "2026-07-10", "asteron-v2"));
  const d = diffAccountCase(T2, T2ctx);
  t("§118 changed contextVersion flagged as client_objective_changed", d.contextChanged && d.decision.drivers.includes("client_objective_changed"));
}

// §119/§52 locale independence: EN vs ES snapshots of same intelligence ⇒ no diff
{
  const enA = acct({ decision: "prioritize", counterSignals: ["Tonnage decline reported"], whatChanged: [{ event: "Opened new terminals", date: "2026-06-20", age: "2mo", source: "x", kind: "true_change" }], validations: ["Confirm current systems / vendor"], validationDetails: [{ question: "Confirm current systems / vendor", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }] });
  const esA = acct({ decision: "prioritize", counterSignals: ["Caída de tonelaje reportada"], whatChanged: [{ event: "Abrió nuevas terminales", date: "2026-06-20", age: "2mo", source: "x", kind: "true_change" }], validations: ["Confirmar sistemas / proveedor actuales"], validationDetails: [{ question: "Confirmar sistemas / proveedor actuales", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }] });
  const en = snapshotAccountReview(enA, rev("rl1", "2026-06-28")); const esS = snapshotAccountReview(esA, rev("rl2", "2026-06-29"));
  const d = diffAccountCase(en, esS);
  t("§119 same intelligence EN vs ES ⇒ no material change (locale-independent)", d.material === false && d.newChangeKeys.length === 0 && d.counterevidenceAdded === false);
}

// §120 out-of-order insert: newer then older ⇒ current stays the true latest
{
  const { current, previous } = orderReviews([T3, T1, T2]);
  t("§120 orderReviews picks true latest by timestamp regardless of insert order", current?.reviewId === "r3" && previous?.reviewId === "r2");
  const { current: c2 } = orderReviews([T2, T3, T1, T2]);   // duplicate + shuffled
  t("§85/§121 dedup + ordering keeps current = r3", c2?.reviewId === "r3");
}

// §122/§45 sparse account: repeated no-evidence reviews ⇒ no false novelty spam
{
  const sparse = (id: string, at: string) => snapshotAccountReview(acct({ id: "quala", company: "Quala", decision: "monitor", whatChanged: [{ event: "none", date: null, age: null, source: null, kind: "unknown" }], dimensions: [{ label: "Fit", value: "Moderate" }, { label: "Timing", value: "Limited" }, { label: "Evidence", value: "Limited" }] }), rev(id, at));
  const d = diffAccountCase(sparse("s1", "2026-03-01"), sparse("s2", "2026-06-01"));
  t("§122 sparse account across cycles ⇒ no material change, no memory module", d.material === false && sinceLastReview(d, false) === null);
}

// §123-125 portfolio diff reuses diffPortfolioIntelligence (canonical keys)
{
  const vm = (accts: AccountBriefVM[]): DeliverableViewModel => ({ meta: { client: "Asteron", market: null, generatedAt: null, generatedLabel: null, tierLabel: null, language: "en", schemaVersion: 1 }, headline: null, summary: null, portfolio: { total: accts.length, counts: { prioritize: 0, validate: 0, monitor: 0, hold: 0 }, allocation: null, funnel: null, note: null }, accounts: accts, commercialContext: null, validationQueue: [], coverage: null, methodology: [], limitations: [], downloads: { pdf: false, portfolioCsv: false, evidenceCsv: false }, capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: false, showMethodology: false } });
  const before = vm([acct({ id: "saia", decision: "monitor", whatChanged: [{ event: "none", date: null, age: null, source: null, kind: "unknown" }] })]);
  const after = vm([acct({ id: "saia", decision: "prioritize", whatChanged: [{ event: "Opened new terminal", date: "2026-06-20", age: "2mo", source: "x", kind: "true_change" }], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "2mo", strength: "Strong" } })]);
  const pdiff = diffPortfolioIntelligence({ pi: buildPortfolioIntelligence(before), decisions: { saia: "monitor" }, validations: {} }, { pi: buildPortfolioIntelligence(after), decisions: { saia: "prioritize" }, validations: {} });
  t("§123/§125 portfolio diff reuses diffPortfolioIntelligence (decision transition)", pdiff.decisionChanges.some(x => x.caseId === "saia" && x.to === "prioritize"));
  t("§124 portfolio diff detects a new change pattern (coverage improved)", pdiff.coverage.verifiedChange.from === 0 && pdiff.coverage.verifiedChange.to === 1);
}

// §90-91 memory item provenance/inspectability: decision item names its drivers
{
  const m = sinceLastReview(d12, false)!;
  t("§18/§57 Since-Last-Review leads with Decision transition", m.items[0].kind === "decision" && /Monitor → Prioritize/.test(m.items[0].text));
  t("§91 decision item names the material drivers", /verified material change|independent support/i.test(m.items[0].text));
  const mes = sinceLastReview(d12, true)!;
  t("§75 Spanish Since-Last-Review localized", mes.title === "Desde la última revisión" && /Decisión/.test(mes.items[0].text));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
