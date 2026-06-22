"use client";
import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface NotifStats {
  total:            number;
  unread:           number;
  search_completed: number;
  search_failed:    number;
  credits_low:      number;
  credits_added:    number;
}

interface NotifRow {
  id:         string;
  user_id:    string;
  type:       string;
  title:      string;
  message:    string;
  is_read:    boolean;
  created_at: string;
  profiles:   { email: string | null } | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  search_completed: { color: "#16a34a", bg: "#f0fdf4" },
  search_failed:    { color: "#dc2626", bg: "#fef2f2" },
  credits_low:      { color: "#d97706", bg: "#fffbeb" },
  credits_added:    { color: "#0ea5e9", bg: "#f0f9ff" },
};

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLES[type] ?? { color: "#64748b", bg: "#f1f5f9" };
  const label = type.replace(/_/g, " ");
  return (
    <span style={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: "0.65rem", padding: "0.15rem 0.55rem", borderRadius: "1rem", border: `1px solid ${s.color}25`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.5rem", flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.35rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>{value.toLocaleString()}</div>
    </div>
  );
}

const TH: React.CSSProperties = { textAlign: "left", padding: "0.65rem 1rem", fontWeight: 700, color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0" };
const TD: React.CSSProperties = { padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", fontSize: "0.83rem" };

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function AdminNotificationsPage() {
  const [stats, setStats]       = useState<NotifStats | null>(null);
  const [rows, setRows]         = useState<NotifRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [typeFilter, setType]   = useState("");
  const [isReadFilter, setIsRead] = useState("");

  const PER_PAGE = 25;

  const load = useCallback((p: number, type: string, isRead: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE) });
    if (type)   params.set("type",    type);
    if (isRead) params.set("is_read", isRead);

    adminFetch(`/api/admin/notifications?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { stats: NotifStats; notifications: NotifRow[]; total: number } | null) => {
        if (d) {
          setStats(d.stats);
          setRows(d.notifications as unknown as NotifRow[]);
          setTotal(d.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1, "", ""); }, [load]);

  function applyFilter() {
    setPage(1);
    load(1, typeFilter, isReadFilter);
  }

  function goPage(p: number) {
    setPage(p);
    load(p, typeFilter, isReadFilter);
  }

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <AdminLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Notifications</h1>
        <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{total.toLocaleString()} total</span>
      </div>

      {/* Stat cards */}
      {stats && (
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <StatCard label="Total"            value={stats.total} />
          <StatCard label="Unread"           value={stats.unread} />
          <StatCard label="Search Completed" value={stats.search_completed} />
          <StatCard label="Search Failed"    value={stats.search_failed} />
          <StatCard label="Credits Low"      value={stats.credits_low} />
          <StatCard label="Credits Added"    value={stats.credits_added} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <select
          value={typeFilter}
          onChange={e => setType(e.target.value)}
          style={{ padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#1e293b", outline: "none", background: "#fff" }}
        >
          <option value="">All types</option>
          <option value="search_completed">Search completed</option>
          <option value="search_failed">Search failed</option>
          <option value="credits_low">Credits low</option>
          <option value="credits_added">Credits added</option>
        </select>
        <select
          value={isReadFilter}
          onChange={e => setIsRead(e.target.value)}
          style={{ padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#1e293b", outline: "none", background: "#fff" }}
        >
          <option value="">All statuses</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
        <button
          onClick={applyFilter}
          style={{ padding: "0.45rem 1rem", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          Filter
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
          <thead>
            <tr>
              {["User", "Type", "Title", "Date", "Read"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#94a3b8", padding: "3rem" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#94a3b8", padding: "3rem" }}>No notifications found.</td></tr>
            ) : (
              rows.map(n => (
                <tr key={n.id}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                  style={{ background: n.is_read ? "" : "#f0f9ff" }}
                >
                  <td style={{ ...TD, color: "#64748b" }}>{n.profiles?.email ?? n.user_id.slice(0, 8)}</td>
                  <td style={TD}><TypeBadge type={n.type} /></td>
                  <td style={{ ...TD, fontWeight: n.is_read ? 400 : 600, color: "#0f172a", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title}
                  </td>
                  <td style={{ ...TD, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(n.created_at)}</td>
                  <td style={TD}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: n.is_read ? "#16a34a" : "#d97706" }}>
                      {n.is_read ? "Read" : "Unread"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem", borderTop: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{total.toLocaleString()} total — page {page} of {totalPages}</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button disabled={page <= 1} onClick={() => goPage(page - 1)}
                style={{ padding: "0.3rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.8rem", background: page <= 1 ? "#f8fafc" : "#fff", color: page <= 1 ? "#94a3b8" : "#1e293b", cursor: page <= 1 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                ← Prev
              </button>
              <button disabled={page >= totalPages} onClick={() => goPage(page + 1)}
                style={{ padding: "0.3rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.8rem", background: page >= totalPages ? "#f8fafc" : "#fff", color: page >= totalPages ? "#94a3b8" : "#1e293b", cursor: page >= totalPages ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
