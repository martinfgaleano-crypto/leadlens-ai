#!/usr/bin/env node
/** Customer Deliverables V1 — generate REAL inspectable artifacts for each one-time tier from safe
 *  synthetic fixtures (no customer data, no network, no research, no spend). Emits per tier:
 *  <tier>.pdf (real application/pdf via jsPDF), <tier>.html (self-contained print view), and
 *  <tier>.csv (Portfolio/Premium only). Premium uses a synthetic persisted PremiumContextV1. */
import { writeFileSync, mkdirSync } from "node:fs";
import type { DeliverableViewModel, AccountBriefVM, DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";
import type { DeliveryTier } from "@/lib/delivery-system/tier-composer";

const { fromDeliverableViewModel, composeForTier, toPresentationModel, renderPdfBuffer, renderPdfHtml, renderCsv, tierOffersChannel } = await import("@/lib/delivery-system/index");
const { assemblePremiumContext } = await import("@/lib/intelligence/premium/premium-context");

const OUT = process.argv[2] || "/tmp/leadlens-artifacts";
mkdirSync(OUT, { recursive: true });

const SEGMENTS = ["Logistics", "Healthcare", "Manufacturing", "Food distribution", "Industrial services"];
const DEC: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];
const S = (f: Strength, t: Strength, e: Strength) => [{ label: "Fit", value: f }, { label: "Timing", value: t }, { label: "Evidence", value: e }];
const STR: Strength[] = ["Strong", "Moderate", "Limited"];

function acc(i: number): AccountBriefVM {
  const id = String(i + 1);
  const decision = DEC[i % 4];
  const seg = SEGMENTS[i % SEGMENTS.length];
  const strong = decision === "prioritize";
  return {
    id, rank: i + 1, company: `${["Northstar", "FreshRoute", "Atlas", "Meridian", "Cascade", "Vertex"][i % 6]} ${seg.split(" ")[0]} ${id}`,
    segment: seg, geography: i % 3 === 0 ? "United States" : "South America", domain: `acct${id}.example.com`,
    accountRole: null, opportunityType: null,
    decision, decisionNote: `${strong ? "Recent dated operational change aligns with your offer" : decision === "validate" ? "Promising fit; a central procurement question is unconfirmed" : decision === "monitor" ? "Relevant, but timing evidence is not yet established" : "Insufficient evidence to justify attention now"}.`,
    thesis: `${seg} operator showing ${strong ? "expansion and hiring" : "structural fit"} — evaluated in your commercial context.`,
    whyItMatters: "Fits the stated operations/supply-chain objective.",
    dimensions: S(STR[i % 3], STR[(i + 1) % 3], STR[(i + 2) % 3]),
    whatChanged: strong ? [{ event: "Signed a regional distribution agreement", date: "2026-08-05", age: "9d", source: "news", kind: "recent_event" as const }] : [],
    evidence: { sourceCount: strong ? 4 : 2, datedCount: strong ? 3 : 1, corroborated: strong, latestAge: strong ? "9d" : "30d", strength: STR[(i + 2) % 3] },
    sources: [
      { label: "Company press release", url: "https://press.example.com/a", date: "2026-08-05", age: "9d", relation: "direct", claim: "expansion" },
      { label: "Regional business journal", url: "https://journal.example.com/b", date: "2026-07-20", age: "25d", relation: "corroborating", claim: "hiring" },
      { label: "Industry profile", url: "https://profile.example.com/c", date: null, age: null, relation: "context", claim: "profile" },
    ],
    counterSignals: decision === "validate" ? ["Decision scope may be regional, not corporate."] : decision === "monitor" ? ["No operations change observed yet."] : [],
    limitations: strong ? [] : ["Only one source confirms the change."],
    validations: decision === "hold" ? [] : [`Confirm ${decision === "validate" ? "central procurement" : "the operations change affects your category"}.`],
    validationDetails: decision === "validate" ? [{ question: "Confirm central procurement", decisionCritical: true, howToValidate: "Check filings", changesDecisionBecause: "Central procurement would justify prioritizing." }] : undefined,
    nextStep: strong ? "Open a conversation about their expanded operations." : null,
    revisitWhen: decision === "monitor" ? "A new facility is announced" : null, monitorIdentity: null,
    freshness: { label: "Fresh", age: strong ? "9d" : "30d" }, confidence: STR[i % 3],
  };
}
const accounts = Array.from({ length: 18 }, (_, i) => acc(i));
const counts = { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<DecisionState, number>;
for (const a of accounts) counts[a.decision]++;

const vm: DeliverableViewModel = {
  meta: { client: "Northwind Advisory (sample)", market: "United States · South America", generatedAt: "2026-09-09T00:00:00Z", generatedLabel: "Sep 9, 2026", tierLabel: "", language: "en", schemaVersion: 1 },
  headline: "Where to focus now across the researched set",
  summary: "Accounts evaluated in your commercial context. Decisions reflect Fit, Timing and Evidence; each carries what supports it and what still needs confirming. No procurement events are confirmed — treat strong cases as fit-and-timing theses to validate.",
  portfolio: { total: 18, counts, allocation: { line: "Focus first", detail: `on the ${counts.prioritize} prioritize accounts, then the ${counts.validate} to validate.` }, funnel: { considered: 46, rejected: 22, selected: 18 }, note: "Observed within this researched portfolio — not the whole market." },
  accounts,
  commercialContext: { objective: "Find US & South American mid-market operators whose recent operational change increases supply-chain/ops needs", clientDescription: "We provide operations and supply-chain consulting", summary: "ICP: mid-market operators with recent dated operational change", regions: ["United States", "South America"], industries: SEGMENTS, criteria: ["recent operational change", "mid-market", "operations-led"] },
  validationQueue: accounts.filter((a) => a.validations.length).slice(0, 8).map((a) => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations })),
  coverage: { withDatedEvidence: 12, withSources: 18, corroborated: 9, grade: "Moderate", note: "Public evidence only; corroboration varies by account." },
  methodology: ["Fit / Timing / Evidence evaluated per account", "One canonical Decision per account (caseDecision authority)", "Evidence is dated and sourced; retrieval date != event date"],
  limitations: ["Public evidence only — absence of a signal is not counterevidence.", "Portfolio patterns describe this researched set, not the whole market."],
  downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
  capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
};

const ev = (url: string) => [{ sourceId: url, url, observedDate: "2026-08-01", claim: "observed" }];
const note = (s: string, url: string) => ({ statement: s, basis: "signal" as const, evidence: ev(url), confidence: "Moderate" as const, stale: false });
const premiumContext = assemblePremiumContext({
  benchmark: {
    recurringNeeds: [note("Buyers in this segment repeatedly cite supply-chain resilience and lead-time pressure.", "https://ex.com/a"), note("Labor availability and operational throughput are recurring constraints.", "https://ex.com/g")],
    offerPositioning: [note("Operations-consulting offers here compete on speed-to-impact and sector depth.", "https://ex.com/b")],
    differentiatedWhere: [note("Sector-specific operating playbooks appear to differentiate versus generalist firms.", "https://ex.com/c")],
  },
  competitors: [{ entity: "Generalist operations consultancies", role: "alternative", whyRelevant: "The most common alternative buyers weigh.", affects: "benchmark", positioning: [note("Broad footprint, less sector depth.", "https://ex.com/d")], counterevidence: [], unknowns: [], confidence: "Moderate" }],
  additionalOpportunities: [{ entity: "Regional 3PL cluster", role: "adjacent_segment", whyDiscovered: "Adjacent to the evaluated portfolio.", connectionToObjective: "Same buyer, adjacent operational need.", evidence: ev("https://ex.com/e"), worthInvestigatingBecause: "Fits the stated objective.", unknowns: [], deepResearched: false }],
  ecosystem: [{ entity: "Regional industry association", role: "platform", materialTo: "access", why: "Controls access to the target segment's decision-makers.", evidence: ev("https://ex.com/f") }],
});

const baseDoc = fromDeliverableViewModel(vm);
const tiers: DeliveryTier[] = ["preview", "brief", "intelligence", "premium"];
const labelOf: Record<DeliveryTier, string> = { preview: "preview", brief: "brief", intelligence: "portfolio", premium: "premium" };

console.log(`Writing artifacts to ${OUT}\n`);
for (const tier of tiers) {
  const doc = tier === "premium" ? { ...baseDoc, premiumContext } : baseDoc;
  const composed = composeForTier(doc, tier);
  const name = labelOf[tier];
  const html = renderPdfHtml(toPresentationModel(doc, tier, "pdf"));
  const pdf = renderPdfBuffer(toPresentationModel(doc, tier, "pdf"));
  writeFileSync(`${OUT}/${name}.pdf`, pdf);
  writeFileSync(`${OUT}/${name}.html`, html);
  const csv = tierOffersChannel(tier, "csv") ? renderCsv(toPresentationModel(doc, tier, "csv")) : null;
  if (csv) writeFileSync(`${OUT}/${name}.csv`, csv);
  const premiumSection = composed.premium ? `premium[briefs=${composed.premium.decisionCriticalBriefs.length}, benchmark=${composed.premium.executivePortfolio.context?.benchmark.state ?? "NONE"}]` : "premium[none]";
  console.log(`${name.padEnd(10)} accounts=${String(composed.accounts.length).padEnd(2)} pdf=${(pdf.length / 1024).toFixed(0)}KB html=${html.length}B csv=${csv ? csv.split("\n").length + "rows" : "—"}  ${premiumSection}`);
}
console.log("\nDone.");
