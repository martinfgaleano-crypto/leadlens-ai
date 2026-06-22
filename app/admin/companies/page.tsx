"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface CompanyRow {
  id:             string;
  company_name:   string;
  domain:         string | null;
  industry:       string | null;
  company_size:   string | null;
  contacts_count: number;
  times_seen:     number;
  average_score:  number | null;
  top_score:      number | null;
  last_seen:      string;
}

interface Stats {
  total:         number;
  industries:    number;
  avg_score:     number;
  top_score:     number;
  repeat_count:  number;
  repeat_rate:   number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ScorePill({ value, label }: { value: number | null; label?: string }) {
  if (value == null) return <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>—</span>;
  const color = value >= 70 ? "#16a34a" : value >= 50 ? "#d97706" : "#dc2626";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      background: color + "18", color, fontWeight: 700,
      fontSize: "0.78rem", padding: "0.2rem 0.55rem", borderRadius: "1rem",
      border: `1px solid ${color}30`,
    }}>
      {label && <span style={{ fontWeight: 500, opacity: 0.8 }}>{label}</span>}
      {value}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem",
      padding: "1.1rem 1.5rem", minWidth: 120, flex: 1,
    }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.35rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

const S = {
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" } as React.CSSProperties,
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 } as React.CSSProperties,
  statsRow: { display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" as const },
  toolbar: { display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" as const, alignItems: "center" },
  input: {
    padding: "0.5rem 0.9rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0",
    fontSize: "0.875rem", color: "#1e293b", outline: "none", minWidth: 220,
  } as React.CSSProperties,
  select: {
    padding: "0.5rem 0.9rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0",
    fontSize: "0.875rem", color: "#1e293b", background: "#fff", cursor: "pointer",
  } as React.CSSProperties,
  clearBtn: {
    padding: "0.5rem 0.9rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0",
    fontSize: "0.8rem", color: "#64748b", background: "#fff", cursor: "pointer",
  } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.85rem" },
  th: {
    textAlign: "left" as const, padding: "0.65rem 0.9rem", fontWeight: 700,
    color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase" as const,
    letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0",
  },
  td: { padding: "0.75rem 0.9rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" as const },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" as const },
  pagination: { display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end", marginTop: "1rem" } as React.CSSProperties,
  pgBtn: (active: boolean) => ({
    padding: "0.35rem 0.75rem", borderRadius: "0.4rem", fontSize: "0.8rem", cursor: "pointer",
    border: "1px solid #e2e8f0", fontWeight: active ? 700 : 400,
    background: active ? "#0ea5e9" : "#fff", color: active ? "#fff" : "#64748b",
  } as React.CSSProperties),
};

export default function CompaniesPage() {
  const [companies, setCompanies]     = useState<CompanyRow[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [q, setQ]                     = useState("");
  const [industry, setIndustry]       = useState("");
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [total, setTotal]             = useState(0);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCompanies = useCallback(async (qVal: string, indVal: string, pageVal: number) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ q: qVal, industry: indVal, page: String(pageVal), per_page: "25" });
      const res = await adminFetch(`/api/admin/companies?${p.toString()}`);
      if (res.ok) {
        const data = await res.json() as { companies: CompanyRow[]; total: number; total_pages: number };
        setCompanies(data.companies ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    adminFetch("/api/admin/companies/stats")
      .then(r => r.ok ? r.json() : null)
      .then((d: Stats | null) => { if (d) setStats(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCompanies(q, industry, page);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, industry, page, fetchCompanies]);

  function handleQChange(val: string) { setQ(val); setPage(1); }
  function handleIndustryChange(val: string) { setIndustry(val); setPage(1); }
  function handleClear() { setQ(""); setIndustry(""); setPage(1); }

  return (
    <AdminLayout>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>Company Intelligence</h1>
        <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{total} companies</span>
      </div>

      {/* Stats */}
      {stats && (
        <div style={S.statsRow}>
          <StatCard label="Total Companies"   value={stats.total.toLocaleString()} />
          <StatCard label="Industries"        value={stats.industries} />
          <StatCard label="Avg Score"         value={stats.avg_score} />
          <StatCard label="Top Score"         value={stats.top_score} />
          <StatCard label="Repeat Companies"  value={stats.repeat_count} />
          <StatCard label="Repeat Rate"       value={`${stats.repeat_rate}%`} />
        </div>
      )}

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          style={S.input}
          placeholder="Search companies or domains…"
          value={q}
          onChange={e => handleQChange(e.target.value)}
        />
        <select style={S.select} value={industry} onChange={e => handleIndustryChange(e.target.value)}>
          <option value="">All industries</option>
          <option value="Technology">Technology</option>
          <option value="Finance">Finance</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Marketing">Marketing</option>
          <option value="Retail">Retail</option>
          <option value="Real Estate">Real Estate</option>
          <option value="Education">Education</option>
        </select>
        {(q || industry) && (
          <button style={S.clearBtn} onClick={handleClear}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Company</th>
              <th style={S.th}>Industry</th>
              <th style={S.th}>Contacts</th>
              <th style={S.th}>Times Seen</th>
              <th style={S.th}>Avg Score</th>
              <th style={S.th}>Top Score</th>
              <th style={S.th}>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
                  Loading…
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
                  No companies found.
                </td>
              </tr>
            ) : (
              companies.map(c => (
                <tr
                  key={c.id}
                  onClick={() => { window.location.href = `/admin/companies/${c.id}`; }}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>{c.company_name}</div>
                    {c.domain && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{c.domain}</div>}
                  </td>
                  <td style={S.td}>
                    <span style={{ color: "#64748b" }}>{c.industry ?? "—"}</span>
                  </td>
                  <td style={S.td}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{c.contacts_count}</span>
                  </td>
                  <td style={S.td}>
                    <span style={{ color: "#64748b" }}>{c.times_seen}</span>
                  </td>
                  <td style={S.td}><ScorePill value={c.average_score} /></td>
                  <td style={S.td}><ScorePill value={c.top_score} /></td>
                  <td style={S.td}>
                    <span style={{ color: "#64748b", fontSize: "0.82rem" }}>{fmtDate(c.last_seen)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={S.pagination}>
          <button style={S.pgBtn(false)} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const p = i + 1;
            return <button key={p} style={S.pgBtn(p === page)} onClick={() => setPage(p)}>{p}</button>;
          })}
          {totalPages > 7 && page < totalPages && (
            <button style={S.pgBtn(false)} onClick={() => setPage(totalPages)}>{totalPages}</button>
          )}
          <button style={S.pgBtn(false)} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </AdminLayout>
  );
}
