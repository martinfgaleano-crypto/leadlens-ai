"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

type Candidate = {
  id: string; company_name: string; domain: string | null; region: string | null; country: string | null;
  industry: string | null; signal_type: string | null; signal_summary: string | null; signal_date: string | null;
  source_url: string; source_category: string; evidence_snippet: string | null; evidence_quality: string | null;
  freshness_status: string | null; confidence_score: number | null; usage_rights_status: string;
  safety_status: string; review_status: string; vault_company_id: string | null;
};

const REVIEW_FILTERS = ["", "pending_review", "approved", "rejected", "reserved"];
const SAFETY_FILTERS = ["", "ok", "needs_review", "blocked"];

function pill(text: string, bg: string, color: string) {
  return <span style={{ background: bg, color, borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.65rem", fontWeight: 700 }}>{text}</span>;
}

function CandidatesInner() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(searchParams.get("review_status") ?? "");
  const [safety, setSafety] = useState(searchParams.get("safety_status") ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const runId = searchParams.get("run_id") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (review) qs.set("review_status", review);
    if (safety) qs.set("safety_status", safety);
    if (runId) qs.set("run_id", runId);
    const res = await adminFetch(`/api/admin/lead-hunter/candidates?${qs.toString()}`);
    if (res.ok) setItems(((await res.json())?.items ?? []) as Candidate[]);
    setLoading(false);
  }, [review, safety, runId]);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: string) {
    setBusy(id);
    setMsg(null);
    const res = await adminFetch(`/api/admin/lead-hunter/candidates/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok
      ? { ok: true, text: action === "promote-to-vault" ? `Promoted to Vault (company ${d.company_existed ? "matched" : "created"}).` : `Candidate ${action}d.` }
      : { ok: false, text: d.error ?? "Action failed." });
    setBusy(null);
    await load();
  }

  const select: React.CSSProperties = { padding: "0.4rem 0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.78rem", fontFamily: "inherit", color: "#0f172a", background: "#fff" };
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({ background: bg, color, border: "none", borderRadius: "0.4rem", padding: "0.3rem 0.7rem", fontWeight: 700, fontSize: "0.68rem", cursor: "pointer", fontFamily: "inherit" });

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.1rem" }}>
        <Link href="/admin/lead-hunter" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Lead Hunter</Link>
        <h1 style={{ color: "#0f172a", fontSize: "1.3rem", fontWeight: 800, margin: "0.6rem 0 0" }}>Candidate review</h1>
        <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.3rem 0 0" }}>
          Review-first: nothing reaches the Vault without an explicit decision. Blocked candidates and unverified rights can never be promoted.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <select value={review} onChange={e => setReview(e.target.value)} style={select}>
          {REVIEW_FILTERS.map(f => <option key={f} value={f}>{f || "All review statuses"}</option>)}
        </select>
        <select value={safety} onChange={e => setSafety(e.target.value)} style={select}>
          {SAFETY_FILTERS.map(f => <option key={f} value={f}>{f || "All safety statuses"}</option>)}
        </select>
        {runId && <span style={{ alignSelf: "center", color: "#94a3b8", fontSize: "0.75rem" }}>Filtered to one run</span>}
      </div>

      {msg && <div style={{ marginBottom: "1rem", padding: "0.6rem 0.9rem", background: msg.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.5rem", fontSize: "0.8rem", color: msg.ok ? "#15803d" : "#dc2626" }}>{msg.text}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {loading ? <div style={{ color: "#94a3b8", padding: "1.5rem" }}>Loading…</div>
        : items.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
            No candidates match these filters. Generate candidates from a run first.
          </div>
        ) : items.map(c => (
          <div key={c.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem" }}>{c.company_name}</span>
                  {c.signal_type && pill(c.signal_type.replace(/_/g, " "), "#e0e7ff", "#4338ca")}
                  {c.freshness_status && pill(c.freshness_status, c.freshness_status === "fresh" ? "#dcfce7" : c.freshness_status === "recent" ? "#e0f2fe" : "#f1f5f9", c.freshness_status === "fresh" ? "#15803d" : c.freshness_status === "recent" ? "#075985" : "#64748b")}
                  {c.evidence_quality && pill(`evidence: ${c.evidence_quality}`, "#f8fafc", "#475569")}
                  {pill(`conf ${c.confidence_score ?? "—"}`, "#0f172a", "#fff")}
                  {c.safety_status === "blocked" && pill("BLOCKED", "#fee2e2", "#dc2626")}
                  {c.safety_status === "needs_review" && pill("RIGHTS REVIEW", "#fef3c7", "#92400e")}
                  {c.vault_company_id && pill("IN VAULT", "#dcfce7", "#15803d")}
                </div>
                {c.signal_summary && <div style={{ color: "#334155", fontSize: "0.82rem", marginBottom: "0.25rem" }}>{c.signal_summary}</div>}
                {c.evidence_snippet && <div style={{ color: "#64748b", fontSize: "0.75rem", fontStyle: "italic", marginBottom: "0.25rem" }}>&ldquo;{c.evidence_snippet.slice(0, 160)}{c.evidence_snippet.length > 160 ? "…" : ""}&rdquo;</div>}
                <div style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                  <a href={c.source_url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", textDecoration: "none" }}>{c.source_url.slice(0, 55)}{c.source_url.length > 55 ? "…" : ""}</a>
                  {" "}· {c.source_category} · rights: {c.usage_rights_status} · {[c.region, c.country].filter(Boolean).join(", ") || "region —"} · [{c.review_status}]
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, flexWrap: "wrap" }}>
                {c.review_status === "pending_review" && c.safety_status !== "blocked" && (
                  <>
                    <button onClick={() => act(c.id, "approve")} disabled={busy != null} style={btn("#15803d")}>Approve</button>
                    <button onClick={() => act(c.id, "reserve")} disabled={busy != null} style={btn("#6366f1")}>Reserve</button>
                  </>
                )}
                {c.review_status !== "rejected" && (
                  <button onClick={() => act(c.id, "reject")} disabled={busy != null} style={btn("#fff", "#dc2626")}>Reject</button>
                )}
                {(c.review_status === "approved" || c.review_status === "pending_review") && !c.vault_company_id && c.safety_status !== "blocked" && (
                  <button onClick={() => act(c.id, "promote-to-vault")} disabled={busy != null} style={btn("#0f172a")}>
                    {busy === c.id ? "Working…" : "→ Vault"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<AdminLayout><div style={{ color: "#94a3b8", padding: "2rem" }}>Loading…</div></AdminLayout>}>
      <CandidatesInner />
    </Suspense>
  );
}
