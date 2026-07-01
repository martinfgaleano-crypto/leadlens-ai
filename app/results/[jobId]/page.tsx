"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { LeadLensReport, OpportunityRanking, ProcessedLead } from "@/types";

/**
 * /results/[jobId] — Account-level Opportunity Report (customer-facing).
 *
 * Polls /api/report?job_id=xxx for job status, then renders the report as an
 * account/company opportunity monitor.
 *
 * Account-level rules (product positioning):
 *   - No personal names, emails, phone numbers, titles, or LinkedIn profiles are
 *     ever rendered — even if legacy report_json contains them.
 *   - Rows are companies/accounts, not contacts.
 *   - Freshness is only shown from real labels; unknown is shown as unknown.
 *   - "Change" labels appear only when client_visible is true.
 */

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [status, setStatus] = useState<string>("pending");
  const [report, setReport] = useState<LeadLensReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/report?job_id=${jobId}`);
        const data = await res.json();
        setStatus(data.status ?? (data.report ? "completed" : "error"));
        if (data.report) setReport(data.report);
        if (data.report || data.status === "completed" || data.status === "error") clearInterval(poll);
      } catch {
        setStatus("error");
        setError("Could not reach the server.");
        clearInterval(poll);
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [jobId]);

  const rankingMap = useMemo(() => {
    const map = new Map<string, OpportunityRanking>();
    for (const opp of report?.ranked_opportunities ?? []) {
      if (opp.lead_id) map.set(opp.lead_id, opp);
    }
    return map;
  }, [report]);

  if (status === "pending" || status === "processing") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-pulse">⚙️</div>
          <h1 className="text-2xl font-bold mb-3">Building your opportunity report…</h1>
          <p className="text-gray-500 mb-2">The AI agents are researching accounts and gathering evidence.</p>
          <p className="text-gray-400 text-sm">This takes 15–45 minutes. You can close this page and come back.</p>
          <p className="text-gray-300 text-xs mt-6">Report ID: {jobId}</p>
        </div>
      </main>
    );
  }

  if (status === "error" || error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-500 mb-4">{error ?? "An unexpected error occurred."}</p>
          <p className="text-gray-400 text-sm">Contact us with Report ID: <code className="bg-gray-100 px-1 rounded">{jobId}</code></p>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Report not available. If this persists, contact support with Report ID <code className="bg-gray-100 px-1 rounded">{jobId}</code>.</p>
      </main>
    );
  }

  // Ranking order when available, score order otherwise. Never re-ranked client-side.
  const sorted = [...report.processed_leads].sort((a, b) => {
    const ra = rankingMap.get(a.id)?.rank;
    const rb = rankingMap.get(b.id)?.rank;
    if (ra != null && rb != null) return ra - rb;
    return b.qualification.fit_score - a.qualification.fit_score;
  });

  const changeSection = buildChangeSection(report);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Account Opportunity Report</h1>
            <p className="text-gray-500">{report.total_leads} accounts analyzed · {PLANS[report.plan] ?? report.plan} · {new Date(report.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-3">
            <a href={`/api/report?job_id=${jobId}&format=csv`} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              ⬇ CSV
            </a>
            <a href={`/api/report?job_id=${jobId}&format=md`} className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-700">
              ⬇ Markdown
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Accounts",  value: report.total_leads,  color: "bg-white" },
            { label: "HOT 🔥",    value: report.hot_count,    color: "bg-red-50" },
            { label: "WARM 🟡",   value: report.warm_count,   color: "bg-yellow-50" },
            { label: "COLD 🔵",   value: report.cold_count,   color: "bg-blue-50" },
            { label: "Avg fit",   value: `${report.avg_score}/10`, color: "bg-green-50" },
          ].map(s => (
            <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 text-center`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-gray-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Executive summary */}
        {report.executive_summary && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
            <h3 className="font-semibold mb-2 text-sm">Executive Summary</h3>
            <p className="text-sm text-gray-700">{report.executive_summary}</p>
          </div>
        )}

        {/* What Changed */}
        {changeSection && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
            <h3 className="font-semibold mb-1 text-sm">{changeSection.title}</h3>
            {changeSection.note && <p className="text-xs text-gray-400 mb-3">{changeSection.note}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              {changeSection.items.map(item => (
                <span key={item.label} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700">
                  <span className="font-semibold">{item.count}</span> {item.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Account list */}
        <div className="space-y-3">
          {sorted.map(lead => (
            <AccountCard
              key={lead.id}
              lead={lead}
              ranking={rankingMap.get(lead.id)}
              jobId={jobId}
              expanded={expanded === lead.id}
              onToggle={() => setExpanded(prev => (prev === lead.id ? null : lead.id))}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── What Changed section builder ─────────────────────────────────────────────
// "Since Last Report" only when previous_* fields prove a real comparison ran.
// Noise types are never shown to customers.

const CUSTOMER_CHANGE_LABELS: Record<string, string> = {
  new_account:                "New this cycle",
  new_evidence:               "New evidence found",
  fresh_signal_added:         "Fresh signal detected",
  signal_became_stale:        "Signal appears stale",
  priority_increased:         "Priority increased",
  priority_decreased:         "Priority decreased",
  repeated_with_new_evidence: "Seen before, new evidence",
  excluded_by_feedback:       "Excluded based on your feedback",
  revived_account:            "Back on the radar",
  still_relevant:             "Still relevant",
};

function buildChangeSection(report: LeadLensReport): {
  title: string;
  note: string | null;
  items: { label: string; count: number }[];
} | null {
  const summary = report.change_summary;
  if (!summary || summary.client_visible_count <= 0) return null;

  const isComparison = (report.ranked_opportunities ?? []).some(o =>
    o.previous_action != null ||
    o.previous_evidence_quality != null ||
    o.previous_source_freshness != null ||
    o.previous_signal_date != null,
  );

  const items: { label: string; count: number }[] = [];
  for (const [type, count] of Object.entries(summary.by_type ?? {})) {
    if (!count || count <= 0) continue;
    const label = CUSTOMER_CHANGE_LABELS[type];
    if (!label) continue; // noise types (no_meaningful_change, repeated_no_change) have no customer label
    items.push({ label, count });
  }
  if (items.length === 0) return null;

  return isComparison
    ? { title: "What Changed Since Last Report", note: null, items }
    : {
        title: "Current Change Signals",
        note: "Baseline run — no previous report was available for comparison.",
        items,
      };
}

// ─── Account card ─────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  send_outreach_now:      "Contact this week",
  validate_source_first:  "Validate the signal first",
  monitor_for_new_signal: "Monitor for a new signal",
  enrich_manually:        "Research further",
  add_to_watchlist:       "Add to watchlist",
  exclude:                "Do not pursue",
};

function AccountCard({
  lead, ranking, jobId, expanded, onToggle,
}: {
  lead: ProcessedLead;
  ranking: OpportunityRanking | undefined;
  jobId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = lead.candidate;
  const q = lead.qualification;
  const e = lead.enrichment;
  const lm = lead.learning;

  const cat = q.category;
  const catColor = {
    HOT: "bg-red-100 text-red-700",
    WARM: "bg-amber-100 text-amber-700",
    COLD: "bg-blue-100 text-blue-700",
    DISCARD: "bg-gray-100 text-gray-500",
  }[cat] ?? "bg-gray-100 text-gray-500";

  const action = ranking?.recommended_action ?? e.recommended_action;
  const actionLabel = action ? (ACTION_LABELS[action] ?? action.replace(/_/g, " ")) : null;

  const evidenceLabel = ranking?.evidence_strength_label
    ?? (lm?.evidence_quality
      ? { high: "Strong evidence", medium: "Moderate evidence", low: "Limited evidence", insufficient: "Evidence limited" }[lm.evidence_quality]
      : null);

  const freshnessLabel = ranking?.source_freshness_label ?? lm?.freshness_label ?? null;
  const coverageNote = ranking?.source_coverage_note ?? (lm?.limited_region_coverage ? "Source coverage limited for this region" : null);
  const sourceName = ranking?.source_name ?? lm?.source_name ?? null;
  const changeLabel = ranking?.client_visible === true && ranking.change_label ? ranking.change_label : null;

  const confirmedSignals = e.timing_signals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred"),
  );

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-gray-300 font-mono text-sm w-8 flex-shrink-0">
            {ranking?.rank != null ? `#${ranking.rank}` : "—"}
          </span>
          <div className="min-w-0">
            <span className="font-medium">{c.company}</span>
            <div className="text-gray-400 text-xs truncate">
              {c.industry ?? "Industry not available"} · {c.location ?? "Region not available"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {changeLabel && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full hidden md:inline">{changeLabel}</span>
          )}
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${catColor}`}>{cat}</span>
          <span className="text-gray-500 text-sm">{q.fit_score}/10</span>
          <span className="text-gray-300">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          {/* Recommended action */}
          {actionLabel && (
            <div className="bg-sky-50 border border-sky-100 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-sky-700 uppercase mb-1">Recommended action</h4>
              <p className="text-sm text-sky-900 font-medium">{actionLabel}</p>
            </div>
          )}

          {/* Why it fits */}
          {(e.account_thesis || q.fit_reasons.length > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Why this account fits</h4>
              {e.account_thesis && <p className="text-sm text-gray-700 mb-2 italic">{e.account_thesis}</p>}
              <ul className="space-y-1">
                {q.fit_reasons.map((r, j) => (
                  <li key={j} className="text-sm text-gray-600 flex gap-2"><span className="text-green-500">✓</span>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Why now */}
          {(e.why_now || confirmedSignals.length > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Why now</h4>
              {e.why_now && <p className="text-sm text-gray-700 mb-2">{e.why_now}</p>}
              {confirmedSignals.length > 0 && (
                <ul className="space-y-1">
                  {confirmedSignals.map((s, j) => (
                    <li key={j} className="text-sm text-gray-600 flex gap-2"><span className="text-amber-500">⚡</span>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Change classification */}
          {changeLabel && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Change</h4>
              <p className="text-sm text-indigo-700">{changeLabel}</p>
            </div>
          )}

          {/* Evidence & source context */}
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Evidence strength</h4>
              <p className="text-sm text-gray-700">{evidenceLabel ?? "Not available"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Signal freshness</h4>
              <p className="text-sm text-gray-700">{freshnessLabel ?? "Signal date not confirmed"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Source context</h4>
              <p className="text-sm text-gray-700">{sourceName ?? "Not available"}</p>
              {coverageNote && <p className="text-xs text-amber-600 mt-1">⚠ {coverageNote}</p>}
            </div>
          </div>

          {/* Flags / risks */}
          {q.disqualification_reasons.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              ⚠️ {q.disqualification_reasons.join(" · ")}
            </div>
          )}

          {/* Feedback */}
          <FeedbackBar lead={lead} jobId={jobId} />
        </div>
      )}
    </div>
  );
}

// ─── Feedback bar (account-level) ─────────────────────────────────────────────
// Wires to the existing POST /api/feedback/opportunity — company-level only.

const FEEDBACK_OPTIONS: { label: string; signal: string }[] = [
  { label: "Good fit",           signal: "useful" },
  { label: "Not relevant",       signal: "irrelevant" },
  { label: "Already contacted",  signal: "contacted" },
  { label: "Weak evidence",      signal: "generic" },
  { label: "Show more like this", signal: "add_to_vault" },
  { label: "Do not show again",  signal: "exclude_similar" },
];

function FeedbackBar({ lead, jobId }: { lead: ProcessedLead; jobId: string }) {
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(signal: string, label: string) {
    if (sending || sent) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback/opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id:             jobId,
          company:            lead.candidate.company,
          domain:             lead.candidate.domain ?? undefined,
          industry:           lead.candidate.industry ?? undefined,
          opportunity_score:  lead.qualification.fit_score,
          category:           lead.qualification.category,
          feedback_signal:    signal,
        }),
      });
      if (res.ok) setSent(label);
    } catch {
      // best-effort — leave buttons enabled on failure
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        ✓ Feedback saved: {sent}. This improves your next report.
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Feedback on this account</h4>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_OPTIONS.map(opt => (
          <button
            key={opt.signal}
            onClick={() => send(opt.signal, opt.label)}
            disabled={sending}
            className="text-xs border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const PLANS: Record<string, string> = {
  sample: "Sample",
  starter: "Beta Starter",
  standard: "Beta Standard",
  pro: "Beta Pro",
};
