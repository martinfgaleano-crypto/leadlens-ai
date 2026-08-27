"use client";
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";
import type { LaunchReadinessAssessment, LaunchReadinessGate } from "@/lib/intelligence/launch-readiness";

type Payload = {
  generated_at: string;
  readiness: LaunchReadinessAssessment;
  capability_summary: { overall: { state: string; score?: number }; confidence: string; states: Record<string, number>; blockers: string[] };
  history: Array<{ observed_at: string; score: number; level: string; confidence: string; blocker_count: number; capability_score: number | null }>;
  history_summary: { state: string; readiness_delta: number | null; capability_delta: number | null; last_material_change_at: string | null; gate_transitions: Array<{ gate_id: string; from: string; to: string }>; capability_transitions: Array<{ capability_id: string; from: string; to: string }> };
  persistence: { available: boolean; persisted: boolean; error: string | null };
};

const colors: Record<string, string> = { pass: "#15803d", degraded: "#b45309", fail: "#b91c1c", unmeasured: "#64748b" };
const labels: Record<string, string> = { pass: "PASS", degraded: "DEGRADED", fail: "FAIL", unmeasured: "UNMEASURED" };
const words = (value: string) => value.replace(/_/g, " ");

function Gate({ gate }: { gate: LaunchReadinessGate }) {
  const color = colors[gate.state];
  return <article style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${color}`, borderRadius: 10, padding: "1rem 1.1rem" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div><strong style={{ color: "#0f172a", fontSize: ".9rem" }}>{gate.label}</strong><div style={{ color: "#64748b", fontSize: ".74rem", marginTop: 3 }}>Weight {gate.weight} · n={gate.sample_size} · {gate.capability_ids.length} capabilities</div></div>
      <span style={{ color, background: `${color}12`, border: `1px solid ${color}35`, borderRadius: 999, padding: ".18rem .52rem", fontSize: ".66rem", fontWeight: 800 }}>{labels[gate.state]}</span>
    </div>
    <p style={{ color: "#334155", fontSize: ".8rem", lineHeight: 1.5, margin: ".65rem 0 .4rem" }}>{gate.reason}</p>
    {gate.next_action && <p style={{ color: "#0f172a", fontSize: ".76rem", margin: 0 }}><strong>Next:</strong> {gate.next_action}</p>}
    <details style={{ marginTop: ".55rem", color: "#64748b", fontSize: ".72rem" }}><summary>Machine-readable evidence</summary><ul>{gate.evidence.length ? gate.evidence.map((item) => <li key={item}>{item}</li>) : <li>No evidence reference available.</li>}</ul></details>
  </article>;
}

export default function LaunchReadinessPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await adminFetch("/api/admin/intelligence/launch-readiness");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Readiness unavailable");
      setData(body as Payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Readiness unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const r = data?.readiness;
  const scoreColor = !r ? "#64748b" : r.score >= 75 ? "#15803d" : r.score >= 50 ? "#b45309" : "#b91c1c";
  return <AdminLayout><main style={{ maxWidth: 1120, margin: "0 auto", color: "#0f172a" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", marginBottom: 22 }}>
      <div><span style={{ color: "#0284c7", fontSize: ".7rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Automatic control · internal</span><h1 style={{ fontSize: "1.55rem", margin: ".3rem 0" }}>Launch Readiness</h1><p style={{ color: "#64748b", maxWidth: 720, margin: 0, lineHeight: 1.5 }}>Computed from current capability telemetry, production controls and empirical validation. No manual percentage or browser checklist contributes.</p></div>
      <button onClick={() => void refresh()} disabled={loading} style={{ border: 0, borderRadius: 8, padding: ".62rem .9rem", background: "#0f172a", color: "#fff", fontWeight: 700 }}>{loading ? "Evaluating…" : "Re-evaluate"}</button>
    </header>
    {error && <section style={{ padding: 16, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 10, color: "#991b1b" }}><strong>No score substituted.</strong> {error}</section>}
    {r && <>
      <section style={{ display: "grid", gridTemplateColumns: "minmax(220px, .8fr) minmax(300px, 2fr)", gap: 16, marginBottom: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}><div style={{ color: "#64748b", fontSize: ".72rem", fontWeight: 700 }}>CURRENT AUTOMATIC SCORE</div><div style={{ color: scoreColor, fontWeight: 900, fontSize: "3.2rem", lineHeight: 1.1, marginTop: 8 }}>{r.score}<span style={{ fontSize: "1rem" }}>/100</span></div><div style={{ fontWeight: 800, textTransform: "capitalize", marginTop: 8 }}>{words(r.level)}</div><div style={{ color: "#64748b", fontSize: ".75rem", marginTop: 4 }}>Confidence {r.confidence} · n={r.sample_size}</div></div>
        <div style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 12, padding: 20 }}><h2 style={{ color: "#fff", margin: "0 0 .6rem", fontSize: "1rem" }}>Current launch truth</h2>{r.blockers.length ? <ul style={{ paddingLeft: 18, margin: 0 }}>{r.blockers.map((item) => <li key={item} style={{ marginBottom: 7, lineHeight: 1.45 }}>{item}</li>)}</ul> : <p>No failing gate in the current evidence.</p>}<p style={{ color: "#94a3b8", fontSize: ".72rem", margin: "1rem 0 0" }}>Evaluated {new Date(r.evaluated_at).toLocaleString()} · source cutoff {r.source_data_cutoff ? new Date(r.source_data_cutoff).toLocaleString() : "unavailable"}</p></div>
      </section>
      {!data?.persistence.available && <section style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: 12, borderRadius: 8, marginBottom: 16 }}><strong>History not durable yet.</strong> Apply migration 055. Current evaluation remains live and honest; no trend is claimed.</section>}
      <section><h2 style={{ fontSize: "1rem" }}>Launch gates</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>{r.gates.map((gate) => <Gate key={gate.id} gate={gate} />)}</div></section>
      <section style={{ marginTop: 22, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}><h2 style={{ fontSize: "1rem", marginTop: 0 }}>Durable history</h2>{data.history_summary.state === "insufficient_history" && <p style={{ color: "#64748b", fontSize: ".8rem" }}>One baseline exists. History is insufficient for a trend; no delta is inferred.</p>}{data.history_summary.state !== "insufficient_history" && <p style={{ color: "#334155", fontSize: ".8rem" }}>Readiness delta: <strong>{data.history_summary.readiness_delta! >= 0 ? "+" : ""}{data.history_summary.readiness_delta}</strong> · Capability delta: <strong>{data.history_summary.capability_delta ?? "unmeasured"}</strong> · {data.history_summary.gate_transitions.length} gate transitions.</p>}{data.history.length ? <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: ".76rem" }}><thead><tr>{["Observed", "Readiness", "Level", "Capability", "Confidence", "Blockers"].map((x) => <th key={x} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{x}</th>)}</tr></thead><tbody>{data.history.map((x) => <tr key={`${x.observed_at}:${x.score}`}><td style={{ padding: 8 }}>{new Date(x.observed_at).toLocaleString()}</td><td>{x.score}</td><td>{words(x.level)}</td><td>{x.capability_score ?? "unmeasured"}</td><td>{x.confidence}</td><td>{x.blocker_count}</td></tr>)}</tbody></table></div> : <p style={{ color: "#64748b", fontSize: ".8rem" }}>No persisted history is available. This is an honest empty state, not a zero trend.</p>}</section>
      <details style={{ marginTop: 18, color: "#475569", fontSize: ".78rem" }}><summary>Scoring policy</summary><ul>{r.policy.map((item) => <li key={item}>{item}</li>)}</ul></details>
    </>}
  </main></AdminLayout>;
}
