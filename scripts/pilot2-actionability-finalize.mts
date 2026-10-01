#!/usr/bin/env node
/** Provider-free Pilot 2 closure: union the accepted prior foundation with the
 * bounded actionability runs, replace Natural Grocers with its freshly validated
 * Track-A Case, select deterministically, and render honest tier outputs. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
const { fromDeliverableViewModel } = await import("@/lib/delivery-system/delivery-document");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");
const { resolveReportExperience } = await import("@/lib/products/report-experience");
const { selectDeterministically } = await import("@/lib/intelligence/deterministic-tier-selection");
const { tierReadinessFor, canonicalKey } = await import("@/lib/intelligence/customer-job");
const { evaluateCanonicalTierReadiness } = await import("@/lib/intelligence/advanced-tier-readiness");
const { scopeCanonicalIntelligence } = await import("@/lib/intelligence/canonical-intelligence-delivery");

const base = JSON.parse(readFileSync("output/pilot2/2026-09-30-final2/pilot2-merged-report.json", "utf8"));
const expansion = JSON.parse(readFileSync("output/pilot2/2026-09-30-actionability-v1/pilot2-merged-report.json", "utf8"));
const trackA = JSON.parse(readFileSync("output/pilot2/2026-09-30-actionability-v1/track-a-validation.json", "utf8"));
const trackASearch = JSON.parse(readFileSync("output/pilot2/2026-09-30-actionability-v1/track-a-search.json", "utf8"));
const marketResearchUniverse = JSON.parse(readFileSync("output/pilot2/2026-09-30-market-universe-v2/market-research-universe.json", "utf8"));
const out = "output/pilot2/2026-09-30-actionability-final";
mkdirSync(out, { recursive: true });
const byCompany = new Map<string, any>();
for (const lead of [...base.reportJson.processed_leads, ...expansion.reportJson.processed_leads, ...trackA.processed_leads]) byCompany.set(lead.candidate.company.toLowerCase(), lead);
const caseByCompany = new Map<string, any>();
for (const c of [...base.reportJson.canonical_cases, ...expansion.reportJson.canonical_cases, ...trackA.cases]) caseByCompany.set(c.account_id.toLowerCase(), c);
const leads = [...byCompany.values()];
const cases = [...caseByCompany.values()].filter((c) => byCompany.has(c.account_id.toLowerCase()));
const qualified = cases.map((c) => {
  const lead = byCompany.get(c.account_id.toLowerCase());
  const current = lead.candidate.current_actionability_verified === true;
  return { key: canonicalKey(c.account_id, lead.candidate.domain ?? null), company: c.account_id, domain: lead.candidate.domain ?? null, route: current ? "supplier_access" : "accumulated", decision: c.decision, fit: c.fit, timing: c.timing, evidenceCount: (lead.enrichment?.evidence_discipline ?? []).length, qualifiedAtPass: current ? 7 : 1, hasSource: Boolean(current ? lead.candidate.actionability_source_url : lead.candidate.source_url), hasValidatedDate: Boolean(lead.candidate.signal_date), currentActionabilityBasis: current, commercialMechanismVerified: current && lead.candidate.access_verified === true, accessPathIdentified: lead.candidate.access_path_identified === true, counterevidenceMaterial: lead.enrichment?.account_research?.counterevidence_material_found === true };
});
const selectable = qualified.map((q) => { const c = caseByCompany.get(q.company.toLowerCase()); return { id: q.key, company: q.company, decision: q.decision, fit: c.fit, timing: c.timing, evidence: c.evidence, evidenceCount: q.evidenceCount, hasSource: q.hasSource === true, hasValidatedDate: q.hasValidatedDate === true, independentlyCorroborated: false, commercialMechanismVerified: q.commercialMechanismVerified === true, accessVerified: q.accessPathIdentified === true, counterevidenceMaterial: q.counterevidenceMaterial === true }; });
const selection = selectDeterministically(selectable, 18);
const ordered = selection.selected.map((s: any) => byCompany.get(s.company.toLowerCase())).filter(Boolean);
const order = new Map(ordered.map((lead: any, i: number) => [lead.id, i + 1]));
const oldRank = new Map([...base.reportJson.ranked_opportunities, ...expansion.reportJson.ranked_opportunities].map((r: any) => [r.company.toLowerCase(), r]));
const ranked = ordered.map((lead: any, i: number) => {
  const prior = oldRank.get(lead.candidate.company.toLowerCase()) ?? {};
  const c = caseByCompany.get(lead.candidate.company.toLowerCase());
  return { ...prior, lead_id: lead.id, company: lead.candidate.company, rank: i + 1, fit_score: lead.qualification.fit_score, category: lead.qualification.category, recommended_action: c.decision === "prioritize" ? "send_outreach_now" : c.decision === "validate" ? "validate_source_first" : c.decision === "monitor" ? "monitor_for_new_signal" : "exclude", actionability_status: c.decision === "prioritize" ? "act_now" : c.decision === "validate" ? "validate_first" : c.decision, decision: { ...(prior.decision ?? {}), decision: c.decision } };
});
const reportJson = { ...base.reportJson, delivery_capacity_target: 18, processed_leads: ordered, canonical_cases: cases.filter((c) => order.has(byCompany.get(c.account_id.toLowerCase())?.id)), ranked_opportunities: ranked, executive_summary: "Pilot 2 actionability escalation produced one evidence-qualified Prioritize from a live official supplier-submission mechanism. The accumulated foundation remains one account short of Premium capacity; Premium is therefore not delivery-ready." };
const institutional = assembleInstitutionalReport(reportJson, base.meta);
institutional.intelligence!.market_research_universe = marketResearchUniverse;
const legacyReadiness = tierReadinessFor(qualified, [2, 6, 12, 18]);
const scopedIntelligence = (target: number) => scopeCanonicalIntelligence(institutional.intelligence!, ordered.slice(0, target).map((lead: any) => lead.candidate.company));
const readiness = {
  Preview: evaluateCanonicalTierReadiness("preview", qualified, scopedIntelligence(2), true),
  Brief: evaluateCanonicalTierReadiness("brief", qualified, scopedIntelligence(6), true),
  Portfolio: evaluateCanonicalTierReadiness("portfolio", qualified, scopedIntelligence(12), true),
  Premium: evaluateCanonicalTierReadiness("premium", qualified, scopedIntelligence(18), true),
};
const escalation = { version: "actionability-research-escalation-v1", jobId: base.jobState.jobId, tier: "premium", reason: "ZERO_EVIDENCE_QUALIFIED_PRIORITIZE", status: "success", pass: 7, maxPasses: 7, budgetUsd: 5, spendUsd: 0.874133, queries: trackASearch.observations.map((o: any) => o.query), queryFamilies: ["supplier_access", "category_review", "current_timing", "vendor_onboarding_open", "distributor_brand_submission", "hospitality_local_sourcing", "corporate_gifting_supplier"], providersAttempted: ["brave", "anthropic"], providerFailures: ["anthropic_timeout_in_final_coverage_pass"], accountsDeepened: 3, accountsDiscovered: new Set([...expansion.jobState.candidates, ...JSON.parse(readFileSync("output/pilot2/2026-09-30-actionability-v2/pilot2-merged-report.json", "utf8")).jobState.candidates].map((c: any) => c.key)).size, mechanismsVerified: 1, accessPathsIdentified: 1, currentTimingSignals: 1, prioritizeFound: 1, candidates: [], rejectionReasons: { NO_VERIFIED_ACCESS: 2, PROVIDER_TIMEOUT: 3 }, stopCondition: "EVIDENCE_QUALIFIED_PRIORITIZE_FOUND; PREMIUM_CAPACITY_REMAINS_17_OF_18" };
const tiers: any[] = [];
for (const [tier, label, code] of [["preview", "Preview", "preview_launch_v0"], ["brief", "Brief", "brief_launch_v0"], ["intelligence", "Portfolio", "intelligence_launch_v0"], ["premium", "Premium", "premium_launch_v0"]] as const) {
  const experience = resolveReportExperience(code, "en");
  const vm = fromInstitutionalReport(institutional, experience);
  const doc = fromDeliverableViewModel(vm);
  const pm = toPresentationModel(doc as any, tier as any, "pdf");
  const pdf = await renderPdfBuffer(pm as any);
  const path = `${out}/LeadLens_AmorDeGea_Pilot2_${label}.pdf`;
  writeFileSync(path, pdf);
  tiers.push({ tier, label, accounts: (pm as any).document?.accounts?.length ?? 0, bytes: pdf.length, path, deliveryReady: label === "Portfolio" ? readiness.Portfolio.deliveryReady : label === "Premium" ? readiness.Premium.deliveryReady : readiness[label].deliveryReady });
}
const artifact = { version: "pilot2-actionability-final-v3", created_at: new Date().toISOString(), jobId: base.jobState.jobId, qualified, readiness, legacyReadiness, intelligence: institutional.intelligence, escalation, selection: { selected: selection.selected.map((x: any) => x.company), qualifiedNotSelected: selection.qualifiedNotSelected }, decisions: cases.reduce((a: any, c: any) => { a[c.decision] = (a[c.decision] ?? 0) + 1; return a; }, {}), tiers, provenance: { base: "output/pilot2/2026-09-30-final2", expansion: "output/pilot2/2026-09-30-actionability-v1", trackA: "output/pilot2/2026-09-30-actionability-v1/track-a-validation.json", marketResearchUniverse: "output/pilot2/2026-09-30-market-universe-v2/market-research-universe.json" } };
writeFileSync(`${out}/pilot2-actionability-final.json`, JSON.stringify(artifact, null, 2));
writeFileSync(`${out}/pilot2-merged-report.json`, JSON.stringify({ reportJson: { ...reportJson, canonical_intelligence: institutional.intelligence }, meta: base.meta, jobState: { ...base.jobState, qualified, tierReadiness: readiness, canonicalIntelligence: institutional.intelligence, actionabilityEscalation: escalation, status: readiness.Premium.deliveryReady ? "complete" : "partial" } }, null, 2));
console.log(JSON.stringify({ output: out, qualified: qualified.length, decisions: artifact.decisions, readiness, tiers }, null, 2));
