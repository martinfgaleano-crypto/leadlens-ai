"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchRow = {
  id: string;
  user_id: string;
  icp_id: string | null;
  name: string;
  status: string;
  requested_lead_count: number;
  created_at: string;
  customer_email: string;
  icp_name: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:    { bg: "#fef3c7", color: "#92400e" },
    processing: { bg: "#e0e7ff", color: "#4338ca" },
    completed:  { bg: "#dcfce7", color: "#15803d" },
    failed:     { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{
      display: "inline-block", background: s.bg, color: s.color,
      borderRadius: 999, padding: "0.18rem 0.55rem",
      fontSize: "0.68rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      {status}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSearchesPage() {
  const [searches, setSearches]     = useState<SearchRow[]>([]);
  const [filtered, setFiltered]     = useState<SearchRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [query, setQuery]           = useState("");
  const [statusFilter, setStatus]   = useState("");

  useEffect(() => {
    adminFetch("/api/admin/searches?limit=200")
      .then(async (r) => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? `Error ${r.status}`); setLoading(false); return; }
        const d = await r.json();
        const list = (d.searches ?? []) as SearchRow[];
        setSearches(list);
        setFiltered(list);
        setLoading(false);
      })
      .catch(() => { setError("Network error — could not load searches."); setLoading(false); });
  }, []);

  useEffect(() => {
    let out = searches;
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.customer_email.toLowerCase().includes(q) ||
        (s.icp_name ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter) out = out.filter(s => s.status === statusFilter);
    setFiltered(out);
  }, [query, statusFilter, searches]);

  const counts = {
    pending:    searches.filter(s => s.status === "pending").length,
    processing: searches.filter(s => s.status === "processing").length,
    completed:  searches.filter(s => s.status === "completed").length,
    failed:     searches.filter(s => s.status === "failed").length,
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Lead Searches</h1>
          <p style={{ color: "#64748b", margin: "0.2rem 0 0", fontSize: "0.875rem" }}>{searches.length} total across all customers</p>
        </div>
      </div>

      {/* Status summary chips */}
      {!loading && searches.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {(["pending", "processing", "completed", "failed"] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatus(statusFilter === st ? "" : st)}
              style={{
                background: statusFilter === st ? "#0f172a" : "#fff",
                color:      statusFilter === st ? "#f8fafc"  : "#64748b",
                border: "1px solid #e2e8f0",
                borderRadius: "99px", padding: "0.3rem 0.875rem",
                fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {st} <span style={{ fontWeight: 800 }}>({counts[st]})</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + status filter */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <input
          placeholder="Search name, email, ICP..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: "1 1 240px", padding: "0.6rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0f172a", fontFamily: "inherit", outline: "none" }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          style={{ padding: "0.6rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0f172a", background: "#fff", fontFamily: "inherit", outline: "none" }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: "2rem", color: "#64748b", fontSize: "0.875rem" }}>Loading searches…</div>
        )}
        {error && (
          <div style={{ padding: "2rem", color: "#dc2626", fontSize: "0.875rem" }}>{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              {searches.length === 0 ? "No searches yet" : "No results for these filters"}
            </div>
            <div style={{ fontSize: "0.8rem" }}>
              {searches.length === 0
                ? "Lead searches submitted by customers will appear here."
                : "Try clearing the filters."}
            </div>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Date", "Search name", "Customer", "ICP", "Leads", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", maxWidth: 220 }}>
                    <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontFamily: "monospace" }}>{s.id.slice(0, 8)}…</div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}>{s.customer_email}</div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ fontSize: "0.78rem", color: s.icp_name ? "#0f172a" : "#94a3b8" }}>
                      {s.icp_name ?? "—"}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.825rem", color: "#64748b", fontWeight: 600 }}>
                    {s.requested_lead_count}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link href={`/admin/searches/${s.id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
