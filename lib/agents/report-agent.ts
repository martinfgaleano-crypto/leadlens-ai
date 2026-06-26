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

// ─── Curation tiers ───────────────────────────────────────────────────────────

function computeTiers(
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[],
  discard: ProcessedLead[]
): { priority: ProcessedLead[]; monitor: ProcessedLead[]; excluded: ProcessedLead[] } {
  // Priority = HOT + top-scoring WARM (≥7.0)
  const topWarm = warm.filter(l => l.qualification.fit_score >= 7.0);
  const lowerWarm = warm.filter(l => l.qualification.fit_score < 7.0);
  const priority = [...hot, ...topWarm];

  // Monitor = lower WARM + COLD accounts that have at least one confirmed signal
  const coldWithSignal = cold.filter(l =>
    l.enrichment.timing_signals.some(
      s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    )
  );
  const coldWithoutSignal = cold.filter(l => !coldWithSignal.includes(l));
  const monitor = [...lowerWarm, ...coldWithSignal];

  // Excluded = DISCARD + signal-weak COLD
  const excluded = [...coldWithoutSignal, ...discard];

  return { priority, monitor, excluded };
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
  const { priority, monitor, excluded } = computeTiers(hot, warm, cold, discard);

  if (priority.length === 0 && monitor.length === 0) {
    return `LeadLens analyzed ${leads.length} accounts for your ${plan} plan. No accounts reached the priority or monitor threshold — all ${leads.length} are excluded from the first outreach wave. Average score: ${avgScore}/10. Consider narrowing your ICP description or reviewing target industry criteria.`;
  }

  const priorityNames = priority.slice(0, 3).map(l => l.candidate.company).join(", ");
  const exclusionNote = excluded.length > 0
    ? ` ${excluded.length} account${excluded.length > 1 ? "s are" : " is"} excluded from the first wave (low fit or insufficient evidence).`
    : "";

  if (priority.length === 0) {
    const signalNote = signalCount > 0
      ? `${signalCount} account${signalCount > 1 ? "s have" : " has"} confirmed buying signals but remain in the monitor tier — validate fit before outreach.`
      : `No confirmed buying signals in this batch — all outreach would be hypothesis-led. Consider narrowing your ICP criteria.`;
    return `LeadLens identified ${monitor.length} account${monitor.length > 1 ? "s" : ""} worth monitoring, but none cleared the priority threshold for immediate outreach.${exclusionNote} All require manual validation before contact. Average score: ${avgScore}/10. ${signalNote}`;
  }

  const signalNote = signalCount > 0
    ? `${signalCount} account${signalCount > 1 ? "s have" : " has"} confirmed buying signals — lead with these in Wave 1.`
    : `No confirmed buying signals — use hypothesis-framed openers and look for a timing anchor before sending.`;

  return `LeadLens identified ${priority.length} priority account${priority.length > 1 ? "s" : ""} ready for outreach and ${monitor.length} account${monitor.length > 1 ? "s" : ""} to monitor.${exclusionNote} Priority accounts: ${priorityNames}. Average score: ${avgScore}/10. ${signalNote}`;
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

  const { priority, monitor, excluded } = computeTiers(hot, warm, cold, []);

  const SYSTEM = `You are a senior B2B commercial intelligence analyst. Write a concise 3-sentence executive summary for an Opportunity Snapshot report.
Rules:
- Lead with a curated count: "X priority accounts ready for outreach, Y accounts to monitor, Z excluded" — not the total raw count
- Be specific — cite actual account names and industries for top priority accounts
- Distinguish confirmed signals from inferences honestly
- Recommend ONE specific next action
- Do NOT say "impressive results", "great batch", or any promotional language
- Do NOT mention individual people, emails, or contact data`;

  const priorityAccounts = priority.slice(0, 3).map(l =>
    `${l.candidate.company} (${l.candidate.industry ?? "?"}, ${l.qualification.fit_score}/10)`
  ).join(", ");

  const topSignals = priority.concat(monitor).flatMap(l =>
    l.enrichment.timing_signals.filter(s =>
      !s.toLowerCase().includes("no confirmed") && !s.toLowerCase().includes("inferred")
    )
  ).slice(0, 3);

  const userMsg = `ICP target industries: ${icp.target_industries.join(", ")}
Total accounts analyzed: ${leads.length}
CURATED TIERS — use these, not the raw totals:
  Priority (ready for outreach): ${priority.length} accounts
  Monitor (needs validation first): ${monitor.length} accounts
  Excluded (low fit / insufficient evidence): ${excluded.length + (leads.filter(l => l.qualification.fit_score < 4).length)} accounts
Priority accounts: ${priorityAccounts || "none above threshold"}
Avg score across full batch: ${avgScore}
Confirmed public signals: ${signalCount}/${leads.length}
Top confirmed signals: ${topSignals.join("; ") || "none — all outreach is hypothesis-led"}

Write a 3-sentence executive summary: (1) curated tier counts + top priority accounts, (2) evidence quality and signal availability, (3) specific next action.`;

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
  const { priority, monitor } = computeTiers(hot, warm, cold, []);

  // Wave 1: signal-led priority accounts
  const signalPriority = withSignals.filter(l => priority.includes(l));
  if (signalPriority.length > 0) {
    const top = signalPriority.slice(0, 3).map(l => l.candidate.company).join(", ");
    actions.push(`Wave 1 — this week: contact the ${signalPriority.length} priority account${signalPriority.length > 1 ? "s" : ""} with confirmed buying signals first. These have a likely 30–90 day evaluation window. Start with: ${top}`);
  } else if (priority.length > 0) {
    const top = priority.slice(0, 3).map(l => l.candidate.company).join(", ");
    actions.push(`Wave 1 — this week: contact ${priority.length} priority account${priority.length > 1 ? "s" : ""} using the recommended angle from each brief. No confirmed signals, so use hypothesis-framed openers. Start with: ${top}`);
  }

  // Wave 2: monitor accounts (lower friction)
  if (monitor.length > 0) {
    actions.push(`Wave 2 — parallel track: send LinkedIn company messages to the ${monitor.length} monitor account${monitor.length > 1 ? "s" : ""} (lower friction than email when signal is weak). Review fit before sending.`);
  }

  // COLD explicitly excluded from outreach
  const coldNoSignal = cold.filter(l =>
    !l.enrichment.timing_signals.some(
      s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    )
  );
  if (coldNoSignal.length > 0) {
    actions.push(`Do NOT outreach to ${coldNoSignal.length} COLD account${coldNoSignal.length > 1 ? "s" : ""} without manual research first — they lack confirmed signals and sufficient evidence. Validate pain hypothesis before any contact.`);
  }

  actions.push("Log which accounts respond and the reply reason — this is the most valuable input for the next ICP refinement cycle.");

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
  const { priority, monitor } = computeTiers(hot, warm, cold, []);

  if (priority.length > 0) {
    const topCount = Math.min(priority.length, 5);
    recs.push(`Send outreach to the ${topCount} highest-scoring priority accounts first — outreach drafts and recommended angles are ready. Work in score order; signal relevance decays within 30–60 days.`);
  }

  if (priority.length > 0 && monitor.length > 0) {
    recs.push(`Run monitor accounts in parallel with a softer angle — LinkedIn company message is lower friction than cold email when signal confidence is low.`);
  } else if (monitor.length > 0 && priority.length === 0) {
    recs.push(`No priority accounts in this batch. Use monitor accounts as your starting point — but validate fit manually before sending. LinkedIn first, email only after a signal is confirmed.`);
  }

  if (cold.length > 0) {
    recs.push(`COLD accounts (${cold.length}) are excluded from Wave 1. Do not send outreach until you've validated the pain hypothesis and confirmed there's a decision-maker to reach. These accounts need research, not a pitch.`);
  }

  recs.push(`After the first wave, log responses and signal quality — this feedback directly improves the next ICP run.`);

  return recs;
}

function mode(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
}
