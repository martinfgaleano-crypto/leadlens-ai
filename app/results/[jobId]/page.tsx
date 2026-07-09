"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { LeadLensReport, OpportunityRanking, ProcessedLead } from "@/types";
import { getSupabaseClient } from "@/lib/supabase/client";

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

  // Reports are ownership-protected: attach the Supabase session token when a
  // session exists. Without a session (and outside demo mode) the API returns
  // 401 and we show a sign-in prompt instead of polling forever.
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return {};
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      stopped = true;
      if (poll) clearInterval(poll);
    };

    async function fetchOnce() {
      if (stopped) return;
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/report?job_id=${jobId}`, { headers });
        if (stopped) return;
        if (res.status === 401) {
          setStatus("unauthorized");
          stop();
          return;
        }
        if (res.status === 404) {
          setStatus("error");
          setError("This report does not exist or is not accessible from your account.");
          stop();
          return;
        }
        const data = await res.json();
        if (stopped) return;
        setStatus(data.status ?? (data.report ? "completed" : "error"));
        if (data.report) setReport(data.report);
        if (data.report || data.status === "completed" || data.status === "failed" || data.status === "error") stop();
      } catch {
        if (stopped) return;
        setStatus("error");
        setError("Could not reach the server.");
        stop();
      }
    }

    // Immediate first fetch — completed reports render right away instead of
    // waiting for the first 5s polling tick.
    fetchOnce();
    poll = setInterval(fetchOnce, 5000);
    return stop;
  }, [jobId, authHeaders]);

  async function download(format: "csv" | "md") {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/report?job_id=${jobId}&format=${format}`, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leadlens-${jobId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* best-effort */ }
  }

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

  if (status === "unauthorized") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-bold mb-2">Sign in to view this report</h1>
          <p className="text-gray-500 mb-4">Reports are private to the account that owns the monitor.</p>
          <a href="/login" className="inline-block bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-700">Go to sign in</a>
        </div>
      </main>
    );
  }

  if (status === "failed") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2">This run did not complete</h1>
          <p className="text-gray-500 mb-4">The monitor run failed before producing a report. Our team has visibility into failed runs.</p>
          <p className="text-gray-400 text-sm">Reference ID: <code className="bg-gray-100 px-1 rounded">{jobId}</code></p>
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
  const isComparisonRun = hasTrueComparison(report);
  const evidenceSummary = buildEvidenceSummary(report);
  const freshnessSummary = buildFreshnessSummary(report);

  // Derived next action — counts existing recommended_action values, invents nothing.
  const contactNow = (report.ranked_opportunities ?? []).filter(o => o.recommended_action === "send_outreach_now").length;
  const validateFirst = (report.ranked_opportunities ?? []).filter(o => o.recommended_action === "validate_source_first").length;
  const nextAction = contactNow > 0
    ? `Contact ${contactNow} account${contactNow === 1 ? "" : "s"} this week`
    : validateFirst > 0
      ? `Validate signals on ${validateFirst} account${validateFirst === 1 ? "" : "s"}`
      : report.hot_count + report.warm_count > 0
        ? "Review your priority accounts below"
        : "Monitor — no immediate outreach recommended";

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <a href="/dashboard" className="inline-block text-sm text-gray-500 hover:text-gray-700 mb-4 no-underline">
          ← Back to workspace
        </a>

        {/* Report header — the deliverable's cover */}
        <div className="rounded-2xl mb-8 p-6 md:p-8 text-white shadow-lg" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0c4a6e 100%)" }}>
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[0.65rem] font-bold tracking-widest uppercase text-sky-300">LeadLens · Account Intelligence</span>
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-green-400/20 text-green-300 uppercase tracking-wide">Report ready</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">Account Opportunity Report</h1>
              <p className="text-sky-200/80 text-sm">
                {report.total_leads} accounts analyzed · {PLANS[report.plan] ?? report.plan} · {new Date(report.created_at).toLocaleString()}
              </p>
              <span className={`inline-block mt-3 text-xs font-semibold px-2.5 py-1 rounded-full ${isComparisonRun ? "bg-green-400/20 text-green-300" : "bg-indigo-400/20 text-indigo-200"}`}>
                {isComparisonRun ? "↔ Compared with your previous report" : "◆ Baseline run — first report in this monitor"}
              </span>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => download("csv")} className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20">
                ⬇ CSV
              </button>
              <button onClick={() => download("md")} className="bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-400">
                ⬇ Markdown
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            { label: "Accounts",  value: report.total_leads,  accent: "border-gray-200" },
            { label: "Hot", value: report.hot_count, accent: "border-red-200" },
            { label: "Warm", value: report.warm_count, accent: "border-amber-200" },
            { label: "Cold", value: report.cold_count, accent: "border-blue-200" },
            { label: "Avg fit", value: `${report.avg_score}/10`, accent: "border-green-200" },
          ].map(s => (
            <div key={s.label} className={`bg-white border ${s.accent} rounded-xl p-4 text-center shadow-sm`}>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recommended next action — derived from existing actions only */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-5 py-3.5 mb-6 flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-widest text-sky-600">Recommended next action</div>
            <div className="text-sm font-semibold text-sky-900">{nextAction}</div>
          </div>
        </div>

        {/* Executive summary */}
        {report.executive_summary && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
            <h3 className="font-semibold mb-2 text-sm">Executive Summary</h3>
            <p className="text-sm text-gray-700">{report.executive_summary}</p>
          </div>
        )}

        {/* Evidence & freshness summary — counts of existing labels only */}
        {(evidenceSummary || freshnessSummary) && (
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {evidenceSummary && (
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold mb-2 text-sm">Evidence Quality</h3>
                <div className="flex flex-wrap gap-2">
                  {evidenceSummary.map(item => (
                    <span key={item.label} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700">
                      <span className="font-semibold">{item.count}</span> {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {freshnessSummary && (
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold mb-2 text-sm">Signal Freshness</h3>
                <div className="flex flex-wrap gap-2">
                  {freshnessSummary.map(item => (
                    <span key={item.label} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700">
                      <span className="font-semibold">{item.count}</span> {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
              searchId={report.search_id}
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

function hasTrueComparison(report: LeadLensReport): boolean {
  return (report.ranked_opportunities ?? []).some(o =>
    o.previous_action != null ||
    o.previous_evidence_quality != null ||
    o.previous_source_freshness != null ||
    o.previous_signal_date != null,
  );
}

// Counts of existing evidence_quality_counts — customer-safe labels, no enums.
function buildEvidenceSummary(report: LeadLensReport): { label: string; count: number }[] | null {
  const counts = report.evidence_quality_counts;
  if (!counts) return null;
  const items = [
    { label: "Strong evidence", count: counts.high ?? 0 },
    { label: "Moderate evidence", count: counts.medium ?? 0 },
    { label: "Limited evidence", count: counts.low ?? 0 },
    { label: "Evidence insufficient", count: counts.insufficient ?? 0 },
  ].filter(i => i.count > 0);
  return items.length > 0 ? items : null;
}

// Counts of existing per-account source_freshness values. Unknown stays
// unknown — never upgraded, never hidden.
function buildFreshnessSummary(report: LeadLensReport): { label: string; count: number }[] | null {
  const counts: Record<string, number> = {};
  for (const lead of report.processed_leads) {
    const f = lead.learning?.source_freshness;
    if (!f) continue;
    counts[f] = (counts[f] ?? 0) + 1;
  }
  const LABELS: Record<string, string> = {
    fresh:   "Fresh signals",
    recent:  "Recent signals",
    stale:   "Stale signals",
    unknown: "Freshness unknown",
  };
  const items = Object.entries(counts)
    .map(([k, count]) => ({ label: LABELS[k] ?? k, count }))
    .filter(i => i.count > 0);
  return items.length > 0 ? items : null;
}

function buildChangeSection(report: LeadLensReport): {
  title: string;
  note: string | null;
  items: { label: string; count: number }[];
} | null {
  const summary = report.change_summary;
  if (!summary || summary.client_visible_count <= 0) return null;

  const isComparison = hasTrueComparison(report);

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
  lead, ranking, jobId, searchId, expanded, onToggle,
}: {
  lead: ProcessedLead;
  ranking: OpportunityRanking | undefined;
  jobId: string;
  searchId: string | undefined;
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
  const catAccent = {
    HOT: "border-l-red-400",
    WARM: "border-l-amber-400",
    COLD: "border-l-blue-300",
    DISCARD: "border-l-gray-200",
  }[cat] ?? "border-l-gray-200";

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
    <div className={`bg-white border border-gray-100 border-l-4 ${catAccent} rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow`}>
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
          <FeedbackBar lead={lead} jobId={jobId} searchId={searchId} />
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

function FeedbackBar({ lead, jobId, searchId }: { lead: ProcessedLead; jobId: string; searchId: string | undefined }) {
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(signal: string, label: string) {
    if (sending || sent) return;
    setSending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/feedback/opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id:             jobId,
          search_id:          searchId,
          company:            lead.candidate.company,
          domain:             lead.candidate.domain ?? undefined,
          industry:           lead.candidate.industry ?? undefined,
          opportunity_score:  lead.qualification.fit_score,
          category:           lead.qualification.category,
          feedback_signal:    signal,
        }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        setSent(d.already_saved ? `${label} (already recorded)` : label);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        ✓ Feedback saved: {sent}. Your feedback helps future reports improve.
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Feedback on this account</h4>
      <p className="text-xs text-gray-400 mb-2">Your feedback helps future reports improve.</p>
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
      {failed && (
        <p className="text-xs text-red-500 mt-2">Could not save feedback — please try again.</p>
      )}
    </div>
  );
}

const PLANS: Record<string, string> = {
  sample: "Sample",
  starter: "Beta Starter",
  standard: "Beta Standard",
  pro: "Beta Pro",
};
