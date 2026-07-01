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
  const { onboardingData, plan, jobId } = input;
  const id = jobId ?? `job-${Date.now()}`;

  console.log(`[pipeline] starting — plan=${plan} demo=${IS_DEMO}`);

  const { runICPAgent } = await import("./agents/icp-agent");
  const { icp, criteria } = await runICPAgent(onboardingData, plan);
  console.log(`[pipeline] ICP built — industries=${icp.target_industries.join(", ")} clarity=${icp.icp_clarity_score ?? "?"}/100`);

  const { runLeadFinderAgent } = await import("./agents/lead-finder-agent");
  const candidates: LeadCandidate[] = await runLeadFinderAgent(criteria);
  console.log(`[pipeline] found ${candidates.length} candidates`);

  // Load vault patterns once — fails gracefully, never blocks the pipeline
  const { loadVaultPatterns } = await import("./vault/feedback-vault");
  const vaultPatterns = await loadVaultPatterns().catch(() => []);
  if (vaultPatterns.length > 0) {
    console.log(`[pipeline] vault: ${vaultPatterns.length} patterns loaded (${vaultPatterns.filter(p => p.vault_ready).length} vault-ready)`);
  }

  const processedLeads: ProcessedLead[] = [];
  const targetCount = PLAN_LEAD_COUNT[plan];

  for (let i = 0; i < Math.min(candidates.length, targetCount); i++) {
    const candidate = candidates[i];
    try {
      const lead = await processOneLead(candidate, criteria, icp, onboardingData);
      processedLeads.push(lead);
      console.log(`[pipeline] lead ${i + 1}/${targetCount}: ${candidate.company} → ${lead.qualification.category} (${lead.qualification.fit_score}) gen=${lead.outreach.genericness_risk ?? "?"} hal=${lead.outreach.hallucination_risk ?? "?"}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline] failed to process ${candidate.company}: ${errMsg.slice(0, 120)}`);
      processedLeads.push(buildFailedLead(candidate, errMsg));
    }
  }

  console.log(`[pipeline] ${processedLeads.length} leads processed`);

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

  // Source Access & Freshness Layer v0 — normalizes source metadata per opportunity
  // (best-effort, never blocks; must run after Account Memory, before Evidence Quality)
  const { applySourceFreshnessToLeads, applySourceFreshnessToReport } = await import("./sources/signal-freshness");
  const leadsWithSources = applySourceFreshnessToLeads(leadsForReport);
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
  const report = applyEvidenceQualityToReport(reportWithSources);

  // Write account memory updates after report is built (best-effort, fire-and-forget)
  if (!IS_DEMO) {
    updateAccountMemoryFromReport(leadsWithQuality, id, clientKey, memoryMap).catch(() => {});
  }

  const hotCount = report.hot_count;
  const warnCount = report.strategic_warnings?.length ?? 0;
  console.log(`[pipeline] report ready — hot=${hotCount} warm=${report.warm_count} avg=${report.avg_score} warnings=${warnCount}`);

  return report;
}

// ─── Single-lead processing ───────────────────────────────────────────────────

async function processOneLead(
  candidate: LeadCandidate,
  criteria: import("@/types").LeadSearchCriteria,
  icp: import("@/types").ICP,
  onboarding: OnboardingData
): Promise<ProcessedLead> {
  const { runResearchAgent } = await import("./agents/research-agent");
  const { runQualificationAgent } = await import("./agents/qualification-agent");
  const { runPersonalizationAgent } = await import("./agents/personalization-agent");
  const { runOutreachAgent } = await import("./agents/outreach-agent");
  const { runQCAgent } = await import("./agents/qc-agent");

  // Agent 3: Research
  const enrichment = await runResearchAgent(candidate, criteria);

  // Agent 4: Qualify
  const qualification = await runQualificationAgent(enrichment, icp);

  // Agent 5: Personalize — now returns PersonalizationResult
  const personalization = await runPersonalizationAgent(qualification, criteria);

  // Agent 6: Outreach — receives full PersonalizationResult
  const outreach = await runOutreachAgent(qualification, personalization, criteria);

  // Agent 7: QC — criteria passed for buyer/seller confusion detection
  const checkedOutreach = await runQCAgent(qualification, outreach, criteria);

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
