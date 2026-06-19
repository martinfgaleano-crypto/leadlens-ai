"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

type Job = {
  id: string;
  order_id: string;
  plan: string;
  status: string;
  progress: number;
  error_message: string | null;
  admin_approved: boolean;
  report_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  pending:          { bg: "#fef3c7", color: "#92400e" },
  awaiting_intake:  { bg: "#fef3c7", color: "#92400e" },
  intake_received:  { bg: "#dbeafe", color: "#1d4ed8" },
  queued:           { bg: "#dbeafe", color: "#1d4ed8" },
  processing:       { bg: "#e0e7ff", color: "#4338ca" },
  completed:        { bg: "#dcfce7", color: "#15803d" },
  delivered:        { bg: "#dcfce7", color: "#15803d" },
  error:            { bg: "#fee2e2", color: "#dc2626" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.55rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 999, height: 6, width: 80, overflow: "hidden" }}>
      <div style={{ background: pct === 100 ? "#16a34a" : "#0ea5e9", width: `${pct}%`, height: "100%", borderRadius: 999, transition: "width 0.3s" }} />
    </div>
  );
}

const ALL_STATUSES = ["pending", "awaiting_intake", "intake_received", "queued", "processing", "completed", "delivered", "error"];

export default function JobsListPage() {
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [filtered, setFiltered] = useState<Job[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter]     = useState("");

  useEffect(() => {
    adminFetch("/api/admin/jobs?limit=200")
      .then(async (r) => {
        if (!r.ok) { setError(`Error ${r.status}`); setLoading(false); return; }
        const d = await r.json();
        const list = (d.jobs ?? []) as Job[];
        setJobs(list);
        setFiltered(list);
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  useEffect(() => {
    let out = jobs;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(j => j.id.toLowerCase().includes(q) || j.order_id.toLowerCase().includes(q) || j.plan.toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter(j => j.status === statusFilter);
    if (planFilter)   out = out.filter(j => j.plan === planFilter);
    setFiltered(out);
  }, [search, statusFilter, planFilter, jobs]);

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s).length;
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Jobs</h1>
        <p style={{ color: "#64748b", margin: "0.2rem 0 0", fontSize: "0.875rem" }}>{jobs.length} total pipeline jobs</p>
      </div>

      {/* Status pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {ALL_STATUSES.filter(s => counts[s] > 0).map(s => {
          const c = STATUS_MAP[s] ?? { bg: "#f1f5f9", color: "#64748b" };
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              style={{ background: statusFilter === s ? c.bg : "#fff", color: statusFilter === s ? c.color : "#64748b", border: `1px solid ${statusFilter === s ? c.color : "#e2e8f0"}`, borderRadius: 999, padding: "0.25rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {s.replace(/_/g, " ")} ({counts[s]})
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <input placeholder="Search job ID, order ID, plan..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: "1 1 240px", padding: "0.6rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", fontFamily: "inherit", outline: "none" }} />
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          style={{ padding: "0.6rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit" }}>
          <option value="">All plans</option>
          <option value="sample">Sample</option>
          <option value="starter">Starter</option>
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading && <div style={{ padding: "2rem", color: "#64748b" }}>Loading jobs...</div>}
        {error   && <div style={{ padding: "2rem", color: "#dc2626" }}>{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>No jobs found</div>
            <div style={{ fontSize: "0.8rem" }}>{jobs.length === 0 ? "Jobs are created automatically when orders are received." : "Try clearing filters."}</div>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Created", "Job ID", "Order ID", "Plan", "Status", "Progress", "Report", ""].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((j, i) => (
                <tr key={j.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(j.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#0f172a" }}>{j.id.slice(0, 10)}…</span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link href={`/admin/orders/${j.order_id}`} style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#0ea5e9", textDecoration: "none" }}>
                      {j.order_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>{j.plan}</td>
                  <td style={{ padding: "0.75rem 1rem" }}><StatusBadge status={j.status} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <ProgressBar pct={j.progress} />
                      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{j.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    {j.report_id
                      ? <span style={{ color: "#16a34a", fontSize: "0.75rem", fontWeight: 600 }}>Ready</span>
                      : <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>—</span>}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link href={`/admin/jobs/${j.id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" }}>View →</Link>
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
