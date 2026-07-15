"use client";
// Customer Intelligence — observation-mode admin center. Shows structured
// feedback observability and learner output. Prominent, honest framing:
// nothing here affects rankings in this version.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  sub: { color: "#64748b", fontSize: "0.85rem", marginBottom: "1rem" } as React.CSSProperties,
  banner: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: "0.6rem", padding: "0.7rem 1rem", fontSize: "0.82rem", fontWeight: 600, marginBottom: "1.25rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" } as React.CSSProperties,
  metric: { background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: "0.6rem", padding: "0.75rem", textAlign: "center" as const },
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
  btnSm: { background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.4rem", padding: "0.2rem 0.6rem", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", color: "#334155" } as React.CSSProperties,
  pill: (bg: string, fg: string) => ({ display: "inline-block", background: bg, color: fg, borderRadius: "999px", padding: "0.1rem 0.55rem", fontSize: "0.66rem", fontWeight: 700 }) as React.CSSProperties,
};

type Pref = {
  id: string; scope: string; monitor_id: string | null; feature_key: string;
  direction: string; status: string; strength: number | null; confidence: number | null;
  effective_confidence: number | null; observations: number; positive_obs: number;
  neutral_obs: number; negative_obs: number; distinct_report_count: number;
  last_observed_at: string | null; explanation: string | null; version: number;
};

type Overview = {
  migration_missing?: boolean;
  message?: string;
  metrics?: {
    total_events: number; with_reason_codes: number; with_snapshot: number; with_versions: number;
    sentiment: { positive: number; neutral: number; negative: number; none: number };
    top_reason_codes: [string, number][];
    already_known_pct: number; bad_explanation_pct: number; incorrect_information_pct: number;
  };
  preferences?: Pref[];
};

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  inferred_weak: { label: "Emerging pattern", bg: "#eff6ff", fg: "#1e40af" },
  inferred_validated: { label: "Validated pattern — observation only", bg: "#f0fdf4", fg: "#166534" },
  explicit: { label: "Explicit", bg: "#f8fafc", fg: "#334155" },
  frozen: { label: "Frozen", bg: "#f1f5f9", fg: "#475569" },
  revoked: { label: "Revoked", bg: "#fef2f2", fg: "#991b1b" },
};

export default function IntelligencePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/intelligence/overview");
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? `Load failed (${res.status})`); return; }
      setData(d); setError(null);
    } catch { setError("Network error."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runLearner() {
    setRunning(true); setRunResult(null);
    try {
      const res = await adminFetch("/api/admin/intelligence/learn", { method: "POST", body: JSON.stringify({}) });
      const d = await res.json();
      if (!res.ok) setRunResult(`Failed: ${d.error ?? d.result?.reason ?? res.status}`);
      else setRunResult(`Done — ${d.result.events_read} events read, ${d.result.events_learnable} learnable, ${d.result.created} created, ${d.result.updated} updated, ${d.result.unchanged} unchanged.`);
      await load();
    } finally { setRunning(false); }
  }

  async function act(id: string, action: "freeze" | "revoke") {
    if (!window.confirm(action === "freeze"
      ? "Freeze this pattern? It will stop updating automatically (ranking stays off)."
      : "Revoke this pattern? It keeps its history but is excluded from any future interpretation.")) return;
    setBusy(id);
    try {
      const res = await adminFetch(`/api/admin/intelligence/preferences/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      if (!res.ok) setError((await res.json()).error ?? `${action} failed`);
      await load();
    } finally { setBusy(null); }
  }

  const prefLabel = (p: Pref) => {
    if (p.status !== "inferred_weak") return STATUS_LABEL[p.status] ?? STATUS_LABEL.inferred_weak;
    return (p.positive_obs + p.negative_obs) < 3 ? { label: "Early signal", bg: "#f8fafc", fg: "#64748b" } : STATUS_LABEL.inferred_weak;
  };

  return (
    <AdminLayout>
      <h1 style={S.h1}>Customer Intelligence</h1>
      <p style={S.sub}>Structured feedback observability and observation-only learned patterns.</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {[
          { href: "/admin/intelligence/growth", label: "📈 Growth Observatory" },
          { href: "/admin/intelligence/review", label: "🧑‍⚖️ Review Queue" },
          { href: "/admin/intelligence/sources", label: "🔎 Source Access" },
        ].map((l) => (
          <a key={l.href} href={l.href} style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", padding: "0.4rem 0.9rem", fontSize: "0.78rem", fontWeight: 600, color: "#0f172a", textDecoration: "none" }}>{l.label}</a>
        ))}
      </div>
      <div style={S.banner}>⚠ Observation mode — learned preferences are not affecting rankings.</div>

      {error && <div style={{ ...S.banner, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>{error}</div>}
      {data?.migration_missing && (
        <div style={S.card}>Migration 031 not applied — intelligence columns unavailable. Apply <code>supabase/migrations/031_intelligence_foundation.sql</code> and refresh.</div>
      )}

      {data?.metrics && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Feedback observability</h2>
            <button style={S.btn} onClick={runLearner} disabled={running}>{running ? "Running learner…" : "Run learner"}</button>
          </div>
          {runResult && <p style={{ fontSize: "0.78rem", color: "#334155", marginBottom: "0.75rem" }}>{runResult}</p>}
          <div style={S.grid}>
            {[
              { label: "Feedback events", value: data.metrics.total_events },
              { label: "With reasons", value: data.metrics.with_reason_codes },
              { label: "With snapshot", value: data.metrics.with_snapshot },
              { label: "With versions", value: data.metrics.with_versions },
              { label: "Useful", value: data.metrics.sentiment.positive },
              { label: "Partial", value: data.metrics.sentiment.neutral },
              { label: "Not useful", value: data.metrics.sentiment.negative },
              { label: "Already known %", value: `${data.metrics.already_known_pct}%` },
              { label: "Weak explanation %", value: `${data.metrics.bad_explanation_pct}%` },
            ].map((m) => (
              <div key={m.label} style={S.metric}>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>{m.value}</div>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginTop: "0.2rem" }}>{m.label}</div>
              </div>
            ))}
          </div>
          {data.metrics.top_reason_codes.length > 0 && (
            <div style={{ marginTop: "0.9rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {data.metrics.top_reason_codes.map(([code, n]) => (
                <span key={code} style={S.pill("#f1f5f9", "#475569")}>{n} × {code.replace(/_/g, " ")}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={S.card}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>Observed patterns</h2>
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.9rem" }}>
          Rebuilt deterministically from structured feedback. Ranking impact: <strong>Off</strong> for every pattern in this version.
        </p>
        {(data?.preferences ?? []).length === 0 ? (
          <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>No patterns yet — they appear after customers leave structured feedback and the learner runs.</p>
        ) : (
          (data!.preferences!).map((p) => {
            const lab = prefLabel(p);
            return (
              <div key={p.id} style={{ borderTop: "1px solid #f1f5f9", padding: "0.7rem 0", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                  <code style={{ color: "#0f172a", fontWeight: 700 }}>{p.feature_key}</code>
                  <span style={S.pill(p.direction === "positive" ? "#f0fdf4" : p.direction === "negative" ? "#fef2f2" : "#f8fafc", p.direction === "positive" ? "#166534" : p.direction === "negative" ? "#991b1b" : "#64748b")}>{p.direction}</span>
                  <span style={S.pill(lab.bg, lab.fg)}>{lab.label}</span>
                  <span style={S.pill("#f8fafc", "#64748b")}>{p.scope}{p.monitor_id ? ` · ${p.monitor_id.slice(0, 8)}…` : ""}</span>
                  <span style={S.pill("#f8fafc", "#64748b")}>ranking: Off</span>
                </div>
                <div style={{ color: "#64748b", margin: "0.3rem 0" }}>
                  {p.positive_obs}+ / {p.neutral_obs}○ / {p.negative_obs}− · {p.distinct_report_count} report{p.distinct_report_count === 1 ? "" : "s"} · conf {p.confidence ?? "—"} (effective {p.effective_confidence ?? "—"}) · v{p.version}
                  {p.last_observed_at ? ` · last ${new Date(p.last_observed_at).toISOString().slice(0, 10)}` : ""}
                </div>
                {p.explanation && <div style={{ color: "#475569", fontSize: "0.76rem", marginBottom: "0.35rem" }}>{p.explanation}</div>}
                {(p.status === "inferred_weak" || p.status === "inferred_validated") && (
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button style={S.btnSm} disabled={busy === p.id} onClick={() => act(p.id, "freeze")}>Freeze</button>
                    <button style={{ ...S.btnSm, color: "#991b1b" }} disabled={busy === p.id} onClick={() => act(p.id, "revoke")}>Revoke</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}
