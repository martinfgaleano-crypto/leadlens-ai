"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultStats {
  total_searches:     number;
  vault_searches:     number;
  total_vault_leads:  number;
  total_apollo_leads: number;
  avg_hit_rate:       number;
}

interface SearchRow {
  id:                   string;
  name:                 string;
  status:               string;
  requested_lead_count: number;
  vault_leads_used:     number;
  apollo_leads_used:    number;
  vault_hit_rate:       number;
  created_at:           string;
  user_email:           string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["", "pending", "processing", "completed", "failed"] as const;

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:    { bg: "#fef3c7", color: "#92400e" },
    processing: { bg: "#e0e7ff", color: "#4338ca" },
    completed:  { bg: "#dcfce7", color: "#15803d" },
    failed:     { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.65rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {status}
    </span>
  );
}

function HitRateBar({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.round(rate * 100));
  const color = pct >= 60 ? "#15803d" : pct >= 30 ? "#854d0e" : "#64748b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color, minWidth: 30 }}>{pct}%</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VaultPerformancePage() {
  const [stats, setStats]       = useState<VaultStats | null>(null);
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  async function load(p = page, s = status) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(p), per_page: "25" });
    if (s) params.set("status", s);

    const res = await adminFetch(`/api/admin/vault-performance?${params.toString()}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `Error ${res.status}`);
      setLoading(false);
      return;
    }
    const d = await res.json();
    setStats(d.stats as VaultStats);
    setSearches(d.searches as SearchRow[]);
    setTotal(d.total as number);
    setLoading(false);
  }

  useEffect(() => { load(1, ""); /* eslint-disable-next-line */ }, []);

  function handleStatusChange(val: string) {
    setStatus(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, val), 350);
  }

  function goPrev() { const p = page - 1; setPage(p); load(p, status); }
  function goNext() { const p = page + 1; setPage(p); load(p, status); }

  const perPage = 25;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const formatDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          Vault Performance
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.35rem 0 0" }}>
          Vault reuse metrics across all searches.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.6rem", color: "#dc2626", fontSize: "0.82rem" }}>
          {error}
        </div>
      )}

      {/* ── Stat cards ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", marginBottom: "1.75rem" }}>
          <StatCard label="Total Searches"    value={stats.total_searches} />
          <StatCard label="Vault Searches"    value={stats.vault_searches} sub={`${stats.total_searches > 0 ? Math.round(stats.vault_searches / stats.total_searches * 100) : 0}% of total`} />
          <StatCard label="Vault Leads"       value={stats.total_vault_leads} />
          <StatCard label="Apollo Leads"      value={stats.total_apollo_leads} />
          <StatCard label="Avg Vault Hit Rate" value={`${Math.round(stats.avg_hit_rate * 100)}%`} />
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
        <select
          value={status}
          onChange={e => handleStatusChange(e.target.value)}
          style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.82rem", background: "#fff", fontFamily: "inherit", outline: "none", color: "#0f172a" }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === "" ? "All statuses" : s}</option>
          ))}
        </select>

        <span style={{ color: "#94a3b8", fontSize: "0.78rem", marginLeft: "auto" }}>
          {total} search{total !== 1 ? "es" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>Loading…</div>
        ) : searches.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No searches found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Search", "User", "Status", "Requested", "Vault Leads", "Apollo Leads", "Hit Rate", "Date"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searches.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i < searches.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                      <Link href={`/admin/searches/${row.id}`} style={{ color: "#0ea5e9", fontWeight: 600, textDecoration: "none", fontSize: "0.82rem" }}>
                        {row.name}
                      </Link>
                    </td>
                    <td style={{ padding: "0.65rem 1rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
                      {row.user_email ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={{ padding: "0.65rem 1rem", fontSize: "0.82rem", color: "#0f172a", textAlign: "center" }}>
                      {row.requested_lead_count}
                    </td>
                    <td style={{ padding: "0.65rem 1rem", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, color: row.vault_leads_used > 0 ? "#15803d" : "#94a3b8", fontSize: "0.82rem" }}>
                        {row.vault_leads_used}
                      </span>
                    </td>
                    <td style={{ padding: "0.65rem 1rem", textAlign: "center" }}>
                      <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.82rem" }}>
                        {row.apollo_leads_used}
                      </span>
                    </td>
                    <td style={{ padding: "0.65rem 1rem", minWidth: 120 }}>
                      <HitRateBar rate={row.vault_hit_rate} />
                    </td>
                    <td style={{ padding: "0.65rem 1rem", fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > perPage && (
          <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={goPrev} disabled={page === 1}
                style={{ padding: "0.4rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: page === 1 ? "#f8fafc" : "#fff", color: page === 1 ? "#cbd5e1" : "#374151", fontSize: "0.78rem", fontWeight: 600, cursor: page === 1 ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                ← Prev
              </button>
              <button
                onClick={goNext} disabled={page >= totalPages}
                style={{ padding: "0.4rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: page >= totalPages ? "#f8fafc" : "#fff", color: page >= totalPages ? "#cbd5e1" : "#374151", fontSize: "0.78rem", fontWeight: 600, cursor: page >= totalPages ? "not-allowed" : "pointer", fontFamily: "inherit" }}
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
