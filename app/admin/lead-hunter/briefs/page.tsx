"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const SIGNAL_TYPES = ["hiring", "expansion", "new_office", "funding", "product_launch", "partnership", "event_participation", "growth_announcement", "regulatory_or_registry_update", "b2b_buying_trigger"];

type Brief = { id: string; name: string; target_market: string | null; region: string | null; country: string | null; industry: string | null; max_candidates: number; created_at: string };

export default function BriefsPage() {
  const [items, setItems] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ max_candidates: "25", language: "en" });
  const [signals, setSignals] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingRun, setCreatingRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/lead-hunter/briefs");
    if (res.ok) setItems(((await res.json())?.items ?? []) as Brief[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { setMsg({ ok: false, text: "Brief name is required." }); return; }
    setSaving(true);
    setMsg(null);
    const res = await adminFetch("/api/admin/lead-hunter/briefs", {
      method: "POST",
      body: JSON.stringify({ ...form, max_candidates: Number(form.max_candidates) || 25, signal_types: signals }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setMsg({ ok: true, text: "Brief created." }); setForm({ max_candidates: "25", language: "en" }); setSignals([]); setFormOpen(false); await load(); }
    else setMsg({ ok: false, text: d.error ?? "Create failed." });
    setSaving(false);
  }

  async function handleNewRun(briefId: string) {
    setCreatingRun(briefId);
    const res = await adminFetch("/api/admin/lead-hunter/runs", { method: "POST", body: JSON.stringify({ brief_id: briefId }) });
    const d = await res.json().catch(() => ({}));
    setCreatingRun(null);
    if (res.ok && d?.item?.id) window.location.href = `/admin/lead-hunter/runs/${d.item.id}`;
    else setMsg({ ok: false, text: d.error ?? "Could not create run." });
  }

  const input: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" };
  const label: React.CSSProperties = { display: "block", fontSize: "0.68rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.3rem" };

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.25rem" }}>
        <Link href="/admin/lead-hunter" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Lead Hunter</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.6rem" }}>
          <div>
            <h1 style={{ color: "#0f172a", fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>Hunter briefs</h1>
            <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.3rem 0 0" }}>A brief defines what to hunt: market, region, industry, and which signals matter.</p>
          </div>
          <button onClick={() => setFormOpen(o => !o)} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
            {formOpen ? "Cancel" : "+ New brief"}
          </button>
        </div>
      </div>

      {msg && <div style={{ marginBottom: "1rem", padding: "0.6rem 0.9rem", background: msg.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.5rem", fontSize: "0.8rem", color: msg.ok ? "#15803d" : "#dc2626" }}>{msg.text}</div>}

      {formOpen && (
        <form onSubmit={handleCreate} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem", marginBottom: "0.9rem" }}>
            {[["name", "Brief name *"], ["target_market", "Target market"], ["region", "Region"], ["country", "Country"], ["industry", "Industry"], ["max_candidates", "Max candidates"]].map(([k, l]) => (
              <label key={k}><span style={label}>{l}</span><input value={form[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={input} /></label>
            ))}
          </div>
          <label style={{ display: "block", marginBottom: "0.9rem" }}>
            <span style={label}>ICP notes</span>
            <textarea value={form.icp_notes ?? ""} onChange={e => setForm(f => ({ ...f, icp_notes: e.target.value }))} rows={2} style={{ ...input, resize: "vertical" }} />
          </label>
          <div style={{ marginBottom: "1rem" }}>
            <span style={label}>Signal types to look for</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {SIGNAL_TYPES.map(st => {
                const on = signals.includes(st);
                return (
                  <button type="button" key={st} onClick={() => setSignals(prev => on ? prev.filter(x => x !== st) : [...prev, st])}
                    style={{ background: on ? "#0ea5e9" : "#f8fafc", color: on ? "#fff" : "#64748b", border: `1px solid ${on ? "#0ea5e9" : "#e2e8f0"}`, borderRadius: 999, padding: "0.3rem 0.75rem", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {st.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ background: saving ? "#e2e8f0" : "#0ea5e9", color: saving ? "#94a3b8" : "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.25rem", fontWeight: 700, fontSize: "0.8rem", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Create brief"}
          </button>
        </form>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading ? <div style={{ padding: "2rem", color: "#94a3b8" }}>Loading…</div>
        : items.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
            No briefs yet. A brief tells Lead Hunter what to look for — create your first one.
          </div>
        ) : items.map(b => (
          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "0.85rem 1.25rem", borderBottom: "1px solid #f8fafc" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>{b.name}</div>
              <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                {[b.target_market, b.industry, b.region, b.country].filter(Boolean).join(" · ") || "No targeting details"} · max {b.max_candidates}
              </div>
            </div>
            <button onClick={() => handleNewRun(b.id)} disabled={creatingRun != null}
              style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.45rem", padding: "0.45rem 1rem", fontWeight: 700, fontSize: "0.75rem", cursor: creatingRun != null ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>
              {creatingRun === b.id ? "Creating…" : "Start run →"}
            </button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
