"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

type Run = { id: string; brief_id: string | null; status: string; provider_mode: string; candidate_count: number; created_at: string; completed_at: string | null; error_message: string | null };

const COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#f1f5f9", color: "#64748b" }, queued: { bg: "#fef3c7", color: "#92400e" },
  processing: { bg: "#e0e7ff", color: "#4338ca" }, completed: { bg: "#dcfce7", color: "#15803d" },
  failed: { bg: "#fee2e2", color: "#dc2626" }, cancelled: { bg: "#f1f5f9", color: "#94a3b8" },
};

export default function RunsPage() {
  const [items, setItems] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/lead-hunter/runs");
      if (res.ok) setItems(((await res.json())?.items ?? []) as Run[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.25rem" }}>
        <Link href="/admin/lead-hunter" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Lead Hunter</Link>
        <h1 style={{ color: "#0f172a", fontSize: "1.3rem", fontWeight: 800, margin: "0.6rem 0 0" }}>Hunter runs</h1>
        <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.3rem 0 0" }}>Each run collects sources for a brief and turns them into review-ready candidates. Start runs from the Briefs page.</p>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading ? <div style={{ padding: "2rem", color: "#94a3b8" }}>Loading…</div>
        : items.length === 0 ? <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>No runs yet — create a brief and start a run from there.</div>
        : items.map(r => {
          const c = COLORS[r.status] ?? COLORS.draft;
          return (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "0.85rem 1.25rem", borderBottom: "1px solid #f8fafc" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ background: c.bg, color: c.color, borderRadius: 999, padding: "0.15rem 0.6rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase" }}>{r.status}</span>
                  <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{r.provider_mode}</span>
                </div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  {new Date(r.created_at).toLocaleString()} · {r.candidate_count} candidate{r.candidate_count === 1 ? "" : "s"}
                  {r.error_message && <span style={{ color: "#dc2626" }}> · {r.error_message}</span>}
                </div>
              </div>
              <Link href={`/admin/lead-hunter/runs/${r.id}`} style={{ color: "#0ea5e9", fontWeight: 700, fontSize: "0.78rem", textDecoration: "none", flexShrink: 0 }}>Open →</Link>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
