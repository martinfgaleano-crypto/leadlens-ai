// ─── Asteron Systems benchmark deliverable (real evidence) ────────────────────
// Builds a DeliverableViewModel for the synthetic client Asteron Systems whose
// 12 opportunities are the REAL benchmark accounts, populated strictly from the
// benchmark evaluation snapshot (real dates + real publisher origins). An analyst
// curation layer supplies thesis / Why-Now / decision rationale in the frozen
// grammar — no invented facts, all 12 accounts remain visible (§63/§64).
// Rendered through the EXISTING portable generator (no product-code change).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderPortableHtml } from "../../lib/deliverable/portable/render-portable";
import type { DeliverableViewModel, AccountBriefVM, DecisionState, Strength } from "../../lib/deliverable/deliverable-view-model";

const EVAL = JSON.parse(readFileSync("ml/data/benchmark/temporal_benchmark_v1.evaluation.json", "utf8"));
const acctEval = (n: string) => EVAL.accounts.find((a: any) => a.name === n);

// Analyst curation — decision + narrative in the frozen grammar. Evidence facts
// come only from the evaluation snapshot; this layer adds commercial reasoning.
interface Cur { role: string; type: string; decision: DecisionState; fit: Strength; timing: Strength; evidence: Strength;
  thesis: string; changed: string; whyNow: string; decisionNote: string; validations: string[]; counter: string[]; limits: string[]; next: string; revisit?: string }

const C: Record<string, Cur> = {
  "Saia Inc.": { role: "Potential Customer", type: "Capacity Expansion", decision: "prioritize", fit: "Strong", timing: "Strong", evidence: "Strong",
    thesis: "A multi-terminal LTL carrier standing up new terminals month after month — a physical-network build-out that strains routing, dock and yard tooling.",
    changed: "Opened new LTL terminals across the Midwest (Duluth, Columbia, Marysville WA, Indiana) — a third consecutive month of terminal openings.",
    whyNow: "Each new terminal is a new operating node Asteron's TMS/orchestration must model; a rapid multi-site build-out is exactly when a carrier re-evaluates network tooling — the window is open now, not after the network settles.",
    decisionNote: "Recent, material, independently corroborated network expansion aligned to Asteron's core profile.",
    validations: ["Confirm whether terminal ramp is straining existing TMS/linehaul planning (decision-critical).", "Identify the operations/network-planning owner."],
    counter: ["LTL tonnage/volume reported soft in late-2025 trade coverage — expansion is capacity-led, not demand-led, so budget urgency may lag."],
    limits: ["No public signal on their current planning-systems vendor."], next: "Reach the VP Operations/Network Planning with a terminal-ramp orchestration angle.", revisit: "New terminal announcements stop for 2+ months, or a systems-vendor selection is disclosed." },
  "Watsco": { role: "Potential Customer", type: "Enterprise Transformation", decision: "prioritize", fit: "Strong", timing: "Strong", evidence: "Strong",
    thesis: "The largest US HVAC/R distributor consolidating the Sunbelt through acquisition — each deal adds branches that must be integrated onto common operations systems.",
    changed: "Announced (Apr 28) and completed (Jun 2) the acquisition of Jackson Supply, expanding Sunbelt distribution presence.",
    whyNow: "Acquisition integration is the moment distribution/branch operations get re-platformed; Asteron's multi-site orchestration is most relevant during the post-close integration window that just opened.",
    decisionNote: "Confirmed, dated acquisition (announce→complete) with primary + independent corroboration.",
    validations: ["Confirm integration scope for Jackson Supply branches (decision-critical).", "Map their existing distribution-tech stack vs. Asteron fit."],
    counter: ["Q4 earnings framed markets as only 'stabilizing' — capex appetite may be measured."],
    limits: ["Watsco runs a strong in-house digital program; build-vs-buy resistance is plausible."], next: "Engage supply-chain/IT integration lead on branch-integration orchestration.", revisit: "Integration completes without external tooling, or a further acquisition lands." },
  "Encompass Health": { role: "Potential Customer", type: "Operations Expansion", decision: "prioritize", fit: "Moderate", timing: "Strong", evidence: "Strong",
    thesis: "An operator of rehabilitation hospitals adding and expanding facilities — each new hospital is a new operations site with staffing, supply and scheduling load.",
    changed: "Multiple dated facility developments: Kansas hospital expansion completed (Jul 29), Deaconess expansion announced (Apr 13), Greenville build at midpoint (Mar 24), Franklin expansion begun (Sep 2025).",
    whyNow: "A sustained facility-growth cadence means recurring site-onboarding — the operational pattern Asteron shortens; the cadence is active this quarter.",
    decisionNote: "Repeated, dated, corroborated facility expansion across independent local + trade outlets.",
    validations: ["Confirm whether healthcare-ops fit is close enough to Asteron's logistics core (decision-critical).", "Identify facility-operations systems owner."],
    counter: ["Healthcare facility ops differ from logistics/distribution — category fit is the open question, not evidence."],
    limits: ["Asteron's logistics framing may not map cleanly to hospital operations."], next: "Validate healthcare-operations fit before active pursuit.", revisit: "A new facility wave, or a disclosed operations-platform initiative." },
  "Alianza Team": { role: "Potential Customer", type: "Capacity Expansion", decision: "prioritize", fit: "Strong", timing: "Strong", evidence: "Moderate",
    thesis: "A Colombian B2B fats/oils manufacturer expanding internationally — a plant build-out that adds cross-border operations and distribution complexity.",
    changed: "Opened a $36M U.S. functional-fats facility (Apr 9) and publicly reported consolidating its expansion with ~20% exports (May 19).",
    whyNow: "A new US plant plus export growth introduces multi-country operations and distribution coordination — precisely where Asteron's orchestration reduces onboarding time; the plant is newly live.",
    decisionNote: "Dated facility opening corroborated by independent trade (foodnavigator) + Colombian press (elnorte) — the strongest Colombian case.",
    validations: ["Confirm US plant's operations/distribution systems scope (decision-critical).", "Identify the supply-chain owner across CO↔US."],
    counter: ["No public signal of a systems gap yet — plant may launch on an incumbent stack."],
    limits: ["Cross-border org may centralize systems decisions outside the new plant."], next: "Approach supply-chain leadership on the CO↔US operations bridge.", revisit: "Further plant/geography expansion, or a disclosed systems initiative." },
  "GXO Logistics": { role: "Potential Customer", type: "Operations Expansion", decision: "validate", fit: "Moderate", timing: "Moderate", evidence: "Moderate",
    thesis: "A pure-play contract-logistics operator opening automated hubs while simultaneously restructuring — genuine expansion clouded by material contraction.",
    changed: "Opened a future-ready logistics hub (Sant'Antonino, Mar 31) and expanded an Electro Dépôt automation contract (Apr 19) — but multiple 2026 layoffs/closures (Southaven, Memphis, West Jefferson) are dated in the same window.",
    whyNow: "Expansion signals exist, but concurrent restructuring means the net operations trajectory is ambiguous — the case must be reconciled before allocating attention.",
    decisionNote: "Real expansion AND real contraction, both dated and sourced — a genuine conflict to resolve, not a clean opportunity.",
    validations: ["Determine whether new-hub/automation growth outweighs the layoff/closure footprint (decision-critical).", "Locate which region carries the net-new operations."],
    counter: ["220-job Southaven closure, Memphis ~200 cuts, West Jefferson layoffs — material contraction concurrent with expansion."],
    limits: ["Public signals conflict; net direction is unresolved from open sources."], next: "Hold active pursuit until the expansion-vs-restructuring balance is confirmed.", revisit: "A clear net-growth or net-contraction signal resolves the conflict." },
  "Tecnoglass": { role: "Potential Customer", type: "Capacity Expansion", decision: "validate", fit: "Moderate", timing: "Moderate", evidence: "Moderate",
    thesis: "An architectural-glass manufacturer signaling new-plant plans and a US redomicile — expansion that is announced but not yet operational.",
    changed: "Public signals of new-plant plans + US redomiciling (Feb 28) and double-digit growth guidance (Feb 10); credit facility amended to raise capacity (Sep 2025).",
    whyNow: "If the new plant proceeds it creates a fresh operations site — but the development is at the plan/financing stage, so the systems window is prospective, not open today.",
    decisionNote: "Real forward-looking signals, but no confirmed dated facility opening yet — validate before prioritizing.",
    validations: ["Confirm whether the new plant has moved from plan to build (decision-critical).", "Track redomicile-driven operations changes."],
    counter: ["Evidence is plans/financial rather than an executed operational event."],
    limits: ["Timeline to a live plant is unconfirmed."], next: "Monitor for a groundbreaking/opening that converts plans into an operations trigger.", revisit: "New-plant construction or opening is confirmed." },
  "US Foods": { role: "Potential Customer", type: "Capacity Expansion", decision: "validate", fit: "Strong", timing: "Limited", evidence: "Moderate",
    thesis: "A national foodservice distributor whose DC network is core to Asteron's profile — one confirmed expansion, but dated and single-sourced.",
    changed: "Completed expansion of a large Louisiana distribution center (Nov 20, 2025).",
    whyNow: "A finished DC expansion changes throughput and slotting needs — relevant to Asteron, but the event is ~9 months old, so timing is weaker than the terminal/hub cases.",
    decisionNote: "Real material DC expansion, but single-origin and older; corroboration and recency need confirming.",
    validations: ["Find independent corroboration + any newer DC activity (decision-critical).", "Confirm current DC-systems posture."],
    counter: ["A 2026 layoffs page appears for US Foods — mixed operational signal."],
    limits: ["Only one distribution-expansion source surfaced in-window."], next: "Seek a second origin and a fresher signal before prioritizing.", revisit: "A newer DC opening or automation initiative appears." },
  "Mueller Industries": { role: "Potential Customer", type: "Enterprise Transformation", decision: "validate", fit: "Moderate", timing: "Moderate", evidence: "Moderate",
    thesis: "A copper/brass manufacturer growing by acquisition and adding automated capacity — expansion real but reported mostly via secondary sources.",
    changed: "Acquired Bison Metals Technologies (Apr 2) and expanded Mueller Coatings production with a new automated line (Jan 7).",
    whyNow: "Acquisition + new automated capacity add operations sites/lines to integrate — Asteron-relevant, but the signals lean on secondary aggregators, so confidence is moderate.",
    decisionNote: "Genuine dated M&A/capacity events, but primary corroboration is thin.",
    validations: ["Corroborate the Bison acquisition scope via primary sources (decision-critical).", "Assess integration/systems implications."],
    counter: ["Sourcing skews to secondary finance aggregators rather than primary/trade."],
    limits: ["Primary-source confirmation limited in-window."], next: "Confirm via primary filings before elevating.", revisit: "Primary confirmation or a further acquisition." },
  "Quala S.A.": { role: "Potential Customer", type: "New Business", decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Limited",
    thesis: "A large Colombian CPG manufacturer with a strong operational footprint but no material dated expansion event surfaced in-window.",
    changed: "No verified dated material operational event found in the current window.",
    whyNow: "Structurally a fit for Asteron, but without a dated operational trigger there is no time-sensitive reason to act now.",
    decisionNote: "No material dated event; identity confirmed but no temporal trigger.",
    validations: ["Watch for plant/DC investment announcements."], counter: [],
    limits: ["Spanish-language public coverage may under-report operational events (recall limit)."], next: "Monitor for a dated facility/capacity announcement.", revisit: "A plant, DC, or capacity investment is announced." },
  "Crystal S.A.S.": { role: "Potential Customer", type: "New Business", decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Limited",
    thesis: "A vertically-integrated textile manufacturer/retailer — plausible fit, but no dated operational expansion event surfaced.",
    changed: "No verified dated material operational event found in the current window.",
    whyNow: "No temporal trigger; fit is structural rather than time-sensitive.",
    decisionNote: "No material dated event surfaced.",
    validations: ["Watch for plant or retail-network expansion."], counter: [],
    limits: ["'Crystal' is a common token — identity noise plus Spanish recall limits."], next: "Monitor for a dated expansion signal.", revisit: "A new plant or store-network expansion is announced." },
  "Grupo BIOS": { role: "Potential Customer", type: "New Business", decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Limited",
    thesis: "A Colombian agro-industrial holding with many plants — strong structural fit, but no dated operational event surfaced in-window.",
    changed: "No verified dated material operational event found in the current window.",
    whyNow: "No time-sensitive trigger despite good structural fit.",
    decisionNote: "Identity confirmed on several sources; no material dated event.",
    validations: ["Watch for plant/logistics investment announcements."], counter: [],
    limits: ["Likely Spanish-language recall limitation on operational news."], next: "Monitor for a dated plant/capacity announcement.", revisit: "A facility or capacity investment is announced." },
  "Coordinadora Mercantil": { role: "Potential Customer", type: "New Business", decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Limited",
    thesis: "A national Colombian logistics operator — ideal structural fit, but no valid dated operational event surfaced for the Colombian entity.",
    changed: "No verified dated material operational event found; the only negative hit resolved to a same-named Spanish firm and was excluded (wrong entity).",
    whyNow: "No temporal trigger; the strong structural fit is not yet backed by a dated event.",
    decisionNote: "No material dated event; wrong-entity noise correctly rejected.",
    validations: ["Watch for hub/technology investment by the Colombian entity."], counter: [],
    limits: ["Name collision with a Spanish 'Coordinadora' required strict entity control; Spanish recall limits apply."], next: "Monitor for a dated logistics-network or technology signal.", revisit: "A hub opening or systems initiative by the Colombian entity is announced." },
};

const RANK: Record<DecisionState, number> = { prioritize: 0, validate: 1, monitor: 2, hold: 3 };
const ageLabel = (iso: string | null): string | null => { if (!iso) return null; const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000); if (d < 0) return null; if (d < 45) return `${d}d`; return `${Math.round(d / 30)}mo`; };

const accounts: AccountBriefVM[] = EVAL.accounts.map((ev: any): AccountBriefVM => {
  const cur = C[ev.name];
  const src = (ev.accepted_evidence as any[]).map((e, i) => ({
    label: e.host, url: null, date: e.date, age: ageLabel(e.date),
    relation: (i === 0 ? "direct" : "corroborating") as "direct" | "corroborating",
    claim: e.title, observation: null, basis: "observed" as const,
    impacts: ["what_changed", "timing"] as Array<"what_changed" | "timing">,
  }));
  const latest = ev.latest_event_date;
  return {
    id: ev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    rank: null, company: ev.name, segment: ev.sector, geography: ev.country === "CO" ? "Colombia" : "United States", domain: null,
    accountRole: cur.role, opportunityType: cur.type, opportunityDescriptor: null,
    decision: cur.decision, decisionNote: cur.decisionNote, thesis: cur.thesis,
    whyItMatters: ev.funnel.accepted > 0 ? cur.whyNow : null,
    dimensions: [
      { label: "Fit", value: cur.fit }, { label: "Timing", value: cur.timing }, { label: "Evidence", value: cur.evidence },
    ],
    whatChanged: ev.funnel.accepted > 0
      ? [{ event: cur.changed, date: latest, age: ageLabel(latest), source: src[0]?.label ?? null, kind: "true_change" as const }]
      : [{ event: cur.changed, date: null, age: null, source: null, kind: "unknown" as const }],
    evidence: { sourceCount: src.length, datedCount: src.filter(s => s.date).length, corroborated: ev.funnel.independent, latestAge: ageLabel(latest), strength: cur.evidence },
    sources: src,
    counterSignals: cur.counter,
    limitations: cur.limits,
    validations: cur.validations,
    validationDetails: cur.validations.map((q, i) => ({ question: q, decisionCritical: i === 0, howToValidate: null, changesDecisionBecause: null })),
    nextStep: cur.next, revisitWhen: cur.revisit ?? null,
    freshness: latest ? { label: "Latest evidence", age: ageLabel(latest) } : null,
    confidence: cur.evidence,
  };
}).sort((a: AccountBriefVM, b: AccountBriefVM) => RANK[a.decision] - RANK[b.decision]);

const counts = accounts.reduce((m: any, a) => (m[a.decision] = (m[a.decision] || 0) + 1, m), { prioritize: 0, validate: 0, monitor: 0, hold: 0 });
const withDated = accounts.filter(a => a.evidence.datedCount > 0).length;
const withSources = accounts.filter(a => a.sources.length > 0).length;
const corroborated = accounts.filter(a => a.evidence.corroborated).length;

const vm: DeliverableViewModel = {
  meta: { client: "Asteron Systems", market: "United States & Colombia · Enterprise operations", generatedAt: new Date().toISOString(), generatedLabel: new Date().toISOString().slice(0, 10), tierLabel: "Benchmark", language: "en", schemaVersion: 1 },
  headline: "Operational-expansion opportunities across 12 real mid-market & enterprise accounts",
  summary: "A real-evidence validation of LeadLens temporal intelligence: 12 accounts evaluated against Asteron's operational-expansion thesis, each Case built only from dated, sourced public evidence. Four accounts show recent, independently corroborated expansion; four need validation; four have no current dated trigger.",
  portfolio: { total: accounts.length, counts, allocation: { line: "Focus first on the four corroborated, recent expansions", detail: "Saia, Watsco, Encompass Health and Alianza Team each show a dated, independently corroborated operational expansion aligned to Asteron's thesis." }, funnel: { considered: 12, rejected: 0, selected: 12 }, note: "All 12 evaluated accounts remain visible regardless of evidence outcome." },
  accounts,
  commercialContext: { objective: EVAL.client.objective, clientDescription: EVAL.client.sells, summary: EVAL.client.attractive_when, regions: ["United States", "Colombia"], industries: ["Logistics", "Distribution", "Manufacturing", "Healthcare", "Food & Agriculture"], criteria: EVAL.client.stronger_timing_from },
  validationQueue: accounts.filter(a => a.decision === "validate").map(a => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations })),
  coverage: { withDatedEvidence: withDated, withSources, corroborated, grade: "Strong", note: `${withDated}/12 accounts carry dated evidence; ${corroborated}/12 independently corroborated.` },
  methodology: ["Accounts selected first by structural criteria (sector, operational intensity, public visibility) — never because an event was known.", "Evidence gated: identity → real event date → materiality → client-relevance → independent origin.", "Retrieval/crawl dates, static pages and wrong-entity matches rejected.", "Counterevidence gathered by a separate adversarial pass."],
  limitations: ["Spanish-language operational news has weaker public recall — several Colombian accounts may have events not surfaced in-window.", "Some acquisitions are corroborated by secondary finance aggregators rather than primary filings."],
  downloads: { pdf: false, portfolioCsv: true, evidenceCsv: true },
  capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
};

mkdirSync("output/benchmark", { recursive: true });
writeFileSync("output/benchmark/asteron-benchmark-deliverable.vm.json", JSON.stringify(vm, null, 2) + "\n");
const html = renderPortableHtml(vm);
writeFileSync("output/benchmark/asteron-benchmark.html", html);
console.log(JSON.stringify({ accounts: accounts.length, counts, withDated, withSources, corroborated, htmlBytes: html.length, htmlKb: Math.round(html.length / 1024) }, null, 2));
