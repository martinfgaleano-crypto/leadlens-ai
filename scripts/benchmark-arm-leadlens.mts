#!/usr/bin/env node
/**
 * Competitive benchmark — ARM A (LeadLens, FROZEN at dd13f9d). Runs the current pipeline
 * on the frozen neutral 7-company universe: real research + canonical decision
 * (runLeadLensPipeline) → decision-driven commercial-path research (SEC EDGAR for trigger
 * + buyer function; honest not-established for external mechanism/access, per the frozen
 * capability) → synthesizeCase → Path to Prioritize + next action. No Intelligence changes;
 * no manual evidence injection.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const OUT = "output/competitive-benchmark/01_arm_leadlens"; mkdirSync(OUT, { recursive: true });
const UA = { "User-Agent": "LeadLens research experiment founder@example.com", Accept: "application/json" };
const { runLeadLensPipeline } = await import("@/lib/pipeline");
const { canonicalCaseForLead } = await import("@/lib/intelligence/productive-spine");
const { promotePrimarySourceEvent } = await import("@/lib/intelligence/primary-source-event-promotion");
const { synthesizeCase } = await import("@/lib/monitor/canonical-case");
const ddr = await import("@/lib/intelligence/decision-driven-research");
const { derivePathToPrioritize } = await import("@/lib/intelligence/path-to-prioritize");
const { assessAccountEligibility } = await import("@/lib/intelligence/account-eligibility");
const { getUsage } = await import("@/lib/ops/usage-ledger");
const usdNow = () => (getUsage().anthropic?.calculated_cost_usd_today ?? 0);

const UNIVERSE = JSON.parse(readFileSync("output/competitive-benchmark/00_frozen_input/frozen_input.json", "utf8")).candidate_universe;
const onboardingData: any = { company_name: "Meridian Transition Partners", company_description: "Boutique US consultancy specializing in post-merger integration (PMI) operational execution for mid-market industrial manufacturers.", offer_description: "First-120-day post-merger integration of operations, supply chain and ERP for mid-market industrial acquirers.", value_proposition: "Partner-led PMI execution that de-risks the first 120 days of an industrial acquisition.", target_customer_description: "US mid-market industrial / manufacturing companies that recently closed an acquisition and must integrate operations with limited internal PMI capacity.", tone: "consultative", contact_email: "founder@example.com", output_language: "en", target_market_region: "north_america", target_countries: ["United States"], product_code: "premium_launch_v0" };
const objectiveIcp: any = { target_industries: ["Mid-market industrial manufacturer"], target_titles: [], company_size_range: "mid-market", pain_points: [], disqualifiers: ["staffing agency", "recruiting firm"], ideal_signals: ["recent acquisition", "carve-out", "merger"], exclusions_explicit: [], icp_clarity_score: 80 };
const objectiveCriteria: any = { target_industries: ["Mid-market industrial manufacturer"], target_company_size: ["mid-market"], target_job_titles: [], target_geography: ["United States"], excluded_industries: ["staffing", "recruiting"], buying_signals: ["recent acquisition"], disqualification_criteria: objectiveIcp.disqualifiers, offer_summary: "first-120-day post-merger integration for mid-market industrial acquirers", value_proposition: "partner-led PMI execution", tone: "consultative", plan: "pro", lead_count: UNIVERSE.length, require_real_discovery: false, output_language: "en", target_market_region: "north_america" };
const customer: import("@/lib/intelligence/decision-driven-research").ResearchCustomerContext = { service: "post-merger integration (PMI) operational execution", triggerFamily: ["acquisition", "carve-out", "merger"], mechanismHints: ["integration management office", "external integration advisory"], buyerFunctionHints: ["corporate development", "integration management", "operations leadership"], geography: "United States" };
const DAYS = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
async function edgar(phrase: string, forms?: string) { const u = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(phrase)}${forms ? `&forms=${forms}` : ""}`; const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`EDGAR ${r.status}`); const j: any = await r.json(); return { url: u, hits: (j.hits?.hits ?? []).map((h: any) => ({ date: h._source?.file_date ?? null, names: h._source?.display_names ?? [], form: h._source?.root_form ?? null })) }; }
const nameMatch = (names: string[], co: string) => names.some((d) => d.toLowerCase().includes(co.toLowerCase().split(" ")[0]));
function researcher(company: string) {
  return async (o: any) => {
    try {
      if (o.dimension === "trigger" || o.dimension === "counterevidence") {
        const e = await edgar(`"${company}" acquisition`, "8-K");
        const hits = e.hits.filter((h: any) => nameMatch(h.names, company) && h.date).sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
        if (o.dimension === "counterevidence") { if (hits.length && DAYS(hits[0].date) > 730) return { state: "supported", result: `Most recent acquisition 8-K is ${Math.round(DAYS(hits[0].date))}d old (>24mo) — triggered integration likely complete.`, sources: [{ url: e.url, title: "SEC 8-K", date: hits[0].date }] }; return { state: "not_found", result: "No evidence the trigger is stale or in-house.", sources: [], failure: "evidence_not_found" }; }
        if (!hits.length) return { state: "not_found", result: `No acquisition-referencing 8-K in SEC EDGAR for ${company}.`, sources: [{ url: e.url, title: "SEC EDGAR 8-K", date: null }], failure: "evidence_not_found" };
        const age = DAYS(hits[0].date); const cur = age <= 730;
        return { state: cur ? "verified" : "supported", result: `SEC EDGAR: most recent acquisition-referencing 8-K filed ${hits[0].date} (${Math.round(age)}d ago; ${cur ? "current" : ">24mo"}).`, sources: [{ url: e.url, title: "SEC EDGAR 8-K", date: hits[0].date }], dated: hits[0].date };
      }
      if (o.dimension === "buyer_function") { const e = await edgar(`"${company}" "corporate development"`); const hit = e.hits.filter((h: any) => nameMatch(h.names, company) && h.date).sort((a: any, b: any) => (a.date < b.date ? 1 : -1))[0]; if (hit) return { state: "supported", result: `SEC filing (${hit.form ?? "filing"}, ${hit.date}) references a Corporate Development function — plausible owner of post-close integration.`, sources: [{ url: e.url, title: "SEC EDGAR", date: hit.date }] }; return { state: "inferred", result: `By organizational logic Corporate Development / Operations would own post-acquisition integration at ${company}. Inference, not verified.`, sources: [], failure: "evidence_not_found" }; }
      // mechanism/access: frozen capability — honestly not established from free primary sources (not disproven).
      if (o.dimension === "mechanism") return { state: "not_found", result: `No primary-source evidence that ${company} engages EXTERNAL post-merger-integration advisors (not disproven).`, sources: [], failure: "evidence_not_found" };
      return { state: "not_found", result: `No commercial access route established from free primary sources.`, sources: [], failure: "evidence_not_found" };
    } catch (e) { return { state: "unknown", result: `Research failed: ${e instanceof Error ? e.message : e}`, sources: [], failure: "provider_failure" }; }
  };
}

const start = usdNow();
const leads = UNIVERSE.map((s: any, i: number) => ({ id: `bm_${i}_${s.domain}`, company: s.company, domain: s.domain, website_url: `https://${s.domain}`, country: "United States", industry: s.sector, source: "public_signal" as const, confidence_score: 0.8 }));
console.log(`ARM A (LeadLens) — ${leads.length} accounts. spend before: $${start.toFixed(4)}`);
const report: any = await runLeadLensPipeline({ onboardingData, plan: "pro", icpOverride: objectiveIcp, criteriaOverride: objectiveCriteria, candidatesOverride: leads, decisionOnly: true, researchCandidateLimit: leads.length, deliveryLimit: leads.length, researchConcurrency: 3 });
for (const l of report.processed_leads ?? []) promotePrimarySourceEvent(l);
report.canonical_cases = (report.processed_leads ?? []).map((l: any) => canonicalCaseForLead(l)).filter(Boolean);
const byLead = new Map((report.processed_leads ?? []).map((l: any) => [l.id, l]));

const out: any[] = [];
for (const cc of report.canonical_cases) {
  const lead: any = byLead.get(cc.lead_id); if (!lead) continue;
  const company = lead.candidate.company;
  const elig = assessAccountEligibility({ company, industry: lead.candidate.industry ?? null, country: "United States", companySummary: lead.enrichment?.company_summary ?? null }, { geographies: ["United States"], targetRole: "direct_buyer" });
  const beforeInput: any = { accountId: company, identityVerified: true, fromUniverse: true, signalKind: null, signalDate: null, dateConfidence: "none", sourceHost: null, materialEvent: false, hasMaterialCounter: false, openDecisionCritical: ["Is there a current why-now trigger?"], priorFit: cc.fit ?? "Strong", priorTiming: cc.timing ?? "Limited", priorEvidence: cc.evidence ?? "Moderate", independentSupportNew: false, hasPostReviewEvent: false, geographyConfirmed: true, regionRequired: false };
  const objectives = ddr.deriveResearchObjectives({ account: { company, domain: lead.candidate.domain ?? null }, customer, missing: { trigger: true, mechanism: true, buyerFunction: true, access: true }, openDecisionCritical: beforeInput.openDecisionCritical, fit: beforeInput.priorFit });
  const run = await ddr.runResearchAgenda(objectives, { research: researcher(company) });
  const afterInput = ddr.applyFindingsToCaseInput(beforeInput, objectives);
  const after = synthesizeCase(afterInput);
  const dim = (d: string) => objectives.find((o: any) => o.dimension === d);
  const ptp = derivePathToPrioritize({ decision: after.decision, fit: afterInput.priorFit, timing: after.timing, evidence: after.evidence, openDecisionCritical: afterInput.openDecisionCritical, hasMaterialCounter: afterInput.hasMaterialCounter, commercialMechanismVerified: afterInput.channelAccessVerified === true, commercialAccessVerified: afterInput.channelAccessVerified === true, independentlyCorroborated: false });
  out.push({ company, eligible: elig.outcome, decision: after.decision, why_now: dim("trigger")?.result ?? null, buyer_function: `${dim("buyer_function")?.state}: ${dim("buyer_function")?.result}`, external_mechanism: `${dim("mechanism")?.state}: ${dim("mechanism")?.result}`, commercial_access: `${dim("access")?.state}: ${dim("access")?.result}`, counterevidence: dim("counterevidence")?.result, critical_unknowns: afterInput.openDecisionCritical, path_to_prioritize: ptp.reachable ? ptp.conditions : [ptp.rationale], next_action: run.triggerCurrent ? `Validate with Corporate Development whether post-close integration remains active and whether external PMI specialists are used, before allocating outbound effort.` : "No active action — reconsider on a new acquisition/transformation trigger.", trigger_current: run.triggerCurrent, fit: cc.fit, sources: objectives.flatMap((o: any) => o.sources) });
  console.log(`  ${company}: ${after.decision} | why_now=${run.triggerCurrent ? "current" : "none"} buyer=${dim("buyer_function")?.state}`);
}
const dist = out.reduce((m: any, a: any) => ({ ...m, [a.decision]: (m[a.decision] ?? 0) + 1 }), {});
writeFileSync(`${OUT}/leadlens_output.json`, JSON.stringify({ arm: "LeadLens (frozen dd13f9d)", generated_at: new Date().toISOString(), spend_usd: usdNow() - start, decision_distribution: dist, accounts: out }, null, 2));
console.log(`\nARM A dist: ${JSON.stringify(dist)} | spend $${(usdNow() - start).toFixed(4)} -> ${OUT}/leadlens_output.json`);
