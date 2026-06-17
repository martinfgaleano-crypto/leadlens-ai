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

  const verifiedEmails = leads.filter(l => l.candidate.email_status === "verified").length;
  const warmAvg = warm.length > 0
    ? parseFloat((warm.reduce((s, l) => s + l.qualification.fit_score, 0) / warm.length).toFixed(1))
    : 0;

  const patterns = buildPatterns(leads, hot, warm, verifiedEmails);
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
    const topNames = hot.slice(0, 3).map(l => `${l.candidate.name ?? l.candidate.company} (${l.candidate.company})`).join(", ");
    actionLine = `${hot.length} HOT lead${hot.length > 1 ? "s" : ""} should go out this week — outreach sequences are ready. Top prospects: ${topNames}.`;
  } else if (warm.length > 0) {
    const topNames = warm.slice(0, 3).map(l => `${l.candidate.name ?? l.candidate.company} at ${l.candidate.company}`).join(", ");
    actionLine = `Focus on the ${warm.length} WARM lead${warm.length > 1 ? "s" : ""} — review the personalization trigger for each before sending. Strongest: ${topNames}.`;
  } else {
    actionLine = `All leads in this batch need manual review before outreach. Consider refining your ICP or switching to a larger plan for more variety.`;
  }

  return `LeadLens processed ${leads.length} leads for your ${plan} plan: ${hot.length} HOT, ${warm.length} WARM, ${cold.length} COLD, ${discard.length} DISCARD. ${qualityLine} ${actionLine}`;
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

  const SYSTEM = `You are a B2B sales analyst. Write a concise 3-sentence executive summary for a lead report. Be specific, no fluff.`;
  const userMsg = `Total: ${leads.length} leads | HOT: ${hot.length} | WARM: ${warm.length} | COLD: ${cold.length} | Avg score: ${avgScore}
Top HOT leads: ${hot.slice(0, 3).map(l => `${l.candidate.name ?? "?"} at ${l.candidate.company}`).join(", ")}
Write a 3-sentence executive summary.`;

  return callClaude(SYSTEM, userMsg, 200);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPatterns(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  verifiedEmails: number
): string[] {
  if (leads.length === 0) return ["No leads to analyze."];

  const patterns: string[] = [];
  const primaryGroup = hot.length > 0 ? hot : warm;

  // Top industry in best leads
  const primaryIndustries = primaryGroup.map(l => l.candidate.industry).filter(Boolean) as string[];
  const topIndustry = mode(primaryIndustries);
  if (topIndustry) {
    const label = hot.length > 0 ? "HOT" : "WARM";
    patterns.push(`Most ${label} leads are in ${topIndustry} — prioritize this vertical for best response rates`);
  }

  // Top titles in best leads
  const primaryTitles = primaryGroup.map(l => l.candidate.title).filter(Boolean) as string[];
  const topTitle = mode(primaryTitles);
  if (topTitle) {
    patterns.push(`${topTitle} is the most common high-fit title — adjust subject lines for this persona`);
  }

  // WARM average score
  if (warm.length > 0) {
    const warmAvg = parseFloat((warm.reduce((s, l) => s + l.qualification.fit_score, 0) / warm.length).toFixed(1));
    patterns.push(`WARM leads average ${warmAvg}/10 — personalized follow-up could convert several into active conversations`);
  }

  // Email coverage
  const withEmail = leads.filter(l => l.candidate.email).length;
  const emailPct = Math.round((withEmail / leads.length) * 100);
  patterns.push(`${emailPct}% of leads have email addresses — ${verifiedEmails} verified for highest deliverability`);

  // LinkedIn-only leads
  const missingEmail = leads.filter(l => !l.candidate.email).length;
  if (missingEmail > 0) {
    patterns.push(`${missingEmail} lead${missingEmail > 1 ? "s" : ""} have no email — use the included LinkedIn DM sequence for these`);
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
    recs.push(`Send HOT leads this week using the personalized email sequence — follow up with the LinkedIn DM on day 2–3 if no reply`);
    if (hot.length > 5) recs.push(`If sending manually, prioritize the top ${Math.min(hot.length, 5)} HOT leads first — freshest timing signals`);
  } else if (warm.length > 0) {
    recs.push(`Start with the WARM leads — review the personalization trigger for each before sending to improve reply rates`);
    recs.push(`For WARM leads, the LinkedIn DM is a lower-commitment first touch than email`);
  }

  if (hot.length > 0 && warm.length > 0) {
    recs.push(`Run WARM leads in parallel with a softer, educational angle — don't wait until HOT responses come in`);
  }

  if (cold.length > 0) {
    recs.push(`Review COLD leads manually — some may be worth contacting with a lighter two-touch sequence`);
  }

  recs.push(`Do not include DISCARD leads in this campaign — save send volume for higher-fit prospects`);

  return recs;
}

function mode(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
}
