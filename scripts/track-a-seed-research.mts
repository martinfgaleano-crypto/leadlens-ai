#!/usr/bin/env node
/**
 * Track-A Gold-Standard — REAL research + decision pipeline over a seeded set of real
 * US mid-market industrial companies, because discovery-SEARCH was unavailable in this
 * environment (BRAVE_API_KEY absent; serper/tavily returned no yield for the niche
 * M&A-trigger queries — see track-a-diagnostics.json). This is NOT mocked evidence and
 * NOT a hand-authored report: the seeds are only candidate NAMES/domains; the actual
 * research, evidence, mechanism/access assessment and canonical decision are produced
 * by the real LeadLens pipeline (runLeadLensPipeline + canonicalCaseForLead), exactly
 * as a discovered candidate would be. The seed list is the bounded reproducible fixture
 * (§49). The customer is the Track-A PMI consultancy fixture.
 *
 * Seeds: real, public, plausibly-acquisitive US mid-market industrials. The pipeline
 * VERIFIES or REFUTES a current PMI opportunity for each — their facts are not asserted
 * here. Selecting easy winners is explicitly avoided; the mix will include non-current
 * and weak cases, which is the point.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const OUT = process.env.TRACKA_OUT || "output/goldstandard/track-a";
mkdirSync(OUT, { recursive: true });

const { runLeadLensPipeline } = await import("@/lib/pipeline");
const { canonicalCaseForLead } = await import("@/lib/intelligence/productive-spine");
const { promotePrimarySourceEvent } = await import("@/lib/intelligence/primary-source-event-promotion");
const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
const { fromDeliverableViewModel } = await import("@/lib/delivery-system/delivery-document");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");
const { resolveReportExperience } = await import("@/lib/products/report-experience");
const { getUsage } = await import("@/lib/ops/usage-ledger");
const { assessAccountEligibility } = await import("@/lib/intelligence/account-eligibility");
const { selectDeterministically } = await import("@/lib/intelligence/deterministic-tier-selection");
const usdNow = () => (getUsage().anthropic?.calculated_cost_usd_today ?? 0);

const onboardingData: any = {
  company_name: "Meridian Transition Partners",
  company_description: "Boutique US consultancy specializing in post-merger integration (PMI) operational execution for mid-market industrial and manufacturing companies — first-120-day integration of operations, supply chain and ERP after an acquisition.",
  offer_description: "Hands-on first-120-day post-merger integration of operations, supply chain and ERP for mid-market manufacturers and PE-backed industrial platforms.",
  value_proposition: "Partner-led PMI execution that de-risks the first 120 days of an industrial acquisition: synergy capture, supply-chain consolidation and ERP cutover, without a large retained bench.",
  target_customer_description: "US mid-market industrial / manufacturing companies and PE-backed manufacturing platforms that have RECENTLY closed an acquisition, add-on or carve-out and must integrate operations quickly with limited internal PMI capacity.",
  tone: "consultative", contact_email: "founder@example.com", output_language: "en",
  target_market_region: "north_america", target_countries: ["United States"], product_code: "premium_launch_v0",
};
const objectiveIcp: any = {
  target_industries: ["Mid-market industrial manufacturer", "Industrial equipment manufacturer", "PE-backed manufacturing platform"],
  target_titles: [], company_size_range: "mid-market", pain_points: [],
  disqualifiers: ["staffing agency", "recruiting firm", "advertising agency", "law firm"],
  ideal_signals: ["recent acquisition", "add-on acquisition", "carve-out", "merger close"],
  exclusions_explicit: ["staffing agency", "recruiting firm"], icp_clarity_score: 80,
};
const objectiveCriteria: any = {
  target_industries: objectiveIcp.target_industries, target_company_size: ["mid-market"], target_job_titles: [],
  target_geography: ["United States"], excluded_industries: ["staffing", "recruiting", "advertising", "legal services"],
  buying_signals: ["recent acquisition", "add-on", "carve-out", "merger close"], disqualification_criteria: objectiveIcp.disqualifiers,
  offer_summary: "first-120-day post-merger integration of operations, supply chain and ERP for mid-market industrial acquirers",
  value_proposition: "partner-led PMI execution de-risking the first 120 days of an industrial acquisition (synergy capture, supply-chain consolidation, ERP cutover)",
  tone: "consultative", plan: "pro", lead_count: 8, require_real_discovery: false,
  output_language: "en", target_market_region: "north_america",
};

// Real, public US industrials with a plausible M&A cadence. The pipeline verifies/refutes
// a CURRENT PMI opportunity for each — mix is intentional (serial acquirers + quieter names).
const SEEDS: Array<{ company: string; domain: string; industry: string }> = [
  { company: "Standex International", domain: "standex.com", industry: "Diversified industrial manufacturer" },
  { company: "Kadant Inc", domain: "kadant.com", industry: "Industrial processing technology manufacturer" },
  { company: "CECO Environmental", domain: "cecoenviro.com", industry: "Industrial environmental systems manufacturer" },
  { company: "Franklin Electric", domain: "franklin-electric.com", industry: "Water and fueling systems manufacturer" },
  { company: "Mayville Engineering Company", domain: "mecinc.com", industry: "Contract metal fabrication manufacturer" },
  { company: "Enpro Inc", domain: "enpro.com", industry: "Industrial sealing and materials manufacturer" },
  { company: "Chart Industries", domain: "chartindustries.com", industry: "Industrial process and cryogenic equipment manufacturer" },
  { company: "Hillman Solutions", domain: "hillmangroup.com", industry: "Hardware and industrial products manufacturer" },
];
const leads = SEEDS.map((s, i) => ({ id: `seed_${i}_${s.domain}`, company: s.company, domain: s.domain, website_url: `https://${s.domain}`, country: "United States", industry: s.industry, source: "public_signal" as const, confidence_score: 0.8 }));

const start = usdNow();
const CACHE = `${OUT}/track-a-research-cache.json`;
console.log(`=== TRACK-A SEED RESEARCH :: ${leads.length} real seeds, real research pipeline ===`);
console.log(`spend today before run: $${start.toFixed(4)}`);
let report: any;
const { existsSync, readFileSync } = await import("node:fs");
if (process.env.TRACKA_REUSE_RESEARCH === "1" && existsSync(CACHE)) {
  // Render-only / correction re-run (§10): reuse the already-paid research so fixing a
  // downstream gate does NOT trigger a second research run.
  report = JSON.parse(readFileSync(CACHE, "utf8"));
  console.log(`reusing cached research (${(report.processed_leads ?? []).length} leads) — NO new research spend`);
} else {
  try {
    report = await runLeadLensPipeline({ onboardingData, plan: "pro", icpOverride: objectiveIcp, criteriaOverride: objectiveCriteria, candidatesOverride: leads, decisionOnly: true, researchCandidateLimit: leads.length, deliveryLimit: leads.length, researchConcurrency: 3 });
  } catch (e) { console.error("pipeline error:", e instanceof Error ? e.message : e); process.exit(1); }
  writeFileSync(CACHE, JSON.stringify(report, null, 2)); // cache BEFORE downstream gates so a correction re-run is free
}
for (const l of report.processed_leads ?? []) promotePrimarySourceEvent(l);
report.canonical_cases = (report.processed_leads ?? []).map((l: any) => canonicalCaseForLead(l)).filter(Boolean);
console.log(`researched=${(report.processed_leads ?? []).length} canonical_cases=${report.canonical_cases.length} cost $${(usdNow() - start).toFixed(4)}`);

// Eligibility gate + decision distribution.
const byLead = new Map((report.processed_leads ?? []).map((l: any) => [l.id, l]));
const kept: any[] = []; const excluded: any[] = [];
for (const cc of report.canonical_cases) {
  const lead: any = byLead.get(cc.lead_id); if (!lead) continue;
  const elig = assessAccountEligibility({ company: lead.candidate.company, industry: lead.candidate.industry ?? null, country: "United States", companySummary: lead.enrichment?.company_summary ?? null }, { geographies: ["United States"], targetRole: "direct_buyer" });
  if (elig.outcome !== "eligible") { excluded.push({ company: lead.candidate.company, reason: `${elig.outcome}_${elig.reason}` }); continue; }
  kept.push(cc);
}
const keptCompanies = new Set(kept.map((c) => (byLead.get(c.lead_id)?.candidate?.company ?? "").toLowerCase()));
const mergedLeads = (report.processed_leads ?? []).filter((l: any) => keptCompanies.has((l.candidate.company ?? "").toLowerCase()));
const dist = kept.reduce((m: any, c: any) => ({ ...m, [c.decision]: (m[c.decision] ?? 0) + 1 }), {});
console.log("decisions:", JSON.stringify(dist), "| excluded:", excluded.map((x) => x.company).join(", ") || "(none)");

const diagnostics = { customer: onboardingData.company_name, seeds: SEEDS.length, researched: (report.processed_leads ?? []).length, eligible: kept.length, excluded, decisions: dist, decidedAccounts: kept.map((c) => { const l: any = byLead.get(c.lead_id); return { company: l?.candidate?.company, decision: c.decision, fit: c.fit, timing: c.timing, evidence: c.evidence }; }), spendUsd: usdNow() - start, discovery_note: "Discovery-search unavailable in this environment (BRAVE_API_KEY absent; serper/tavily no yield) — see track-a-diagnostics.json. Seeds substitute for discovery ONLY; research/decision are the real pipeline." };
writeFileSync(`${OUT}/track-a-seed-diagnostics.json`, JSON.stringify(diagnostics, null, 2));

if (mergedLeads.length === 0) { console.error("No eligible researched accounts."); process.exit(0); }

// Order by deterministic selection, assemble, render ONE Gold-Standard Premium artifact.
const selIn = kept.map((c) => { const l: any = byLead.get(c.lead_id); const ar = l?.enrichment?.account_research; return { id: l.id, company: l.candidate.company, decision: c.decision, fit: c.fit, timing: c.timing, evidence: c.evidence, evidenceCount: (l.enrichment?.evidence_discipline ?? []).length, hasSource: Boolean(l.candidate?.source_url), hasValidatedDate: Boolean(l.candidate?.signal_date), independentlyCorroborated: Boolean(ar?.corroboration_attempted && (ar?.corroborating_domains ?? 0) >= 1), commercialMechanismVerified: l.candidate?.opportunity_kind === "channel_fit", accessVerified: false, counterevidenceMaterial: ar?.counterevidence_material_found === true }; });
const selection = selectDeterministically(selIn, 5);
const order = selection.selected.map((x: any) => x.company.toLowerCase());
const finalLeads = mergedLeads.filter((l: any) => order.includes((l.candidate.company ?? "").toLowerCase()));
const finalCanonical = kept.filter((c) => finalLeads.some((l: any) => l.id === c.lead_id));
const ranked = (report.ranked_opportunities ?? []).filter((o: any) => finalLeads.some((l: any) => l.id === o.lead_id))
  .sort((a: any, b: any) => order.indexOf((byLead.get(a.lead_id)?.candidate?.company ?? "").toLowerCase()) - order.indexOf((byLead.get(b.lead_id)?.candidate?.company ?? "").toLowerCase()))
  .map((o: any, i: number) => ({ ...o, rank: i + 1 }));

const reportJson: any = { onboarding: onboardingData, processed_leads: finalLeads, ranked_opportunities: ranked, canonical_cases: finalCanonical, executive_summary: report.executive_summary ?? "" };
const meta = { job_id: `tracka_seed_${Date.now()}`, plan: "pro", search_id: null, customer_ref: "track-a-pmi-consultancy", created_at: new Date().toISOString() };
writeFileSync(`${OUT}/track-a-merged-report.json`, JSON.stringify({ reportJson, meta }, null, 2));
const institutional = assembleInstitutionalReport(reportJson, meta);

const { deriveResearchInput, producePremiumContext, premiumContextFromEnvelope } = await import("@/lib/intelligence/premium/premium-production");
const premiumEnvelope = await producePremiumContext(deriveResearchInput({ onboardingData, criteria: { target_market_region: "United States" }, companies: institutional.account_dossiers.map((d: any) => d.company) }));
reportJson._premium_context = premiumEnvelope;
writeFileSync(`${OUT}/track-a-merged-report.json`, JSON.stringify({ reportJson, meta }, null, 2));

const vm = fromInstitutionalReport(institutional, resolveReportExperience("premium_launch_v0", "en"));
const doc = { ...fromDeliverableViewModel(vm), premiumContext: premiumContextFromEnvelope(premiumEnvelope) };
const pm = toPresentationModel(doc as any, "premium", "pdf");
const pdf = await renderPdfBuffer(pm as any);
const pdfPath = `${OUT}/LeadLens_TrackA_GoldStandard_Premium.pdf`;
writeFileSync(pdfPath, pdf);
console.log(`\nGOLD-STANDARD ARTIFACT :: ${pdfPath} (${pdf.length} bytes, ${(pm as any).document?.accounts?.length ?? 0} accounts)`);
console.log(`total spend this run: $${(usdNow() - start).toFixed(4)}`);
console.log("done");
