"use client";
// Institutional Opportunity Report — admin-only, print-ready presentation over
// an existing snapshot. Separate route from customer /results; never changes
// ranking. Every material statement is basis-labeled (fact/inference/etc).

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "../../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";
import type { InstitutionalOpportunityReportV1, Claim, ClaimBasis, AccountDossier } from "@/lib/reports/institutional-report-types";

const BASIS: Record<ClaimBasis, { label: string; bg: string; fg: string }> = {
  fact: { label: "FACT", bg: "#dcfce7", fg: "#166534" },
  inference: { label: "INFERENCE", bg: "#e0f2fe", fg: "#075985" },
  hypothesis: { label: "HYPOTHESIS", bg: "#fef3c7", fg: "#92400e" },
  recommendation: { label: "RECOMMENDATION", bg: "#eef2ff", fg: "#3730a3" },
  unknown: { label: "UNKNOWN", bg: "#f1f5f9", fg: "#64748b" },
};

function BasisTag({ basis }: { basis: ClaimBasis }) {
  const b = BASIS[basis];
  return <span style={{ display: "inline-block", background: b.bg, color: b.fg, borderRadius: "3px", padding: "0 4px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.04em", marginRight: 6, verticalAlign: "middle" }}>{b.label}</span>;
}
function ClaimLine({ c }: { c: Claim }) {
  return (
    <p style={{ fontSize: 13, lineHeight: 1.5, color: "#1e293b", margin: "3px 0" }}>
      <BasisTag basis={c.basis} />{c.text}
      {c.evidence && <span style={{ color: "#94a3b8", fontSize: 11 }}> — {c.evidence}</span>}
    </p>
  );
}

export default function InstitutionalReportPage() {
  const params = useParams();
  const jobId = params?.jobId as string;
  const [report, setReport] = useState<InstitutionalOpportunityReportV1 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch(`/api/admin/reports/institutional/${jobId}`);
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? `Load failed (${res.status})`); return; }
    setReport(d.report);
  }, [jobId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <AdminLayout><p style={{ color: "#b91c1c" }}>{error}</p></AdminLayout>;
  if (!report) return <AdminLayout><p style={{ color: "#64748b" }}>Assembling report…</p></AdminLayout>;

  const r = report;
  const sec: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "18px 22px", marginBottom: 16 };
  const h2: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f172a", margin: "0 0 10px" };

  return (
    <AdminLayout>
      <style>{`@media print { nav, aside, button { display: none !important; } main { margin: 0 !important; padding: 0 !important; max-width: 100% !important; } .inst-report { box-shadow: none; } }`}</style>
      <div className="inst-report" data-institutional-report-version="institutional-report-v1" style={{ maxWidth: 860 }}>
        {/* Cover */}
        <div style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f 70%,#0c4a6e)", color: "#fff", borderRadius: 10, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7dd3fc" }}>Institutional Opportunity Report</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px" }}>{r.executive_brief.headline}</h1>
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>
            {r.context.customer_ref ?? "—"} · generated {r.metadata.generated_at.slice(0, 10)} · {r.portfolio_summary.total} accounts · schema v{r.schema_version}
          </div>
          <button onClick={() => window.print()} style={{ marginTop: 12, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Print / Save PDF</button>
        </div>

        {/* Executive brief */}
        <div style={sec}>
          <h2 style={h2}>Executive Brief</h2>
          <ClaimLine c={r.executive_brief.summary} />
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            {[["Priority accounts", r.executive_brief.priority_count], ["Total analyzed", r.executive_brief.total_accounts], ["Markets", r.context.regions.length || "—"], ["Avg fit", r.portfolio_summary.avg_fit_score ?? "—"]].map(([l, v]) => (
              <div key={l as string}><div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{v as React.ReactNode}</div><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>{l as string}</div></div>
            ))}
          </div>
        </div>

        {/* Portfolio summary */}
        <div style={sec}>
          <h2 style={h2}>Portfolio Summary</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["HOT", r.portfolio_summary.hot, "#fee2e2", "#991b1b"], ["WARM", r.portfolio_summary.warm, "#fef3c7", "#92400e"], ["COLD", r.portfolio_summary.cold, "#e0f2fe", "#075985"], ["DISCARD", r.portfolio_summary.discard, "#f1f5f9", "#64748b"]].map(([l, v, bg, fg]) => (
              <div key={l as string} style={{ background: bg as string, color: fg as string, borderRadius: 6, padding: "8px 14px", textAlign: "center", minWidth: 68 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{v as number}</div><div style={{ fontSize: 10, fontWeight: 700 }}>{l as string}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{r.portfolio_summary.tier_note}</p>
          {r.portfolio_summary.funnel && (
            <p style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
              Funnel: {r.portfolio_summary.funnel.considered} considered → {r.portfolio_summary.funnel.rejected} rejected → <strong>{r.portfolio_summary.funnel.selected} selected</strong>
            </p>
          )}
        </div>

        {/* Priority opportunities */}
        {r.priority_opportunities.length > 0 && (
          <div style={sec}>
            <h2 style={h2}>Priority Opportunities</h2>
            {r.priority_opportunities.map((p) => (
              <div key={`${p.rank}-${p.company}`} style={{ borderTop: "1px solid #f1f5f9", padding: "7px 0", display: "flex", gap: 10 }}>
                <span style={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, minWidth: 26 }}>#{p.rank ?? "—"}</span>
                <div><strong style={{ fontSize: 13 }}>{p.company}</strong> <span style={{ fontSize: 10, fontWeight: 700, color: "#991b1b" }}>{p.tier}</span><div style={{ fontSize: 12, color: "#64748b" }}>{p.one_line}</div></div>
              </div>
            ))}
          </div>
        )}

        {/* Account dossiers */}
        <h2 style={{ ...h2, fontSize: 14, marginTop: 22 }}>Account Dossiers</h2>
        {r.account_dossiers.map((d: AccountDossier, i) => (
          <div key={i} style={{ ...sec, borderLeft: `3px solid ${d.tier === "HOT" ? "#ef4444" : d.tier === "WARM" ? "#f59e0b" : "#cbd5e1"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
              <div><strong style={{ fontSize: 15, color: "#0f172a" }}>{d.rank ? `#${d.rank} · ` : ""}{d.company}</strong>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{[d.industry, d.location, d.domain].filter(Boolean).join(" · ") || "—"}</div></div>
              <div style={{ textAlign: "right" }}><span style={{ fontSize: 11, fontWeight: 800, color: "#991b1b" }}>{d.tier}</span>{d.fit_score != null && <span style={{ fontSize: 11, color: "#64748b" }}> · fit {d.fit_score}</span>}
                {d.evidence_grounded != null && <div style={{ fontSize: 9, fontWeight: 700, color: d.evidence_grounded ? "#166534" : "#92400e" }}>{d.evidence_grounded ? "EVIDENCE-GROUNDED" : "VALIDATE FIRST"}</div>}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ClaimLine c={d.thesis} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 2, marginTop: 6 }}>
              <div><span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Why now</span><ClaimLine c={d.why_now} /></div>
              <div><span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Why this company</span><ClaimLine c={d.why_this_company} /></div>
              <div><span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Why this quarter</span><ClaimLine c={d.why_this_quarter} /></div>
            </div>
            {d.evidence_chain.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Evidence chain</span>
                {d.evidence_chain.map((ev, j) => (
                  <div key={j} style={{ fontSize: 12, color: "#334155", margin: "2px 0" }}>
                    <BasisTag basis={ev.url ? "fact" : "inference"} />
                    {ev.url ? <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>{ev.label}</a> : ev.label}
                    {ev.date && <span style={{ color: "#94a3b8" }}> · {ev.date}</span>}
                  </div>
                ))}
              </div>
            )}
            {d.risks.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Risks</span>
                {d.risks.map((rk, j) => <ClaimLine key={j} c={rk} />)}
              </div>
            )}
            {d.hypotheses.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Hypotheses to validate</span>
                {d.hypotheses.map((h, j) => <ClaimLine key={j} c={h} />)}
              </div>
            )}
            {d.playbook && (
              <div style={{ marginTop: 8, background: "#fef2f2", borderRadius: 6, padding: "8px 12px" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#991b1b", textTransform: "uppercase" }}>Executive playbook (HOT)</span>
                {Object.entries(d.playbook).map(([k, v]) => <p key={k} style={{ fontSize: 12, margin: "2px 0", color: "#334155" }}><strong style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}:</strong> {v}</p>)}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Recommended next step</span>
              <ClaimLine c={d.recommended_next_step} />
            </div>
          </div>
        ))}

        {/* Coverage + methodology + limitations */}
        <div style={sec}>
          <h2 style={h2}>Coverage</h2>
          <p style={{ fontSize: 12, color: "#475569" }}>
            {r.coverage.accounts_with_dated_evidence}/{r.account_dossiers.length} accounts with dated evidence · {r.coverage.accounts_with_sources} with source links · regions: {r.coverage.regions_covered.join(", ") || "—"} · industries: {r.coverage.industries_covered.join(", ") || "—"}
          </p>
        </div>
        <div style={sec}>
          <h2 style={h2}>Methodology</h2>
          <ul style={{ fontSize: 12, color: "#475569", margin: 0, paddingLeft: 18 }}>{r.methodology.map((m, i) => <li key={i} style={{ marginBottom: 3 }}>{m}</li>)}</ul>
        </div>
        <div style={{ ...sec, background: "#fffbeb", border: "1px solid #fde68a" }}>
          <h2 style={{ ...h2, color: "#92400e" }}>Limitations</h2>
          <ul style={{ fontSize: 12, color: "#92400e", margin: 0, paddingLeft: 18 }}>{r.limitations.map((m, i) => <li key={i} style={{ marginBottom: 3 }}>{m}</li>)}</ul>
        </div>
        <p style={{ fontSize: 10, color: "#cbd5e1", textAlign: "center" }}>
          versions: {Object.entries(r.versions).map(([k, v]) => `${k} ${v}`).join(" · ")} · assembled {r.metadata.assembled_at.slice(0, 16)}
        </p>
      </div>
    </AdminLayout>
  );
}
