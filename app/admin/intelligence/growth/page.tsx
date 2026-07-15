"use client";
// Intelligence Growth Observatory — index, components, maturity, ML registry.
// Every number is real; missing evidence is labeled, never estimated.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" } as React.CSSProperties,
  banner: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: "0.6rem", padding: "0.7rem 1rem", fontSize: "0.82rem", fontWeight: 600, marginBottom: "1.25rem" } as React.CSSProperties,
  pill: (bg: string, fg: string) => ({ display: "inline-block", background: bg, color: fg, borderRadius: "999px", padding: "0.1rem 0.55rem", fontSize: "0.66rem", fontWeight: 700 }) as React.CSSProperties,
};

type Component = { key: string; score: number | null; status: string; details: Record<string, unknown> };
type Growth = { index: number | null; components: Component[]; maturity_level: number; maturity_label: string; maturity_reason: string; blockers: string[]; version: number; computed_at: string };
type MlRow = { model_name: string; model_version: string; algorithm: string; status: string; dataset_version: string; demo_only: boolean; metrics: Record<string, unknown>; created_at: string };

const COMPONENT_LABELS: Record<string, string> = {
  data_foundation: "Data Foundation (20%)",
  label_quality: "Label Quality (20%)",
  market_coverage: "Market Coverage (20%)",
  decision_performance: "Decision Performance (25%)",
  learning_velocity: "Learning Velocity (15%)",
};

export default function GrowthPage() {
  const [data, setData] = useState<{ growth: Growth; ml: { status: string; models: MlRow[]; datasets: Array<{ dataset_version: string; status: string; demo_only: boolean }>; shadow_predictions: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/intelligence/growth");
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? `Load failed (${res.status})`); return; }
      setData(d); setError(null);
    } catch { setError("Network error."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const g = data?.growth;
  return (
    <AdminLayout>
      <h1 style={S.h1}>Intelligence Growth Observatory</h1>
      <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1rem" }}>How much intelligence exists, how reliable it is and how fast it grows — real data only.</p>
      <div style={S.banner}>⚠ Observation mode — no ML output affects customer rankings.</div>
      {error && <div style={{ ...S.banner, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>{error}</div>}

      {g && (
        <>
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: g.index === null ? "#94a3b8" : "#0f172a" }}>
                  {g.index === null ? "—" : g.index}
                  <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}> / 100</span>
                </div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" }}>Intelligence Growth Index v{g.version}</div>
              </div>
              <span style={S.pill("#eef2ff", "#3730a3")}>{g.maturity_label}</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.5rem" }}>{g.maturity_reason}{g.index === null ? " · Index withheld: fewer than 3 components have real evidence." : ""}</p>
            {g.blockers.length > 0 && (
              <div style={{ marginTop: "0.6rem" }}>
                {g.blockers.map((b) => <span key={b} style={{ ...S.pill("#fef2f2", "#991b1b"), marginRight: "0.4rem" }}>{b}</span>)}
              </div>
            )}
          </div>

          <div style={S.card}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>Components</h2>
            {g.components.map((c) => (
              <div key={c.key} style={{ borderTop: "1px solid #f1f5f9", padding: "0.7rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>{COMPONENT_LABELS[c.key] ?? c.key}</strong>
                  {c.score === null
                    ? <span style={S.pill("#fffbeb", "#92400e")}>{c.status === "blocked_by_migration" ? "blocked by migration" : "insufficient real-world evidence"}</span>
                    : <span style={{ fontWeight: 800, color: "#0f172a" }}>{c.score}</span>}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.25rem" }}>
                  {Object.entries(c.details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v ?? "—"}`).join(" · ")}
                </div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>ML registry</h2>
            <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
              {data!.ml.status === "available" ? `${data!.ml.shadow_predictions} shadow predictions stored.` : "Migration 032 not applied — registry lives in local manifests until then."}
            </p>
            {data!.ml.models.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>No registered models{data!.ml.status !== "available" ? " (DB registry blocked)" : ""}. Local training runs appear here after ml:register.</p>
            ) : data!.ml.models.map((m) => (
              <div key={`${m.model_name}-${m.model_version}`} style={{ borderTop: "1px solid #f1f5f9", padding: "0.6rem 0", fontSize: "0.78rem" }}>
                <code style={{ fontWeight: 700 }}>{m.model_name}@{m.model_version}</code>
                <span style={{ ...S.pill("#f8fafc", "#475569"), marginLeft: "0.5rem" }}>{m.algorithm}</span>
                <span style={{ ...S.pill(m.demo_only ? "#fffbeb" : "#f0fdf4", m.demo_only ? "#92400e" : "#166534"), marginLeft: "0.4rem" }}>{m.demo_only ? "TECHNICAL VALIDATION ONLY (demo)" : m.status}</span>
                <span style={{ color: "#64748b", marginLeft: "0.5rem" }}>dataset {m.dataset_version}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
