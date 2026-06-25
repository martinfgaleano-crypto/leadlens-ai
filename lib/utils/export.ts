import type { LeadLensReport, ProcessedLead } from "@/types";

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Priority", "Priority Label", "Opportunity Score", "Evidence Status",
  "Company", "Industry", "Company Size", "Location", "Source", "Source URL", "Confidence Score",
  "Why It Fits", "Flags",
  "Timing Signals", "Company Context",
  "Recommended Angle", "Outreach Subject", "Outreach Draft",
  "LinkedIn Message", "Follow-up 1", "Follow-up 2", "QC Notes",
];

export function exportToCSV(report: LeadLensReport): string {
  const sorted = [...report.processed_leads].sort(
    (a, b) => b.qualification.fit_score - a.qualification.fit_score
  );

  const rows = sorted.map((lead, i) => {
    const c = lead.candidate;
    const e = lead.enrichment;
    const q = lead.qualification;
    const o = lead.outreach;
    const category = q.fit_score >= 8 ? "HOT" : q.fit_score >= 6 ? "WARM" : q.fit_score >= 4 ? "COLD" : "DISCARD";

    return [
      i + 1, category, q.fit_score, c.email_status ?? "",
      c.company, c.industry ?? "", c.company_size ?? "", c.location ?? "",
      c.source, c.source_url ?? "", c.confidence_score.toFixed(2),
      q.fit_reasons.join(" | "), q.disqualification_reasons.join(" | "),
      e.timing_signals.join(" | "), e.company_summary ?? "",
      o.personalization_trigger, o.subject,
      o.email_body.replace(/\n/g, " "), o.linkedin_dm.replace(/\n/g, " "),
      o.followup_1.replace(/\n/g, " "), o.followup_2.replace(/\n/g, " "),
      o.qc_notes.join(" | "),
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
  const sorted = [...report.processed_leads].sort(
    (a, b) => b.qualification.fit_score - a.qualification.fit_score
  );
  const lines: string[] = [];

  lines.push(`# LeadLens AI — Opportunity Snapshot`);
  lines.push(`**Plan:** ${report.plan} · **Opportunities:** ${report.total_leads} · **Generated:** ${new Date(report.created_at).toLocaleString()}`);
  lines.push(`**Job ID:** \`${report.job_id}\``);
  lines.push("");

  lines.push(`## Executive Summary`);
  lines.push(report.executive_summary);
  lines.push("");

  lines.push(`## Summary Stats`);
  lines.push(`| Category | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| 🔥 HOT | ${report.hot_count} |`);
  lines.push(`| 🟡 WARM | ${report.warm_count} |`);
  lines.push(`| 🔵 COLD | ${report.cold_count} |`);
  lines.push(`| ⛔ DISCARD | ${report.discard_count} |`);
  lines.push(`| Avg Score | ${report.avg_score}/10 |`);
  lines.push("");

  lines.push(`## Patterns Observed`);
  for (const p of report.patterns_observed) lines.push(`- ${p}`);
  lines.push("");

  lines.push(`## Recommendations`);
  for (const r of report.recommendations) lines.push(`- ${r}`);
  lines.push("");

  lines.push(`## Opportunity Breakdown`);
  lines.push("---");

  for (let i = 0; i < sorted.length; i++) {
    const lead = sorted[i];
    const c = lead.candidate;
    const q = lead.qualification;
    const o = lead.outreach;
    const cat = q.fit_score >= 8 ? "🔥 HOT" : q.fit_score >= 6 ? "🟡 WARM" : q.fit_score >= 4 ? "🔵 COLD" : "⛔ DISCARD";
    const qcIcon = o.qc_status === "APPROVED" ? "✅" : o.qc_status === "REVIEW_NEEDED" ? "⚠️" : "❌";

    lines.push(`### ${i + 1}. ${c.company ?? "Unknown"}`);
    lines.push(`**${c.industry ?? "?"}** · ${c.company_size ?? "?"}`);
    lines.push(`**Opportunity Score:** ${q.fit_score}/10 ${cat} · **Evidence:** ${qcIcon} ${o.qc_status}`);
    lines.push("");

    if (c.location) lines.push(`- Location: ${c.location}`);
    lines.push(`- Source: ${c.source}${c.source_url ? ` — ${c.source_url}` : ""}`);
    lines.push(`- Confidence: ${Math.round(c.confidence_score * 100)}%`);
    lines.push("");

    if (lead.enrichment.company_summary) {
      lines.push(`**Company Context:** ${lead.enrichment.company_summary}`);
      lines.push("");
    }

    if (lead.enrichment.timing_signals.length > 0) {
      lines.push(`**Timing Signals / Buying Signals**`);
      for (const s of lead.enrichment.timing_signals) lines.push(`- ⚡ ${s}`);
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
      lines.push(`**QC Notes:** ${o.qc_notes.join(" · ")}`);
      lines.push("");
    }

    if (q.fit_score >= 4) {
      lines.push(`**Outreach Sequence**`);
      lines.push(`> *Trigger:* ${o.personalization_trigger}`);
      lines.push("");
      lines.push(`**Outreach Draft** — *Subject: ${o.subject}*`);
      lines.push(o.email_body);
      lines.push("");
      lines.push(`**LinkedIn Message**`);
      lines.push(o.linkedin_dm);
      lines.push("");
      lines.push(`**Follow-up 1 (Day 3–4):** ${o.followup_1}`);
      lines.push(`**Follow-up 2 (Day 7–8):** ${o.followup_2}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  lines.push(`*Generated by LeadLens AI — Opportunity Snapshot*`);
  return lines.join("\n");
}
