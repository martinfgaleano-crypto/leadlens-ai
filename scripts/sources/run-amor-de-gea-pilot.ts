import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ICP, LeadSearchCriteria, OnboardingData } from "@/types";

loadEnvConfig(process.cwd());
process.env.ALLOW_MOCK_LEADS_WITH_REAL_AI = "false";
process.env.DEMO_MODE = "false";

const budget = Number(process.env.PILOT_E2E_MAX_USD ?? "0");
if (!Number.isFinite(budget) || budget <= 0 || budget > 5) {
  console.error("STOPPED: PILOT_E2E_MAX_USD must be explicitly set between 0 and 5.");
  process.exit(2);
}

const phase = process.env.AMOR_PILOT_PHASE === "full" ? "full" : "discovery";
const discoveryTier = ["preview", "brief", "intelligence"].includes(process.env.AMOR_DISCOVERY_TIER ?? "") ? process.env.AMOR_DISCOVERY_TIER! : "preview";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = process.env.AMOR_RUN_DIR || join("ml", "data", "pilot-amor-de-gea", stamp);
const checkpointDir = process.env.AMOR_CHECKPOINT_DIR || join(runDir, "checkpoints");
mkdirSync(runDir, { recursive: true });

const icp: ICP = {
  target_industries: ["natural products retailers, wellness hospitality, spas and resorts"],
  target_titles: ["head of procurement", "food and beverage director", "wellness director", "category manager"],
  company_size_range: "mid-market to enterprise",
  pain_points: ["differentiate wellness assortment", "add functional non-alcoholic beverages", "serve sleep, energy and digestive wellness routines"],
  disqualifiers: ["does not sell or serve ingestible products", "food and beverage fully controlled by an unrelated third party", "defunct or permanently closed"],
  ideal_signals: ["new store or resort opening", "new wellness program", "spa expansion", "wellness brand partnership", "natural product assortment expansion"],
  product_detected: "Herbal extract wellness beverages for sleep, energy and digestive routines.",
  problem_solved: "Adds differentiated functional beverages to retail and hospitality wellness experiences.",
  buyer_profile: "Procurement, category, F&B or wellness leader responsible for selecting guest/customer products.",
  icp_clarity_score: 82,
  icp_risks: ["US food/beverage compliance and distributor requirements are unknown", "some hospitality properties outsource F&B procurement"],
  top_priority_signals: ["new wellness program", "new property/store opening", "wellness partnership"],
};

const criteria: LeadSearchCriteria = {
  target_industries: icp.target_industries,
  target_company_size: ["mid-market", "enterprise"],
  target_job_titles: icp.target_titles,
  target_geography: ["Colombia"],
  excluded_industries: ["medical providers", "government", "non-profit"],
  buying_signals: icp.ideal_signals,
  disqualification_criteria: icp.disqualifiers,
  offer_summary: "Shelf-stable herbal extract wellness beverages supporting sleep and relaxation, morning energy, and digestive care.",
  value_proposition: "A differentiated natural beverage ritual for retailers, spas, hotels and resorts seeking practical everyday wellbeing products.",
  tone: "consultative",
  plan: "sample",
  lead_count: 2,
  output_language: "es",
  target_market_region: "latin_america",
  outreach_language: "Spanish",
  localization_notes: "Colombia only; validate INVIMA, national distribution coverage, cold-chain/shelf-life requirements and retailer or hospitality supplier onboarding before outreach.",
  sender_company_name: "Amor de Gea",
  sender_company_description: "Colombian wellbeing brand producing herbal extract beverages for everyday healthy routines.",
  excluded_account_names: ["Moli Natural", "Supernat"],
} as LeadSearchCriteria;

async function main() {
  const { getUsage } = await import("@/lib/ops/usage-ledger");
  const knownAccounts = ["Grupo Éxito", "Carulla", "Olímpica", "Farmatodo Colombia", "Cruz Verde Colombia", "PriceSmart Colombia", "Makro Colombia"];
  const previousPilotAccounts = criteria.excluded_account_names ?? [];
  const targetCountries = ["Colombia"];
  const usageBefore = getUsage().anthropic;
  const beforeInput = usageBefore?.input_tokens_today ?? 0;
  const beforeOutput = usageBefore?.output_tokens_today ?? 0;
  const beforeCost = usageBefore?.calculated_cost_usd_today ?? 0;
  // Default split reserves headroom for search/extraction providers. The prior
  // default (llmBudget = full budget) left provider_budget_usd = 0, so discovery
  // got a $0 cost cap and ANY non-zero discovery cost tripped failed_budget_guard
  // — the run could never complete unless PILOT_LLM_MAX_USD was set manually.
  // 60% LLM / 40% providers matches the tested value-contract pattern (LLM is the
  // smaller, bounded cost in discovery; providers/extraction are the variable part).
  const llmBudget = Number(process.env.PILOT_LLM_MAX_USD ?? Number((budget * 0.6).toFixed(6)));
  if (!Number.isFinite(llmBudget) || llmBudget < 0 || llmBudget > budget) throw new Error("PILOT_LLM_MAX_USD must be between 0 and the total pilot cap.");
  const { evaluatePilotValueContract } = await import("@/lib/ops/pilot-preflight");
  const valueContract = evaluatePilotValueContract({ target_countries: targetCountries, known_accounts: knownAccounts, minimum_novel_opportunities: 2, minimum_dynamic_opportunities: 1, maximum_obvious_accounts: 0, total_budget_usd: budget, llm_budget_usd: llmBudget });
  if (!valueContract.ready) throw new Error(`PILOT_VALUE_CONTRACT_BLOCKED: ${valueContract.blockers.join(" ")}`);
  process.env.LEADLENS_LLM_BUDGET_USD = String(llmBudget);
  process.env.LEADLENS_LLM_COST_BASELINE_USD = String(beforeCost);
  if (criteria.target_geography.length !== 1 || criteria.target_geography[0] !== targetCountries[0]) {
    throw new Error(`GEOGRAPHY_CONTRACT_MISMATCH: Amor de Gea must target Colombia only.`);
  }
  const { runCompanyFirstDiscovery } = await import("@/lib/discovery/company-first-discovery");
  const reusePath = process.env.AMOR_DISCOVERY_PATH;
  const discovery = reusePath && existsSync(reusePath)
    ? JSON.parse(readFileSync(reusePath, "utf8")) as Awaited<ReturnType<typeof runCompanyFirstDiscovery>>
    : await runCompanyFirstDiscovery(icp, criteria, discoveryTier, 5, { costCapUsd: valueContract.provider_budget_usd });
  const { enforceCandidateGeography } = await import("@/lib/quality/geography-contract");
  const candidatesBeforeGeographyGate = discovery.candidates.length;
  discovery.candidates = enforceCandidateGeography(discovery.candidates, targetCountries);
  const candidatesAfterGeographyGate = discovery.candidates.length;
  const known = new Set(knownAccounts.map(name => name.toLowerCase()));
  const candidatesBeforeNoveltyGate = discovery.candidates.length;
  discovery.candidates = discovery.candidates.filter(candidate => !known.has(candidate.company.toLowerCase()));
  const novelCandidates = discovery.candidates.filter(candidate => candidate.account_visibility !== "obvious" && candidate.discovery_value !== "low"
    && (candidate.opportunity_kind === "timing_signal" || (candidate.opportunity_kind === "channel_fit" && ["strong", "moderate"].includes(candidate.channel_evidence_grade ?? ""))));
  const dynamicNovelCandidates = novelCandidates.filter(candidate => candidate.discovery_origin === "dynamic_enumeration");
  const { sanitizePublicContent } = await import("@/lib/security/public-content-sanitizer");
  discovery.candidates = discovery.candidates.map(candidate => ({ ...candidate, raw_context: sanitizePublicContent(candidate.raw_context ?? "") }));
  writeFileSync(join(runDir, "discovery.json"), `${JSON.stringify(discovery, null, 2)}\n`);

  const manifest: Record<string, unknown> = {
    version: "amor-de-gea-pilot-v1", phase, ran_at: new Date().toISOString(), budget_cap_usd: budget,
    llm_budget_cap_usd: llmBudget,
    discovery_tier: discoveryTier,
    value_contract: { minimum_novel_opportunities: 2, minimum_dynamic_opportunities: 1, maximum_obvious_accounts: 0, provider_budget_cap_usd: valueContract.provider_budget_usd },
    mock_disabled: true, candidates: discovery.candidates.length, discovery_reused: !!reusePath, estimated_discovery_cost_usd: reusePath ? 0 : discovery.metrics.est_cost_usd,
    operating_mode: discovery.metrics.operating_mode, error_taxonomy: discovery.metrics.error_taxonomy,
    universe_quality: discovery.metrics.universe_quality,
    channel_evidence_grades: discovery.metrics.channel_evidence_grades,
    discovery_output_quality: {
      emitted: discovery.metrics.emitted,
      defensible: discovery.metrics.defensible_emitted,
      preliminary: discovery.metrics.preliminary_emitted,
      dynamic_emitted: discovery.metrics.dynamic_emitted,
      dynamic_defensible: discovery.metrics.dynamic_defensible_emitted,
    },
    universe_origin_counts: discovery.metrics.universe_origin_counts,
    universe_role_counts: discovery.metrics.universe_role_counts,
    search_trace_queries: discovery.metrics.search_trace.length,
    target_countries: targetCountries,
    candidates_before_geography_gate: candidatesBeforeGeographyGate,
    candidates_rejected_wrong_geography: candidatesBeforeGeographyGate - candidatesAfterGeographyGate,
    known_accounts_excluded: knownAccounts,
    candidates_rejected_known_account: candidatesBeforeNoveltyGate - discovery.candidates.length,
    status: phase === "full" ? "discovery_ready" : "completed",
  };
  if (novelCandidates.length < 2) {
    manifest.status = "insufficient_novel_opportunities";
    manifest.delivery_decision = "do_not_deliver";
    manifest.novel_opportunity_count = novelCandidates.length;
  }
  if (dynamicNovelCandidates.length < 1) {
    manifest.status = "insufficient_dynamic_opportunities";
    manifest.delivery_decision = "do_not_deliver";
    manifest.dynamic_opportunity_count = dynamicNovelCandidates.length;
  }
  if (discovery.metrics.universe_quality.status === "weak") {
    manifest.status = "weak_buyer_universe";
    manifest.delivery_decision = "do_not_deliver";
    manifest.universe_quality_blockers = discovery.metrics.universe_quality.blockers;
  }
  if (discovery.metrics.operating_mode === "provider_limited") {
    manifest.status = "provider_coverage_insufficient";
    manifest.delivery_decision = "do_not_deliver";
    manifest.provider_coverage = { available: discovery.metrics.providers_available, missing: discovery.metrics.providers_missing };
  }
  if (!reusePath && discovery.metrics.est_cost_usd > budget - llmBudget + 0.000001) {
    manifest.status = "failed_budget_guard";
    manifest.delivery_decision = "do_not_continue";
  }
  const manifestPath = join(runDir, "manifest.json");
  // Persist progress before expensive stages. An interrupted provider call must
  // never leave an ambiguous directory that looks like a successful pilot.
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (phase === "full") {
    const estimatedFullCost = null;
    if (discovery.candidates.length === 0) throw new Error("No defensible candidates survived discovery; full report was not generated.");
    if (novelCandidates.length < 2) throw new Error(`Paid-value gate blocked report generation: only ${novelCandidates.length}/2 novel opportunities survived.`);
    if (dynamicNovelCandidates.length < 1) throw new Error("Dynamic-value gate blocked report generation: no defensible opportunity originated in live company enumeration.");
    if (discovery.metrics.operating_mode === "provider_limited") throw new Error(`Provider-coverage gate blocked report generation: only ${discovery.metrics.providers_available.join(", ") || "no provider"} returned usable results.`);
    const onboarding: OnboardingData = {
      company_name: "Amor de Gea",
      company_description: criteria.sender_company_description ?? "Wellbeing beverage brand.",
      offer_description: criteria.offer_summary ?? "Herbal wellness beverages.",
      value_proposition: criteria.value_proposition ?? "Differentiated wellbeing routines.",
      target_customer_description: "Empresas medianas y grandes que operan en Colombia: retailers de productos naturales, spas, hoteles y resorts con responsabilidad directa sobre productos wellness o alimentos y bebidas.",
      tone: "consultative", contact_email: "", output_language: "es", target_market_region: "latin_america", target_countries: ["Colombia"], known_accounts: knownAccounts, product_code: "preview_launch_v0",
    };
    const { runLeadLensPipeline } = await import("@/lib/pipeline");
    const { completeSnapshot, createProcessingSnapshot, failSnapshot } = await import("@/lib/storage/snapshot-store");
    const reportJobId = `amor-de-gea-${stamp}`;
    const processingSnapshotId = await createProcessingSnapshot(reportJobId, "sample");
    if (!processingSnapshotId) throw new Error("Admin Portal persistence unavailable: could not create the processing snapshot.");
    manifest.admin_portal = { job_id: reportJobId, snapshot_id: processingSnapshotId, status: "processing", path: "/admin/snapshots" };
    manifest.status = "generating_report";
    manifest.report_started_at = new Date().toISOString();
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    let report: Awaited<ReturnType<typeof runLeadLensPipeline>>;
    try {
      report = await runLeadLensPipeline({ onboardingData: onboarding, plan: "sample", jobId: reportJobId, candidatesOverride: discovery.candidates, icpOverride: icp, criteriaOverride: criteria, decisionOnly: true, checkpointDir });
    } catch (error) {
      await failSnapshot(reportJobId, "sample", error instanceof Error ? error.message.slice(0, 300) : "Pilot report generation failed.");
      manifest.status = "failed";
      manifest.failed_stage = "report_generation";
      manifest.failed_at = new Date().toISOString();
      manifest.error = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      throw error;
    }
    const { buildMarketLandscape } = await import("@/lib/reports/market-landscape");
    Object.assign(report, {
      market_landscape: buildMarketLandscape({
        discovery,
        report,
        knownAccounts,
        previousAccounts: previousPilotAccounts,
        geography: targetCountries,
        categoryQuery: criteria.offer_summary ?? icp.product_detected ?? "Bebidas herbales naturales de bienestar",
      }),
    });
    writeFileSync(join(runDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (report.delivery_readiness?.status === "blocked") {
      await failSnapshot(reportJobId, "sample", `Report delivery blocked: ${(report.delivery_readiness.reasons ?? []).join(" ").slice(0, 240)}`);
      manifest.status = "failed_report_quality";
      manifest.delivery_decision = "do_not_deliver";
      manifest.delivery_readiness = report.delivery_readiness;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      throw new Error("Report quality gate blocked Admin Portal completion; local report retained for diagnosis.");
    }
    const completedSnapshotId = await completeSnapshot(reportJobId, "sample", report);
    if (!completedSnapshotId) {
      await failSnapshot(reportJobId, "sample", "Generated report could not be persisted for Admin Portal review.");
      throw new Error("Report generated locally but Admin Portal persistence failed; delivery remains blocked.");
    }
    manifest.report = "report.json";
    manifest.admin_portal = { job_id: reportJobId, snapshot_id: completedSnapshotId, status: "completed", path: "/admin/snapshots" };
    manifest.estimated_full_cost_cap_usd = estimatedFullCost;
    manifest.cost_control = "token-metered list-price guard; no fixed $0.95 assumption";
    manifest.delivery_readiness = report.delivery_readiness;
    manifest.actionability = report.actionability_summary;
    manifest.status = "completed";
    manifest.report_completed_at = new Date().toISOString();
  }

  const usageAfter = getUsage().anthropic;
  manifest.llm_usage_observed = {
    model: usageAfter?.pricing_model ?? null,
    input_tokens: Math.max(0, (usageAfter?.input_tokens_today ?? 0) - beforeInput),
    output_tokens: Math.max(0, (usageAfter?.output_tokens_today ?? 0) - beforeOutput),
    calculated_list_cost_usd: Number(Math.max(0, (usageAfter?.calculated_cost_usd_today ?? 0) - beforeCost).toFixed(8)),
    pricing_source: usageAfter?.pricing_source ?? null,
    billed_cost_usd: null,
    billed_cost_status: "unavailable_without_provider_invoice",
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ run_dir: runDir, ...manifest, emitted: discovery.candidates.map(c => ({ company: c.company, date: c.signal_date, source_url: c.source_url })) }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
