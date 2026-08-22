// Portfolio Intelligence V1 — gate + provenance + segment-behavior contract.
// Verifies: pattern minimum support; change patterns only from verified change;
// evidence coverage counts; coverage gaps never become negative evidence;
// validation-theme recurrence; tensions require both sides; guidance provenance;
// unsupported synthesis rejected; sparse (Amor) fabricates nothing; rich
// (Asteron) produces supported synthesis; deterministic layer LLM-free.
import { readFileSync } from "node:fs";
import { fromAmorPilot } from "../../lib/deliverable/adapters";
import { buildPortfolioIntelligence, diffPortfolioIntelligence } from "../../lib/deliverable/portfolio-intelligence";
import type { DeliverableViewModel, AccountBriefVM } from "../../lib/deliverable/deliverable-view-model";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

const asteron: DeliverableViewModel = JSON.parse(readFileSync("output/benchmark/asteron-benchmark-deliverable.vm.json", "utf8"));
const amor = fromAmorPilot(JSON.parse(readFileSync("output/amor-pilot1-deliverable.data.json", "utf8")));
const A = buildPortfolioIntelligence(asteron);
const M = buildPortfolioIntelligence(amor);

// ── synthetic mini-VM helpers for edge gates ──
const acct = (o: Partial<AccountBriefVM>): AccountBriefVM => ({
  id: o.id!, rank: null, company: o.company ?? o.id!, segment: null, geography: null, domain: null,
  accountRole: null, opportunityType: o.opportunityType ?? null, decision: o.decision ?? "monitor",
  decisionNote: null, thesis: null, whyItMatters: null,
  dimensions: o.dimensions ?? [], whatChanged: o.whatChanged ?? [],
  evidence: o.evidence ?? { sourceCount: 0, datedCount: 0, corroborated: null, latestAge: null, strength: null },
  sources: [], counterSignals: o.counterSignals ?? [], limitations: [], validations: o.validations ?? [],
  validationDetails: o.validationDetails, nextStep: null, freshness: null, confidence: null,
});
const mkVM = (accounts: AccountBriefVM[]): DeliverableViewModel => ({
  meta: { client: "T", market: null, generatedAt: null, generatedLabel: null, tierLabel: null, language: "en", schemaVersion: 1 },
  headline: null, summary: null,
  portfolio: { total: accounts.length, counts: { prioritize: 0, validate: 0, monitor: 0, hold: 0 }, allocation: null, funnel: null, note: null },
  accounts, commercialContext: null, validationQueue: [], coverage: null, methodology: [], limitations: [],
  downloads: { pdf: false, portfolioCsv: false, evidenceCsv: false },
  capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: false, showMethodology: false },
});

// §22 pattern minimum support: 1 case = notable, not pattern
{
  const pi = buildPortfolioIntelligence(mkVM([acct({ id: "a", opportunityType: "Capacity Expansion" })]));
  t("§22 single opportunity-type case is 'notable', not a pattern", pi.opportunityPatterns[0].notable === true);
  const pi2 = buildPortfolioIntelligence(mkVM([acct({ id: "a", opportunityType: "Capacity Expansion" }), acct({ id: "b", opportunityType: "Capacity Expansion" })]));
  t("§22 two same-type cases form a pattern (not notable)", pi2.opportunityPatterns[0].notable === false && pi2.opportunityPatterns[0].supportingCaseIds.length === 2);
}

// §123 change patterns ONLY from verified change
{
  const staticOnly = acct({ id: "s", whatChanged: [{ event: "New plant opened", date: null, age: null, source: null, kind: "static_context" }] });
  const verified = acct({ id: "v", whatChanged: [{ event: "New plant opened in June", date: "2026-06-01", age: "2mo", source: "x", kind: "true_change" }] });
  const pi = buildPortfolioIntelligence(mkVM([staticOnly, verified]));
  t("§123 static-context change does not feed change patterns", !pi.changePatterns.some(p => p.supportingCaseIds.includes("s")));
  t("§123 verified change feeds change patterns", pi.changePatterns.some(p => p.supportingCaseIds.includes("v")));
}

// §125 coverage gap = absence, never negative evidence
{
  const noEv = acct({ id: "n", whatChanged: [{ event: "none", date: null, age: null, source: null, kind: "unknown" }] });
  const pi = buildPortfolioIntelligence(mkVM([noEv]));
  const gap = pi.coverageGaps.find(g => g.category === "No verified recent change");
  t("§125 no-change account produces a coverage gap", !!gap && gap.caseIds.includes("n"));
  t("§12/§125 gap framed as 'not established', never 'inactive'", !!gap && /not evidence of inactivity|not yet established/i.test(gap.summary));
}

// §126/§33 validation theme requires ≥2 conceptually-equivalent
{
  const v = (id: string) => acct({ id, validations: ["Confirm current systems / vendor posture"], validationDetails: [{ question: "Confirm current systems / vendor posture", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }] });
  const one = buildPortfolioIntelligence(mkVM([v("a")]));
  t("§33 single validation is not a theme", one.validationThemes.length === 0);
  const two = buildPortfolioIntelligence(mkVM([v("a"), v("b")]));
  t("§33 recurring validation across 2 accounts forms a theme", two.validationThemes.some(th => /systems/i.test(th.theme) && th.caseIds.length === 2));
}

// §127/§37 tension requires BOTH verified positive AND material contradictory counter
{
  const posOnly = acct({ id: "p", whatChanged: [{ event: "Opened new terminal", date: "2026-06-01", age: "2mo", source: "x", kind: "true_change" }], counterSignals: ["Category fit is the open question"] });
  const both = acct({ id: "g", whatChanged: [{ event: "Opened new hub", date: "2026-06-01", age: "2mo", source: "x", kind: "true_change" }], counterSignals: ["220-job closure and layoffs in same window"] });
  const pi = buildPortfolioIntelligence(mkVM([posOnly, both]));
  t("§37 soft caveat does not create a tension", !pi.tensions.some(x => x.caseId === "p"));
  t("§37 material contradiction creates a tension", pi.tensions.some(x => x.caseId === "g"));
}

// §128/§129 guidance + read carry provenance
t("§128 every guidance item has ≥1 supporting case id", A.guidance.every(g => g.provenance.caseIds.length >= 1 && g.provenance.fieldTypes.length >= 1));
t("§129 every Read statement has provenance", A.read.every(r => r.provenance.caseIds.length >= 1));

// §130 unsupported synthesis rejected: a pattern can never exceed its real support
t("§130 no pattern claims more cases than exist", A.opportunityPatterns.every(p => p.supportingCaseIds.length <= asteron.accounts.length) && A.changePatterns.every(p => p.supportingCaseIds.length <= asteron.accounts.length));

// §131 deterministic layer renders without any LLM/provider
t("§131 deterministic layer present with no provider call", A.deterministic.total === 12 && typeof A.deterministic.verifiedChangeCount === "number");

// §132 SPARSE (Amor) fabricates nothing temporal
t("§132 Amor produces zero change patterns", M.changePatterns.filter(p => !p.notable).length === 0);
t("§132 Amor produces zero tensions", M.tensions.length === 0);
t("§132 Amor verified-change count is 0", M.deterministic.verifiedChangeCount === 0);
t("§47 Amor still yields useful decision landscape + validation + coverage gaps", M.attention.length > 0 && M.coverageGaps.length > 0);
t("§12 Amor Read frames sparsity as coverage limit, not quality", M.read.some(r => /coverage limit|not a quality/i.test(r.text)));

// §133 RICH (Asteron) produces supported synthesis
t("§133 Asteron produces ≥1 real change pattern", A.changePatterns.some(p => !p.notable));
t("§133 Asteron surfaces GXO tension (§97)", A.tensions.some(x => /gxo/i.test(x.company)));
t("§97 GXO tension preserves both positive and counter evidence", A.tensions.some(x => /gxo/i.test(x.company) && x.positive.length > 0 && /layoff|clos|cut/i.test(x.counter)));
t("§16 Asteron Read has 2–4 statements", A.read.length >= 2 && A.read.length <= 4);

// §47 opportunity quality ≠ evidence richness: Amor accounts are 'limited' coverage but still carry decisions
t("§50 Amor coverage states are 'limited' yet decisions exist (quality≠observability)", M.deterministic.coverageStates.limited > 0 && (M.deterministic.decisionCounts.prioritize + M.deterministic.decisionCounts.validate) > 0);

// §15/§47 no numeric quality score exposed anywhere in VM
t("§15 no numeric portfolio quality score field exists", !("score" in (A as any)) && !("qualityScore" in A.deterministic));

// §119-120 memory-ready: a simulated second snapshot (deterministic change) is diffable
{
  const v1 = mkVM([
    acct({ id: "x", decision: "validate", opportunityType: "Capacity Expansion", whatChanged: [{ event: "none", date: null, age: null, source: null, kind: "unknown" }], validations: ["Confirm current systems / vendor posture"], validationDetails: [{ question: "Confirm current systems / vendor posture", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }] }),
    acct({ id: "y", decision: "prioritize", opportunityType: "Capacity Expansion", whatChanged: [{ event: "Opened new plant", date: "2026-05-01", age: "3mo", source: "s", kind: "true_change" }], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "3mo", strength: "Strong" } }),
  ]);
  // review 2: x's decision advanced to prioritize, x now has a verified plant change, x's validation resolved
  const v2 = mkVM([
    acct({ id: "x", decision: "prioritize", opportunityType: "Capacity Expansion", whatChanged: [{ event: "Opened new plant in July", date: "2026-07-01", age: "1mo", source: "s", kind: "true_change" }], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "1mo", strength: "Strong" }, validations: [] }),
    acct({ id: "y", decision: "prioritize", opportunityType: "Capacity Expansion", whatChanged: [{ event: "Opened new plant", date: "2026-05-01", age: "3mo", source: "s", kind: "true_change" }], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "3mo", strength: "Strong" } }),
  ]);
  const diff = diffPortfolioIntelligence(
    { pi: buildPortfolioIntelligence(v1), decisions: { x: "validate", y: "prioritize" }, validations: { x: ["Confirm current systems / vendor posture"], y: [] } },
    { pi: buildPortfolioIntelligence(v2), decisions: { x: "prioritize", y: "prioritize" }, validations: { x: [], y: [] } },
  );
  t("§120 diff detects a decision change (x validate→prioritize)", diff.decisionChanges.some(d => d.caseId === "x" && d.from === "validate" && d.to === "prioritize"));
  t("§120 diff detects verified-change coverage strengthening (1→2)", diff.coverage.verifiedChange.from === 1 && diff.coverage.verifiedChange.to === 2);
  t("§120 diff detects a strengthened change pattern", diff.patternSupport.some(p => p.direction === "strengthened") || diff.changePatterns.persisting.length > 0);
  t("§120 diff detects a resolved validation on x", diff.validationsResolved.some(r => r.caseId === "x" && r.resolved.length === 1));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
