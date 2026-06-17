import type {
  OnboardingData,
  PlanType,
  LeadLensReport,
  ProcessedLead,
  LeadCandidate,
  PipelineInput,
} from "@/types";
import { PLAN_LEAD_COUNT } from "@/types";

export type { PipelineInput };

const IS_DEMO = process.env.DEMO_MODE === "true";

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runLeadLensPipeline(input: PipelineInput): Promise<LeadLensReport> {
  const { onboardingData, plan, jobId } = input;
  const id = jobId ?? `job-${Date.now()}`;

  console.log(`[pipeline] starting — plan=${plan} demo=${IS_DEMO}`);

  // Agent 1: ICP
  const { runICPAgent } = await import("./agents/icp-agent");
  const { icp, criteria } = await runICPAgent(onboardingData, plan);
  console.log(`[pipeline] ICP built — industries=${icp.target_industries.join(", ")}`);

  // Agent 2: Lead Finder
  const { runLeadFinderAgent } = await import("./agents/lead-finder-agent");
  const candidates: LeadCandidate[] = await runLeadFinderAgent(criteria);
  console.log(`[pipeline] found ${candidates.length} candidates`);

  // Agents 3–7: Process each lead (research → qualify → personalize → outreach → QC)
  const processedLeads: ProcessedLead[] = [];
  const targetCount = PLAN_LEAD_COUNT[plan];

  for (let i = 0; i < Math.min(candidates.length, targetCount); i++) {
    const candidate = candidates[i];
    try {
      const lead = await processOneLead(candidate, criteria, icp, onboardingData);
      processedLeads.push(lead);
      console.log(`[pipeline] processed lead ${i + 1}/${targetCount}: ${candidate.company}`);
    } catch (err) {
      // One lead failure never kills the batch — add as REVIEW_NEEDED stub
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline] failed to process ${candidate.company}: ${errMsg.slice(0, 120)}`);
      processedLeads.push(buildFailedLead(candidate, errMsg));
    }
  }

  console.log(`[pipeline] ${processedLeads.length} leads processed successfully`);

  // Agent 8: Report
  const { runReportAgent } = await import("./agents/report-agent");
  const report = await runReportAgent(processedLeads, plan, onboardingData, icp, id);

  console.log(`[pipeline] report ready — hot=${report.hot_count} warm=${report.warm_count}`);
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

  // Agent 5: Personalize
  const trigger = await runPersonalizationAgent(qualification, criteria);

  // Agent 6: Outreach
  const outreach = await runOutreachAgent(qualification, trigger, criteria);

  // Agent 7: QC
  const checkedOutreach = await runQCAgent(qualification, outreach);

  return {
    id: candidate.id,
    candidate,
    enrichment,
    qualification,
    outreach: checkedOutreach,
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
  };

  return { id: candidate.id, candidate, enrichment: stub, qualification, outreach };
}
