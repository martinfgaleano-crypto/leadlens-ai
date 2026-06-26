import type { ProcessedLead, LeadLensReport, PlanType, OnboardingData, ICP, OpportunityRanking } from "@/types";
import { computeRanking } from "@/lib/ranking";

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

  // Ranking — applies rank/ranking_explanation back to each lead's qualification in-place
  const ranked_opportunities: OpportunityRanking[] = computeRanking(leads);

  const patterns = buildPatterns(leads, hot, warm, highConfidence, withConfirmedSignals.length);
  const recommendations = buildRecommendations(leads, hot, warm, cold);
  const segment_insights = buildSegmentInsights(leads, hot, warm);
  const top_signals_observed = extractTopSignals(withConfirmedSignals);
  const first_actions = buildFirstActions(hot, warm, cold, withConfirmedSignals);
  const strategic_warnings = buildStrategicWarnings(leads, hot, warm, cold, highConfidence, avgScore, icp);
  const evidence_quality_summary = buildEvidenceQualitySummary(leads, highConfidence, withConfirmedSignals.length);

  // Report-level QC
  const reportQC = runReportQC(leads, hot, warm, cold, discard, avgScore, withConfirmedSignals.length, icp);

  const executive_summary = IS_DEMO || !process.env.ANTHROPIC_API_KEY
    ? buildDemoSummary(leads, hot, warm, cold, discard, avgScore, plan, withConfirmedSignals.length)
    : await buildClaudeSummary(leads, hot, warm, cold, avgScore, icp, withConfirmedSignals.length, ranked_opportunities);

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
    ranked_opportunities,
    report_quality_score: reportQC.score,
    report_quality_notes: reportQC.notes,
    report_risks: reportQC.risks,
    recommended_fix_before_delivery: reportQC.fix,
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
  signalCount: number,
  ranked: OpportunityRanking[]
): Promise<string> {
  const { callClaude } = await import("@/lib/anthropic");

  const discard = leads.filter(l => l.qualification.fit_score < 4);
  const { priority, monitor, excluded } = computeTiers(hot, warm, cold, discard);

  const SYSTEM = `You are a senior B2B commercial intelligence analyst delivering a strategic opportunity assessment.
Write a 4-sentence executive summary that sounds like a seasoned analyst — not a report generator.

Rules:
- Sentence 1: Lead with curated counts — "X priority accounts, Y to monitor, Z excluded" — name top 1-2 priority accounts specifically
- Sentence 2: Name the strongest signal pattern observed across the batch (or honestly state there are none)
- Sentence 3: Identify the strongest segment and the weakest area in this batch — what should be avoided or monitored vs. pursued
- Sentence 4: One specific next action this week — concrete, not generic. "Contact [company] using the warehouse expansion angle" not "send outreach"
- Never say: "impressive results", "strong batch", "promising", or any promotional filler
- Never mention individual people, phone numbers, emails, or personal LinkedIn URLs
- Distinguish confirmed signals from inferences explicitly`;

  const priorityAccounts = priority.slice(0, 2).map(l =>
    `${l.candidate.company} (${l.candidate.industry ?? "?"}, ${l.qualification.fit_score}/10)`
  ).join(", ");

  const topRanked = ranked.slice(0, 1)[0];
  const topSignalPattern = priority.concat(monitor).flatMap(l =>
    l.enrichment.timing_signals.filter(s =>
      !s.toLowerCase().includes("no confirmed") && !s.toLowerCase().includes("inferred")
    )
  ).slice(0, 2).join("; ");

  const industryScores: Record<string, number[]> = {};
  for (const l of leads) {
    const ind = l.candidate.industry ?? "Unknown";
    (industryScores[ind] = industryScores[ind] ?? []).push(l.qualification.fit_score);
  }
  const industryAvgs = Object.entries(industryScores).map(([ind, scores]) => ({
    ind,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  })).sort((a, b) => b.avg - a.avg);

  const bestSegment = industryAvgs[0]?.ind ?? "unknown";
  const worstSegment = industryAvgs[industryAvgs.length - 1]?.ind ?? "unknown";

  const userMsg = `ICP target industries: ${icp.target_industries.join(", ")}
Total accounts analyzed: ${leads.length}

CURATED TIERS (use these — not raw counts):
  Priority (ready for outreach): ${priority.length} accounts
  Monitor (validate first): ${monitor.length} accounts
  Excluded (low fit / weak evidence): ${excluded.length} accounts

Priority accounts: ${priorityAccounts || "none above priority threshold"}
Top ranked account: ${topRanked ? `${topRanked.company} — ${topRanked.top_priority_reason}` : "none"}
Avg score: ${avgScore}/10
Confirmed buying signals: ${signalCount}/${leads.length}
Strongest signal pattern: ${topSignalPattern || "none confirmed — all outreach is hypothesis-led"}
Strongest segment by avg score: ${bestSegment}
Weakest segment by avg score: ${worstSegment}
HOT accounts: ${hot.length} | WARM: ${warm.length} | COLD: ${cold.length} | DISCARD: ${discard.length}

Write a 4-sentence strategic executive summary following the rules exactly.`;

  return callClaude(SYSTEM, userMsg, 400);
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

// ─── Report-level QC ─────────────────────────────────────────────────────────
// Self-assessment of the batch quality before delivery. Deterministic — no extra API call.

function runReportQC(
  leads: ProcessedLead[],
  hot: ProcessedLead[],
  warm: ProcessedLead[],
  cold: ProcessedLead[],
  discard: ProcessedLead[],
  avgScore: number,
  signalCount: number,
  icp: ICP
): { score: number; notes: string[]; risks: string[]; fix: string | undefined } {
  const notes: string[] = [];
  const risks: string[] = [];
  let deductions = 0;

  const total = leads.length;
  if (total === 0) {
    return { score: 0, notes: ["No accounts processed — empty batch"], risks: ["Empty report — cannot deliver"], fix: "Re-run with a broader ICP or different target industries" };
  }

  // ── Check 1: No actionable accounts ────────────────────────────────────────
  if (hot.length === 0 && warm.length === 0) {
    notes.push("No HOT or WARM accounts in batch — nothing ready for outreach or monitoring");
    risks.push("All accounts are COLD or DISCARD — this report cannot support a Wave 1 campaign");
    deductions += 30;
  } else if (hot.length === 0) {
    notes.push("No HOT accounts — strongest tier is WARM. Manage expectations on reply rates");
    deductions += 10;
  }

  // ── Check 2: Too many COLD as actionable ───────────────────────────────────
  const coldFraction = cold.length / total;
  if (coldFraction > 0.6) {
    notes.push(`${cold.length}/${total} accounts are COLD — over 60% of the batch is below the outreach threshold`);
    risks.push("High COLD concentration suggests ICP criteria may be too broad or the source pool is misaligned");
    deductions += 15;
  }

  // ── Check 3: No confirmed signals ─────────────────────────────────────────
  if (signalCount === 0) {
    notes.push("Zero confirmed buying signals across the entire batch — all outreach is hypothesis-led");
    risks.push("Hypothesis-led outreach without any signal anchor typically underperforms by 40–60% vs signal-led campaigns");
    deductions += 15;
  }

  // ── Check 4: Low evidence confidence ──────────────────────────────────────
  const lowConfCount = leads.filter(l => l.candidate.confidence_score < 0.5).length;
  if (lowConfCount > total * 0.5) {
    notes.push(`${lowConfCount}/${total} accounts have low evidence confidence (<50%) — majority of claims are inferred`);
    risks.push("Low evidence base increases hallucination risk in outreach copy");
    deductions += 10;
  }

  // ── Check 5: High genericness across report ────────────────────────────────
  const highGenericCount = leads.filter(l => l.outreach.genericness_risk === "high").length;
  if (highGenericCount > total * 0.3) {
    notes.push(`${highGenericCount} accounts have high-genericness outreach — review before sending`);
    deductions += 10;
  }

  // ── Check 6: Repeated outreach language ──────────────────────────────────
  const subjects = leads.map(l => l.outreach.subject).filter(Boolean);
  const uniqueSubjects = new Set(subjects);
  if (subjects.length > 2 && uniqueSubjects.size < subjects.length * 0.6) {
    notes.push("Multiple accounts share nearly identical email subjects — outreach variety is too low");
    risks.push("Repeated subject lines and copy patterns suggest template usage rather than account-specific intelligence");
    deductions += 15;
  }

  // ── Check 7: DISCARD accounts with outreach sequences ────────────────────
  const discardWithOutreach = discard.filter(l =>
    l.outreach.email_body && !l.outreach.email_body.toLowerCase().startsWith("do not send")
  );
  if (discardWithOutreach.length > 0) {
    notes.push(`${discardWithOutreach.length} DISCARD account(s) have outreach sequences — these should show DO NOT SEND notices only`);
    risks.push("Sending outreach to DISCARD accounts wastes rep capacity and can damage sender reputation");
    deductions += 20;
  }

  // ── Check 8: Very low avg score ───────────────────────────────────────────
  if (avgScore < 4.0) {
    notes.push(`Average batch score is ${avgScore}/10 — below COLD threshold across the board`);
    risks.push("Report quality is insufficient for a commercial campaign — ICP and source criteria need revision");
    deductions += 20;
  }

  // ── Check 9: ICP clarity ─────────────────────────────────────────────────
  if (icp.icp_clarity_score !== undefined && icp.icp_clarity_score < 45) {
    notes.push(`ICP clarity score is ${icp.icp_clarity_score}/100 — low specificity likely explains weak account matching`);
    deductions += 5;
  }

  const score = Math.max(0, 100 - deductions);

  let fix: string | undefined;
  if (score < 60) {
    fix = "Before delivery: review ICP criteria and consider re-running with narrower target industries and stronger signal requirements. The current batch does not support a first outreach wave.";
  } else if (score < 80) {
    fix = "Review COLD accounts and high-genericness outreach before delivery. Confirm all WARM accounts have a specific recommended angle before contacting.";
  }

  return { score, notes, risks, fix };
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
