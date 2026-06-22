"use client";
import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface AnalyticsStats {
  total:               number;
  completed:           number;
  failed:              number;
  success_rate:        number;
  avg_duration_ms:     number | null;
  credits_consumed:    number;
  avg_leads_delivered: number | null;
}

interface FailureRow {
  id:                    string;
  name:                  string;
  credits_consumed:      number;
  process_duration_ms:   number | null;
  process_error_message: string | null;
  error_message:         string | null;
  created_at:            string;
  profiles:              { email: string | null } | null;
}

interface SearchRow {
  id:                      string;
  name:                    string;
  status:                  string;
  requested_lead_count:    number;
  process_generated_count: number | null;
  credits_consumed:        number;
  process_duration_ms:     number | null;
  process_error_message:   string | null;
  created_at:              string;
  profiles:                { email: string | null } | null;
}

interface ApiResponse {
  stats:           AnalyticsStats;
  recent_failures: FailureRow[];
  searches:        SearchRow[];
  total:           number;
  page:            number;
  per_page:        number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef9c3", color: "#854d0e" },
  processing: { bg: "#e0f2fe", color: "#075985" },
  completed:  { bg: "#dcfce7", color: "#14532d" },
  failed:     { bg: "#fee2e2", color: "#7f1d1d" },
};

function StatusBadge({ status }: { status: string }) {
  const { bg, color } = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <span style={{ background: bg, color, borderRadius: "99px", padding: "0.15rem 0.6rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" } as React.CSSProperties}>
      {status}
    </span>
  );
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.5rem", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.35rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

const TH: React.CSSProperties = { textAlign: "left", padding: "0.65rem 1rem", fontWeight: 700, color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0" };
const TD: React.CSSProperties = { padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", fontSize: "0.83rem", color: "#1e293b" };

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [data, setData]       = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState("");
  const [q, setQ]             = useState("");

  const load = useCallback((p: number, st: string, query: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), per_page: "20" });
    if (st)    params.set("status", st);
    if (query) params.set("q", query);

    adminFetch(`/api/admin/analytics/searches?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: ApiResponse | null) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1, "", ""); }, [load]);

  function applyFilter() {
    setPage(1);
    load(1, status, q);
  }

  function goPage(p: number) {
    setPage(p);
    load(p, status, q);
  }

  const stats    = data?.stats;
  const searches = data?.searches ?? [];
  const failures = data?.recent_failures ?? [];
  const total    = data?.total ?? 0;
  const perPage  = data?.per_page ?? 20;
  const totalPages = Math.ceil(total / perPage);

  return (
    <AdminLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Search Analytics</h1>
          <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
            Aggregate metrics and per-search details. Run migration 013 to enable credit tracking.
          </p>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <StatCard label="Total Searches"   value={stats.total.toLocaleString()} />
          <StatCard label="Completed"        value={stats.completed.toLocaleString()} />
          <StatCard label="Failed"           value={stats.failed.toLocaleString()} />
          <StatCard label="Success Rate"     value={`${stats.success_rate}%`} />
          <StatCard label="Avg Duration"     value={fmtDuration(stats.avg_duration_ms)} />
          <StatCard label="Credits Consumed" value={stats.credits_consumed.toLocaleString()} />
          <StatCard label="Avg Leads / Run"  value={stats.avg_leads_delivered ?? "—"} />
        </div>
      )}

      {/* Recent failures */}
      {failures.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1.5rem" }}>
          <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #fee2e2", background: "#fff5f5", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#dc2626" }}>Recent Failures</span>
            <span style={{ fontSize: "0.72rem", color: "#f87171", fontWeight: 600 }}>{failures.length}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                {["Search", "Customer", "Error", "Credits", "Duration", "Date"].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failures.map(f => (
                <tr key={f.id}>
                  <td style={TD}><span style={{ fontWeight: 600, color: "#0f172a" }}>{f.name}</span></td>
                  <td style={{ ...TD, color: "#64748b" }}>{f.profiles?.email ?? "—"}</td>
                  <td style={{ ...TD, color: "#dc2626", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.error_message ?? f.process_error_message ?? "—"}
                  </td>
                  <td style={{ ...TD, color: "#64748b" }}>{f.credits_consumed}</td>
                  <td style={{ ...TD, color: "#64748b" }}>{fmtDuration(f.process_duration_ms)}</td>
                  <td style={{ ...TD, color: "#94a3b8" }}>{fmtDate(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filter toolbar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && applyFilter()}
          style={{ padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#1e293b", outline: "none", width: 200 }}
        />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); load(1, e.target.value, q); }}
          style={{ padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#1e293b", outline: "none", background: "#fff" }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <button
          onClick={applyFilter}
          style={{ padding: "0.45rem 1rem", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          Filter
        </button>
      </div>

      {/* Searches table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
          <thead>
            <tr>
              {["Search", "Customer", "Status", "Requested", "Delivered", "Credits", "Duration", "Date"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: "#94a3b8", padding: "3rem" }}>Loading…</td></tr>
            ) : searches.length === 0 ? (
              <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: "#94a3b8", padding: "3rem" }}>No searches found.</td></tr>
            ) : (
              searches.map(s => (
                <tr key={s.id}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={{ ...TD, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{s.name}</span>
                  </td>
                  <td style={{ ...TD, color: "#64748b" }}>{s.profiles?.email ?? "—"}</td>
                  <td style={TD}><StatusBadge status={s.status} /></td>
                  <td style={{ ...TD, color: "#64748b", textAlign: "center" }}>{s.requested_lead_count}</td>
                  <td style={{ ...TD, color: "#64748b", textAlign: "center" }}>{s.process_generated_count ?? "—"}</td>
                  <td style={{ ...TD, color: s.credits_consumed > 0 ? "#16a34a" : "#94a3b8", fontWeight: s.credits_consumed > 0 ? 700 : 400, textAlign: "center" }}>
                    {s.credits_consumed}
                  </td>
                  <td style={{ ...TD, color: "#64748b" }}>{fmtDuration(s.process_duration_ms)}</td>
                  <td style={{ ...TD, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(s.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem", borderTop: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              {total.toLocaleString()} total — page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
                style={{ padding: "0.3rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.8rem", background: page <= 1 ? "#f8fafc" : "#fff", color: page <= 1 ? "#94a3b8" : "#1e293b", cursor: page <= 1 ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => goPage(page + 1)}
                style={{ padding: "0.3rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.8rem", background: page >= totalPages ? "#f8fafc" : "#fff", color: page >= totalPages ? "#94a3b8" : "#1e293b", cursor: page >= totalPages ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
