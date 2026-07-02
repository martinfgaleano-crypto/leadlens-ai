"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Admin Monitor Operations ─────────────────────────────────────────────────
// Central operational view: job totals, recent runs across all series,
// drainer trigger, and per-job recovery actions. Counts and identifiers only.

type OverviewJob = {
  job_id: string;
  search_id: string | null;
  search_name: string | null;
  plan: string;
  status: "processing" | "completed" | "failed";
  lead_count: number | null;
  hot_count: number | null;
  created_at: string;
  is_stale: boolean;
  is_unscoped: boolean;
};

type Overview = {
  totals: {
    processing: number;
    stale_processing: number;
    failed: number;
    completed: number;
    unscoped_processing: number;
  };
  recent: OverviewJob[];
};

type DrainSummary = {
  scanned: number;
  retriggered: number;
  superseded: number;
  abandoned: number;
  skipped_fresh: number;
  dry_run: boolean;
  errors: string[];
};

function StatusBadge({ status, stale }: { status: string; stale?: boolean }) {
  const map: Record<string, { bg: string; color: string }> = {
    processing: { bg: "#e0e7ff", color: "#4338ca" },
    completed:  { bg: "#dcfce7", color: "#15803d" },
    failed:     { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
      <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.15rem 0.6rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase" }}>
        {status}
      </span>
      {stale && (
        <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 999, padding: "0.15rem 0.6rem", fontSize: "0.68rem", fontWeight: 700 }}>
          STALLED
        </span>
      )}
    </span>
  );
}

export default function MonitorOpsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draining, setDraining] = useState(false);
  const [drainResult, setDrainResult] = useState<DrainSummary | null>(null);
  const [retryingJob, setRetryingJob] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/monitor-runs/overview");
    if (res.ok) {
      const d = await res.json().catch(() => null);
      if (d?.totals) setOverview(d as Overview);
      setError("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `Error ${res.status}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh while anything is processing
  useEffect(() => {
    if (!overview || overview.totals.processing === 0) return;
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [overview, load]);

  async function handleDrain(dryRun: boolean) {
    if (draining) return;
    setDraining(true);
    setDrainResult(null);
    setActionMsg(null);
    const res = await adminFetch(`/api/internal/monitor-runs/drain${dryRun ? "?dry_run=true" : ""}`, { method: "POST" });
    const d = await res.json().catch(() => null);
    if (res.ok && d) setDrainResult(d as DrainSummary);
    else setActionMsg({ ok: false, text: d?.error ?? "Drainer failed." });
    setDraining(false);
    await load();
  }

  async function handleRetry(jobId: string) {
    if (retryingJob) return;
    setRetryingJob(jobId);
    setActionMsg(null);
    const res = await adminFetch(`/api/admin/monitor-runs/${jobId}/retry`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setActionMsg(res.ok
      ? { ok: true, text: d.message ?? "Retry started." }
      : { ok: false, text: d.error ?? "Retry failed." });
    setRetryingJob(null);
    await load();
  }

  return (
    <AdminLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Monitor Operations</h1>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
            Run health across all monitor series. The drainer recovers stalled jobs; the daily cron runs it automatically.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            onClick={() => handleDrain(true)}
            disabled={draining}
            style={{ background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontWeight: 600, fontSize: "0.8rem", cursor: draining ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            Dry run
          </button>
          <button
            onClick={() => handleDrain(false)}
            disabled={draining}
            style={{ background: draining ? "#e2e8f0" : "#0f172a", color: draining ? "#94a3b8" : "#fff", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.8rem", cursor: draining ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {draining ? "Draining…" : "Run drainer now"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", color: "#dc2626", fontSize: "0.85rem" }}>{error}</div>
      )}

      {actionMsg && (
        <div style={{ marginBottom: "1rem", padding: "0.6rem 0.9rem", background: actionMsg.ok ? "#dcfce7" : "#fee2e2", border: `1px solid ${actionMsg.ok ? "#86efac" : "#fca5a5"}`, borderRadius: "0.5rem", fontSize: "0.8rem", color: actionMsg.ok ? "#15803d" : "#dc2626" }}>
          {actionMsg.text}
        </div>
      )}

      {drainResult && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#075985", fontFamily: "monospace" }}>
          drain {drainResult.dry_run ? "(dry run)" : ""}: scanned {drainResult.scanned} · retriggered {drainResult.retriggered} · superseded {drainResult.superseded} · abandoned {drainResult.abandoned} · skipped fresh {drainResult.skipped_fresh}
          {drainResult.errors.length > 0 && <> · errors: {drainResult.errors.join("; ")}</>}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#64748b", padding: "2rem 0" }}>Loading…</div>
      ) : overview && (
        <>
          {/* Totals */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Processing", value: overview.totals.processing, color: "#4338ca" },
              { label: "Stalled", value: overview.totals.stale_processing, color: overview.totals.stale_processing > 0 ? "#dc2626" : "#64748b" },
              { label: "Failed", value: overview.totals.failed, color: overview.totals.failed > 0 ? "#dc2626" : "#64748b" },
              { label: "Completed", value: overview.totals.completed, color: "#15803d" },
              { label: "Unscoped legacy", value: overview.totals.unscoped_processing, color: "#94a3b8" },
            ].map(item => (
              <div key={item.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.6rem", padding: "0.9rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Recent jobs */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>
              Recent runs ({overview.recent.length})
            </div>
            {overview.recent.length === 0 ? (
              <div style={{ padding: "2rem", color: "#94a3b8", fontSize: "0.85rem", textAlign: "center" }}>No monitor runs yet.</div>
            ) : (
              <div>
                {overview.recent.map(job => (
                  <div key={job.job_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid #f8fafc" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                        {job.search_id ? (
                          <Link href={`/admin/searches/${job.search_id}`} style={{ color: "#0ea5e9", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
                            {job.search_name ?? job.search_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "0.85rem" }}>Unscoped legacy job</span>
                        )}
                        <StatusBadge status={job.status} stale={job.is_stale} />
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                        {new Date(job.created_at).toLocaleString()} · {job.plan}
                        {job.status === "completed" && <> · {job.lead_count ?? "—"} accounts · {job.hot_count ?? 0} hot</>}
                      </div>
                      <div style={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: "0.65rem", marginTop: "0.15rem" }}>{job.job_id}</div>
                    </div>
                    <div style={{ flexShrink: 0, display: "flex", gap: "0.5rem" }}>
                      {(job.status === "failed" || job.is_stale) && !job.is_unscoped && (
                        <button
                          onClick={() => handleRetry(job.job_id)}
                          disabled={retryingJob != null}
                          style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.4rem", padding: "0.35rem 0.85rem", fontWeight: 700, fontSize: "0.72rem", cursor: retryingJob != null ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: retryingJob != null ? 0.6 : 1 }}
                        >
                          {retryingJob === job.job_id ? "Retrying…" : "Retry"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
