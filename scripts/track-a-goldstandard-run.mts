#!/usr/bin/env node
/**
 * Intelligence Value Reset — ONE bounded live Track-A run through the ACTUAL LeadLens
 * customer-job / research pipeline, then ONE Gold-Standard Premium artifact over the
 * 2–5 surviving accounts. Operational glue (a script), not product code.
 *
 * Track-A fixture (US specialized consultancy). Facts are labeled:
 *   KNOWN              — none private; this is a validation fixture, not a real client.
 *   ASSUMED-FOR-FIXTURE — the consultancy identity/service below (plausible, generic).
 *   UNKNOWN            — anything the public pipeline must discover about targets.
 * The CUSTOMER is a boutique post-merger-integration (PMI) operations consultancy; its
 * TARGET ACCOUNTS are mid-market US companies with a RECENT, DATED acquisition / roll-up
 * / carve-out — the trigger that creates immediate PMI-execution demand. This is a hard
 * fixture: simple company discovery is NOT enough; the decision depends on tying a dated
 * M&A event to a service-demand thesis, a commercial mechanism, and buyer access.
 *
 * Bounded: hard budget + pass + per-pass-research caps; retries bounded by the pipeline;
 * provider failure terminates honestly; partial research is preserved to OUT before render.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]) if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const OUT = process.env.TRACKA_OUT || "output/goldstandard/track-a";
mkdirSync(OUT, { recursive: true });
const BUDGET = Number(process.env.TRACKA_BUDGET_USD ?? "4");
const MAX_PASSES = Number(process.env.TRACKA_MAX_PASSES ?? "4");
const MAX_RESEARCH_PER_PASS = Number(process.env.TRACKA_MAX_RESEARCH_PER_PASS ?? "4");
const TARGET = Number(process.env.TRACKA_TARGET ?? "5");

const { runCompanyFirstDiscovery } = await import("@/lib/discovery/company-first-discovery");
const { runLeadLensPipeline } = await import("@/lib/pipeline");
const { canonicalCaseForLead } = await import("@/lib/intelligence/productive-spine");
const { accreteDiscoveredCompanies, productionVaultAccretionDeps } = await import("@/lib/vault/vault-accretion");
const { listVaultCompanies } = await import("@/lib/storage/vault-store");
const { getUsage } = await import("@/lib/ops/usage-ledger");
const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
const { fromDeliverableViewModel } = await import("@/lib/delivery-system/delivery-document");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");
const { resolveReportExperience } = await import("@/lib/products/report-experience");
const { createServerClient } = await import("@/lib/supabase/server");
const cj = await import("@/lib/intelligence/customer-job");
const { assessAccountEligibility } = await import("@/lib/intelligence/account-eligibility");
const { selectDeterministically } = await import("@/lib/intelligence/deterministic-tier-selection");
const { promotePrimarySourceEvent } = await import("@/lib/intelligence/primary-source-event-promotion");

type DiscoveredCompany = import("@/lib/intelligence/customer-job").DiscoveredCompany;
type PassSpec = import("@/lib/intelligence/customer-job").PassSpec;
type CanonicalCandidate = import("@/lib/intelligence/customer-job").CanonicalCandidate;
type QualifiedAccount = import("@/lib/intelligence/customer-job").QualifiedAccount;
type RejectionMemoryEntry = import("@/lib/intelligence/customer-job").RejectionMemoryEntry;

const db = createServerClient()!;
const usdNow = () => (getUsage().anthropic?.calculated_cost_usd_today ?? 0);

// ── Track-A customer context (ASSUMED-FOR-FIXTURE; no real private facts) ──
const TARGET_SEGMENTS = [
  "Mid-market industrial manufacturer recent acquisition",
  "PE-backed manufacturing platform add-on acquisition",
  "Industrial company post-carve-out integration",
  "Mid-market manufacturer merger operational integration",
];
const onboardingData: any = {
  company_name: "Meridian Transition Partners",
  company_description: "Boutique US consultancy specializing in post-merger integration (PMI) operational execution for mid-market industrial and manufacturing companies — the first-120-day integration of operations, supply chain and ERP after an acquisition.",
  offer_description: "Hands-on first-120-day post-merger integration of operations, supply chain and ERP for mid-market manufacturers and PE-backed industrial platforms.",
  value_proposition: "Partner-led PMI execution that de-risks the first 120 days of an industrial acquisition: synergy capture, supply-chain consolidation and ERP cutover, without a large retained bench.",
  target_customer_description: "US mid-market industrial / manufacturing companies and PE-backed manufacturing platforms that have RECENTLY closed an acquisition, add-on or carve-out and must integrate operations quickly with limited internal PMI capacity.",
  tone: "consultative", contact_email: "founder@example.com",
  output_language: "en", target_market_region: "north_america",
  target_countries: ["United States"], product_code: "premium_launch_v0",
};
const objectiveIcp: any = {
  target_industries: TARGET_SEGMENTS, target_titles: [], company_size_range: "mid-market",
  pain_points: [], disqualifiers: ["staffing agency", "recruiting firm", "advertising agency", "law firm", "pure software vendor"],
  ideal_signals: ["recent acquisition", "add-on acquisition", "carve-out", "merger close", "roll-up"],
  exclusions_explicit: ["staffing agency", "recruiting firm", "advertising agency", "law firm"],
  icp_clarity_score: 80,
};
const objectiveCriteria: any = {
  target_industries: TARGET_SEGMENTS, target_company_size: ["mid-market"], target_job_titles: [],
  target_geography: ["United States"], excluded_industries: ["staffing", "recruiting", "advertising", "legal services"],
  buying_signals: ["recent acquisition", "add-on", "carve-out", "merger close"],
  disqualification_criteria: objectiveIcp.disqualifiers,
  offer_summary: "first-120-day post-merger integration of operations, supply chain and ERP for mid-market industrial acquirers",
  value_proposition: "partner-led PMI execution de-risking the first 120 days of an industrial acquisition (synergy capture, supply-chain consolidation, ERP cutover)",
  tone: "consultative", plan: "pro", lead_count: TARGET, require_real_discovery: true,
  output_language: "en", target_market_region: "north_america",
};

// Trigger-based discovery routes: a recently-acquisitive mid-market industrial is the
// unit of opportunity (the dated M&A event is the "why now"). Distinct families, one geo.
const ROUTES: Array<{ route: string; industries: string[] }> = [
  { route: "recent_industrial_acquirer", industries: ["Mid-market industrial manufacturer recent acquisition", "Manufacturing company completed acquisition"] },
  { route: "pe_manufacturing_rollup", industries: ["PE-backed manufacturing platform add-on acquisition", "Private equity industrial roll-up"] },
  { route: "carveout_integration", industries: ["Industrial company post-carve-out", "Manufacturing division carve-out buyer"] },
  { route: "merger_operational_integration", industries: ["Mid-market manufacturer merger integration", "Industrial merger operations integration"] },
];
const GEO = ["United States"];
const PASS_PLAN: PassSpec[] = [];
let pid = 0;
for (const g of GEO) for (const r of ROUTES) PASS_PLAN.push({ passId: ++pid, route: r.route, queryFamilyId: `${r.route}:${g.replace(/\s+/g, "_")}`, queries: r.industries, geoCluster: g });

const researchedLeadsById = new Map<string, any>();
const rankedByCompany = new Map<string, any>();
const canonicalByLead = new Map<string, any>();
let lastExecSummary = "";
const gradeByKey = new Map<string, { opportunity_kind?: string; channel_evidence_grade?: string; channel_proof_type?: string }>();

function leadCandidatesFrom(cands: CanonicalCandidate[]): any[] {
  return cands.map((c, i) => {
    const g = gradeByKey.get(c.key);
    return {
      id: `${c.key}_c${i}`, company: c.company, domain: c.domain ?? undefined,
      website_url: c.domain ? `https://${c.domain}` : undefined, location: c.country ?? undefined,
      country: c.country ?? null, industry: c.industry ?? undefined, source: "public_signal" as const,
      confidence_score: c.domain ? 0.8 : 0.5,
      ...(c.sourceUrl ? { source_url: c.sourceUrl } : {}),
      ...(c.signalDate ? { signal_date: c.signalDate } : {}),
      ...(c.signalType ? { signal_type: c.signalType } : {}),
      ...((c.opportunityKind ?? g?.opportunity_kind) ? { opportunity_kind: c.opportunityKind ?? g?.opportunity_kind } : {}),
      ...((c.channelEvidenceGrade ?? g?.channel_evidence_grade) ? { channel_evidence_grade: c.channelEvidenceGrade ?? g?.channel_evidence_grade } : {}),
      ...((c.channelProofType ?? g?.channel_proof_type) ? { channel_proof_type: c.channelProofType ?? g?.channel_proof_type } : {}),
    };
  });
}

const accretionDeps = await productionVaultAccretionDeps();
const deps = {
  now: () => new Date(),
  vaultFirst: async (spec: PassSpec, state: any): Promise<DiscoveredCompany[]> => {
    try {
      const rows = await listVaultCompanies({ region: "United States" });
      const known = new Set(state.candidates.map((c: any) => c.key));
      return rows
        .filter((r: any) => /manufact|industrial|equipment|machin|components|fabricat/i.test(`${r.industry ?? ""}`))
        .map((r: any) => ({ company: r.name, domain: r.domain ?? null, country: r.country ?? "United States", industry: r.industry ?? null }))
        .filter((c: DiscoveredCompany) => !known.has(cj.canonicalKey(c.company, c.domain)))
        .slice(0, 6);
    } catch { return []; }
  },
  discover: async (spec: PassSpec) => {
    const before = usdNow();
    const routeIcp = { ...objectiveIcp, target_industries: spec.queries };
    const routeCriteria = { ...objectiveCriteria, target_industries: spec.queries, target_geography: [spec.geoCluster ?? "United States"] };
    let discovered: DiscoveredCompany[] = [], providersAttempted: string[] = [], providerState: Record<string, string> = {}, raw = 0;
    try {
      const { candidates, metrics } = await runCompanyFirstDiscovery(routeIcp, routeCriteria, "brief", 10, { costCapUsd: 0.4 });
      for (const cand of candidates ?? []) {
        const key = cj.canonicalKey(cand.company, cand.domain ?? null);
        if (cand.opportunity_kind || cand.channel_evidence_grade) gradeByKey.set(key, { opportunity_kind: cand.opportunity_kind, channel_evidence_grade: cand.channel_evidence_grade, channel_proof_type: cand.channel_proof_type });
      }
      const candidateByKey = new Map((candidates ?? []).map((cand: any) => [cj.canonicalKey(cand.company, cand.domain ?? null), cand]));
      discovered = (metrics.universe_accounts ?? []).map((a: any) => {
        const cand: any = candidateByKey.get(cj.canonicalKey(a.company, a.domain ?? null));
        return { company: a.company, domain: a.domain ?? null, country: a.country ?? "United States", industry: a.sector ?? null,
          sourceUrl: cand?.source_url ?? null, signalDate: cand?.signal_date ?? null, signalType: cand?.signal_type ?? null,
          opportunityKind: cand?.opportunity_kind ?? null, channelEvidenceGrade: cand?.channel_evidence_grade ?? null, channelProofType: cand?.channel_proof_type ?? null };
      });
      for (const cand of candidates ?? []) if (cand.domain && !discovered.some((d) => cj.canonicalKey(d.company, d.domain) === cj.canonicalKey(cand.company, cand.domain ?? null))) discovered.push({ company: cand.company, domain: cand.domain ?? null, country: cand.country ?? "United States", industry: cand.industry ?? null, sourceUrl: cand.source_url ?? null, signalDate: cand.signal_date ?? null, signalType: cand.signal_type ?? null, opportunityKind: cand.opportunity_kind ?? null, channelEvidenceGrade: cand.channel_evidence_grade ?? null, channelProofType: cand.channel_proof_type ?? null });
      providersAttempted = metrics.providers_available ?? [];
      providerState = metrics.provider_status ?? {};
      raw = (metrics.universe_route_metrics ?? []).reduce((s: number, x: any) => s + (x.result_pages ?? 0), 0);
    } catch (e) { console.error(`  discover error (${spec.queryFamilyId}):`, e instanceof Error ? e.message : e); }
    const costUsd = Math.max(0, usdNow() - before);
    console.log(`  pass ${spec.passId} [${spec.queryFamilyId}] discovered=${discovered.length} providers=${providersAttempted.join("/")} $${costUsd.toFixed(4)}`);
    return { discovered, providersAttempted, providerState, rawResults: raw, costUsd };
  },
  vaultWriteThrough: async (companies: DiscoveredCompany[]) => {
    try {
      const m = await accreteDiscoveredCompanies(companies.map((c) => ({ name: c.company, domain: c.domain, country: c.country, industry: c.industry, sourceUrl: c.sourceUrl ?? null })), "customer_run", accretionDeps);
      return { evaluated: m.evaluated, new_companies: m.new_companies, existing_rediscovered: m.existing_rediscovered, rejected_non_account: m.rejected_non_account };
    } catch { return { evaluated: 0, new_companies: 0, existing_rediscovered: 0, rejected_non_account: 0 }; }
  },
  qualify: async (candidates: CanonicalCandidate[]): Promise<{ qualified: QualifiedAccount[]; rejected: RejectionMemoryEntry[]; deferredKeys: string[]; costUsd: number }> => {
    const preRejected: RejectionMemoryEntry[] = [];
    const inScope = candidates.filter((c) => {
      // Track-A red team: drop obvious non-buyers of PMI services (pure staffing /
      // recruiting / advertising / legal). Industrials/manufacturers/PE platforms stay.
      if (/staffing|recruit|advertising|marketing agency|law firm|\blaw\b|headhunt/i.test(`${c.company} ${c.industry ?? ""}`)) { preRejected.push({ key: c.key, company: c.company, reason: "OFF_TARGET_NON_BUYER", pass: c.firstSeenPass }); return false; }
      return true;
    });
    const prioritized = [...inScope].sort((a, b) => (gradeByKey.has(b.key) ? 1 : 0) - (gradeByKey.has(a.key) ? 1 : 0) || (b.domain ? 1 : 0) - (a.domain ? 1 : 0));
    const toResearch = prioritized.slice(0, MAX_RESEARCH_PER_PASS);
    const deferredKeys = prioritized.slice(MAX_RESEARCH_PER_PASS).map((c) => c.key);
    if (toResearch.length === 0) return { qualified: [], rejected: preRejected, deferredKeys, costUsd: 0 };
    const leads = leadCandidatesFrom(toResearch);
    const before = usdNow();
    let report: any;
    try {
      report = await runLeadLensPipeline({ onboardingData, plan: "pro", icpOverride: objectiveIcp, criteriaOverride: objectiveCriteria, candidatesOverride: leads, decisionOnly: true, researchCandidateLimit: leads.length, deliveryLimit: leads.length, researchConcurrency: 3 });
    } catch (e) { const costUsd = Math.max(0, usdNow() - before); console.error("  qualify error:", e instanceof Error ? e.message : e); return { qualified: [], rejected: preRejected, deferredKeys: candidates.map((c) => c.key), costUsd }; }
    for (const l of report.processed_leads ?? []) promotePrimarySourceEvent(l);
    report.canonical_cases = (report.processed_leads ?? []).map((l: any) => canonicalCaseForLead(l)).filter(Boolean);
    console.log(`  qualify: researched ${leads.length}, canonical_cases=${report.canonical_cases.length}, cost $${(usdNow() - before).toFixed(4)}`);
    for (const l of report.processed_leads ?? []) researchedLeadsById.set(l.id, l);
    for (const o of report.ranked_opportunities ?? []) { const lead = (report.processed_leads ?? []).find((x: any) => x.id === o.lead_id); const co = (lead?.candidate?.company ?? "").toLowerCase(); if (co && !rankedByCompany.has(co)) rankedByCompany.set(co, o); }
    for (const c of report.canonical_cases ?? []) canonicalByLead.set(c.lead_id, c);
    if (typeof report.executive_summary === "string" && report.executive_summary) lastExecSummary = report.executive_summary;
    const byLead = new Map((report.processed_leads ?? []).map((l: any) => [l.id, l]));
    const qualified: QualifiedAccount[] = [];
    const qualifiedCompanies = new Set<string>();
    for (const cc of report.canonical_cases ?? []) {
      const lead: any = byLead.get(cc.lead_id); if (!lead) continue;
      const company = lead.candidate.company; const domain = lead.candidate.domain ?? null; const key = cj.canonicalKey(company, domain);
      const elig = assessAccountEligibility({ company, industry: lead.candidate.industry ?? null, country: lead.candidate.country ?? "United States", companySummary: lead.enrichment?.company_summary ?? null }, { geographies: ["United States"] });
      if (elig.outcome !== "eligible") { preRejected.push({ key, company, reason: `${elig.outcome === "exclude" ? "INELIGIBLE" : "RESEARCH_MORE"}_${elig.reason}`, pass: candidates[0]?.firstSeenPass ?? 0 }); continue; }
      qualifiedCompanies.add(company.toLowerCase());
      const research = lead.enrichment?.account_research;
      const channelAccess = (lead.candidate?.opportunity_kind === "channel_fit" || lead.candidate?.access_verified === true) && ["strong", "moderate"].includes(lead.candidate?.channel_evidence_grade ?? "");
      qualified.push({ key, company, domain, route: candidates.find((c) => c.key === key)?.route ?? "unknown", decision: cc.decision, fit: cc.fit, timing: cc.timing, evidenceCount: (lead.enrichment?.evidence_discipline ?? []).length, qualifiedAtPass: candidates[0]?.firstSeenPass ?? 0, hasSource: Boolean(lead.candidate?.source_url), hasValidatedDate: Boolean(lead.candidate?.signal_date), currentActionabilityBasis: lead.candidate?.current_actionability_verified === true, commercialMechanismVerified: channelAccess, accessPathIdentified: channelAccess, counterevidenceMaterial: research?.counterevidence_material_found === true });
    }
    const rejected: RejectionMemoryEntry[] = [];
    for (const l of report.processed_leads ?? []) {
      if (qualifiedCompanies.has((l.candidate.company ?? "").toLowerCase())) continue;
      const key = cj.canonicalKey(l.candidate.company, l.candidate.domain ?? null);
      rejected.push({ key, company: l.candidate.company, reason: (l.qualification?.category === "DISCARD" ? "OFF_TARGET_OR_INSUFFICIENT" : "NOT_QUALIFIED"), pass: candidates[0]?.firstSeenPass ?? 0 });
    }
    return { qualified, rejected: [...preRejected, ...rejected], deferredKeys, costUsd: Math.max(0, usdNow() - before) };
  },
  save: async () => { /* no Supabase job persistence for a validation run */ },
};

// ── Pre-run budget check (§3) ──
const startUsd = usdNow();
console.log(`\n=== TRACK-A GOLD-STANDARD RUN ===`);
console.log(`budget ceiling $${BUDGET} | maxPasses ${MAX_PASSES} | research/pass ${MAX_RESEARCH_PER_PASS} | target ${TARGET} | planned passes ${PASS_PLAN.length}`);
console.log(`expected max spend ≈ discovery(${PASS_PLAN.length}×$0.40=$${(PASS_PLAN.length * 0.4).toFixed(2)}) + research(≤${MAX_PASSES * MAX_RESEARCH_PER_PASS} accts) — hard-capped at $${BUDGET} by the engine.`);
console.log(`spend today before run: $${startUsd.toFixed(4)}`);

const jobId = `cj_tracka_goldstandard_${Date.now()}`;
let state = cj.newCustomerJobState({ jobId, customer: onboardingData.company_name, objective: "Where should PMI BD effort go now", contextVersion: 1, geography: "United States", requestedTier: "premium", targetCount: TARGET, milestones: [2, 3, 4, 5] });
state = await cj.runCustomerJob(state, PASS_PLAN, deps as any, { maxPasses: MAX_PASSES, budgetUsd: BUDGET, vaultAsSelectionSource: false });

console.log(`\n=== JOB DONE :: status=${state.status} passes=${state.passesCompleted} qualified=${state.qualified.length} candidates=${state.candidates.length} spend=$${state.spendUsd.toFixed(4)} ===`);
console.log("qualified:", state.qualified.map((q) => `${q.company}[${q.decision}]`).join(" | ") || "(none)");

// ── Assemble + select up to TARGET ──
const selectionInput = state.qualified.map((q) => {
  const lead: any = [...researchedLeadsById.values()].find((l: any) => (l.candidate.company ?? "").toLowerCase() === q.company.toLowerCase());
  const cc: any = lead ? canonicalByLead.get(lead.id) : null; const ar = lead?.enrichment?.account_research;
  return { id: q.key, company: q.company, decision: q.decision, fit: cc?.fit ?? null, timing: cc?.timing ?? null, evidence: cc?.evidence ?? null, evidenceCount: q.evidenceCount, hasSource: Boolean(lead?.candidate?.source_url), hasValidatedDate: Boolean(lead?.candidate?.signal_date), independentlyCorroborated: Boolean(ar?.corroboration_attempted && (ar?.corroborating_domains ?? 0) >= 1), commercialMechanismVerified: lead?.candidate?.opportunity_kind === "channel_fit", accessVerified: lead?.candidate?.opportunity_kind === "channel_fit" && ["strong", "moderate"].includes(lead?.candidate?.channel_evidence_grade ?? ""), counterevidenceMaterial: ar?.counterevidence_material_found === true };
});
const selection = selectDeterministically(selectionInput, TARGET);
const selectedKeys = new Set(selection.selected.map((a: any) => a.id));
const qualifiedCompanySet = new Set(state.qualified.filter((q) => selectedKeys.has(q.key)).map((q) => q.company.toLowerCase()));
const mergedLeads = [...researchedLeadsById.values()].filter((l: any) => qualifiedCompanySet.has((l.candidate.company ?? "").toLowerCase()));
const mergedCanonical = [...canonicalByLead.values()].filter((c: any) => mergedLeads.some((l: any) => l.id === c.lead_id));
const orderedCompanies = selection.selected.map((x: any) => x.company.toLowerCase());
const mergedRanked = [...rankedByCompany.entries()].filter(([co]) => qualifiedCompanySet.has(co)).map(([, o]) => o)
  .sort((a: any, b: any) => orderedCompanies.indexOf((researchedLeadsById.get(a.lead_id)?.candidate?.company ?? "").toLowerCase()) - orderedCompanies.indexOf((researchedLeadsById.get(b.lead_id)?.candidate?.company ?? "").toLowerCase()))
  .map((o: any, i: number) => ({ ...o, rank: i + 1 }));

const diagnostics = { jobId, status: state.status, passes: state.passesCompleted, candidates: state.candidates.length, qualified: state.qualified.length, spendUsd: state.spendUsd, selected: selection.selected.length, decisions: mergedCanonical.reduce((m: any, c: any) => ({ ...m, [c.decision]: (m[c.decision] ?? 0) + 1 }), {}), qualifiedNotSelected: selection.qualifiedNotSelected.map((x: any) => ({ company: x.account.company, reason: x.reason })) };
writeFileSync(`${OUT}/track-a-diagnostics.json`, JSON.stringify(diagnostics, null, 2));

if (mergedLeads.length === 0) {
  console.error(`\nNO QUALIFIED ACCOUNTS. Preserving diagnostics for root-cause (fixture vs provider vs intelligence).`);
  writeFileSync(`${OUT}/track-a-jobstate.json`, JSON.stringify(state, null, 2));
  console.log(`diagnostics -> ${OUT}/track-a-diagnostics.json`);
  process.exit(0);
}

const reportJson: any = { onboarding: onboardingData, processed_leads: mergedLeads, ranked_opportunities: mergedRanked, canonical_cases: mergedCanonical, executive_summary: lastExecSummary || "US post-merger-integration account foundation (Track-A validation)." };
const meta = { job_id: jobId, plan: "pro", search_id: null, customer_ref: "track-a-pmi-consultancy", created_at: new Date().toISOString() };
writeFileSync(`${OUT}/track-a-merged-report.json`, JSON.stringify({ reportJson, meta, jobState: state }, null, 2));

const institutional = assembleInstitutionalReport(reportJson, meta);
console.log(`\ninstitutional dossiers: ${institutional.account_dossiers.length}`);

// Premium market-entry context (additive, fail-closed).
const { deriveResearchInput, producePremiumContext, premiumContextFromEnvelope } = await import("@/lib/intelligence/premium/premium-production");
const premiumEnvelope = await producePremiumContext(deriveResearchInput({ onboardingData, criteria: { target_market_region: "United States" }, companies: institutional.account_dossiers.map((d: any) => d.company) }));
reportJson._premium_context = premiumEnvelope;
writeFileSync(`${OUT}/track-a-merged-report.json`, JSON.stringify({ reportJson, meta, jobState: state }, null, 2));

// ── ONE Gold-Standard Premium artifact (existing visual system; no new renderer) ──
const experience = resolveReportExperience("premium_launch_v0", "en");
const vm = fromInstitutionalReport(institutional, experience);
const doc = { ...fromDeliverableViewModel(vm), premiumContext: premiumContextFromEnvelope(premiumEnvelope) };
const pm = toPresentationModel(doc as any, "premium", "pdf");
const pdf = await renderPdfBuffer(pm as any);
const pdfPath = `${OUT}/LeadLens_TrackA_GoldStandard_Premium.pdf`;
writeFileSync(pdfPath, pdf);
console.log(`\nGOLD-STANDARD ARTIFACT :: ${pdfPath} (${pdf.length} bytes, ${(pm as any).document?.accounts?.length ?? 0} accounts)`);
console.log(`spend this run: $${(usdNow() - startUsd).toFixed(4)} | diagnostics -> ${OUT}/track-a-diagnostics.json`);
console.log("done");
