"use client";
// Institutional Opportunity Brief — customer-facing, premium presentation over
// the SAME report snapshot the customer already owns (/api/results/[jobId]).
// New route: does NOT replace /results/[jobId]. No new API, no external calls at
// render, no ranking change — pure client-side assembly of existing data.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import type { InstitutionalOpportunityReportV1, Claim, ClaimBasis, AccountDossier } from "@/lib/reports/institutional-report-types";

const BASIS: Record<ClaimBasis, { label: string; bg: string; fg: string }> = {
  fact: { label: "Verified", bg: "#dcfce7", fg: "#15803d" },
  inference: { label: "Analysis", bg: "#e0f2fe", fg: "#0369a1" },
  hypothesis: { label: "Hypothesis", bg: "#fef3c7", fg: "#b45309" },
  recommendation: { label: "Recommendation", bg: "#eef2ff", fg: "#4338ca" },
  unknown: { label: "Unknown", bg: "#f1f5f9", fg: "#64748b" },
};

function Tag({ basis }: { basis: ClaimBasis }) {
  const b = BASIS[basis];
  return <span style={{ display: "inline-block", background: b.bg, color: b.fg, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", marginRight: 7, verticalAlign: "middle" }}>{b.label}</span>;
}
function ClaimP({ c }: { c: Claim }) {
  return <p style={{ fontSize: 14, lineHeight: 1.6, color: "#1e293b", margin: "4px 0" }}><Tag basis={c.basis} />{c.text}{c.evidence && <span style={{ color: "#94a3b8", fontSize: 12 }}> — {c.evidence}</span>}</p>;
}

const GRADE = { strong: { label: "Strong evidence", c: "#15803d" }, moderate: { label: "Moderate evidence", c: "#b45309" }, developing: { label: "Developing", c: "#64748b" } };

export default function InstitutionalBriefPage() {
  const jobId = useParams()?.jobId as string;
  const [report, setReport] = useState<InstitutionalOpportunityReportV1 | null>(null);
  const [state, setState] = useState<"loading" | "processing" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/results/${jobId}`);
        if (res.status === 202) { setState("processing"); return; }
        const d = await res.json();
        if (!res.ok || !d.report) { setState("error"); setMsg(d.error ?? "This brief is not available."); return; }
        setReport(assembleInstitutionalReport(d.report, { job_id: jobId, plan: d.plan ?? null, search_id: null, customer_ref: null, created_at: d.created_at ?? new Date().toISOString() }));
      } catch { setState("error"); setMsg("Could not load this brief."); }
    })();
  }, [jobId]);

  const wrap: React.CSSProperties = { maxWidth: 880, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a" };
  if (state === "processing") return <div style={wrap}><p style={{ color: "#64748b" }}>Your brief is being generated. This can take a few minutes — refresh shortly.</p></div>;
  if (state === "error") return <div style={wrap}><p style={{ color: "#64748b" }}>{msg}</p></div>;
  if (!report) return <div style={wrap}><p style={{ color: "#94a3b8" }}>Preparing your brief…</p></div>;

  const r = report;
  const q = r.quality;
  const sec: React.CSSProperties = { background: "#fff", border: "1px solid #e8edf3", borderRadius: 12, padding: "22px 26px", marginBottom: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.03)" };
  const h2: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", margin: "0 0 12px" };
  const tierColor = (t: string) => t === "HOT" ? "#dc2626" : t === "WARM" ? "#d97706" : t === "COLD" ? "#0284c7" : "#94a3b8";

  return (
    <div style={{ background: "#f6f8fb", minHeight: "100vh" }}>
      <style>{`@media print { body { background: #fff; } button { display: none !important; } .ib-sec { box-shadow: none; break-inside: avoid; } }`}</style>
      <div style={wrap} data-institutional-brief-version="institutional-brief-v1">
        {/* Cover */}
        <div style={{ background: "linear-gradient(135deg,#0b1220,#12314f 60%,#0c4a6e)", color: "#fff", borderRadius: 16, padding: "34px 34px 30px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#7dd3fc", marginBottom: 8 }}>Opportunity Intelligence Brief</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, margin: "0 0 10px", maxWidth: 640 }}>{r.executive_brief.headline}</h1>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "#cbd5e1", alignItems: "center" }}>
            <span>{r.metadata.generated_at.slice(0, 10)}</span>
            <span>·</span>
            <span>{r.portfolio_summary.total} accounts analyzed</span>
            {q && <><span>·</span><span style={{ color: GRADE[q.grade].c === "#64748b" ? "#cbd5e1" : "#a7f3d0", fontWeight: 700 }}>{GRADE[q.grade].label}</span></>}
          </div>
          <button onClick={() => window.print()} style={{ marginTop: 16, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Download PDF</button>
        </div>

        {/* Executive brief */}
        <div style={sec} className="ib-sec">
          <h2 style={h2}>Executive Brief</h2>
          <ClaimP c={r.executive_brief.summary} />
          <div style={{ display: "flex", gap: 26, marginTop: 14, flexWrap: "wrap" }}>
            {[["Priority accounts", r.executive_brief.priority_count], ["Markets", r.context.regions.length || "—"], ["Industries", r.context.industries.length || "—"], ["Evidence coverage", q ? `${q.evidence_coverage_pct}%` : "—"]].map(([l, v]) => (
              <div key={l as string}><div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{v as React.ReactNode}</div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", fontWeight: 700 }}>{l as string}</div></div>
            ))}
          </div>
        </div>

        {/* Portfolio intelligence */}
        <div style={sec} className="ib-sec">
          <h2 style={h2}>Portfolio Intelligence</h2>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 10, background: "#eef2f7" }}>
            {(["hot", "warm", "cold", "discard"] as const).map((k) => {
              const v = r.portfolio_summary[k]; const total = r.portfolio_summary.total || 1;
              return v > 0 ? <div key={k} title={`${k}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: tierColor(k.toUpperCase()) }} /> : null;
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
            {(["hot", "warm", "cold", "discard"] as const).map((k) => (
              <span key={k} style={{ color: "#475569" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: tierColor(k.toUpperCase()), marginRight: 5 }} /><strong>{r.portfolio_summary[k]}</strong> {k}</span>
            ))}
          </div>
          {r.portfolio_summary.funnel && (
            <p style={{ fontSize: 12.5, color: "#475569", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
              Selection funnel: <strong>{r.portfolio_summary.funnel.considered}</strong> accounts considered → <strong>{r.portfolio_summary.funnel.rejected}</strong> filtered out → <strong style={{ color: "#0369a1" }}>{r.portfolio_summary.funnel.selected}</strong> selected for you.
            </p>
          )}
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{r.portfolio_summary.tier_note}</p>
        </div>

        {/* Account dossiers */}
        <h2 style={{ ...h2, fontSize: 15, margin: "26px 0 12px", color: "#0f172a" }}>Account Dossiers</h2>
        {r.account_dossiers.map((d: AccountDossier, i) => (
          <div key={i} style={{ ...sec, borderLeft: `4px solid ${tierColor(d.tier)}` }} className="ib-sec">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong style={{ fontSize: 17, color: "#0f172a" }}>{d.rank ? `${d.rank}. ` : ""}{d.company}</strong>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{[d.industry, d.location, d.domain].filter(Boolean).join(" · ") || "Account details limited"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: tierColor(d.tier) }}>{d.tier}</span>
                {d.evidence_grounded != null && <div style={{ fontSize: 10, fontWeight: 700, color: d.evidence_grounded ? "#15803d" : "#b45309", marginTop: 2 }}>{d.evidence_grounded ? "EVIDENCE-GROUNDED" : "VALIDATE FIRST"}</div>}
              </div>
            </div>
            <div style={{ marginTop: 10 }}><ClaimP c={d.thesis} /></div>
            {([["Why now", d.why_now], ["Why this company", d.why_this_company], ["Why this quarter", d.why_this_quarter]] as const).map(([label, claim]) => (
              <div key={label} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <ClaimP c={claim} />
              </div>
            ))}
            {d.evidence_chain.length > 0 && (
              <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Evidence chain</div>
                {d.evidence_chain.map((ev, j) => (
                  <div key={j} style={{ fontSize: 12.5, color: "#334155", margin: "3px 0" }}>
                    <Tag basis={ev.url ? "fact" : "inference"} />
                    {ev.url ? <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>{ev.label}</a> : ev.label}
                    {ev.date && <span style={{ color: "#94a3b8" }}> · {ev.date}</span>}
                  </div>
                ))}
              </div>
            )}
            {d.risks.length > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Risks & unknowns</div>{d.risks.map((rk, j) => <ClaimP key={j} c={rk} />)}</div>}
            {d.hypotheses.length > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Validate before contact</div>{d.hypotheses.map((h, j) => <ClaimP key={j} c={h} />)}</div>}
            {d.playbook && (
              <div style={{ marginTop: 10, background: "#fef2f2", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 4 }}>Commercial approach</div>
                {Object.entries(d.playbook).map(([k, v]) => <p key={k} style={{ fontSize: 12.5, margin: "3px 0", color: "#334155" }}><strong style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}:</strong> {v}</p>)}
              </div>
            )}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Recommended next step</div>
              <ClaimP c={d.recommended_next_step} />
            </div>
          </div>
        ))}

        {/* Methodology + limitations */}
        <div style={sec} className="ib-sec">
          <h2 style={h2}>How this brief was built</h2>
          <ul style={{ fontSize: 12.5, color: "#475569", margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{r.methodology.map((m, i) => <li key={i}>{m}</li>)}</ul>
          {q && <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>{q.note}</p>}
        </div>
        <div style={{ ...sec, background: "#fffbeb", border: "1px solid #fde68a" }} className="ib-sec">
          <h2 style={{ ...h2, color: "#b45309" }}>What this brief is — and isn't</h2>
          <ul style={{ fontSize: 12.5, color: "#92400e", margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{r.limitations.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
        <p style={{ fontSize: 10, color: "#cbd5e1", textAlign: "center", marginTop: 4 }}>LeadLens · brief schema v{r.schema_version} · {r.metadata.generated_at.slice(0, 10)}</p>
      </div>
    </div>
  );
}
