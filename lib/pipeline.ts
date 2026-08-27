import type {
  OnboardingData,
  PlanType,
  LeadLensReport,
  ProcessedLead,
  LeadCandidate,
  PipelineInput,
  LearningMetadata,
  RiskLevel,
  FeedbackSignal,
} from "@/types";
import { PLAN_LEAD_COUNT } from "@/types";
import { applyLearningHints, applyVaultHints } from "@/lib/learning";

export type { PipelineInput };
export { applyLearningHints, applyVaultHints };

const IS_DEMO = process.env.DEMO_MODE === "true";

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runLeadLensPipeline(input: PipelineInput): Promise<LeadLensReport> {
  const { onboardingData, plan, jobId, searchId } = input;
  const id = jobId ?? `job-${Date.now()}`;

  console.log(`[pipeline] starting — plan=${plan} demo=${IS_DEMO}`);

  const precomputedIntelligence = input.icpOverride && input.criteriaOverride
    ? { icp: input.icpOverride, criteria: input.criteriaOverride }
    : null;
  const { icp, criteria } = precomputedIntelligence ?? await (async () => {
    const { runICPAgent } = await import("./agents/icp-agent");
    return runICPAgent(onboardingData, plan);
  })();
  if (precomputedIntelligence) console.log("[pipeline] reusing prevalidated ICP and criteria — duplicate ICP inference skipped");
  const { assertGeographyContract, enforceCandidateGeography } = await import("./quality/geography-contract");
  assertGeographyContract(onboardingData, criteria);

  // Managed pilots (real clients) force compliant public-web discovery — mock
  // env flags never reach a customer-facing run. Internal QA pilots explicitly
  // mark mock_candidates and keep the mock path.
  const pilotBlock = (onboardingData as { pilot?: { mock_candidates?: boolean } }).pilot;
  if (pilotBlock && pilotBlock.mock_candidates !== true) {
    criteria.require_real_discovery = true;
    console.log("[pipeline] pilot run — forcing real public-signal discovery");
  }
  console.log(`[pipeline] ICP built — industries=${icp.target_industries.join(", ")} clarity=${icp.icp_clarity_score ?? "?"}/100`);

  let candidates: LeadCandidate[];
  if (input.candidatesOverride && input.candidatesOverride.length > 0) {
    // Vault bridge (or other pre-approved source): no provider discovery at all.
    candidates = input.candidatesOverride;
    console.log(`[pipeline] using ${candidates.length} pre-selected candidates (source=${candidates[0].source}) — provider discovery skipped`);
  } else {
    const { runLeadFinderAgent } = await import("./agents/lead-finder-agent");
    candidates = await runLeadFinderAgent(criteria);
    console.log(`[pipeline] found ${candidates.length} candidates`);
  }
  if (onboardingData.target_countries?.length) {
    const before = candidates.length;
    candidates = enforceCandidateGeography(candidates, onboardingData.target_countries);
    console.log(`[pipeline] geography gate — target=${onboardingData.target_countries.join(",")} kept=${candidates.length}/${before}`);
  }
  if (onboardingData.known_accounts?.length) {
    const known = new Set(onboardingData.known_accounts.map(name => name.trim().toLowerCase()));
    const before = candidates.length;
    candidates = candidates.filter(candidate => !known.has(candidate.company.trim().toLowerCase()));
    console.log(`[pipeline] novelty gate — excluded_known_accounts=${before - candidates.length}`);
  }

  // Load vault patterns once — fails gracefully, never blocks the pipeline
  const { loadVaultPatterns } = await import("./vault/feedback-vault");
  const vaultPatterns = await loadVaultPatterns().catch(() => []);
  if (vaultPatterns.length > 0) {
    console.log(`[pipeline] vault: ${vaultPatterns.length} patterns loaded (${vaultPatterns.filter(p => p.vault_ready).length} vault-ready)`);
  }

  const processedLeads: ProcessedLead[] = [];
  // Operating limit resolves from the versioned catalog when the job carries a
  // product_code (launch_tier_architecture_v0); legacy jobs keep PLAN_LEAD_COUNT.
  const { resolveProduct } = await import("@/lib/products/catalog");
  const product = resolveProduct((onboardingData as { product_code?: string }).product_code ?? null);
  const targetCount = product ? product.entitlements.opportunity_target : PLAN_LEAD_COUNT[plan];
  if (product) console.log(`[pipeline] product=${product.product_code} tier=${product.tier} opportunity_target=${targetCount}`);

  const researchCount = Math.min(candidates.length, Math.max(targetCount, input.researchCandidateLimit ?? targetCount));
  for (let i = 0; i < researchCount; i++) {
    const candidate = candidates[i];
    try {
      const checkpoint = input.checkpointDir ? await readLeadCheckpoint(input.checkpointDir, candidate.id) : null;
      const lead = checkpoint ?? await processOneLead(candidate, criteria, icp, onboardingData, input.decisionOnly === true);
      if (!checkpoint && input.checkpointDir) await writeLeadCheckpoint(input.checkpointDir, candidate.id, lead);
      processedLeads.push(lead);
      console.log(`[pipeline] lead ${i + 1}/${researchCount}: ${candidate.company} → ${lead.qualification.category} (${lead.qualification.fit_score}) gen=${lead.outreach.genericness_risk ?? "?"} hal=${lead.outreach.hallucination_risk ?? "?"}${checkpoint ? " checkpoint=reused" : ""}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline] failed to process ${candidate.company}: ${errMsg.slice(0, 120)}`);
      processedLeads.push(buildFailedLead(candidate, errMsg));
    }
  }

  console.log(`[pipeline] ${processedLeads.length} leads processed`);
  input.onResearchComplete?.(structuredClone(processedLeads));

  // Post-qualification vault hint pass — enriches learning metadata, never changes scores
  const leadsAfterVault = applyVaultHints(processedLeads, vaultPatterns);
  const hintCount = leadsAfterVault.filter(l => l.learning?.vault_hint_applied).length;
  if (hintCount > 0) {
    console.log(`[pipeline] vault hints applied to ${hintCount}/${leadsAfterVault.length} leads`);
  }

  // Account Memory pass — classifies novelty, excludes do_not_show (best-effort, never blocks)
  const { loadAccountMemory, applyAccountMemoryHints, updateAccountMemoryFromReport, getClientKey } =
    await import("./memory/account-memory");
  const clientKey  = getClientKey(id);
  const memoryMap  = IS_DEMO
    ? new Map()
    : await loadAccountMemory(candidates, clientKey).catch(() => new Map());
  const leadsForReport = applyAccountMemoryHints(leadsAfterVault, memoryMap);
  const memorizedCount = leadsForReport.filter(l => l.learning?.account_memory_state && l.learning.account_memory_state !== "new_opportunity").length;
  if (memorizedCount > 0) {
    console.log(`[pipeline] account memory: ${memorizedCount} previously-seen accounts classified`);
  }

  // Change Classification — derives ChangeTag from Account Memory (best-effort, never blocks)
  const { applyChangeTagsToLeads, applyChangeSinceLastReportToReport } = await import("./memory/change-classifier");
  const leadsAfterChange = applyChangeTagsToLeads(leadsForReport);
  const changedCount = leadsAfterChange.filter(l => l.learning?.change_tag && l.learning.change_tag !== "new" && l.learning.change_tag !== "unchanged").length;
  if (changedCount > 0) {
    console.log(`[pipeline] change classifier: ${changedCount} accounts with notable change tagged`);
  }

  // Source Access & Freshness Layer v0 — normalizes source metadata per opportunity
  // (best-effort, never blocks; must run after Account Memory, before Evidence Quality)
  const { applySourceFreshnessToLeads, applySourceFreshnessToReport } = await import("./sources/signal-freshness");
  const leadsWithSources = applySourceFreshnessToLeads(leadsAfterChange);
  const sourceCount = leadsWithSources.filter(l => l.learning?.source_layer_applied).length;
  if (sourceCount > 0) {
    console.log(`[pipeline] source layer: ${sourceCount} leads classified`);
  }

  // Evidence Quality pass — classifies evidence level, applies recommended_action guardrails
  // (best-effort, never blocks; reads Source Layer metadata when available)
  const { applyEvidenceQualityHints, applyEvidenceQualityToReport } = await import("./quality/evidence-quality");
  const leadsWithQuality = applyEvidenceQualityHints(leadsWithSources);
  const qualityCount = leadsWithQuality.filter(l => l.learning?.evidence_quality).length;
  const insufficientCount = leadsWithQuality.filter(l => l.learning?.evidence_quality === "insufficient").length;
  if (qualityCount > 0) {
    console.log(`[pipeline] evidence quality: ${qualityCount} leads classified, ${insufficientCount} insufficient`);
  }

  const { runReportAgent } = await import("./agents/report-agent");
  const rawReport = await runReportAgent(leadsWithQuality, plan, onboardingData, icp, id);
  // Source Layer metadata → ranked_opportunities (must run before EQ-to-report so
  // EQ can spread over the already-enriched entries without losing source fields)
  const reportWithSources = applySourceFreshnessToReport(rawReport);
  const reportWithEQ = applyEvidenceQualityToReport(reportWithSources);

  // Phase 2: previous snapshot comparison for true "what changed" deltas.
  // Requires searchId (lead_searches.id) — without it getPreviousCompletedSnapshot
  // returns null and Phase 1B proxy classification takes over. Never does a global
  // lookup; cross-customer/cross-search comparisons are not possible.
  let prevSnapshot: import("@/types").LeadLensReport | null = null;
  if (!IS_DEMO && searchId) {
    try {
      const { getPreviousCompletedSnapshot } = await import("./storage/snapshot-store");
      prevSnapshot = await getPreviousCompletedSnapshot(id, searchId);
      if (prevSnapshot) {
        console.log(`[pipeline] previous snapshot found for search ${searchId} — enabling true change deltas`);
      }
    } catch {
      // best-effort — null is safe; proxy classification takes over
    }
  }

  let report = applyChangeSinceLastReportToReport(reportWithEQ, prevSnapshot);

  // Monitor series context — never affects scoring/ranking. Snapshot rows keep
  // the authoritative search_id; carrying it in the payload gives feedback and
  // debugging the same context without extra lookups.
  if (searchId) report.search_id = searchId;

  // Decision Intelligence — deterministic, explains but never re-decides.
  const { applyDecisionIntelligence } = await import("./quality/opportunity-decision");
  applyDecisionIntelligence(report, leadsWithQuality, candidates.length);

  // Intelligence Foundation — freeze per-opportunity feature snapshots and the
  // decision-versions block into the report. Metadata only; never reordering.
  const { applyIntelligenceFoundation } = await import("./intelligence/feature-snapshot");
  await applyIntelligenceFoundation(report, leadsWithQuality);

  // Selection is downstream from bounded Research: commercial delivery limits
  // never silently reduce how many plausible accounts receive intelligence work.
  report = limitReportDelivery(report, input.deliveryLimit ?? targetCount, candidates.length, researchCount, input.deliveryQualityFloor);
  const deliveredIds = new Set(report.processed_leads.map((lead) => lead.id));
  const deliveredLeads = leadsWithQuality.filter((lead) => deliveredIds.has(lead.id));

  // Write account memory updates after report is built (best-effort, fire-and-forget)
  if (!IS_DEMO) {
    updateAccountMemoryFromReport(deliveredLeads, id, clientKey, memoryMap).catch(() => {});
  }

  // Honest coverage context: attach the discovery operating mode so the report
  // (esp. the empty state) can explain WHY coverage was limited — companies
  // investigated, which providers were down — instead of implying the market
  // was fully searched. Never inflates results; only adds honest context.
  try {
    const { getLastDiscoveryCoverage } = await import("./providers/public-signal-provider");
    const cov = getLastDiscoveryCoverage();
    if (cov && !input.candidatesOverride) {
      (report as { coverage_context?: unknown }).coverage_context = cov;
      if (report.ranked_opportunities?.length === 0 && cov.operating_mode !== "full_discovery") {
        const modeEs: Record<string, string> = { targeted_discovery: "investigación dirigida de empresas verificadas (sin proveedores de búsqueda de mercado)", provider_limited: "packs verticales + URLs conocidas + evidencia previa", stopped: "sin evidencia suficiente", analysis_only: "análisis de evidencia aportada" };
        const note = `Cobertura limitada: esta corrida operó en modo «${modeEs[cov.operating_mode] ?? cov.operating_mode}». Se investigaron ${cov.companies_investigated} empresas verificadas mediante ${cov.fresh_extraction_count} extracciones de fuentes corporativas directas; ninguna presentó un evento material fechado en el período. Esto NO es una búsqueda completa del mercado: sin proveedores de búsqueda (${cov.providers_missing.join(", ")}) es probable que existan señales no vistas. La ausencia de hallazgos no implica ausencia de eventos.`;
        report.executive_summary = `${note}\n\n${report.executive_summary ?? ""}`.trim();
      }
    }
  } catch { /* coverage context is best-effort */ }

  const hotCount = report.hot_count;
  const warnCount = report.strategic_warnings?.length ?? 0;
  console.log(`[pipeline] report ready — hot=${hotCount} warm=${report.warm_count} avg=${report.avg_score} warnings=${warnCount} mode=${(report as { coverage_context?: { operating_mode?: string } }).coverage_context?.operating_mode ?? "?"}`);

  // Minimal experience block for downstream tier/language resolution (brief
  // rendering, entitlement lookups). Only product + language — never PII.
  (report as { onboarding?: { product_code?: string; output_language?: string } }).onboarding = {
    product_code: (onboardingData as { product_code?: string }).product_code,
    output_language: onboardingData.output_language ?? "en",
  };

  return report;
}

function limitReportDelivery(report: LeadLensReport, limit: number, considered: number, researched: number, floor?: "warm"): LeadLensReport {
  const bounded = Math.max(0, Math.floor(limit));
  const eligibleIds = new Set(report.processed_leads.filter(lead => floor !== "warm" || lead.qualification.category === "HOT" || lead.qualification.category === "WARM").map(lead => lead.id));
  const ranked = [...(report.ranked_opportunities ?? [])].filter(item => eligibleIds.has(item.lead_id)).sort((a, b) => a.rank - b.rank).slice(0, bounded);
  const selected = new Set(ranked.map((item) => item.lead_id));
  const leads = report.ranked_opportunities
    ? report.processed_leads.filter((lead) => selected.has(lead.id))
    : report.processed_leads.filter(lead => eligibleIds.has(lead.id)).slice(0, bounded);
  const counts = { HOT: 0, WARM: 0, COLD: 0, DISCARD: 0 };
  for (const lead of leads) counts[lead.qualification.category]++;
  const avg = leads.length ? leads.reduce((sum, lead) => sum + lead.qualification.fit_score, 0) / leads.length : 0;
  return {
    ...report,
    processed_leads: leads,
    ranked_opportunities: ranked,
    total_leads: leads.length,
    hot_count: counts.HOT,
    warm_count: counts.WARM,
    cold_count: counts.COLD,
    discard_count: counts.DISCARD,
    avg_score: Math.round(avg * 10) / 10,
    report_intelligence: {
      ...(report.report_intelligence ?? { rejection_reasons: {} }),
      companies_considered: considered,
      companies_selected: leads.length,
      companies_rejected: Math.max(0, researched - leads.length),
    },
  };
}

async function readLeadCheckpoint(dir: string, candidateId: string): Promise<ProcessedLead | null> {
  try {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const file = join(dir, `${candidateId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as ProcessedLead : null;
  } catch { return null; }
}

async function writeLeadCheckpoint(dir: string, candidateId: string, lead: ProcessedLead): Promise<void> {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${candidateId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  writeFileSync(file, `${JSON.stringify(lead, null, 2)}\n`);
}

// ─── Single-lead processing ───────────────────────────────────────────────────

async function processOneLead(
  candidate: LeadCandidate,
  criteria: import("@/types").LeadSearchCriteria,
  icp: import("@/types").ICP,
  onboarding: OnboardingData,
  decisionOnly = false,
): Promise<ProcessedLead> {
  const { runResearchAgent } = await import("./agents/research-agent");
  const { runQualificationAgent } = await import("./agents/qualification-agent");
  const { runPersonalizationAgent, buildDeterministicPersonalization } = await import("./agents/personalization-agent");
  const { runOutreachAgent, buildDeterministicOutreach } = await import("./agents/outreach-agent");
  const { runQCAgent } = await import("./agents/qc-agent");

  // Agent 3: Research
  const enrichment = await runResearchAgent(candidate, criteria);

  // Agent 4: Qualify
  const qualification = await runQualificationAgent(enrichment, icp, criteria.output_language ?? "en");

  // Agent 5: Personalize — now returns PersonalizationResult
  const personalization = decisionOnly
    ? buildDeterministicPersonalization(qualification, criteria)
    : await runPersonalizationAgent(qualification, criteria);

  // Agent 6: Outreach — receives full PersonalizationResult
  const outreach = decisionOnly
    ? buildDeterministicOutreach(qualification, personalization, criteria)
    : await runOutreachAgent(qualification, personalization, criteria);

  // Agent 7: QC — criteria passed for buyer/seller confusion detection
  const checkedOutreach = decisionOnly ? outreach : await runQCAgent(qualification, outreach, criteria);

  // Post-QC repair — deterministic fix for common known issues (max 1 pass, no extra API call)
  const { repairOutreachIfNeeded } = await import("./agents/outreach-agent");
  const repairedOutreach = repairOutreachIfNeeded(checkedOutreach, criteria, qualification);

  // Build learning metadata from all agent outputs
  const learning = buildLearningMetadata(candidate, enrichment, qualification, repairedOutreach, personalization);

  return {
    id: candidate.id,
    candidate,
    enrichment,
    qualification,
    outreach: repairedOutreach,
    learning,
  };
}

// ─── Learning metadata builder ────────────────────────────────────────────────

function buildLearningMetadata(
  candidate: LeadCandidate,
  enrichment: import("@/types").EnrichedLead,
  qualification: import("@/types").QualifiedLead,
  outreach: import("@/types").OutreachSequence,
  personalization: import("@/types").PersonalizationResult
): LearningMetadata {
  const agentConfidence = (enrichment.research_confidence + qualification.qualification_confidence) / 2;

  // Evidence discipline summary
  const discipline = enrichment.evidence_discipline ?? [];
  const verifiedCount = discipline.filter(e => e.type === "verified_public_signal").length;
  const missingCount = discipline.filter(e => e.type === "missing_evidence").length;
  const evidence_discipline_summary: "verified" | "mostly_inferred" | "weak" =
    verifiedCount >= 1 ? "verified" :
    missingCount >= 2 ? "weak" :
    "mostly_inferred";

  // Confirmed timing signals (non-generic)
  const signal_patterns = enrichment.timing_signals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );

  // Aggregate improvement notes from QC
  const improvement_notes = [
    ...(outreach.improvement_notes ?? []),
    ...(enrichment.risks_weaknesses ?? []).slice(0, 1),
  ].filter(Boolean);

  // Pattern worth reusing (if high score + confirmed signal)
  let reusable_pattern: string | undefined;
  if (qualification.fit_score >= 7 && signal_patterns.length > 0 && candidate.industry) {
    reusable_pattern = `HOT/WARM ${candidate.industry} account with signal: ${signal_patterns[0]?.slice(0, 80)}`;
  }

  // Offer-market fit pattern — what this account teaches about ICP-offer alignment
  let offer_market_fit_pattern: string | undefined;
  if (signal_patterns.length > 0 && candidate.industry) {
    const signalSummary = signal_patterns[0]?.slice(0, 60) ?? "confirmed signal";
    offer_market_fit_pattern = `${candidate.industry} account + "${signalSummary}" → ICP fit score ${qualification.fit_score}/10`;
  }

  // Reason for priority / demotion
  const isPriority = qualification.fit_score >= 7.0;
  const reason_for_priority = isPriority
    ? (qualification.opportunity_tier_reason ?? `Score ${qualification.fit_score}/10 with ${signal_patterns.length > 0 ? "confirmed signal" : "strong ICP fit"}`)
    : undefined;
  const reason_for_demotion = !isPriority
    ? (qualification.disqualification_reasons[0] ?? `Score ${qualification.fit_score}/10 — below priority threshold`)
    : undefined;

  // Predicted learning value
  const predicted_learning_value: "high" | "medium" | "low" =
    qualification.fit_score >= 7 && signal_patterns.length > 0 ? "high" :
    qualification.fit_score >= 5 ? "medium" :
    "low";

  // Feedback hooks — which feedback signals make sense for this account
  const feedback_hooks: FeedbackSignal[] = ["useful", "not_useful", "wrong_fit"];
  if (qualification.category === "HOT" || qualification.category === "WARM") {
    feedback_hooks.push("contacted", "meeting_booked", "replied", "add_to_vault");
  }
  if (qualification.category === "COLD" || qualification.category === "DISCARD") {
    feedback_hooks.push("exclude_similar");
  }

  return {
    agent_confidence: parseFloat(agentConfidence.toFixed(2)),
    qc_flags: outreach.qc_notes,
    genericness_risk: (outreach.genericness_risk ?? "medium") as RiskLevel,
    hallucination_risk: (outreach.hallucination_risk ?? "low") as RiskLevel,
    evidence_discipline_summary,
    signal_patterns,
    segment_pattern: candidate.industry,
    improvement_notes,
    reusable_pattern,
    offer_market_fit_pattern,
    reason_for_priority,
    reason_for_demotion,
    predicted_learning_value,
    feedback_hooks,
    // Future feedback fields — not yet collected in UI
    user_feedback: undefined,
    feedback_notes: undefined,
    rejected_reason: undefined,
  };
}

// ─── Fallback stub for leads that failed processing ───────────────────────────

function buildFailedLead(candidate: LeadCandidate, errorMsg: string): ProcessedLead {
  const stub: import("@/types").EnrichedLead = {
    candidate,
    company_summary: `${candidate.company} — processing failed`,
    role_relevance: "Could not enrich — manual review required",
    inferred_pain: "",
    timing_signals: [],
    evidence: [],
    missing_data: ["Lead processing failed — see qc_notes for details"],
    research_confidence: 0,
    why_now: undefined,
    pain_hypothesis: undefined,
    risks_weaknesses: ["Processing error — data not available"],
    evidence_discipline: [],
  };

  const qualification: import("@/types").QualifiedLead = {
    enrichment: stub,
    fit_score: 0,
    category: "DISCARD",
    fit_reasons: [],
    disqualification_reasons: ["Processing error — manual review required"],
    qualification_confidence: 0,
    score_breakdown: {
      role_fit: 0, company_fit: 0, pain_fit: 0,
      timing_signal: 0, reachability: 0, strategic_relevance: 0,
    },
    score_dimensions: {
      icp_fit: 0, signal_strength: 0, timing: 0,
      evidence_quality: 0, strategic_value: 0, confidence: 0,
      disqualification_risk: 100,
    },
    score_explanation: `Score 0/10 → DISCARD. Processing error — could not analyze this account.`,
  };

  const outreach: import("@/types").OutreachSequence = {
    personalization_trigger: "",
    subject: "",
    email_body: "",
    linkedin_dm: "",
    followup_1: "",
    followup_2: "",
    tone: "direct",
    qc_status: "REVIEW_NEEDED",
    qc_notes: [`Processing error: ${errorMsg.slice(0, 200)}`],
    genericness_risk: "high",
    hallucination_risk: "low",
    evidence_weakness: "high",
    improvement_notes: ["Retry processing this account — it encountered an error"],
  };

  const learning: LearningMetadata = {
    agent_confidence: 0,
    qc_flags: outreach.qc_notes,
    genericness_risk: "high",
    hallucination_risk: "low",
    evidence_discipline_summary: "weak",
    signal_patterns: [],
    segment_pattern: candidate.industry,
    improvement_notes: ["Processing error — retry or investigate"],
    rejected_reason: `Processing error: ${errorMsg.slice(0, 100)}`,
  };

  return { id: candidate.id, candidate, enrichment: stub, qualification, outreach, learning };
}
