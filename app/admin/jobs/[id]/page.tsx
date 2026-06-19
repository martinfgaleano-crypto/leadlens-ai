"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

type Job    = { id: string; order_id: string; plan: string; status: string; progress: number; error_message: string | null; admin_approved: boolean; report_id: string | null; started_at: string | null; completed_at: string | null; delivered_at: string | null; created_at: string };
type Event  = { id: string; event_type: string; message: string | null; created_at: string };
type Report = { id: string; created_at: string };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: "#fef3c7", color: "#92400e" }, awaiting_intake: { bg: "#fef3c7", color: "#92400e" },
    intake_received: { bg: "#dbeafe", color: "#1d4ed8" }, queued: { bg: "#dbeafe", color: "#1d4ed8" },
    processing: { bg: "#e0e7ff", color: "#4338ca" },
    completed: { bg: "#dcfce7", color: "#15803d" }, delivered: { bg: "#dcfce7", color: "#15803d" },
    error: { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.2rem 0.6rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{status.replace(/_/g, " ")}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "1rem", paddingBottom: "0.6rem", borderBottom: "1px solid #f8fafc", marginBottom: "0.6rem" }}>
      <span style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, minWidth: 130, textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: "0.1rem" }}>{label}</span>
      <span style={{ color: "#0f172a", fontSize: "0.875rem", flex: 1 }}>{value ?? "—"}</span>
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData]         = useState<{ job: Job; events: Event[]; reportMeta: Report | null } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [saving, setSaving]     = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [runResult, setRunResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirm, setConfirm]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`/api/admin/jobs/${id}`);
    if (!res.ok) { setError(`Error ${res.status}`); setLoading(false); return; }
    const d = await res.json();
    setData(d);
    setStatusUpdate(d.job.status);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addNote() {
    if (!noteText.trim() || !data) return;
    setAddingNote(true);
    await adminFetch("/api/admin/notes", {
      method: "POST",
      body: JSON.stringify({ job_id: data.job.id, order_id: data.job.order_id, note: noteText.trim() }),
    });
    setNoteText("");
    setAddingNote(false);
    load();
  }

  async function saveStatus() {
    setSaving(true);
    await adminFetch(`/api/admin/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: statusUpdate }),
    });
    setSaving(false);
    load();
  }

  async function runPipeline() {
    setConfirm(false);
    setRunLoading(true);
    setRunResult(null);
    const res = await adminFetch(`/api/admin/jobs/${id}/run`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setRunLoading(false);
    setRunResult(res.ok
      ? { ok: true, msg: `Done. ${d.total_leads ?? 0} leads generated.` }
      : { ok: false, msg: d.error ?? "Pipeline failed." });
    load();
  }

  if (loading) return <AdminLayout><div style={{ color: "#64748b", padding: "2rem" }}>Loading job...</div></AdminLayout>;
  if (error)   return <AdminLayout><div style={{ color: "#dc2626", padding: "2rem" }}>{error}</div></AdminLayout>;
  if (!data)   return null;

  const { job, events, reportMeta } = data;
  const canRun = !["processing", "completed", "delivered"].includes(job.status);
  const hasReport = !!reportMeta;

  return (
    <AdminLayout>
      {/* Confirm modal */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: "0.875rem", padding: "2rem", maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <h3 style={{ margin: "0 0 0.75rem", color: "#0f172a", fontSize: "1.1rem", fontWeight: 800 }}>Run pipeline?</h3>
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
              This will consume Anthropic API credits and run the full 8-agent pipeline for job <code style={{ fontFamily: "monospace", color: "#0f172a" }}>{job.id.slice(0, 10)}…</code>.<br /><br />
              Make sure intake data is complete before proceeding.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(false)} style={{ padding: "0.6rem 1.25rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff", color: "#64748b", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Cancel</button>
              <button onClick={runPipeline} style={{ padding: "0.6rem 1.25rem", border: "none", borderRadius: "0.5rem", background: "#0ea5e9", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Run pipeline</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/admin/jobs" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Back to jobs</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem" }}>
          <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Job detail</h1>
          <StatusBadge status={job.status} />
          <span style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{job.id.slice(0, 14)}…</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* LEFT */}
        <div>
          {/* Summary */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Job summary</div>
            <div style={{ padding: "1.25rem" }}>
              <Row label="Job ID"     value={<code style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{job.id}</code>} />
              <Row label="Order"      value={<Link href={`/admin/orders/${job.order_id}`} style={{ color: "#0ea5e9" }}>View order →</Link>} />
              <Row label="Plan"       value={<span style={{ textTransform: "capitalize", fontWeight: 700 }}>{job.plan}</span>} />
              <Row label="Status"     value={<StatusBadge status={job.status} />} />
              <Row label="Progress"   value={
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ background: "#f1f5f9", borderRadius: 999, height: 8, width: 100, overflow: "hidden" }}>
                    <div style={{ background: job.progress === 100 ? "#16a34a" : "#0ea5e9", width: `${job.progress}%`, height: "100%", borderRadius: 999 }} />
                  </div>
                  <span>{job.progress}%</span>
                </div>
              } />
              <Row label="Approved"   value={job.admin_approved ? "Yes" : "No"} />
              <Row label="Report"     value={hasReport ? <span style={{ color: "#16a34a", fontWeight: 600 }}>Ready</span> : "Not generated"} />
              <Row label="Created"    value={new Date(job.created_at).toLocaleString()} />
              <Row label="Started"    value={job.started_at ? new Date(job.started_at).toLocaleString() : null} />
              <Row label="Completed"  value={job.completed_at ? new Date(job.completed_at).toLocaleString() : null} />
              <Row label="Delivered"  value={job.delivered_at ? new Date(job.delivered_at).toLocaleString() : null} />
              {job.error_message && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.4rem", padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "#dc2626", marginTop: "0.25rem" }}>
                  {job.error_message}
                </div>
              )}
            </div>
          </div>

          {/* Events */}
          {events.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Event log ({events.length})</div>
              <div style={{ padding: "1.25rem", maxHeight: 380, overflowY: "auto" as const }}>
                {events.map((ev, i) => (
                  <div key={ev.id} style={{ display: "flex", gap: "0.75rem", marginBottom: i < events.length - 1 ? "0.875rem" : 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0, marginTop: "0.35rem" }} />
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0f172a" }}>{ev.event_type.replace(/_/g, " ")}</div>
                      {ev.message && <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.1rem", lineHeight: 1.4 }}>{ev.message}</div>}
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.1rem" }}>{new Date(ev.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div>
          {/* Pipeline action */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Pipeline</div>
            <div style={{ padding: "1.25rem" }}>
              {!canRun && !runLoading && (
                <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                  {job.status === "processing" ? "Pipeline is currently running." : "Pipeline already completed for this job."}
                </div>
              )}
              <button onClick={() => canRun && !runLoading && setConfirm(true)} disabled={!canRun || runLoading}
                style={{ background: canRun && !runLoading ? "#0ea5e9" : "#e2e8f0", color: canRun && !runLoading ? "#fff" : "#94a3b8", border: "none", borderRadius: "0.5rem", padding: "0.7rem 1.25rem", fontWeight: 700, fontSize: "0.875rem", cursor: canRun && !runLoading ? "pointer" : "not-allowed", fontFamily: "inherit", width: "100%" }}>
                {runLoading ? "Running pipeline..." : "Run pipeline"}
              </button>
              {runResult && (
                <div style={{ marginTop: "0.75rem", padding: "0.7rem", background: runResult.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.5rem", fontSize: "0.8rem", color: runResult.ok ? "#15803d" : "#dc2626" }}>
                  {runResult.msg}
                </div>
              )}
            </div>
          </div>

          {/* Report downloads */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Report</div>
            <div style={{ padding: "1.25rem" }}>
              {!hasReport
                ? <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No report yet. Run the pipeline first.</div>
                : (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
                    <div style={{ color: "#15803d", fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.25rem" }}>Report ready · {new Date(reportMeta!.created_at).toLocaleString()}</div>
                    {[["json", "Download JSON"], ["csv", "Download CSV"], ["md", "Download Markdown"]].map(([fmt, label]) => (
                      <a key={fmt} href={`/api/admin/report/${job.id}?format=${fmt}`} target="_blank" rel="noopener"
                        style={{ display: "block", padding: "0.6rem 1rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.5rem", color: "#0284c7", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none", textAlign: "center" as const }}>
                        {label}
                      </a>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Status update */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Update status</div>
            <div style={{ padding: "1.25rem" }}>
              <select value={statusUpdate} onChange={e => setStatusUpdate(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit", marginBottom: "0.75rem" }}>
                {["pending", "awaiting_intake", "intake_received", "queued", "processing", "completed", "error", "delivered"].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
              <button onClick={saveStatus} disabled={saving}
                style={{ background: saving ? "#7dd3fc" : "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.8rem", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", width: "100%" }}>
                {saving ? "Saving..." : "Save status"}
              </button>
            </div>
          </div>

          {/* Add note */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Add note</div>
            <div style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add internal note..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }}
                  style={{ flex: 1, padding: "0.55rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.8rem", fontFamily: "inherit", outline: "none" }} />
                <button onClick={addNote} disabled={addingNote || !noteText.trim()}
                  style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem 0.875rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
