"use client";
import { useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotRow {
  id:          string;
  job_id:      string;
  plan:        string;
  status:      "processing" | "completed" | "failed";
  lead_count:  number | null;
  hot_count:   number | null;
  warm_count:  number | null;
  avg_score:   number | null;
  created_at:  string;
}

interface Summary {
  total:      number;
  completed:  number;
  failed:     number;
  processing: number;
  avg_leads:  number;
  avg_score:  number;
}

interface SnapshotsData {
  summary:   Summary;
  snapshots: SnapshotRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<string, string> = {
  sample:   "Sample",
  starter:  "Starter",
  standard: "Standard",
  pro:      "Pro",
};

const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  sample:   { bg: "#f1f5f9", color: "#475569" },
  starter:  { bg: "#dbeafe", color: "#1d4ed8" },
  standard: { bg: "#e0e7ff", color: "#3730a3" },
  pro:      { bg: "#fef3c7", color: "#92400e" },
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  completed:  { bg: "#dcfce7", color: "#15803d" },
  failed:     { bg: "#fee2e2", color: "#dc2626" },
  processing: { bg: "#fef3c7", color: "#92400e" },
};

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem", borderTop: accent ? `3px solid ${accent}` : undefined }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const s = PLAN_COLOR[plan] ?? { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.65rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.03em" }}>
      {PLAN_LABEL[plan] ?? plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOR[status] ?? { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.65rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.03em" }}>
      {status}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>—</span>;
  const pct   = Math.min(100, Math.max(0, Number(score)));
  const color = pct >= 70 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ width: 60, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>{Number(score).toFixed(1)}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SnapshotsPage() {
  const [data,   setData]   = useState<SnapshotsData | null>(null);
  const [error,  setError]  = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter,   setPlanFilter]   = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (planFilter)   params.set("plan",   planFilter);
    params.set("limit", "100");

    const res  = await adminFetch(`/api/admin/snapshots?${params}`);
    if (!res.ok) {
      setError(`Error ${res.status} — could not load snapshots.`);
      setLoading(false);
      return;
    }
    const json = await res.json() as SnapshotsData;
    setData(json);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter, planFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const S = data?.summary;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Snapshots
          </h1>
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
            Pipeline runs persisted to <code style={{ fontFamily: "monospace", fontSize: "0.78rem", background: "#f1f5f9", padding: "0.1rem 0.3rem", borderRadius: 4 }}>snapshot_reports</code>. No personal data stored here.
          </p>
        </div>

        {/* Summary cards */}
        {S && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.875rem", marginBottom: "1.75rem" }}>
            <StatCard label="Total Snapshots" value={S.total} accent="#0ea5e9" />
            <StatCard label="Completed"       value={S.completed} sub={`${S.total ? Math.round(S.completed / S.total * 100) : 0}% of total`} accent="#16a34a" />
            <StatCard label="Failed"          value={S.failed}  accent={S.failed > 0 ? "#dc2626" : undefined} />
            <StatCard label="Processing"      value={S.processing} />
            <StatCard label="Avg Leads / Run" value={S.avg_leads} />
            <StatCard label="Avg Opp. Score"  value={S.avg_score > 0 ? S.avg_score.toFixed(1) : "—"} />
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>Filter:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "#fff", color: "#0f172a", cursor: "pointer" }}
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="processing">Processing</option>
          </select>
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "#fff", color: "#0f172a", cursor: "pointer" }}
          >
            <option value="">All plans</option>
            <option value="sample">Sample</option>
            <option value="starter">Starter</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
          </select>
          <button
            onClick={load}
            style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "#f8fafc", color: "#475569", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>

        {/* States */}
        {loading && (
          <div style={{ padding: "3rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>
            Loading snapshots...
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: "1.25rem 1.5rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.75rem", color: "#dc2626", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {!loading && !error && data && data.snapshots.length === 0 && (
          <div style={{ padding: "3rem", textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📭</div>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "0.35rem" }}>No snapshots yet</div>
            <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Snapshots appear here after a pipeline run via <code style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>POST /api/process</code>.
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !error && data && data.snapshots.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Job ID", "Plan", "Status", "Leads", "Hot", "Warm", "Avg Score", "Created", "Report"].map(h => (
                      <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((row, i) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: i < data.snapshots.length - 1 ? "1px solid #f1f5f9" : "none" }}
                    >
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.72rem", color: "#475569", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.job_id}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <PlanBadge plan={row.plan} />
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#0f172a", fontWeight: 600 }}>
                        {row.lead_count ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#dc2626", fontWeight: 600 }}>
                        {row.hot_count ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#d97706", fontWeight: 600 }}>
                        {row.warm_count ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <ScoreBar score={row.avg_score} />
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {formatDate(row.created_at)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <a
                          href={`/api/results/${row.job_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.75rem", color: "#0ea5e9", fontWeight: 600, textDecoration: "none", padding: "0.25rem 0.6rem", border: "1px solid #bae6fd", borderRadius: "0.35rem", background: "#f0f9ff", whiteSpace: "nowrap" }}
                        >
                          View JSON →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "0.65rem 1rem", borderTop: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#94a3b8" }}>
              Showing {data.snapshots.length} snapshot{data.snapshots.length !== 1 ? "s" : ""}
              {statusFilter || planFilter ? " (filtered)" : ""}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
