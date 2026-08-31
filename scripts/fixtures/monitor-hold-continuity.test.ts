// Phase 1/2 — Monitor/Hold memory continuity + cross-run predecessor lineage.
// Proves: Monitor and eligible Hold are ADMITTED to the portfolio + Account Memory;
// structural rejects (qc FAILED) and DISCARD noise are EXCLUDED; strong count drives
// commercial honesty; same-review retry is idempotent (no fake review); and a real
// cross-run predecessor resolves across all decision transitions.

import { selectPortfolioAdmission, isPortfolioNoise } from "../../lib/intelligence/portfolio-admission";
import {
  snapshotAccountReview, diffAccountCase, isStructuralReject, type AccountReviewSnapshot,
} from "../../lib/deliverable/account-memory";
import { InMemoryAccountMemoryRepo, rowsForReview } from "../../lib/deliverable/account-memory-store";
import type { AccountBriefVM, DecisionState } from "../../lib/deliverable/deliverable-view-model";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${name}`); };

// ── Phase 1: portfolio admission policy ──
const cases = [
  { lead_id: "p", decision: "prioritize" },
  { lead_id: "v", decision: "validate" },
  { lead_id: "m", decision: "monitor" },
  { lead_id: "h", decision: "hold" },          // eligible hold
  { lead_id: "sr", decision: "hold" },         // structural reject (qc FAILED)
  { lead_id: "dc", decision: "monitor" },      // DISCARD-tier noise
];
const leads = [
  { id: "p", qc_status: "APPROVED", category: "HOT" },
  { id: "v", qc_status: "APPROVED", category: "WARM" },
  { id: "m", qc_status: "APPROVED", category: "WARM" },
  { id: "h", qc_status: "APPROVED", category: "COLD" },
  { id: "sr", qc_status: "FAILED", category: "WARM" },
  { id: "dc", qc_status: "APPROVED", category: "DISCARD" },
];
const adm = selectPortfolioAdmission(cases, leads);
t("admits prioritize", adm.portfolioIds.has("p"));
t("admits validate", adm.portfolioIds.has("v"));
t("admits monitor", adm.portfolioIds.has("m"));
t("admits eligible hold", adm.portfolioIds.has("h"));
t("excludes structural reject (qc FAILED)", !adm.portfolioIds.has("sr"));
t("excludes DISCARD noise", !adm.portfolioIds.has("dc"));
t("portfolio size = 4", adm.portfolioIds.size === 4);
t("strong count = prioritize+validate only (2)", adm.strongCount === 2);
t("monitor/hold-only run → strongCount 0 (honest abstention)",
  selectPortfolioAdmission([{ lead_id: "m", decision: "monitor" }, { lead_id: "h", decision: "hold" }], [{ id: "m" }, { id: "h" }]).strongCount === 0);
t("isPortfolioNoise: qc FAILED", isPortfolioNoise({ id: "x", qc_status: "FAILED" }) === true);
t("isPortfolioNoise: missing lead admits (memory net applies)", isPortfolioNoise(undefined) === false);

// ── Memory admission: rowsForReview keeps monitor/hold, drops structural reject ──
function vm(id: string, company: string, decision: DecisionState, opts: Partial<AccountBriefVM> = {}): AccountBriefVM {
  return {
    id, company, domain: `${id}.example.com`, geography: "United States", rank: 1, decision,
    decisionNote: opts.decisionNote ?? decision, thesis: null, segment: null, industry: null, location: null,
    accountRole: null, opportunityType: null, opportunityDescriptor: null,
    dimensions: [{ label: "Fit", value: "Moderate" }, { label: "Timing", value: "Moderate" }],
    evidence: { strength: "Moderate", corroborated: false, ...(opts.evidence ?? {}) } as AccountBriefVM["evidence"],
    whatChanged: opts.whatChanged ?? [], sources: opts.sources ?? [], validations: opts.validations ?? [],
    validationDetails: opts.validationDetails, limitations: [], nextStep: null, freshness: null,
    counterSignals: opts.counterSignals ?? [], revisitWhen: opts.revisitWhen ?? null,
    monitorIdentity: opts.monitorIdentity ?? { stableAccountKey: id, domain: `${id}.example.com` },
    ...opts,
  } as AccountBriefVM;
}
const scope = { ownerUserId: "owner-1", clientKey: "context:v1" };
const meta1 = { reviewId: "run-1", reviewedAt: "2026-08-01T00:00:00Z", contextVersion: "ctx:v1" };
const accounts1: AccountBriefVM[] = [
  vm("acct-a", "Acme", "monitor", { whatChanged: [], validations: ["Confirm expansion is operational"] }),
  vm("acct-b", "Beta", "hold"),
  vm("acct-sr", "Reject Co", "hold", { decisionNote: "structural_disqualifier: wrong entity" }),
];
const rows1 = rowsForReview(accounts1, scope, meta1);
t("rowsForReview keeps monitor", rows1.some(r => r.accountId.includes("acct-a") || r.accountId === "acct-a"));
t("rowsForReview keeps eligible hold", rows1.length >= 2);
t("rowsForReview excludes structural reject", !rows1.some(r => r.snapshot.decision === "hold" && r.accountId.includes("sr")) && rows1.length === 2);
t("isStructuralReject detects note", isStructuralReject(accounts1[2]) === true);

// ── Phase 2: cross-run predecessor + transitions (real store, out-of-order safe) ──
async function runContinuity() {
  const repo = new InMemoryAccountMemoryRepo();
  // Run 1: Acme monitor, Beta hold.
  await repo.persist(rowsForReview(accounts1, scope, meta1));

  // Run 2 (later review, SAME scope): Acme → validate (new event + corroboration), Beta → hold unchanged.
  const meta2 = { reviewId: "run-2", reviewedAt: "2026-08-15T00:00:00Z", contextVersion: "ctx:v1" };
  const accounts2: AccountBriefVM[] = [
    vm("acct-a", "Acme", "validate", {
      whatChanged: [{ kind: "recent_event", event: "New plant expansion", date: "2026-08-10", age: null, source: "news.example" }] as AccountBriefVM["whatChanged"],
      sources: [{ label: "news.example", url: "https://news.example/acme" }, { label: "reuters.com", url: "https://reuters.com/acme" }] as AccountBriefVM["sources"],
      evidence: { strength: "Strong", corroborated: true } as AccountBriefVM["evidence"],
    }),
    vm("acct-b", "Beta", "hold"),
  ];
  await repo.persist(rowsForReview(accounts2, scope, meta2));

  // Predecessor resolution for run-2 (keyed by canonical account key = domain:<domain>).
  const key = (id: string) => `domain:${id}.example.com`;
  const preds = await repo.loadPredecessors(scope, [key("acct-a"), key("acct-b")], { reviewId: "run-2", reviewedAt: "2026-08-15T00:00:00Z" });
  t("cross-run predecessor resolves for Acme", preds[key("acct-a")]?.reviewId === "run-1" && preds[key("acct-a")]?.decision === "monitor");
  t("cross-run predecessor resolves for Beta", preds[key("acct-b")]?.reviewId === "run-1" && preds[key("acct-b")]?.decision === "hold");

  // What Changed: Monitor → Validate is a real decision change with drivers.
  const diffA = diffAccountCase(preds[key("acct-a")], snapshotAccountReview(accounts2[0], meta2));
  t("Acme decision changed monitor→validate", diffA.decision.from === "monitor" && diffA.decision.to === "validate" && diffA.decision.changed);
  t("Acme change is material", diffA.material === true);
  t("Acme new material event recorded", diffA.newChangeKeys.length === 1);
  t("Acme independent support added", diffA.independentSupportAdded === true);

  // Beta unchanged: hold→hold, no material change.
  const diffB = diffAccountCase(preds[key("acct-b")], snapshotAccountReview(accounts2[1], meta2));
  t("Beta hold→hold unchanged", diffB.decision.from === "hold" && diffB.decision.to === "hold" && !diffB.decision.changed);
  t("Beta no material change (first-class)", diffB.material === false);

  // Immutability: re-persisting run-1 with CHANGED data does not overwrite history.
  await repo.persist(rowsForReview([vm("acct-a", "Acme", "prioritize")], scope, meta1));
  const preds2 = await repo.loadPredecessors(scope, [key("acct-a")], { reviewId: "run-2", reviewedAt: "2026-08-15T00:00:00Z" });
  t("run-1 predecessor immutable (still monitor, not overwritten)", preds2[key("acct-a")]?.decision === "monitor");

  // Retry: same-review re-ingest is idempotent — NOT a new review.
  const before = repo.rows.length;
  await repo.persist(rowsForReview(accounts2, scope, meta2));
  t("same-review retry idempotent (no fake review rows)", repo.rows.length === before);

  // First review (new account in run-2) → no false predecessor.
  const diffNew = diffAccountCase(null, snapshotAccountReview(vm("acct-new", "NewCo", "monitor"), meta2));
  t("new account → first review, no false predecessor", diffNew.isFirstReview === true && diffNew.decision.changed === false);

  // Cross-tenant isolation: different owner cannot see predecessor.
  const other = await repo.loadPredecessors({ ownerUserId: "owner-2", clientKey: "context:v1" }, [key("acct-a")], { reviewId: "run-2", reviewedAt: "2026-08-15T00:00:00Z" });
  t("cross-tenant isolation (no predecessor for other owner)", !other[key("acct-a")]);
}

runContinuity().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}).catch((e) => { console.error(e); process.exit(1); });
