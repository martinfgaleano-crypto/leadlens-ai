"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { LeadLensReport } from "@/types";

/**
 * /results/[jobId]
 * Polls /api/report?job_id=xxx for job status.
 * In production: waits for Supabase-persisted job to complete.
 * In DEMO_MODE: redirected here isn't expected (use /demo-pipeline instead).
 */

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [status, setStatus] = useState<string>("pending");
  const [report, setReport] = useState<LeadLensReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/report?job_id=${jobId}`);
        const data = await res.json();
        setStatus(data.status ?? "error");
        if (data.report) setReport(data.report);
        if (data.status === "completed" || data.status === "error") clearInterval(poll);
      } catch {
        setStatus("error");
        setError("Could not reach the server.");
        clearInterval(poll);
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [jobId]);

  if (status === "pending" || status === "processing") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-pulse">⚙️</div>
          <h1 className="text-2xl font-bold mb-3">Processing your leads…</h1>
          <p className="text-gray-500 mb-2">The AI agents are researching and writing personalized outreach.</p>
          <p className="text-gray-400 text-sm">This takes 15–45 minutes. You can close this page and come back.</p>
          <p className="text-gray-300 text-xs mt-6">Job ID: {jobId}</p>
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
          <p className="text-gray-400 text-sm">Contact us with Job ID: <code className="bg-gray-100 px-1 rounded">{jobId}</code></p>
          <a href="/demo-pipeline" className="mt-6 inline-block text-sky-600 underline text-sm">
            → Try the demo pipeline instead
          </a>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Job persistence not available in DEMO_MODE. Use <a href="/demo-pipeline" className="text-sky-600 underline">/demo-pipeline</a> instead.</p>
      </main>
    );
  }

  const sorted = [...report.processed_leads].sort(
    (a, b) => b.qualification.fit_score - a.qualification.fit_score
  );

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Your report is ready</h1>
            <p className="text-gray-500">{report.total_leads} leads · {PLANS[report.plan]} · {new Date(report.created_at).toLocaleString()}</p>
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
            { label: "Total",     value: report.total_leads,  color: "bg-white" },
            { label: "HOT 🔥",    value: report.hot_count,    color: "bg-red-50" },
            { label: "WARM 🟡",   value: report.warm_count,   color: "bg-yellow-50" },
            { label: "COLD 🔵",   value: report.cold_count,   color: "bg-blue-50" },
            { label: "Avg score", value: `${report.avg_score}/10`, color: "bg-green-50" },
          ].map(s => (
            <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 text-center`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-gray-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Executive summary */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <h3 className="font-semibold mb-2 text-sm">Executive Summary</h3>
          <p className="text-sm text-gray-700">{report.executive_summary}</p>
        </div>

        {/* Lead list */}
        <div className="space-y-3">
          {sorted.map((lead, i) => {
            const q = lead.qualification;
            const o = lead.outreach;
            const c = lead.candidate;
            const cat = q.fit_score >= 8 ? "HOT" : q.fit_score >= 6 ? "WARM" : q.fit_score >= 4 ? "COLD" : "DISCARD";
            const catColor = { HOT: "bg-red-100 text-red-700", WARM: "bg-amber-100 text-amber-700", COLD: "bg-blue-100 text-blue-700", DISCARD: "bg-gray-100 text-gray-500" }[cat];

            return (
              <div key={lead.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-gray-300 font-mono text-sm w-5 flex-shrink-0">#{i + 1}</span>
                    <div className="min-w-0">
                      <span className="font-medium">{c.name ?? "Unknown"}</span>
                      <span className="text-gray-500 text-sm ml-2">— {c.company}</span>
                      <div className="text-gray-400 text-xs truncate">{c.title ?? "?"} · {c.email ?? "no email"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${catColor}`}>{cat}</span>
                    <span className="text-gray-500 text-sm">{q.fit_score}/10</span>
                    <span className="text-gray-300">{expanded === i ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded === i && (
                  <div className="border-t border-gray-100 p-5 space-y-4">
                    {q.fit_reasons.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fit reasons</h4>
                        <ul className="space-y-1">
                          {q.fit_reasons.map((r, j) => (
                            <li key={j} className="text-sm text-gray-600 flex gap-2"><span className="text-green-500">✓</span>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Personalization trigger</h4>
                      <p className="text-sm italic text-gray-700">{o.personalization_trigger}</p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Email — Subject: {o.subject}</h4>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{o.email_body}</pre>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                      {[
                        { label: "LinkedIn DM", content: o.linkedin_dm },
                        { label: "Follow-up 1 (day 3–4)", content: o.followup_1 },
                        { label: "Follow-up 2 (day 7–8)", content: o.followup_2 },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{item.label}</h4>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{item.content}</pre>
                        </div>
                      ))}
                    </div>

                    {o.qc_status !== "APPROVED" && o.qc_notes.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                        ⚠️ {o.qc_notes.join(" · ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

const PLANS: Record<string, string> = {
  starter: "Beta Starter",
  standard: "Beta Standard",
  pro: "Beta Pro",
};
