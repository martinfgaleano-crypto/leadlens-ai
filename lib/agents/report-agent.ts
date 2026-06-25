import type { ProcessedLead, LeadLensReport, PlanType, OnboardingData, ICP } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

/**
 * Assembles the final LeadLensReport from all processed leads.
 * In DEMO_MODE: deterministic summary.
 * In production: Claude generates executive_summary and patterns.
 */
export async function runReportAgent(
  leads: ProcessedLead[],
  plan: PlanType,
  onboarding: OnboardingData,
  icp: ICP,
  jobId: string
): Promise<LeadLensReport> {
  const hot = leads.filter(l => l.qualification.fit_score >= 8);
  const warm = leads.filter(l => l.qualification.fit_score >= 6 && l.qualification.fit_score < 8);
  const cold = leads.filter(l => l.qualification.fit_score >= 4 && l.qualification.fit_score < 6);
  const discard = leads.filter(l => l.qualification.fit_score < 4);
  const avgScore = leads.length > 0
    ? parseFloat((leads.reduce((s, l) => s + l.qualification.fit_score, 0) / leads.length).toFixed(1))
    : 0;

  const highConfidence = leads.filter(l => l.candidate.confidence_score >= 0.75).length;

  const patterns = buildPatterns(leads, hot, warm, highConfidence);
  const recommendations = buildRecommendations(leads, hot, warm, cold);

  const executive_summary = IS_DEMO || !process.env.ANTHROPIC_API_KEY
    ? buildDemoSummary(leads, hot, warm, cold, discard, avgScore, plan)
    : await buildClaudeSummary(leads, hot, warm, cold, avgScore);

  return {
    job_id: jobId,
    plan,
    total_leads: leads.length,
    hot_count: hot.length,
    warm_count: warm.length,
    cold_count: cold.length,
    discard_count: discard.length,
    avg_score: avgScore,
    executive_summary,
    patterns_observed: patterns,
    recommendations,
    processed_leads: leads,
    created_at: new Date().toISOString(),
  };
}

// ─── Demo summary ─────────────────────────────────────────────────────────────

function buildDemoSummary(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[],
  discard: ProcessedLead[],
  avgScore: number,
  plan: PlanType
): string {
  const qualityLine =
    avgScore >= 7.0
      ? `Average fit score is ${avgScore}/10 — strong batch quality overall.`
      : avgScore >= 5.5
      ? `Average fit score is ${avgScore}/10 — solid foundation, with several leads worth prioritizing.`
      : `Average fit score is ${avgScore}/10 — consider refining your target customer description for a tighter match next run.`;

  let actionLine: string;
  if (hot.length > 0) {
    const topAccounts = hot.slice(0, 3).map(l => l.candidate.company).join(", ");
    actionLine = `${hot.length} HOT opportunit${hot.length > 1 ? "ies" : "y"} identified — outreach drafts are ready. Top accounts: ${topAccounts}.`;
  } else if (warm.length > 0) {
    const topAccounts = warm.slice(0, 3).map(l => l.candidate.company).join(", ");
    actionLine = `Focus on the ${warm.length} WARM opportunit${warm.length > 1 ? "ies" : "y"} — review the recommended angle for each before outreach. Strongest accounts: ${topAccounts}.`;
  } else {
    actionLine = `All accounts in this batch need manual review before outreach. Consider refining your ICP or switching to a larger plan for more signal coverage.`;
  }

  return `LeadLens processed ${leads.length} accounts for your ${plan} plan: ${hot.length} HOT, ${warm.length} WARM, ${cold.length} COLD, ${discard.length} low-priority. ${qualityLine} ${actionLine}`;
}

// ─── Claude summary ───────────────────────────────────────────────────────────

async function buildClaudeSummary(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[],
  avgScore: number
): Promise<string> {
  const { callClaude } = await import("@/lib/anthropic");

  const SYSTEM = `You are a B2B commercial intelligence analyst. Write a concise 3-sentence executive summary for an Opportunity Snapshot report. Focus on accounts and signals, not individual contacts. Be specific, no fluff.`;
  const userMsg = `Total accounts: ${leads.length} | HOT: ${hot.length} | WARM: ${warm.length} | COLD: ${cold.length} | Avg opportunity score: ${avgScore}
Top HOT accounts: ${hot.slice(0, 3).map(l => `${l.candidate.company} (${l.candidate.industry ?? "?"})`).join(", ")}
Write a 3-sentence executive summary focused on account-level opportunity quality and recommended next steps.`;

  return callClaude(SYSTEM, userMsg, 200);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPatterns(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  highConfidenceCount: number
): string[] {
  if (leads.length === 0) return ["No accounts to analyze."];

  const patterns: string[] = [];
  const primaryGroup = hot.length > 0 ? hot : warm;

  // Top industry in best accounts
  const primaryIndustries = primaryGroup.map(l => l.candidate.industry).filter(Boolean) as string[];
  const topIndustry = mode(primaryIndustries);
  if (topIndustry) {
    const label = hot.length > 0 ? "HOT" : "WARM";
    patterns.push(`Most ${label} accounts are in ${topIndustry} — prioritize this segment for the highest-signal outreach`);
  }

  // WARM average score
  if (warm.length > 0) {
    const warmAvg = parseFloat((warm.reduce((s, l) => s + l.qualification.fit_score, 0) / warm.length).toFixed(1));
    patterns.push(`WARM accounts average ${warmAvg}/10 — a well-timed, signal-led outreach could move several into active conversations`);
  }

  // Evidence coverage
  const evidencePct = Math.round((highConfidenceCount / leads.length) * 100);
  patterns.push(`${evidencePct}% of accounts have high-confidence signal evidence — strongest basis for outreach timing`);

  // Accounts with confirmed buying signals
  const withSignals = leads.filter(l =>
    l.enrichment.timing_signals.some(s =>
      !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    )
  ).length;
  if (withSignals > 0) {
    patterns.push(`${withSignals} account${withSignals > 1 ? "s" : ""} have confirmed public buying signals — prioritize these for first outreach wave`);
  }

  return patterns;
}

function buildRecommendations(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[]
): string[] {
  const recs: string[] = [];

  if (hot.length > 0) {
    recs.push(`Prioritize HOT accounts this week — outreach drafts are ready and buying signals are strongest. Start with the top ${Math.min(hot.length, 5)} by opportunity score.`);
    if (hot.length > 5) recs.push(`If reaching out manually, work through HOT accounts in order of score — fresher signals first`);
  } else if (warm.length > 0) {
    recs.push(`Start with WARM accounts — review the recommended angle for each before outreach. Signal-led openers will outperform generic templates.`);
    recs.push(`For WARM accounts, a LinkedIn company message is often a lower-friction first touch than cold email`);
  }

  if (hot.length > 0 && warm.length > 0) {
    recs.push(`Run WARM accounts in parallel with a softer, educational angle — don't wait for HOT responses before engaging WARM ones`);
  }

  if (cold.length > 0) {
    recs.push(`Review COLD accounts manually before outreach — some may be worth a lighter two-touch sequence if the segment fit is strong`);
  }

  recs.push(`Exclude low-priority (DISCARD) accounts from this outreach wave — focus commercial energy on HOT and WARM accounts first`);

  return recs;
}

function mode(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
}
