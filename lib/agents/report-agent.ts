import type { ProcessedLead, LeadLensReport, PlanType, OnboardingData, ICP } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

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
  const withConfirmedSignals = leads.filter(l =>
    l.enrichment.timing_signals.some(s =>
      !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    )
  );

  const patterns = buildPatterns(leads, hot, warm, highConfidence, withConfirmedSignals.length);
  const recommendations = buildRecommendations(leads, hot, warm, cold);
  const segment_insights = buildSegmentInsights(leads, hot, warm);
  const top_signals_observed = extractTopSignals(withConfirmedSignals);
  const first_actions = buildFirstActions(hot, warm, cold, withConfirmedSignals);
  const strategic_warnings = buildStrategicWarnings(leads, hot, warm, cold, highConfidence, avgScore, icp);
  const evidence_quality_summary = buildEvidenceQualitySummary(leads, highConfidence, withConfirmedSignals.length);

  const executive_summary = IS_DEMO || !process.env.ANTHROPIC_API_KEY
    ? buildDemoSummary(leads, hot, warm, cold, discard, avgScore, plan, withConfirmedSignals.length)
    : await buildClaudeSummary(leads, hot, warm, cold, avgScore, icp, withConfirmedSignals.length);

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
    segment_insights,
    top_signals_observed,
    first_actions,
    strategic_warnings,
    evidence_quality_summary,
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
  plan: PlanType,
  signalCount: number
): string {
  const qualityLine =
    avgScore >= 7.0
      ? `Average opportunity score is ${avgScore}/10 — strong batch quality with evidence-backed accounts.`
      : avgScore >= 5.5
      ? `Average opportunity score is ${avgScore}/10 — solid foundation with several accounts worth prioritizing.`
      : `Average opportunity score is ${avgScore}/10 — consider refining your ICP description for tighter segment matching.`;

  const signalLine = signalCount > 0
    ? `${signalCount} of ${leads.length} accounts have confirmed public buying signals — prioritize these for the first outreach wave.`
    : `No confirmed buying signals detected in this batch — all outreach is hypothesis-led. Consider adding more specific signal criteria to your ICP.`;

  let actionLine: string;
  if (hot.length > 0) {
    const topAccounts = hot.slice(0, 3).map(l => l.candidate.company).join(", ");
    actionLine = `${hot.length} HOT opportunit${hot.length > 1 ? "ies" : "y"} identified. Top accounts: ${topAccounts}.`;
  } else if (warm.length > 0) {
    const topAccounts = warm.slice(0, 3).map(l => l.candidate.company).join(", ");
    actionLine = `Focus on ${warm.length} WARM opportunit${warm.length > 1 ? "ies" : "y"} — review recommended angle for each before outreach. Strongest: ${topAccounts}.`;
  } else {
    actionLine = `All accounts need manual review before outreach. Consider refining your ICP or reviewing the signal criteria.`;
  }

  return `LeadLens analyzed ${leads.length} accounts for your ${plan} plan: ${hot.length} HOT, ${warm.length} WARM, ${cold.length} COLD, ${discard.length} low-priority. ${qualityLine} ${signalLine} ${actionLine}`;
}

// ─── Claude summary ───────────────────────────────────────────────────────────

async function buildClaudeSummary(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[],
  avgScore: number,
  icp: ICP,
  signalCount: number
): Promise<string> {
  const { callClaude } = await import("@/lib/anthropic");

  const SYSTEM = `You are a senior B2B commercial intelligence analyst. Write a concise 3-4 sentence executive summary for an Opportunity Snapshot report.
Rules:
- Be specific about what was found — cite actual account names, industries, or signals if available
- Note evidence quality honestly — distinguish verified signals from inferences
- Focus on what the user should DO, not just what was found
- Do NOT use phrases like "impressive results" or "great batch" — be analytical, not promotional
- Do NOT mention individual people, emails, or contact data`;

  const hotAccounts = hot.slice(0, 3).map(l => `${l.candidate.company} (${l.candidate.industry ?? "?"}, score ${l.qualification.fit_score})`).join(", ");
  const topSignals = hot.concat(warm).flatMap(l =>
    l.enrichment.timing_signals.filter(s => !s.toLowerCase().includes("no confirmed") && !s.toLowerCase().includes("inferred"))
  ).slice(0, 3);

  const userMsg = `ICP target industries: ${icp.target_industries.join(", ")}
Total accounts: ${leads.length} | HOT: ${hot.length} | WARM: ${warm.length} | COLD: ${cold.length} | Avg score: ${avgScore}
Accounts with confirmed public signals: ${signalCount}/${leads.length}
Top HOT accounts: ${hotAccounts || "none"}
Top confirmed signals: ${topSignals.join("; ") || "none — all outreach is hypothesis-led"}

Write a 3-4 sentence executive summary focused on: (1) overall batch quality and what it means, (2) top opportunities and why they're the strongest, (3) honest evidence quality assessment, (4) specific recommended next action.`;

  return callClaude(SYSTEM, userMsg, 300);
}

// ─── Segment insights ─────────────────────────────────────────────────────────

function buildSegmentInsights(leads: ProcessedLead[], hot: ProcessedLead[], warm: ProcessedLead[]): string[] {
  if (leads.length === 0) return [];

  const insights: string[] = [];
  const primaryGroup = hot.length > 0 ? hot : warm.length > 0 ? warm : leads;

  // Best-performing industry
  const industryScores = new Map<string, { total: number; count: number }>();
  for (const lead of leads) {
    const ind = lead.candidate.industry;
    if (ind) {
      const current = industryScores.get(ind) ?? { total: 0, count: 0 };
      current.total += lead.qualification.fit_score;
      current.count += 1;
      industryScores.set(ind, current);
    }
  }

  let bestIndustry = "";
  let bestAvg = 0;
  industryScores.forEach(({ total, count }, ind) => {
    const avg = total / count;
    if (avg > bestAvg && count >= 1) {
      bestAvg = avg;
      bestIndustry = ind;
    }
  });

  if (bestIndustry) {
    const hotInIndustry = hot.filter(l => l.candidate.industry === bestIndustry).length;
    insights.push(`${bestIndustry} is the strongest-performing segment — avg score ${bestAvg.toFixed(1)}/10${hotInIndustry > 0 ? `, with ${hotInIndustry} HOT account${hotInIndustry > 1 ? "s" : ""}` : ""}`);
  }

  // HOT vs WARM segment divergence
  if (hot.length > 0 && warm.length > 0) {
    const hotIndustries = new Set(hot.map(l => l.candidate.industry).filter(Boolean));
    const warmOnlyIndustries = warm
      .map(l => l.candidate.industry)
      .filter((i): i is string => Boolean(i) && !hotIndustries.has(i));
    if (warmOnlyIndustries.length > 0) {
      const warmSeg = mode(warmOnlyIndustries);
      if (warmSeg) insights.push(`${warmSeg} accounts appear in WARM tier — may need more signal evidence or ICP refinement to move to HOT`);
    }
  }

  // Cold/discard pattern
  const coldLeads = leads.filter(l => l.qualification.fit_score < 5);
  if (coldLeads.length > leads.length * 0.4) {
    const coldIndustries = coldLeads.map(l => l.candidate.industry).filter(Boolean) as string[];
    const topColdInd = mode(coldIndustries);
    if (topColdInd) {
      insights.push(`${topColdInd} accounts frequently score below threshold — consider excluding this segment from future ICP criteria`);
    }
  }

  return insights;
}

// ─── Top signals ──────────────────────────────────────────────────────────────

function extractTopSignals(withSignals: ProcessedLead[]): string[] {
  if (withSignals.length === 0) return ["No confirmed public buying signals detected in this batch"];

  const signals = withSignals.flatMap(l =>
    l.enrichment.timing_signals.filter(
      s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    ).map(s => ({ company: l.candidate.company, signal: s }))
  );

  return signals.slice(0, 5).map(({ company, signal }) => `${company}: ${signal.slice(0, 100)}`);
}

// ─── First actions ────────────────────────────────────────────────────────────

function buildFirstActions(
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[],
  withSignals: ProcessedLead[]
): string[] {
  const actions: string[] = [];

  if (withSignals.length > 0) {
    const top = withSignals.slice(0, 3).map(l => l.candidate.company).join(", ");
    actions.push(`This week: reach out to the ${withSignals.length} account${withSignals.length > 1 ? "s" : ""} with confirmed buying signals first — they have a likely 30–90 day evaluation window. Start with: ${top}`);
  } else if (hot.length > 0) {
    const top = hot.slice(0, 3).map(l => l.candidate.company).join(", ");
    actions.push(`This week: contact HOT accounts with the recommended angle from each Opportunity Snapshot — even without a signal, these have the strongest ICP fit. Start with: ${top}`);
  }

  if (warm.length > 0) {
    actions.push(`Parallel track: send LinkedIn company messages to WARM accounts (lower friction than email when there's no confirmed signal)`);
  }

  if (cold.length > 0) {
    actions.push(`Review COLD accounts before discarding — some may become relevant if ICP criteria shift or if you refine the segment`);
  }

  actions.push("Log which accounts respond and why — this feedback should inform the next ICP refinement");

  return actions;
}

// ─── Strategic warnings ───────────────────────────────────────────────────────

function buildStrategicWarnings(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[],
  highConfidenceCount: number,
  avgScore: number,
  icp: ICP
): string[] {
  const warnings: string[] = [];

  const signalCount = leads.filter(l =>
    l.enrichment.timing_signals.some(
      s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    )
  ).length;

  if (signalCount === 0) {
    warnings.push("No confirmed buying signals in this batch — all outreach is hypothesis-led. Response rates will likely be lower than signal-led campaigns. Consider adding signal criteria to your ICP.");
  }

  if (hot.length === 0) {
    warnings.push("No HOT accounts in this batch — no account scored ≥8/10. This may indicate ICP criteria are too broad, the signal pool is limited, or the target segment needs refinement.");
  }

  const lowConfCount = leads.filter(l => l.candidate.confidence_score < 0.5).length;
  if (lowConfCount > leads.length * 0.5) {
    warnings.push(`${lowConfCount} of ${leads.length} accounts have low evidence confidence (<50%) — a significant portion of outreach will be based on thin data. Manual research recommended before the first wave.`);
  }

  if (cold.length > leads.length * 0.6) {
    warnings.push(`${cold.length} of ${leads.length} accounts are COLD or below — this suggests the ICP may be too broad or the signal criteria too weak. Consider narrowing the target industries or company size range.`);
  }

  const genericRisk = leads.filter(l => l.outreach.genericness_risk === "high").length;
  if (genericRisk > leads.length * 0.3) {
    warnings.push(`${genericRisk} accounts have high genericness risk in their outreach — review these before sending. Generic outreach consistently underperforms signal-led messaging.`);
  }

  if (icp.icp_clarity_score !== undefined && icp.icp_clarity_score < 50) {
    warnings.push(`ICP clarity score is ${icp.icp_clarity_score}/100 — low ICP specificity may explain weaker account matching. Add more detail to your offer description and target customer profile.`);
  }

  return warnings;
}

// ─── Evidence quality summary ─────────────────────────────────────────────────

function buildEvidenceQualitySummary(leads: ProcessedLead[], highConfCount: number, signalCount: number): string {
  const pct = leads.length > 0 ? Math.round((highConfCount / leads.length) * 100) : 0;
  const signalPct = leads.length > 0 ? Math.round((signalCount / leads.length) * 100) : 0;

  if (pct >= 70 && signalPct >= 40) {
    return `Strong evidence quality: ${pct}% high-confidence accounts, ${signalPct}% with confirmed buying signals. Outreach can be presented as signal-led.`;
  }
  if (pct >= 50 || signalPct >= 20) {
    return `Moderate evidence quality: ${pct}% high-confidence, ${signalPct}% with confirmed signals. Mix of signal-led and hypothesis-led outreach recommended.`;
  }
  return `Thin evidence base: ${pct}% high-confidence, ${signalPct}% with confirmed signals. Most outreach must be framed as hypothesis-led — avoid asserting knowledge of internal priorities.`;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildPatterns(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  highConfidenceCount: number,
  signalCount: number
): string[] {
  if (leads.length === 0) return ["No accounts to analyze."];

  const patterns: string[] = [];
  const primaryGroup = hot.length > 0 ? hot : warm;

  const primaryIndustries = primaryGroup.map(l => l.candidate.industry).filter(Boolean) as string[];
  const topIndustry = mode(primaryIndustries);
  if (topIndustry) {
    const label = hot.length > 0 ? "HOT" : "WARM";
    patterns.push(`Most ${label} accounts are in ${topIndustry} — this is the strongest-converting segment in this batch`);
  }

  if (warm.length > 0) {
    const warmAvg = parseFloat((warm.reduce((s, l) => s + l.qualification.fit_score, 0) / warm.length).toFixed(1));
    patterns.push(`WARM accounts average ${warmAvg}/10 — signal-led outreach could move several into active conversations`);
  }

  const evidencePct = Math.round((highConfidenceCount / leads.length) * 100);
  patterns.push(`${evidencePct}% of accounts have high-confidence signal evidence — these are the strongest basis for outreach timing`);

  if (signalCount > 0) {
    patterns.push(`${signalCount} account${signalCount > 1 ? "s have" : " has"} confirmed public buying signals — prioritize these for the first outreach wave`);
  } else {
    patterns.push("No confirmed buying signals detected — all outreach is hypothesis-led from segment and company profile");
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
    recs.push(`Prioritize HOT accounts this week — outreach drafts and recommended angles are ready. Start with the top ${Math.min(hot.length, 5)} by opportunity score.`);
    if (hot.length > 5) recs.push(`Work through HOT accounts in score order — fresher signals first, since signal relevance decays within 30–60 days`);
  } else if (warm.length > 0) {
    recs.push(`Start with WARM accounts — review the recommended angle for each before outreach. Signal-led openers outperform generic templates significantly.`);
    recs.push(`For WARM accounts without confirmed signals, a LinkedIn company message is lower-friction than cold email`);
  }

  if (hot.length > 0 && warm.length > 0) {
    recs.push(`Run WARM accounts in parallel with a softer, educational angle — don't wait for HOT responses`);
  }

  if (cold.length > 0) {
    recs.push(`Review COLD accounts manually — some may warrant a lighter two-touch sequence if segment fit is strong despite low evidence`);
  }

  recs.push(`Exclude DISCARD accounts from this wave — focus commercial energy on HOT and WARM first`);

  return recs;
}

function mode(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
}
