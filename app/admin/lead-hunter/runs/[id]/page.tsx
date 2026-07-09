"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminLayout from "../../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const CATEGORIES = ["company_website", "public_job_post", "public_news", "public_directory_permitted", "event_conference_page", "marketplace_listing", "public_registry", "customer_provided", "other_permitted_public_source"];
const RIGHTS = ["unverified", "permitted", "licensed", "restricted"];

type Run = { id: string; status: string; provider_mode: string; candidate_count: number; run_summary: Record<string, unknown> | null; error_message: string | null };
type Brief = { id: string; name: string } | null;
type SourceInput = { id: string; source_url: string; source_category: string; usage_rights_status: string; safety_status: string; pasted_context: string | null };
type Candidate = { id: string; company_name: string; signal_summary: string | null; confidence_score: number | null; review_status: string; safety_status: string; source_url: string };

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [brief, setBrief] = useState<Brief>(null);
  const [sources, setSources] = useState<SourceInput[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({ source_category: "", usage_rights_status: "permitted" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await adminFetch(`/api/admin/lead-hunter/runs/${id}`);
    if (res.ok) {
      const d = await res.json().catch(() => null);
      if (d?.run) { setRun(d.run); setBrief(d.brief); setSources(d.sources ?? []); setCandidates(d.candidates ?? []); }
    }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!form.source_url?.trim()) { setMsg({ ok: false, text: "Source URL is required." }); return; }
    setBusy(true);
    setMsg(null);
    const res = await adminFetch(`/api/admin/lead-hunter/runs/${id}/sources`, { method: "POST", body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: d.warning ? `Source added — ${d.warning}` : "Source added." });
      setForm({ source_category: "", usage_rights_status: "permitted" });
      await load();
    } else setMsg({ ok: false, text: d.error ?? "Could not add source." });
    setBusy(false);
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    const res = await adminFetch(`/api/admin/lead-hunter/runs/${id}/generate`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setMsg({ ok: true, text: `Generated ${d.summary?.candidates_created ?? 0} candidate(s) — ${d.summary?.blocked_sources ?? 0} source(s) blocked, ${d.summary?.needs_review ?? 0} need rights review.` });
    else setMsg({ ok: false, text: d.error ?? "Generation failed." });
    setBusy(false);
    await load();
  }

  const input: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" };
  const label: React.CSSProperties = { display: "block", fontSize: "0.68rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.3rem" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.1rem 1.25rem", marginBottom: "1.25rem" };

  if (loading) return <AdminLayout><div style={{ color: "#94a3b8", padding: "2rem" }}>Loading run…</div></AdminLayout>;
  if (!run) return <AdminLayout><div style={{ color: "#dc2626", padding: "2rem" }}>Run not found.</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.1rem" }}>
        <Link href="/admin/lead-hunter/runs" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Runs</Link>
        <h1 style={{ color: "#0f172a", fontSize: "1.3rem", fontWeight: 800, margin: "0.6rem 0 0" }}>
          Run{brief ? ` — ${brief.name}` : ""}
        </h1>
        <div style={{ color: "#64748b", fontSize: "0.78rem", marginTop: "0.25rem" }}>
          Status: <strong>{run.status}</strong> · mode: {run.provider_mode} · {candidates.length} candidate(s)
          {run.error_message && <span style={{ color: "#dc2626" }}> · {run.error_message}</span>}
        </div>
      </div>

      {msg && <div style={{ marginBottom: "1rem", padding: "0.6rem 0.9rem", background: msg.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.5rem", fontSize: "0.8rem", color: msg.ok ? "#15803d" : "#dc2626" }}>{msg.text}</div>}

      {/* Add source */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: "0.35rem" }}>Add source input</div>
        <p style={{ color: "#64748b", fontSize: "0.78rem", margin: "0 0 0.85rem", lineHeight: 1.55 }}>
          Paste a permitted public source URL plus context. Format the first line as
          <code style={{ background: "#f1f5f9", padding: "0 0.3rem", borderRadius: 3 }}> Company — evidence</code> so
          the engine can extract a candidate. Nothing is fetched from the URL — provenance only.
        </p>
        <form onSubmit={addSource}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem", marginBottom: "0.85rem" }}>
            <label><span style={label}>Source URL *</span><input value={form.source_url ?? ""} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} style={input} placeholder="https://…" /></label>
            <label><span style={label}>Source title</span><input value={form.source_title ?? ""} onChange={e => setForm(f => ({ ...f, source_title: e.target.value }))} style={input} /></label>
            <label><span style={label}>Category (auto-detected if empty)</span>
              <select value={form.source_category ?? ""} onChange={e => setForm(f => ({ ...f, source_category: e.target.value }))} style={input}>
                <option value="">Auto-detect</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label><span style={label}>Usage rights</span>
              <select value={form.usage_rights_status ?? "permitted"} onChange={e => setForm(f => ({ ...f, usage_rights_status: e.target.value }))} style={input}>
                {RIGHTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: "block", marginBottom: "0.85rem" }}>
            <span style={label}>Pasted context (first line: Company — evidence)</span>
            <textarea value={form.pasted_context ?? ""} onChange={e => setForm(f => ({ ...f, pasted_context: e.target.value }))} rows={3} style={{ ...input, resize: "vertical" }}
              placeholder="Acme Corp — announced a new plant in Medellín and is hiring 40 sales roles (source published 2026-06-20)" />
          </label>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button type="submit" disabled={busy} style={{ background: busy ? "#e2e8f0" : "#0ea5e9", color: busy ? "#94a3b8" : "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.1rem", fontWeight: 700, fontSize: "0.8rem", cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Add source</button>
            <button type="button" onClick={generate} disabled={busy || sources.length === 0} style={{ background: busy || sources.length === 0 ? "#e2e8f0" : "#0f172a", color: busy || sources.length === 0 ? "#94a3b8" : "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.1rem", fontWeight: 700, fontSize: "0.8rem", cursor: busy || sources.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {busy ? "Working…" : `Generate candidates (${sources.length} source${sources.length === 1 ? "" : "s"})`}
            </button>
          </div>
        </form>
      </div>

      {/* Sources */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: "0.6rem" }}>Source inputs ({sources.length})</div>
        {sources.length === 0 ? <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>None yet.</div>
        : sources.map(s => (
          <div key={s.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f8fafc", fontSize: "0.78rem" }}>
            <span style={{ color: "#0f172a", fontWeight: 600 }}>{s.source_url.slice(0, 60)}{s.source_url.length > 60 ? "…" : ""}</span>
            <span style={{ color: "#64748b" }}> · {s.source_category} · rights: {s.usage_rights_status}</span>
            <span style={{ marginLeft: "0.4rem", background: s.safety_status === "blocked" ? "#fee2e2" : s.safety_status === "needs_review" ? "#fef3c7" : "#dcfce7", color: s.safety_status === "blocked" ? "#dc2626" : s.safety_status === "needs_review" ? "#92400e" : "#15803d", borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.65rem", fontWeight: 700 }}>{s.safety_status}</span>
          </div>
        ))}
      </div>

      {/* Candidates for this run */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>Candidates ({candidates.length})</span>
          <Link href={`/admin/lead-hunter/candidates?run_id=${id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.75rem", textDecoration: "none" }}>Review all →</Link>
        </div>
        {candidates.length === 0 ? <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>No candidates yet — add sources and generate.</div>
        : candidates.slice(0, 10).map(c => (
          <div key={c.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f8fafc", fontSize: "0.78rem" }}>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>{c.company_name}</span>
            <span style={{ color: "#64748b" }}> · {c.signal_summary?.slice(0, 70) ?? "—"} · conf {c.confidence_score ?? "—"}</span>
            <span style={{ marginLeft: "0.4rem", color: "#94a3b8" }}>[{c.review_status}]</span>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
