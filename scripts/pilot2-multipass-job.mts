#!/usr/bin/env node
/**
 * Pilot 2 — OPERATE the multi-pass customer-job system live on Amor de Gea (US export).
 *
 * This is operational glue (a script), not product code: the generic, tested engine is
 * lib/intelligence/customer-job.ts. Here we bind the real seams and run the job:
 *   Vault-first (vault_companies) → route/geo-diverse discovery (runCompanyFirstDiscovery)
 *   → Vault write-through of every discovered canonical company (accreteDiscoveredCompanies)
 *   → union+dedup+rejection-memory → research+qualify NEW candidates (runLeadLensPipeline)
 *   → accumulate → adapt → repeat. Then assemble ONE institutional report from the merged
 *   per-pass research (no double-research) and render the four canonical V2.4 tiers.
 *
 * No manual account selection. No fabricated data. Truth bar owned by the research pipeline.
 * Provider budget ceiling enforced. Writes PDFs + a redacted job telemetry JSON to OUT.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]) if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const OUT = process.env.LEADLENS_RENDER_OUT || "/tmp/pilot2-multipass";
mkdirSync(OUT, { recursive: true });
const BUDGET = Number(process.env.PILOT2_BUDGET_USD ?? "8");
const MAX_PASSES = Number(process.env.PILOT2_MAX_PASSES ?? "12");

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
const { SupabaseCustomerJobStore } = await import("@/lib/intelligence/customer-job-store");

type DiscoveredCompany = import("@/lib/intelligence/customer-job").DiscoveredCompany;
type PassSpec = import("@/lib/intelligence/customer-job").PassSpec;
type CanonicalCandidate = import("@/lib/intelligence/customer-job").CanonicalCandidate;
type QualifiedAccount = import("@/lib/intelligence/customer-job").QualifiedAccount;
type RejectionMemoryEntry = import("@/lib/intelligence/customer-job").RejectionMemoryEntry;

const db = createServerClient()!;
const usdNow = () => (getUsage().anthropic?.calculated_cost_usd_today ?? 0);

// ── Amor de Gea US objective (constructed; the SAME objective ICP qualifies every pass
//    so decisions stay consistent — discovery breadth comes from per-route slices). ──
const OBJECTIVE_INDUSTRIES = [
  "Specialty food and beverage retail", "Natural and organic grocery",
  "Specialty food importer and distributor", "Wellness hospitality and spa", "Premium gifting",
];
const onboardingData: any = {
  company_name: "Amor de Gea",
  company_description: "Colombian maker of premium botanical wellness beverages in glass bottles.",
  offer_description: "Premium botanical wellness beverages in glass, for US retail/hospitality/gifting channels.",
  value_proposition: "Premium natural positioning; small-batch; glass presentation.",
  target_customer_description: "US premium natural/specialty F&B retailers, wellness hotels/spas, premium gifting companies, and specialty importers of premium natural brands.",
  tone: "consultative", contact_email: "founder@example.com",
  output_language: "en", target_market_region: "north_america",
  target_countries: ["United States"], product_code: "premium_launch_v0",
};
const objectiveIcp: any = {
  target_industries: OBJECTIVE_INDUSTRIES, target_titles: [], company_size_range: "",
  pain_points: [], disqualifiers: ["mass-market discount retailer", "pharmacy", "medical channel", "online marketplace"],
  ideal_signals: [], exclusions_explicit: ["mass-market discount retailer", "pharmacy", "medical channel", "online marketplace"],
  icp_clarity_score: 80,
};
const objectiveCriteria: any = {
  target_industries: OBJECTIVE_INDUSTRIES, target_company_size: [], target_job_titles: [],
  target_geography: ["United States"], excluded_industries: ["mass retail", "pharmacy", "marketplace"],
  buying_signals: [], disqualification_criteria: objectiveIcp.disqualifiers, offer_summary: "", value_proposition: "",
  tone: "consultative", plan: "pro", lead_count: 18, require_real_discovery: true,
  output_language: "en", target_market_region: "north_america",
};

// ── Route × geo pass plan (§31/§36/§37): distinct enumeration per pass for breadth. ──
const ROUTES: Array<{ route: string; industries: string[] }> = [
  { route: "specialty_importer", industries: ["Specialty food importer and distributor", "Natural products importer"] },
  { route: "natural_specialty_retail", industries: ["Natural and organic grocery", "Specialty food and beverage retail"] },
  { route: "wellness_hospitality", industries: ["Wellness resort and spa", "Boutique wellness hotel"] },
  { route: "premium_gifting", industries: ["Premium gifting company", "Corporate gourmet gift company"] },
];
const GEO = (process.env.PILOT2_GEO ?? "United States|Miami Florida|New York Northeast|California").split("|").map((s) => s.trim()).filter(Boolean);
const PASS_PLAN: PassSpec[] = [];
let pid = 0;
for (const g of GEO) for (const r of ROUTES) PASS_PLAN.push({ passId: ++pid, route: r.route, queryFamilyId: `${r.route}:${g.replace(/\s+/g, "_")}`, queries: r.industries, geoCluster: g });

// ── Merge accumulator: every researched pass report, so we assemble ONCE (no re-research). ──
const researchedLeadsById = new Map<string, any>();
const rankedByCompany = new Map<string, any>();
const canonicalByLead = new Map<string, any>();
let lastExecSummary = "";

function leadCandidatesFrom(cands: CanonicalCandidate[]): any[] {
  return cands.map((c, i) => ({
    id: `${c.key}_c${i}`, company: c.company, domain: c.domain ?? undefined,
    website_url: c.domain ? `https://${c.domain}` : undefined, location: c.country ?? undefined,
    country: c.country ?? null, industry: c.industry ?? undefined, source: "public_signal" as const,
    confidence_score: c.domain ? 0.8 : 0.5,
  }));
}

const accretionDeps = await productionVaultAccretionDeps();
const routeMatches = (industry: string | null, route: string): boolean => {
  const t = (industry ?? "").toLowerCase();
  if (route === "specialty_importer") return /import|distribut|broker|wholesale/.test(t);
  if (route === "natural_specialty_retail") return /retail|grocer|grocery|natural|organic|gourmet|specialty|market/.test(t);
  if (route === "wellness_hospitality") return /hotel|spa|resort|wellness|hospitality/.test(t);
  if (route === "premium_gifting") return /gift|gifting|hamper/.test(t);
  return true;
};

const deps = {
  now: () => new Date(),
  vaultFirst: async (spec: PassSpec, state: any): Promise<DiscoveredCompany[]> => {
    try {
      const rows = await listVaultCompanies({ region: "United States" });
      const known = new Set(state.candidates.map((c: any) => c.key));
      return rows
        .filter((r: any) => routeMatches(r.industry ?? null, spec.route))
        .map((r: any) => ({ company: r.name, domain: r.domain ?? null, country: r.country ?? "United States", industry: r.industry ?? null }))
        .filter((c: DiscoveredCompany) => !known.has(cj.canonicalKey(c.company, c.domain)))
        .slice(0, 8);
    } catch { return []; }
  },
  discover: async (spec: PassSpec) => {
    const before = usdNow();
    const routeIcp = { ...objectiveIcp, target_industries: spec.queries };
    const routeCriteria = { ...objectiveCriteria, target_industries: spec.queries, target_geography: [spec.geoCluster ?? "United States"] };
    let discovered: DiscoveredCompany[] = [], providersAttempted: string[] = [], providerState: Record<string, string> = {}, raw = 0;
    try {
      const { metrics } = await runCompanyFirstDiscovery(routeIcp, routeCriteria, "brief", 10, { costCapUsd: 0.4 });
      discovered = (metrics.universe_accounts ?? []).map((a: any) => ({ company: a.company, domain: a.domain ?? null, country: a.country ?? "United States", industry: a.sector ?? null }));
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
      const m = await accreteDiscoveredCompanies(
        companies.map((c) => ({ name: c.company, domain: c.domain, country: c.country, industry: c.industry, sourceUrl: c.sourceUrl ?? null })),
        "customer_run", accretionDeps,
      );
      return { evaluated: m.evaluated, new_companies: m.new_companies, existing_rediscovered: m.existing_rediscovered, rejected_non_account: m.rejected_non_account };
    } catch { return { evaluated: 0, new_companies: 0, existing_rediscovered: 0, rejected_non_account: 0 }; }
  },
  qualify: async (candidates: CanonicalCandidate[]): Promise<{ qualified: QualifiedAccount[]; rejected: RejectionMemoryEntry[] }> => {
    const leads = leadCandidatesFrom(candidates);
    const before = usdNow();
    let report: any;
    try {
      report = await runLeadLensPipeline({
        onboardingData, plan: "pro", icpOverride: objectiveIcp, criteriaOverride: objectiveCriteria,
        candidatesOverride: leads, decisionOnly: true, researchCandidateLimit: leads.length, deliveryLimit: leads.length,
      });
    } catch (e) { console.error("  qualify error:", e instanceof Error ? e.message : e); return { qualified: [], rejected: [] }; }
    // Canonical decision authority (same as the productive spine): the raw pipeline
    // does NOT populate canonical_cases — the spine derives them per lead post-hoc.
    report.canonical_cases = (report.processed_leads ?? []).map((l: any) => canonicalCaseForLead(l)).filter(Boolean);
    console.log(`  qualify: researched ${leads.length}, canonical_cases=${report.canonical_cases.length}, cost $${(usdNow() - before).toFixed(4)}`);
    // Accumulate for the single final assembly (dedup by company).
    for (const l of report.processed_leads ?? []) researchedLeadsById.set(l.id, l);
    for (const o of report.ranked_opportunities ?? []) { const lead = (report.processed_leads ?? []).find((x: any) => x.id === o.lead_id); const co = (lead?.candidate?.company ?? "").toLowerCase(); if (co && !rankedByCompany.has(co)) rankedByCompany.set(co, o); }
    for (const c of report.canonical_cases ?? []) canonicalByLead.set(c.lead_id, c);
    if (typeof report.executive_summary === "string" && report.executive_summary) lastExecSummary = report.executive_summary;
    // Map canonical cases → qualified; researched-but-not-cased → rejection memory.
    const byLead = new Map((report.processed_leads ?? []).map((l: any) => [l.id, l]));
    const qualified: QualifiedAccount[] = [];
    const qualifiedCompanies = new Set<string>();
    for (const cc of report.canonical_cases ?? []) {
      const lead: any = byLead.get(cc.lead_id);
      if (!lead) continue;
      const company = lead.candidate.company; const domain = lead.candidate.domain ?? null;
      const key = cj.canonicalKey(company, domain);
      qualifiedCompanies.add(company.toLowerCase());
      qualified.push({ key, company, domain, route: candidates.find((c) => c.key === key)?.route ?? "unknown", decision: cc.decision, fit: cc.fit, timing: cc.timing, evidenceCount: (lead.enrichment?.evidence_discipline ?? []).length, qualifiedAtPass: candidates[0]?.firstSeenPass ?? 0 });
    }
    const rejected: RejectionMemoryEntry[] = [];
    for (const l of report.processed_leads ?? []) {
      if (qualifiedCompanies.has((l.candidate.company ?? "").toLowerCase())) continue;
      const key = cj.canonicalKey(l.candidate.company, l.candidate.domain ?? null);
      rejected.push({ key, company: l.candidate.company, reason: (l.qualification?.category === "DISCARD" ? "OFF_TARGET_OR_INSUFFICIENT" : "NOT_QUALIFIED"), pass: candidates[0]?.firstSeenPass ?? 0 });
    }
    return { qualified, rejected };
  },
  save: async (state: any) => { try { await new SupabaseCustomerJobStore(db as any).save(state, null); } catch { /* best-effort */ } },
};

// ── Run the job ────────────────────────────────────────────────────────────────
const jobId = `cj_amordegea_pilot2_${Date.now()}`;
let state = cj.newCustomerJobState({ jobId, customer: "Amor de Gea", objective: "US export market entry", contextVersion: 1, geography: "United States", requestedTier: "premium", targetCount: 18 });
console.log(`\n=== CUSTOMER JOB ${jobId} — target 18, budget $${BUDGET}, ${PASS_PLAN.length} planned passes ===`);
state = await cj.runCustomerJob(state, PASS_PLAN, deps as any, { maxPasses: MAX_PASSES, budgetUsd: BUDGET });

console.log(`\n=== JOB DONE :: status=${state.status} passes=${state.passesCompleted} qualified=${state.qualified.length} candidates=${state.candidates.length} spend=$${state.spendUsd.toFixed(4)} ===`);
console.log("qualified:", state.qualified.map((q) => `${q.company}[${q.decision}]`).join(" | ") || "(none)");
console.log("vault:", JSON.stringify(state.vault));
console.log("tierReadiness:", JSON.stringify(state.tierReadiness));

// ── Assemble ONE institutional report from the merged research (only qualified accounts) ──
const qualifiedCompanySet = new Set(state.qualified.map((q) => q.company.toLowerCase()));
const mergedLeads = [...researchedLeadsById.values()].filter((l: any) => qualifiedCompanySet.has((l.candidate.company ?? "").toLowerCase()));
const mergedCanonical = [...canonicalByLead.values()].filter((c: any) => mergedLeads.some((l: any) => l.id === c.lead_id));
const rankWeight = (o: any): number => { const d = mergedCanonical.find((c: any) => c.lead_id === o.lead_id)?.decision; return d === "prioritize" ? 4 : d === "validate" ? 3 : d === "monitor" ? 2 : 1; };
const mergedRanked = [...rankedByCompany.entries()].filter(([co]) => qualifiedCompanySet.has(co)).map(([, o]) => o)
  .sort((a: any, b: any) => rankWeight(b) - rankWeight(a)).map((o: any, i: number) => ({ ...o, rank: i + 1 }));

if (mergedLeads.length === 0) { console.error("\nNo qualified accounts to render — job produced an empty foundation."); writeFileSync(`${OUT}/pilot2-job-telemetry.json`, JSON.stringify(state, null, 2)); process.exit(0); }

const reportJson: any = {
  onboarding: onboardingData, processed_leads: mergedLeads, ranked_opportunities: mergedRanked,
  canonical_cases: mergedCanonical, executive_summary: lastExecSummary || "US commercial-entry account foundation for Amor de Gea (multi-pass).",
};
const meta = { job_id: jobId, plan: "pro", search_id: null, customer_ref: "amor-de-gea", created_at: new Date().toISOString() };
// Persist the merged research BEFORE rendering so a render-only re-run never needs re-research.
writeFileSync(`${OUT}/pilot2-merged-report.json`, JSON.stringify({ reportJson, meta, jobState: state }, null, 2));
const institutional = assembleInstitutionalReport(reportJson, meta);
console.log(`\ninstitutional dossiers: ${institutional.account_dossiers.length}`);

const TIERS: Array<[string, string, string]> = [
  ["preview", "Preview", "preview_launch_v0"], ["brief", "Brief", "brief_launch_v0"],
  ["intelligence", "Portfolio", "intelligence_launch_v0"], ["premium", "Premium", "premium_launch_v0"],
];
const tierOut: any[] = [];
for (const [tier, label, code] of TIERS) {
  const experience = resolveReportExperience(code, "en");
  const vm = fromInstitutionalReport(institutional, experience);
  const doc = { ...fromDeliverableViewModel(vm), premiumContext: null };
  const pm = toPresentationModel(doc as any, tier as any, "pdf");
  const pdf = await renderPdfBuffer(pm as any);
  const path = `${OUT}/LeadLens_AmorDeGea_Pilot2_${label}.pdf`;
  writeFileSync(path, pdf);
  const accounts = (doc as any).accounts?.length ?? institutional.account_dossiers.length;
  console.log(`ok ${label.padEnd(10)} accounts=${accounts} bytes=${pdf.length} -> ${path}`);
  tierOut.push({ tier, label, accounts, bytes: pdf.length, pdf: path });
}

writeFileSync(`${OUT}/pilot2-job-telemetry.json`, JSON.stringify({ job: state, tiers: tierOut, institutional_dossiers: institutional.account_dossiers.length }, null, 2));
console.log(`\ntelemetry :: ${OUT}/pilot2-job-telemetry.json`);
console.log(`jobId (for Admin/resume) :: ${jobId}`);
