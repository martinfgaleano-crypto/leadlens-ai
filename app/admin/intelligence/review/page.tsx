"use client";
// Human review queue — turns real training examples into gold labels.
// Blocked honestly until migration 032; demo rows never appear (filtered
// server-side by demo_only=false).

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1rem" } as React.CSSProperties,
  banner: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: "0.6rem", padding: "0.7rem 1rem", fontSize: "0.82rem", fontWeight: 600, marginBottom: "1.25rem" } as React.CSSProperties,
  btn: (bg: string) => ({ background: bg, color: "#fff", border: "none", borderRadius: "0.45rem", padding: "0.35rem 0.8rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", marginRight: "0.4rem" }) as React.CSSProperties,
  chip: (on: boolean) => ({ border: `1px solid ${on ? "#7dd3fc" : "#e2e8f0"}`, background: on ? "#f0f9ff" : "#fff", color: on ? "#075985" : "#64748b", borderRadius: "999px", padding: "0.2rem 0.6rem", fontSize: "0.7rem", cursor: "pointer", marginRight: "0.3rem", marginBottom: "0.3rem" }) as React.CSSProperties,
};

type Item = { id: string; example_key: string; company_key_hash: string; job_id: string | null; feature_snapshot: Record<string, unknown>; baseline_meta: Record<string, unknown> | null; label_status: string; provenance: string; review_priority_reason: string | null };

const REASONS = ["strong_fit", "good_timing", "useful_evidence", "wrong_fit", "weak_or_old_signal", "insufficient_evidence"];

export default function ReviewPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/intelligence/review");
    const d = await res.json();
    if (d.migration_missing) { setBlocked(d.message); return; }
    setItems(d.items ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(id: string, label: string) {
    setBusy(id); setMsg(null);
    try {
      const res = await adminFetch("/api/admin/intelligence/review", { method: "POST", body: JSON.stringify({ example_id: id, label, reason_codes: selected[id] ?? [] }) });
      const d = await res.json();
      setMsg(res.ok ? `Saved: ${label}` : d.error ?? "Failed");
      if (res.ok) await load();
    } finally { setBusy(null); }
  }

  const toggle = (id: string, code: string) => setSelected((s) => ({ ...s, [id]: (s[id] ?? []).includes(code) ? (s[id] ?? []).filter((c) => c !== code) : [...(s[id] ?? []), code] }));

  return (
    <AdminLayout>
      <h1 style={S.h1}>Human Review Queue</h1>
      <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1rem" }}>Reviews create gold labels for training — the highest-authority label source.</p>
      <div style={S.banner}>⚠ Observation mode — labels train shadow models only; rankings unchanged.</div>
      {blocked && <div style={S.card}>{blocked} Apply <code>supabase/migrations/032_ml_foundation.sql</code> and run <code>npm run ml:dataset</code>.</div>}
      {msg && <p style={{ fontSize: "0.78rem", color: "#166534", marginBottom: "0.5rem" }}>{msg}</p>}
      {!blocked && items.length === 0 && <div style={S.card}><p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Queue empty — run <code>npm run ml:dataset</code> after new reports to populate it.</p></div>}
      {items.map((it) => {
        const snap = it.feature_snapshot;
        return (
          <div key={it.id} style={S.card}>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.4rem" }}>
              example <code>{it.example_key.slice(0, 12)}…</code> · {it.provenance} · {it.label_status}{it.job_id ? <> · <a href={`/results/${it.job_id}`} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>open report</a></> : null}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#334155", marginBottom: "0.5rem" }}>
              {["primary_signal_type", "signal_age_days", "normalized_industry", "region", "company_size_bucket", "evidence_quality", "evidence_grounded", "source_count"].map((k) => `${k.replace(/_/g, " ")}: ${snap?.[k] ?? "—"}`).join(" · ")}
            </div>
            {it.baseline_meta && <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.5rem" }}>baseline (context only, not the label): rank {String(it.baseline_meta.baseline_rank ?? "—")} · score {String(it.baseline_meta.baseline_score ?? "—")}</div>}
            <div style={{ marginBottom: "0.5rem" }}>
              {REASONS.map((r) => <button key={r} style={S.chip((selected[it.id] ?? []).includes(r))} onClick={() => toggle(it.id, r)}>{r.replace(/_/g, " ")}</button>)}
            </div>
            <div>
              <button style={S.btn("#166534")} disabled={busy === it.id} onClick={() => submit(it.id, "strong")}>Strong</button>
              <button style={S.btn("#0369a1")} disabled={busy === it.id} onClick={() => submit(it.id, "viable")}>Viable</button>
              <button style={S.btn("#92400e")} disabled={busy === it.id} onClick={() => submit(it.id, "weak")}>Weak</button>
              <button style={S.btn("#991b1b")} disabled={busy === it.id} onClick={() => submit(it.id, "discard")}>Discard</button>
              <button style={S.btn("#64748b")} disabled={busy === it.id} onClick={() => submit(it.id, "insufficient_information")}>Insufficient info</button>
              <button style={S.btn("#94a3b8")} disabled={busy === it.id} onClick={() => submit(it.id, "abstain")}>Abstain</button>
            </div>
          </div>
        );
      })}
    </AdminLayout>
  );
}
