import type { LeadLensReport, ProcessedLead } from "@/types";

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Rank", "Priority", "Score", "Buying Window",
  "Recommended Action", "Evidence Quality", "Evidence Strength", "Source Freshness", "Source Name",
  "Company", "Industry", "Size", "Location", "Confidence",
  "Account Thesis", "Signal Interpretation", "Tier Reason",
  "Timing Signals", "Opportunity Risks", "Next Best Question",
  "Why It Fits", "Flags",
  "Outreach Subject", "Outreach Draft",
  "QC Status", "QC Notes",
];

export function exportToCSV(report: LeadLensReport): string {
  const sorted = report.ranked_opportunities
    ? [...report.processed_leads].sort((a, b) => (a.qualification.rank ?? 99) - (b.qualification.rank ?? 99))
    : [...report.processed_leads].sort((a, b) => b.qualification.fit_score - a.qualification.fit_score);

  const rows = sorted.map((lead, i) => {
    const c = lead.candidate;
    const e = lead.enrichment;
    const q = lead.qualification;
    const o = lead.outreach;

    const confirmedSignals = e.timing_signals.filter(
      s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    );

    const lm = lead.learning;
    const evidenceStrength = lm?.evidence_quality
      ? { high: "Strong evidence", medium: "Moderate evidence", low: "Limited evidence", insufficient: "Insufficient evidence" }[lm.evidence_quality] ?? ""
      : "";
    const sourceFreshness = lm?.freshness_label ?? "";
    const sourceName = lm?.source_name ?? "";

    return [
      q.rank ?? (i + 1),
      q.category,
      q.fit_score,
      e.buying_window ?? "",
      (e.recommended_action ?? "").replace(/_/g, " "),
      e.evidence_quality_grade ?? "",
      evidenceStrength,
      sourceFreshness,
      sourceName,
      c.company,
      c.industry ?? "",
      c.company_size ?? "",
      c.location ?? "",
      c.confidence_score.toFixed(2),
      e.account_thesis ?? "",
      q.signal_interpretation ?? "",
      q.opportunity_tier_reason ?? "",
      confirmedSignals.join(" | "),
      (e.opportunity_risks ?? []).join(" | "),
      e.next_best_question ?? "",
      q.fit_reasons.join(" | "),
      q.disqualification_reasons.join(" | "),
      o.subject,
      o.email_body.toLowerCase().startsWith("do not send") ? "DO NOT SEND" : o.email_body.replace(/\n/g, " "),
      o.qc_status,
      o.qc_notes.slice(0, 2).join(" | "),
    ].map(csvCell).join(",");
  });

  return [CSV_HEADERS.map(csvCell).join(","), ...rows].join("\n");
}

function csvCell(value: string | number | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── Markdown export ──────────────────────────────────────────────────────────

export function exportToMarkdown(report: LeadLensReport): string {
  // Use ranking order if available, otherwise sort by score
  const sorted = report.ranked_opportunities
    ? [...report.processed_leads].sort((a, b) => (a.qualification.rank ?? 99) - (b.qualification.rank ?? 99))
    : [...report.processed_leads].sort((a, b) => b.qualification.fit_score - a.qualification.fit_score);

  const lines: string[] = [];

  lines.push(`# LeadLens AI — Opportunity Snapshot`);
  lines.push(`**Plan:** ${report.plan} · **Opportunities:** ${report.total_leads} · **Generated:** ${new Date(report.created_at).toLocaleString()}`);
  if (report.report_quality_score !== undefined) {
    lines.push(`**Report Quality Score:** ${report.report_quality_score}/100`);
  }
  lines.push("");

  // ── Executive Summary ────────────────────────────────────────────────────────
  lines.push(`## Executive Summary`);
  lines.push(report.executive_summary);
  lines.push("");

  // ── Opportunity Tiers ────────────────────────────────────────────────────────
  const hot   = sorted.filter(l => l.qualification.category === "HOT");
  const warm  = sorted.filter(l => l.qualification.category === "WARM");
  const cold  = sorted.filter(l => l.qualification.category === "COLD");
  const disc  = sorted.filter(l => l.qualification.category === "DISCARD");

  if (hot.length > 0 || warm.length > 0) {
    lines.push(`## Priority Opportunities`);
    lines.push(`*Ready for outreach — these accounts have the strongest ICP fit and/or confirmed buying signals.*`);
    lines.push("");
    for (const l of [...hot, ...warm.filter(w => w.qualification.fit_score >= 7)]) {
      const rec = l.enrichment.recommended_action ?? "";
      lines.push(`- **${l.candidate.company}** (${l.candidate.industry ?? "?"}, ${l.qualification.fit_score}/10 ${l.qualification.category})${rec ? ` → ${rec.replace(/_/g, " ")}` : ""}`);
      if (l.enrichment.account_thesis) lines.push(`  *${l.enrichment.account_thesis}*`);
    }
    lines.push("");
  }

  const monitorList = warm.filter(w => w.qualification.fit_score < 7).concat(
    cold.filter(c => c.enrichment.timing_signals.some(
      s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    ))
  );
  if (monitorList.length > 0) {
    lines.push(`## Monitor List`);
    lines.push(`*These accounts need further validation before outreach — confirm signal fit manually.*`);
    lines.push("");
    for (const l of monitorList) {
      lines.push(`- **${l.candidate.company}** (${l.candidate.industry ?? "?"}, ${l.qualification.fit_score}/10 ${l.qualification.category})`);
      if (l.enrichment.next_best_question) lines.push(`  Next question: *${l.enrichment.next_best_question}*`);
    }
    lines.push("");
  }

  if (disc.length > 0) {
    lines.push(`## Excluded / Do Not Pursue`);
    lines.push(`*These accounts did not meet ICP criteria — do not include in outreach sequences.*`);
    lines.push("");
    for (const l of disc) {
      lines.push(`- **${l.candidate.company}** (${l.candidate.industry ?? "?"}) — ${l.qualification.disqualification_reasons[0]?.slice(0, 80) ?? "hard ICP disqualifier"}`);
    }
    lines.push("");
  }

  // ── Signal Patterns ──────────────────────────────────────────────────────────
  if (report.top_signals_observed && report.top_signals_observed.length > 0 && !report.top_signals_observed[0]?.includes("No confirmed")) {
    lines.push(`## Signal Patterns`);
    for (const s of report.top_signals_observed) lines.push(`- ⚡ ${s}`);
    lines.push("");
  }

  // ── Segment Insights ─────────────────────────────────────────────────────────
  if (report.segment_insights && report.segment_insights.length > 0) {
    lines.push(`## Segment Insights`);
    for (const s of report.segment_insights) lines.push(`- ${s}`);
    lines.push("");
  }

  // ── First Actions ────────────────────────────────────────────────────────────
  if (report.first_actions && report.first_actions.length > 0) {
    lines.push(`## Recommended First Actions`);
    for (const a of report.first_actions) lines.push(`- ${a}`);
    lines.push("");
  }

  // ── Strategic Warnings ───────────────────────────────────────────────────────
  if (report.strategic_warnings && report.strategic_warnings.length > 0) {
    lines.push(`## Strategic Warnings`);
    for (const w of report.strategic_warnings) lines.push(`- ⚠ ${w}`);
    lines.push("");
  }

  // ── Report QC ────────────────────────────────────────────────────────────────
  if (report.report_quality_notes && report.report_quality_notes.length > 0) {
    lines.push(`## Report Quality Notes`);
    for (const n of report.report_quality_notes) lines.push(`- ${n}`);
    if (report.recommended_fix_before_delivery) {
      lines.push(`> **Recommended fix:** ${report.recommended_fix_before_delivery}`);
    }
    lines.push("");
  }

  // ── Stats table ───────────────────────────────────────────────────────────────
  lines.push(`## Batch Statistics`);
  lines.push(`| Category | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| HOT | ${report.hot_count} |`);
  lines.push(`| WARM | ${report.warm_count} |`);
  lines.push(`| COLD | ${report.cold_count} |`);
  lines.push(`| DISCARD | ${report.discard_count} |`);
  lines.push(`| Avg Score | ${report.avg_score}/10 |`);
  lines.push("");

  // ── Per-account detail ────────────────────────────────────────────────────────
  lines.push(`## Account Intelligence — Full Detail`);
  lines.push("---");

  for (const lead of sorted) {
    const c = lead.candidate;
    const q = lead.qualification;
    const e = lead.enrichment;
    const o = lead.outreach;
    const tierLabel = q.category === "HOT" ? "HOT" : q.category === "WARM" ? "WARM" : q.category === "COLD" ? "COLD" : "DISCARD";
    const qcIcon = o.qc_status === "APPROVED" ? "✅" : o.qc_status === "REVIEW_NEEDED" ? "⚠️" : "❌";

    const rankLabel = q.rank !== undefined ? `#${q.rank} · ` : "";
    lines.push(`### ${rankLabel}${c.company ?? "Unknown"}`);
    lines.push(`**${c.industry ?? "?"}** · ${c.company_size ?? "?"} · Score: ${q.fit_score}/10 **${tierLabel}** · QC: ${qcIcon} ${o.qc_status}`);
    lines.push("");

    // Account thesis + buying window
    if (e.account_thesis) {
      lines.push(`**Account Thesis:** ${e.account_thesis}`);
      lines.push("");
    }
    if (e.buying_window && e.buying_window !== "unclear") {
      lines.push(`**Buying Window:** ${e.buying_window.replace("_", " ")}${e.buying_window_reason ? ` — ${e.buying_window_reason}` : ""}`);
      lines.push("");
    }

    // Signal interpretation
    if (q.signal_interpretation) {
      lines.push(`**Signal Interpretation:** ${q.signal_interpretation}`);
      lines.push("");
    }

    // Tier reason
    if (q.opportunity_tier_reason) {
      lines.push(`**Tier Reasoning:** ${q.opportunity_tier_reason}`);
      lines.push("");
    }

    // Recommended action
    const action = e.recommended_action;
    const actionReason = e.recommended_action_reason;
    if (action) {
      lines.push(`**Recommended Action:** ${action.replace(/_/g, " ")}${actionReason ? ` — ${actionReason}` : ""}`);
      lines.push("");
    }

    // Next best question
    if (e.next_best_question) {
      lines.push(`**Next Best Question:** *${e.next_best_question}*`);
      lines.push("");
    }

    // Ranking explanation
    if (q.ranking_explanation) {
      lines.push(`**Ranking:** ${q.ranking_explanation}`);
      lines.push("");
    }

    // Company details + source/freshness metadata
    if (c.location) lines.push(`- Location: ${c.location}`);
    lines.push(`- Source: ${c.source} · Confidence: ${Math.round(c.confidence_score * 100)}%`);
    lines.push(`- Evidence quality: ${e.evidence_quality_grade ?? "?"}`);
    const lm = lead.learning;
    if (lm?.evidence_quality) {
      const strengthLabels: Record<string, string> = { high: "Strong evidence", medium: "Moderate evidence", low: "Limited evidence", insufficient: "Insufficient evidence" };
      lines.push(`- Evidence strength: ${strengthLabels[lm.evidence_quality] ?? lm.evidence_quality}`);
    }
    if (lm?.freshness_label) {
      lines.push(`- Signal freshness: ${lm.freshness_label}`);
    }
    if (lm?.limited_region_coverage) {
      lines.push(`- ⚠ Source coverage limited for this region`);
    }
    if (lm?.source_name) {
      lines.push(`- Source name: ${lm.source_name}`);
    }
    lines.push("");

    if (e.company_summary) {
      lines.push(`**Company Context:** ${e.company_summary}`);
      lines.push("");
    }

    const confirmedSignals = e.timing_signals.filter(
      s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
    );
    if (confirmedSignals.length > 0) {
      lines.push(`**Confirmed Signals**`);
      for (const s of confirmedSignals) lines.push(`- ⚡ ${s}`);
      lines.push("");
    }

    if (e.opportunity_risks && e.opportunity_risks.length > 0) {
      lines.push(`**Opportunity Risks**`);
      for (const r of e.opportunity_risks) lines.push(`- ⚠ ${r}`);
      lines.push("");
    }

    if (q.fit_reasons.length > 0) {
      lines.push(`**Fit Reasons**`);
      for (const r of q.fit_reasons) lines.push(`- ✓ ${r}`);
      lines.push("");
    }

    if (q.disqualification_reasons.length > 0) {
      lines.push(`**Flags**`);
      for (const r of q.disqualification_reasons) lines.push(`- ⚠ ${r}`);
      lines.push("");
    }

    if (o.qc_notes.length > 0) {
      lines.push(`**QC Notes:** ${o.qc_notes.slice(0, 2).join(" · ")}`);
      lines.push("");
    }

    if (q.fit_score >= 4 && !o.email_body.toLowerCase().startsWith("do not send")) {
      lines.push(`**Outreach Sequence**`);
      lines.push(`> *Trigger:* ${o.personalization_trigger}`);
      lines.push("");
      lines.push(`**Draft** — *Subject: ${o.subject}*`);
      lines.push(o.email_body);
      lines.push("");
      if (o.linkedin_dm && !o.linkedin_dm.toLowerCase().startsWith("do not")) {
        lines.push(`**LinkedIn:** ${o.linkedin_dm}`);
        lines.push("");
      }
      if (o.followup_1) lines.push(`**Follow-up 1:** ${o.followup_1}`);
      if (o.followup_2) lines.push(`**Follow-up 2:** ${o.followup_2}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  lines.push(`*Generated by LeadLens AI — Opportunity Intelligence Platform*`);
  return lines.join("\n");
}
