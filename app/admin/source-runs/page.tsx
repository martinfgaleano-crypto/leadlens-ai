"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface RunRow {
  id:            string;
  search_id:     string | null;
  source_name:   string;
  status:        string;
  started_at:    string;
  completed_at:  string | null;
  duration_ms:   number | null;
  results_found: number;
  notes:         string | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const SOURCE_LABELS: Record<string, string> = {
  apollo: "Apollo.io", google_maps: "Google Maps", linkedin: "LinkedIn",
  company_websites: "Company Websites", directories: "Directories", crunchbase: "Crunchbase",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    completed: ["#16a34a", "#f0fdf4"],
    failed:    ["#dc2626", "#fef2f2"],
    processing:["#0ea5e9", "#f0f9ff"],
    skipped:   ["#94a3b8", "#f1f5f9"],
  };
  const [color, bg] = map[status] ?? ["#64748b", "#f1f5f9"];
  return (
    <span style={{ background: bg, color, fontWeight: 700, fontSize: "0.7rem", padding: "0.2rem 0.55rem", borderRadius: "1rem", border: `1px solid ${color}25`, textTransform: "capitalize" as const }}>
      {status}
    </span>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

const S = {
  toolbar:  { display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" as const, alignItems: "center" },
  select:   { padding: "0.5rem 0.9rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", fontSize: "0.875rem", color: "#1e293b", background: "#fff", cursor: "pointer" } as React.CSSProperties,
  clearBtn: { padding: "0.5rem 0.9rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", fontSize: "0.8rem", color: "#64748b", background: "#fff", cursor: "pointer" } as React.CSSProperties,
  card:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  table:    { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.83rem" },
  th:       { textAlign: "left" as const, padding: "0.65rem 1rem", fontWeight: 700, color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0" },
  td:       { padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" as const },
  pgBtn:    (active: boolean) => ({ padding: "0.35rem 0.75rem", borderRadius: "0.4rem", fontSize: "0.8rem", cursor: "pointer", border: "1px solid #e2e8f0", fontWeight: active ? 700 : 400, background: active ? "#0ea5e9" : "#fff", color: active ? "#fff" : "#64748b" } as React.CSSProperties),
};

export default function SourceRunsPage() {
  const [runs, setRuns]           = useState<RunRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sourceName, setSourceName] = useState("");
  const [status, setStatus]       = useState("");
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRuns = useCallback(async (src: string, st: string, pg: number) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ source_name: src, status: st, page: String(pg), per_page: "25" });
      const res = await adminFetch(`/api/admin/source-runs?${p}`);
      if (res.ok) {
        const d = await res.json() as { runs: RunRow[]; total: number; total_pages: number };
        setRuns(d.runs ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.total_pages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchRuns(sourceName, status, page), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sourceName, status, page, fetchRuns]);

  function handleClear() { setSourceName(""); setStatus(""); setPage(1); }

  return (
    <AdminLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Source Runs</h1>
        <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{total} runs</span>
      </div>

      {/* Filters */}
      <div style={S.toolbar}>
        <select style={S.select} value={sourceName} onChange={e => { setSourceName(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select style={S.select} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
          <option value="skipped">Skipped</option>
        </select>
        {(sourceName || status) && (
          <button style={S.clearBtn} onClick={handleClear}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Time</th>
              <th style={S.th}>Source</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Duration</th>
              <th style={S.th}>Results</th>
              <th style={S.th}>Search ID</th>
              <th style={S.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>Loading…</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>No runs found.</td></tr>
            ) : (
              runs.map(r => (
                <tr key={r.id}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={S.td}><span style={{ color: "#64748b", fontSize: "0.8rem" }}>{fmtDate(r.started_at)}</span></td>
                  <td style={S.td}><span style={{ fontWeight: 600, color: "#1e293b" }}>{SOURCE_LABELS[r.source_name] ?? r.source_name}</span></td>
                  <td style={S.td}><StatusBadge status={r.status} /></td>
                  <td style={S.td}><span style={{ color: "#64748b" }}>{fmtDuration(r.duration_ms)}</span></td>
                  <td style={S.td}><span style={{ fontWeight: 600, color: "#0f172a" }}>{r.results_found}</span></td>
                  <td style={S.td}>
                    {r.search_id
                      ? <a href={`/admin/searches/${r.search_id}`} style={{ color: "#0ea5e9", fontSize: "0.75rem", fontFamily: "monospace", textDecoration: "none" }}>
                          {r.search_id.slice(0, 8)}…
                        </a>
                      : <span style={{ color: "#94a3b8" }}>—</span>
                    }
                  </td>
                  <td style={S.td}><span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{r.notes ?? "—"}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button style={S.pgBtn(false)} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => i + 1).map(p => (
            <button key={p} style={S.pgBtn(p === page)} onClick={() => setPage(p)}>{p}</button>
          ))}
          {totalPages > 7 && page < totalPages && (
            <button style={S.pgBtn(false)} onClick={() => setPage(totalPages)}>{totalPages}</button>
          )}
          <button style={S.pgBtn(false)} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </AdminLayout>
  );
}
