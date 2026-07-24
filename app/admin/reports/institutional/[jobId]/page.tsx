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

function HorizontalBars({ items, max }: { items: Array<{ label: string; value: number; color: string; note?: string }>; max?: number }) {
  const ceiling = Math.max(max ?? 0, ...items.map((item) => item.value), 1);
  return (
    <div role="img" aria-label={items.map((item) => `${item.label}: ${item.value}`).join(", ")} style={{ display: "grid", gap: 9 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: "#334155", fontWeight: 650 }}>{item.label}</span>
            <span style={{ color: "#64748b" }}>{item.value}{item.note ? ` · ${item.note}` : ""}</span>
          </div>
          <div style={{ height: 9, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(item.value > 0 ? 3 : 0, (item.value / ceiling) * 100)}%`, height: "100%", background: item.color, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments, center, sublabel }: { segments: Array<{ label: string; value: number; color: string }>; center: string; sublabel: string }) {
  const total = Math.max(segments.reduce((sum, segment) => sum + segment.value, 0), 1);
  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width="132" height="132" viewBox="0 0 120 120" role="img" aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="15" />
        {segments.filter((segment) => segment.value > 0).map((segment) => {
          const length = (segment.value / total) * circumference;
          const node = <circle key={segment.label} cx="60" cy="60" r={radius} fill="none" stroke={segment.color} strokeWidth="15" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
          offset += length;
          return node;
        })}
        <text x="60" y="57" textAnchor="middle" fontSize="17" fontWeight="800" fill="#0f172a">{center}</text>
        <text x="60" y="72" textAnchor="middle" fontSize="8" fill="#64748b">{sublabel}</text>
      </svg>
      <div style={{ display: "grid", gap: 6 }}>
        {segments.map((segment) => (
          <div key={segment.label} style={{ fontSize: 11, color: "#475569" }}>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: segment.color, marginRight: 6 }} />
            {segment.label}: <strong>{segment.value}</strong>
          </div>
        ))}
      </div>
    </div>
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
  const landscapeStages = r.market_landscape?.accounts.reduce<Record<string, number>>((counts, account) => {
    counts[account.stage] = (counts[account.stage] ?? 0) + 1;
    return counts;
  }, {}) ?? {};
  const fitItems = r.account_dossiers
    .filter((dossier) => dossier.fit_score != null)
    .map((dossier) => ({ label: dossier.company, value: dossier.fit_score ?? 0, color: dossier.tier === "HOT" ? "#ef4444" : dossier.tier === "WARM" ? "#f59e0b" : "#38bdf8", note: dossier.tier }));
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

        {/* Decision dashboard */}
        <div style={sec}>
          <h2 style={h2}>Decision Dashboard</h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>Vista comparativa del embudo, calidad de evidencia y fortaleza relativa de las oportunidades.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 22 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 9 }}>Portfolio por tier</div>
              <DonutChart
                center={String(r.portfolio_summary.total)}
                sublabel="analizadas"
                segments={[
                  { label: "HOT", value: r.portfolio_summary.hot, color: "#ef4444" },
                  { label: "WARM", value: r.portfolio_summary.warm, color: "#f59e0b" },
                  { label: "COLD", value: r.portfolio_summary.cold, color: "#38bdf8" },
                  { label: "DESCARTADAS", value: r.portfolio_summary.discard, color: "#cbd5e1" },
                ]}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 9 }}>Cobertura de evidencia</div>
              <HorizontalBars items={[
                { label: "Con fuente", value: r.quality?.evidence_coverage_pct ?? 0, color: "#0284c7", note: "%" },
                { label: "Con señal fechada", value: r.quality?.dated_coverage_pct ?? 0, color: "#7c3aed", note: "%" },
                { label: "Evidence-grounded", value: r.quality?.grounded_pct ?? 0, color: "#16a34a", note: "%" },
              ]} max={100} />
              <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 10 }}>La cobertura mide trazabilidad, no confirma intención de compra.</p>
            </div>
          </div>
          {fitItems.length > 0 && (
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 16, paddingTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 9 }}>Comparación de fit entre finalistas</div>
              <HorizontalBars items={fitItems} max={10} />
            </div>
          )}
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

        {/* Market landscape */}
        {r.market_landscape && (
          <div style={sec}>
            <h2 style={h2}>Market Landscape & Selection Funnel</h2>
            <p style={{ fontSize: 13, color: "#334155", margin: "0 0 5px" }}>
              <strong>Category:</strong> {r.market_landscape.category_query} · <strong>Region:</strong> {r.market_landscape.geography.join(", ") || "—"}
            </p>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{r.market_landscape.explanation}</p>
            <div style={{ display: "flex", gap: 18, margin: "10px 0", flexWrap: "wrap" }}>
              {[["Market references + investigated", r.market_landscape.considered_count], ["Investigated", r.market_landscape.investigated_count], ["Finalists", r.market_landscape.selected_count]].map(([label, value]) => (
                <div key={label as string}><strong style={{ fontSize: 18 }}>{value as number}</strong><div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>{label as string}</div></div>
              ))}
            </div>
            <div style={{ margin: "14px 0 18px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 9 }}>Embudo de selección</div>
              <HorizontalBars items={[
                { label: "Universo documentado", value: r.market_landscape.considered_count, color: "#94a3b8" },
                { label: "Investigadas", value: r.market_landscape.investigated_count, color: "#0ea5e9" },
                { label: "Preliminares", value: landscapeStages.preliminary ?? 0, color: "#8b5cf6" },
                { label: "Finalistas", value: r.market_landscape.selected_count, color: "#16a34a" },
              ]} />
            </div>
            <p style={{ background: "#eff6ff", borderLeft: "3px solid #38bdf8", padding: "8px 10px", fontSize: 12, color: "#0c4a6e" }}>
              {r.market_landscape.known_accounts_policy}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "6px 5px" }}>Company</th><th>Stage</th><th>Origin / role</th><th>Selection outcome</th>
                </tr></thead>
                <tbody>{r.market_landscape.accounts.map((account) => (
                  <tr key={`${account.company}-${account.stage}`} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                    <td style={{ padding: "7px 5px", minWidth: 130 }}><strong>{account.company}</strong>{account.domain && <div style={{ color: "#94a3b8" }}>{account.domain}</div>}</td>
                    <td style={{ padding: "7px 5px", whiteSpace: "nowrap", fontWeight: 700, color: account.stage === "finalist" ? "#166534" : account.stage === "known_reference" ? "#075985" : "#64748b" }}>{account.stage.replace(/_/g, " ")}</td>
                    <td style={{ padding: "7px 5px", color: "#64748b", minWidth: 110 }}>{account.origin.replace(/_/g, " ")}{account.role ? ` · ${account.role.replace(/_/g, " ")}` : ""}</td>
                    <td style={{ padding: "7px 5px", color: "#334155", lineHeight: 1.4 }}>{account.outcome_reason}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

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
        {r.account_dossiers.length > 0 && (
          <div style={sec}>
            <h2 style={h2}>Finalist Comparison Matrix</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "7px 5px" }}>Empresa</th><th>Fit</th><th>Tier</th><th>Acción</th><th>Fuente</th><th>Fecha</th><th>Riesgos</th><th>Siguiente paso</th>
                </tr></thead>
                <tbody>{r.account_dossiers.map((dossier) => (
                  <tr key={dossier.company} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                    <td style={{ padding: "8px 5px", minWidth: 120 }}><strong>{dossier.company}</strong></td>
                    <td style={{ padding: "8px 5px" }}>{dossier.fit_score ?? "—"}</td>
                    <td style={{ padding: "8px 5px", fontWeight: 700 }}>{dossier.tier}</td>
                    <td style={{ padding: "8px 5px" }}>{dossier.actionability_status?.replace(/_/g, " ") ?? "—"}</td>
                    <td style={{ padding: "8px 5px" }}>{dossier.evidence_chain.some((evidence) => evidence.url) ? "Sí" : "No"}</td>
                    <td style={{ padding: "8px 5px" }}>{dossier.evidence_chain.some((evidence) => evidence.date) ? "Sí" : "No"}</td>
                    <td style={{ padding: "8px 5px", minWidth: 140 }}>{dossier.risks.map((risk) => risk.text).slice(0, 2).join(" · ")}</td>
                    <td style={{ padding: "8px 5px", minWidth: 150 }}>{dossier.recommended_next_step.text}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

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
