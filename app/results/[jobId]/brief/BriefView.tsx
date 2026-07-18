"use client";
// Presentational client component for the Institutional Opportunity Brief.
// Receives the ALREADY-ASSEMBLED, curated report from the server — the raw
// report_json (internal _versions, processed_leads, learning metadata) never
// reaches the browser. No data fetching, no assembly, no auth here.

import type { InstitutionalOpportunityReportV1, Claim, ClaimBasis, AccountDossier } from "@/lib/reports/institutional-report-types";
import { deriveMiniVerdict, derivePortfolioStatus, deriveDecay, deriveMomentum, deriveAllocation, type ReportExperience } from "@/lib/products/report-experience";

const BASIS: Record<ClaimBasis, { label: string; bg: string; fg: string }> = {
  fact: { label: "Verified", bg: "#dcfce7", fg: "#15803d" },
  inference: { label: "Analysis", bg: "#e0f2fe", fg: "#0369a1" },
  hypothesis: { label: "Hypothesis", bg: "#fef3c7", fg: "#b45309" },
  recommendation: { label: "Recommendation", bg: "#eef2ff", fg: "#4338ca" },
  unknown: { label: "Unknown", bg: "#f1f5f9", fg: "#64748b" },
};
function Tag({ basis, labels }: { basis: ClaimBasis; labels?: Record<string, string> }) {
  const b = BASIS[basis];
  return <span style={{ display: "inline-block", background: b.bg, color: b.fg, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", marginRight: 7, verticalAlign: "middle" }}>{labels?.[basis] ?? b.label}</span>;
}
function ClaimP({ c, labels }: { c: Claim; labels?: Record<string, string> }) {
  return <p style={{ fontSize: 14, lineHeight: 1.6, color: "#1e293b", margin: "4px 0" }}><Tag basis={c.basis} labels={labels} />{c.text}{c.evidence && <span style={{ color: "#94a3b8", fontSize: 12 }}> — {c.evidence}</span>}</p>;
}
const GRADE = { strong: { label: "Strong evidence", c: "#a7f3d0" }, moderate: { label: "Moderate evidence", c: "#cbd5e1" }, developing: { label: "Developing", c: "#cbd5e1" } };

// Customer-facing label localization — Spanish reports must read as Spanish,
// not English section headers over Spanish prose. Proper nouns and original
// source titles keep their language.
const L = (es: boolean) => ({
  briefTitle: es ? "Informe de Inteligencia de Oportunidades" : "Opportunity Intelligence Brief",
  icpVerdict: es ? "Veredicto del ICP" : "ICP Verdict",
  verdictWord: { proceed: es ? "AVANZAR" : "PROCEED", refine: es ? "REFINAR" : "REFINE", stop: es ? "DETENER" : "STOP" } as Record<string, string>,
  verdictEvidence: es ? "derivado de los resultados reales de este preview" : "derived from this preview's real results",
  execBrief: es ? "Resumen Ejecutivo" : "Executive Brief",
  accountsAnalyzed: es ? "cuentas analizadas" : "accounts analyzed",
  priorityAccounts: es ? "Cuentas prioritarias" : "Priority accounts",
  markets: es ? "Mercados" : "Markets",
  industries: es ? "Sectores" : "Industries",
  evidenceCoverage: es ? "Cobertura de evidencia" : "Evidence coverage",
  portfolio: es ? "Inteligencia de Portafolio" : "Portfolio Intelligence",
  funnel: es ? "Embudo de selección" : "Selection funnel",
  considered: es ? "consideradas" : "considered",
  filteredOut: es ? "filtradas" : "filtered out",
  selected: es ? "seleccionadas para ti" : "selected for you",
  allocation: es ? "Asignación de esfuerzo" : "Effort allocation",
  dossiers: es ? "Fichas por Cuenta" : "Account Dossiers",
  whyNow: es ? "Por qué ahora" : "Why now",
  whyCompany: es ? "Por qué esta empresa" : "Why this company",
  whyQuarter: es ? "Por qué este trimestre" : "Why this quarter",
  evidenceChain: es ? "Cadena de evidencia" : "Evidence chain",
  risks: es ? "Riesgos e incógnitas" : "Risks & unknowns",
  validate: es ? "Validar antes de contactar" : "Validate before contact",
  approach: es ? "Enfoque comercial" : "Commercial approach",
  nextStep: es ? "Siguiente paso recomendado" : "Recommended next step",
  evidence: es ? "Evidencia" : "Evidence",
  momentum: "Momentum",
  revalidateBy: es ? "revalidar antes de" : "revalidate by",
  howBuilt: es ? "Cómo se construyó este informe" : "How this brief was built",
  whatIsnt: es ? "Qué es este informe — y qué no" : "What this brief is — and isn't",
  download: es ? "Descargar PDF" : "Download PDF",
  grade: { strong: es ? "Evidencia sólida" : "Strong evidence", moderate: es ? "Evidencia moderada" : "Moderate evidence", developing: es ? "En desarrollo" : "Developing" } as Record<string, string>,
  tierChip: { HOT: es ? "PRIORITARIA" : "HOT", WARM: es ? "POSIBLE" : "WARM", COLD: es ? "FRÍA" : "COLD", DISCARD: es ? "DESCARTADA" : "DISCARD", UNSCORED: es ? "SIN PUNTAJE" : "UNSCORED" } as Record<string, string>,
  grounded: es ? "CON EVIDENCIA" : "EVIDENCE-GROUNDED",
  validateFirst: es ? "VALIDAR PRIMERO" : "VALIDATE FIRST",
  fitTiming: es ? "Fit × Timing" : "Fit × Timing",
  fitAxis: es ? "Fit (0–10)" : "Fit (0–10)",
  timingAxis: es ? "Días desde la señal" : "Days since signal",
  freshnessTitle: es ? "Frescura de las señales" : "Signal freshness",
  rankingTitle: es ? "Ranking de oportunidades" : "Opportunity ranking",
  signalDist: es ? "Distribución por tipo de señal" : "Signal type distribution",
  timelineTitle: es ? "Línea de tiempo de señales" : "Signal timeline",
  regionDist: es ? "Distribución por ubicación" : "Location distribution",
  noDatedData: es ? "Sin datos con fecha suficientes para graficar — se muestran solo los análisis." : "Not enough dated data to chart — analysis only.",
  chartsTitle: es ? "Visualización del análisis" : "Analysis at a glance",
  fresh: es ? "reciente (≤30d)" : "fresh (≤30d)", recent: es ? "activa (≤90d)" : "recent (≤90d)", stale: es ? "antigua (>90d)" : "stale (>90d)", undated: es ? "sin fecha" : "undated",
  bucketWord: { hot: es ? "prioritarias" : "hot", warm: es ? "posibles" : "warm", cold: es ? "frías" : "cold", discard: es ? "descartadas" : "discard" } as Record<string, string>,
  basis: {
    fact: es ? "Verificado" : "Verified", inference: es ? "Análisis" : "Analysis",
    hypothesis: es ? "Hipótesis" : "Hypothesis", recommendation: es ? "Recomendación" : "Recommendation",
    unknown: es ? "Sin datos" : "Unknown",
  } as Record<string, string>,
});


// ─── Tier charts — decision-support only, real data only ─────────────────────
// Every mark maps to a real dossier value; undated accounts are listed, never
// plotted with invented positions. Progressive by tier: Preview gets the light
// Fit×Timing comparison + freshness; Brief adds ranking + statuses;
// Intelligence adds timeline + location distribution.
function TierCharts({ dossiers, tier, t, tierColor }: {
  dossiers: AccountDossier[]; tier: string; t: ReturnType<typeof L>; tierColor: (s: string) => string;
}) {
  const latest = (d: AccountDossier) => d.evidence_chain.map((e) => e.date).filter(Boolean).sort().reverse()[0] ?? null;
  const days = (iso: string | null) => { if (!iso) return null; const v = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000); return Number.isFinite(v) && v >= 0 ? v : null; };
  const pts = dossiers.map((d) => ({ name: d.company, fit: d.fit_score ?? null, days: days(latest(d)), tier: d.tier, location: d.location }));
  const dated = pts.filter((p) => p.fit !== null && p.days !== null) as { name: string; fit: number; days: number; tier: string; location: string | null }[];
  if (dossiers.length === 0) return null;
  const showRanking = tier !== "preview";
  const showAdvanced = tier === "intelligence" || tier === "premium";
  const W = 560, H = 190, PAD = 42;
  const xOf = (d: number) => PAD + Math.min(d, 120) / 120 * (W - PAD - 16);
  const yOf = (f: number) => H - 28 - (f / 10) * (H - 48);
  const buckets = { fresh: pts.filter((p) => p.days !== null && p.days <= 30).length, recent: pts.filter((p) => p.days !== null && p.days > 30 && p.days <= 90).length, stale: pts.filter((p) => p.days !== null && p.days > 90).length, undated: pts.filter((p) => p.days === null).length };
  const maxB = Math.max(1, ...Object.values(buckets));
  const chartBox: React.CSSProperties = { background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "12px 14px", marginBottom: 12, overflowX: "auto" };
  const chartH4: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" };
  const locs = Array.from(new Map(pts.map((p) => [p.location ?? "—", pts.filter((q) => (q.location ?? "—") === (p.location ?? "—")).length])).entries());

  return (
    <div className="ib-sec" style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 12, padding: "22px 26px", marginBottom: 18 }}>
      <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", margin: "0 0 12px" }}>{t.chartsTitle}</h2>

      {dated.length > 0 ? (
        <div style={chartBox}>
          <h4 style={chartH4}>{t.fitTiming}</h4>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }} role="img" aria-label={t.fitTiming}>
            <line x1={PAD} y1={H - 28} x2={W - 10} y2={H - 28} stroke="#cbd5e1" />
            <line x1={PAD} y1={12} x2={PAD} y2={H - 28} stroke="#cbd5e1" />
            <text x={W - 12} y={H - 10} fontSize={9.5} fill="#94a3b8" textAnchor="end">{t.timingAxis}</text>
            <text x={10} y={20} fontSize={9.5} fill="#94a3b8">{t.fitAxis}</text>
            {[0, 30, 60, 90, 120].map((d) => <text key={d} x={xOf(d)} y={H - 14} fontSize={8.5} fill="#94a3b8" textAnchor="middle">{d === 120 ? "120+" : d}</text>)}
            {[0, 5, 10].map((f) => <text key={f} x={PAD - 6} y={yOf(f) + 3} fontSize={8.5} fill="#94a3b8" textAnchor="end">{f}</text>)}
            {dated.map((p, i) => (
              <g key={i}>
                <circle cx={xOf(p.days)} cy={yOf(p.fit)} r={7} fill={tierColor(p.tier)} opacity={0.85} />
                <text x={xOf(p.days) + 10} y={yOf(p.fit) + 3.5} fontSize={10} fontWeight={700} fill="#334155">{p.name.slice(0, 22)}</text>
              </g>
            ))}
          </svg>
          {pts.some((p) => p.days === null) && <p style={{ fontSize: 10.5, color: "#94a3b8", margin: "4px 0 0" }}>{t.undated}: {pts.filter((p) => p.days === null).map((p) => p.name).join(", ")}</p>}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "#94a3b8" }}>{t.noDatedData}</p>
      )}

      <div style={chartBox}>
        <h4 style={chartH4}>{t.freshnessTitle}</h4>
        {(Object.entries(buckets) as [keyof typeof buckets, number][]).filter(([, n]) => n > 0).map(([k, n]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
            <span style={{ fontSize: 10.5, color: "#475569", width: 120 }}>{t[k]}</span>
            <div style={{ height: 10, borderRadius: 5, width: `${(n / maxB) * 60}%`, background: k === "fresh" ? "#15803d" : k === "recent" ? "#0284c7" : k === "stale" ? "#b45309" : "#94a3b8", minWidth: 10 }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#334155" }}>{n}</span>
          </div>
        ))}
      </div>

      {showRanking && dossiers.filter((d) => d.fit_score !== null).length > 1 && (
        <div style={chartBox}>
          <h4 style={chartH4}>{t.rankingTitle}</h4>
          {dossiers.filter((d) => d.fit_score !== null).sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)).map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
              <span style={{ fontSize: 10.5, color: "#475569", width: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.company}</span>
              <div style={{ height: 10, borderRadius: 5, width: `${((d.fit_score ?? 0) / 10) * 55}%`, background: tierColor(d.tier), minWidth: 8 }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#334155" }}>{d.fit_score}/10 · {t.tierChip[d.tier] ?? d.tier}</span>
            </div>
          ))}
        </div>
      )}

      {showAdvanced && dated.length > 1 && (
        <div style={chartBox}>
          <h4 style={chartH4}>{t.timelineTitle}</h4>
          <svg viewBox={`0 0 ${W} 70`} style={{ width: "100%", maxWidth: W, display: "block" }} role="img" aria-label={t.timelineTitle}>
            <line x1={PAD} y1={40} x2={W - 10} y2={40} stroke="#cbd5e1" />
            {dated.map((p, i) => (
              <g key={i}>
                <circle cx={xOf(p.days)} cy={40} r={6} fill={tierColor(p.tier)} />
                <text x={xOf(p.days)} y={26 - (i % 2) * 12} fontSize={9} fill="#475569" textAnchor="middle">{p.name.slice(0, 16)}</text>
                <text x={xOf(p.days)} y={56} fontSize={8.5} fill="#94a3b8" textAnchor="middle">{p.days}d</text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {showAdvanced && locs.length > 1 && (
        <div style={chartBox}>
          <h4 style={chartH4}>{t.regionDist}</h4>
          {locs.map(([loc, n]) => (
            <div key={loc} style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
              <span style={{ fontSize: 10.5, color: "#475569", width: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loc}</span>
              <div style={{ height: 10, borderRadius: 5, width: `${(n / dossiers.length) * 55}%`, background: "#0284c7", minWidth: 8 }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#334155" }}>{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BriefView({ report, experience }: { report: InstitutionalOpportunityReportV1; experience?: ReportExperience }) {
  const r = report;
  const q = r.quality;
  const es = experience?.language === "es";
  const t = L(es);
  // Tier experience (server-resolved). Legacy calls without it render everything.
  const x = experience ?? null;
  const miniVerdict = x?.show_mini_verdict ? deriveMiniVerdict(r.portfolio_summary, es ? "es" : "en") : null;
  // Portfolio depth (Intelligence/Premium): statuses, decay, momentum and
  // allocation derived deterministically from REAL dates and evidence.
  const deepPortfolio = x ? (x.portfolio_depth === "complete" || x.portfolio_depth === "advanced") : false;
  const latestDate = (d: AccountDossier) => d.evidence_chain.map((e) => e.date).filter(Boolean).sort().reverse()[0] ?? null;
  const statuses = deepPortfolio ? r.account_dossiers.map((d) => derivePortfolioStatus({ tier: d.tier, evidence_grounded: d.evidence_grounded, latest_date: latestDate(d) })) : [];
  const allocation = deepPortfolio && statuses.length ? deriveAllocation(statuses) : null;
  const STATUS_COLOR: Record<string, string> = { act_now: "#15803d", investigate: "#0369a1", monitor: "#b45309", reserve: "#64748b", reject: "#dc2626" };
  const wrap: React.CSSProperties = { maxWidth: 880, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a" };
  const sec: React.CSSProperties = { background: "#fff", border: "1px solid #e8edf3", borderRadius: 12, padding: "22px 26px", marginBottom: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.03)" };
  const h2: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", margin: "0 0 12px" };
  const tierColor = (t: string) => t === "HOT" ? "#dc2626" : t === "WARM" ? "#d97706" : t === "COLD" ? "#0284c7" : "#94a3b8";

  return (
    <div style={{ background: "#f6f8fb", minHeight: "100vh" }}>
      <style>{`@media print { body { background: #fff; } button { display: none !important; } .ib-sec { box-shadow: none; break-inside: avoid; } }`}</style>
      <div style={wrap} data-institutional-brief-version="institutional-brief-v1">
        <div style={{ background: "linear-gradient(135deg,#0b1220,#12314f 60%,#0c4a6e)", color: "#fff", borderRadius: 16, padding: "34px 34px 30px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#7dd3fc", marginBottom: 8 }}>{x ? `${x.display_name} · ${x.header_label}` : t.briefTitle}</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, margin: "0 0 10px", maxWidth: 640 }}>{r.executive_brief.headline}</h1>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "#cbd5e1", alignItems: "center" }}>
            <span>{r.metadata.generated_at.slice(0, 10)}</span><span>·</span><span>{r.portfolio_summary.total} {t.accountsAnalyzed}</span>
            {q && <><span>·</span><span style={{ color: GRADE[q.grade].c, fontWeight: 700 }}>{t.grade[q.grade]}</span></>}
          </div>
          <button onClick={() => window.print()} style={{ marginTop: 16, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.download}</button>
        </div>

        {miniVerdict && (
          <div style={{ ...sec, borderLeft: `4px solid ${miniVerdict.verdict === "proceed" ? "#15803d" : miniVerdict.verdict === "refine" ? "#b45309" : "#dc2626"}` }} className="ib-sec">
            <h2 style={h2}>{t.icpVerdict}</h2>
            <div style={{ fontSize: 20, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: miniVerdict.verdict === "proceed" ? "#15803d" : miniVerdict.verdict === "refine" ? "#b45309" : "#dc2626" }}>{t.verdictWord[miniVerdict.verdict]}</div>
            <ClaimP labels={t.basis} c={{ basis: "recommendation", text: miniVerdict.reason, evidence: t.verdictEvidence }} />
          </div>
        )}

        <div style={sec} className="ib-sec">
          <h2 style={h2}>{t.execBrief}</h2>
          <ClaimP labels={t.basis} c={r.executive_brief.summary} />
          <div style={{ display: "flex", gap: 26, marginTop: 14, flexWrap: "wrap" }}>
            {[[t.priorityAccounts, r.executive_brief.priority_count], [t.markets, r.context.regions.length || "—"], [t.industries, r.context.industries.length || "—"], [t.evidenceCoverage, q ? `${q.evidence_coverage_pct}%` : "—"]].map(([l, v]) => (
              <div key={l as string}><div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{v as React.ReactNode}</div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", fontWeight: 700 }}>{l as string}</div></div>
            ))}
          </div>
        </div>

        {x && r.account_dossiers.length > 0 && (
          <TierCharts dossiers={r.account_dossiers} tier={x.tier} t={t} tierColor={tierColor} />
        )}

        {(!x || x.show_portfolio) && (
        <div style={sec} className="ib-sec">
          <h2 style={h2}>{t.portfolio}</h2>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 10, background: "#eef2f7" }}>
            {(["hot", "warm", "cold", "discard"] as const).map((k) => {
              const v = r.portfolio_summary[k]; const total = r.portfolio_summary.total || 1;
              return v > 0 ? <div key={k} title={`${k}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: tierColor(k.toUpperCase()) }} /> : null;
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
            {(["hot", "warm", "cold", "discard"] as const).map((k) => (
              <span key={k} style={{ color: "#475569" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: tierColor(k.toUpperCase()), marginRight: 5 }} /><strong>{r.portfolio_summary[k]}</strong> {t.bucketWord[k] ?? k}</span>
            ))}
          </div>
          {r.portfolio_summary.funnel && (!x || x.show_funnel) && (
            <p style={{ fontSize: 12.5, color: "#475569", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
              {t.funnel}: <strong>{r.portfolio_summary.funnel.considered}</strong> {t.considered} → <strong>{r.portfolio_summary.funnel.rejected}</strong> {t.filteredOut} → <strong style={{ color: "#0369a1" }}>{r.portfolio_summary.funnel.selected}</strong> {t.selected}.
            </p>
          )}
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{r.portfolio_summary.tier_note}</p>
          {allocation && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{t.allocation}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{allocation.line}</div>
              <p style={{ fontSize: 12.5, color: "#475569", margin: "4px 0 0", lineHeight: 1.55 }}>{allocation.detail}</p>
            </div>
          )}
        </div>
        )}

        <h2 style={{ ...h2, fontSize: 15, margin: "26px 0 12px", color: "#0f172a" }}>{t.dossiers}</h2>
        {r.account_dossiers.map((d: AccountDossier, i) => {
          const status = deepPortfolio ? statuses[i] : null;
          const decay = deepPortfolio ? deriveDecay(latestDate(d)) : null;
          const momentum = deepPortfolio ? deriveMomentum(d.evidence_chain.map((e) => e.date)) : null;
          return (
          <div key={i} style={{ ...sec, borderLeft: `4px solid ${tierColor(d.tier)}` }} className="ib-sec">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div><strong style={{ fontSize: 17, color: "#0f172a" }}>{d.rank ? `${d.rank}. ` : ""}{d.company}</strong>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{[d.industry, d.location, d.domain].filter(Boolean).join(" · ") || "Account details limited"}</div></div>
              <div style={{ textAlign: "right" }}><span style={{ fontSize: 12, fontWeight: 800, color: tierColor(d.tier) }}>{t.tierChip[d.tier] ?? d.tier}</span>
                {d.evidence_grounded != null && <div style={{ fontSize: 10, fontWeight: 700, color: d.evidence_grounded ? "#15803d" : "#b45309", marginTop: 2 }}>{d.evidence_grounded ? t.grounded : t.validateFirst}</div>}</div>
            </div>
            {status && decay && momentum && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: STATUS_COLOR[status.status], textTransform: "uppercase", letterSpacing: "0.04em" }}>{status.label}</span>
                <span style={{ fontSize: 11.5, color: "#475569" }}>{status.because}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>· {t.evidence}: <strong>{decay.label}</strong> ({t.revalidateBy} {decay.revalidate_by})</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>· Momentum: <strong>{momentum.label}</strong> — {momentum.factors}</span>
              </div>
            )}
            <div style={{ marginTop: 10 }}><ClaimP labels={t.basis} c={d.thesis} /></div>
            {([[t.whyNow, d.why_now], [t.whyCompany, d.why_this_company], [t.whyQuarter, d.why_this_quarter]] as const).map(([label, claim]) => (
              <div key={label} style={{ marginTop: 8 }}><div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div><ClaimP labels={t.basis} c={claim} /></div>
            ))}
            {d.evidence_chain.length > 0 && (
              <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{t.evidenceChain}</div>
                {d.evidence_chain.map((ev, j) => (
                  <div key={j} style={{ fontSize: 12.5, color: "#334155", margin: "3px 0" }}>
                    <Tag basis={ev.url ? "fact" : "inference"} labels={t.basis} />
                    {ev.url ? <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>{ev.label}</a> : ev.label}
                    {ev.date && <span style={{ color: "#94a3b8" }}> · {ev.date}</span>}
                  </div>
                ))}
              </div>
            )}
            {d.risks.length > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{t.risks}</div>{d.risks.map((rk, j) => <ClaimP key={j} c={rk} />)}</div>}
            {d.hypotheses.length > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{t.validate}</div>{d.hypotheses.map((h, j) => <ClaimP key={j} c={h} />)}</div>}
            {d.playbook && (
              <div style={{ marginTop: 10, background: "#fef2f2", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 4 }}>{t.approach}</div>
                {Object.entries(d.playbook).map(([k, v]) => <p key={k} style={{ fontSize: 12.5, margin: "3px 0", color: "#334155" }}><strong style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}:</strong> {v}</p>)}
              </div>
            )}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}><div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{t.nextStep}</div><ClaimP labels={t.basis} c={d.recommended_next_step} /></div>
          </div>
          );
        })}

        {x?.upgrade_hint && (
          <div style={{ ...sec, background: "#f0f9ff", border: "1px solid #bae6fd" }} className="ib-sec">
            <p style={{ fontSize: 13, color: "#075985", margin: 0 }}>{x.upgrade_hint}</p>
          </div>
        )}

        <div style={sec} className="ib-sec">
          <h2 style={h2}>{t.howBuilt}</h2>
          <ul style={{ fontSize: 12.5, color: "#475569", margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{r.methodology.map((m, i) => <li key={i}>{m}</li>)}</ul>
          {q && <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>{q.note}</p>}
        </div>
        <div style={{ ...sec, background: "#fffbeb", border: "1px solid #fde68a" }} className="ib-sec">
          <h2 style={{ ...h2, color: "#b45309" }}>{t.whatIsnt}</h2>
          <ul style={{ fontSize: 12.5, color: "#92400e", margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{r.limitations.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
        <p style={{ fontSize: 10, color: "#cbd5e1", textAlign: "center", marginTop: 4 }}>LeadLens · brief schema v{r.schema_version} · {r.metadata.generated_at.slice(0, 10)}</p>
      </div>
    </div>
  );
}
