"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadSearch = {
  id: string;
  user_id: string;
  icp_id: string | null;
  name: string;
  status: string;
  requested_lead_count: number;
  countries: string[];
  industries: string[];
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  // Process log columns (added by migration 005)
  process_started_at?: string | null;
  process_finished_at?: string | null;
  process_duration_ms?: number | null;
  process_generated_count?: number | null;
  process_duplicates_skipped?: number | null;
  process_error_message?: string | null;
  // Vault-first metrics (added by migration 015)
  vault_leads_used?:  number | null;
  apollo_leads_used?: number | null;
  vault_hit_rate?:    number | null;
};

type Profile = {
  id: string;
  email: string | null;
  plan: string;
  credits_remaining: number;
};

type Icp = {
  id: string;
  name: string;
  target_countries: string[];
  target_regions: string[];
  industries: string[];
  company_sizes: string[];
  target_job_titles: string[];
  keywords: string[];
  exclusions: string[];
  priority: string;
  notes: string | null;
};

type LeadResult = {
  id: string;
  search_id: string;
  company_name: string;
  website: string | null;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  country: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  // Quality layer (Phase 7)
  lead_score: number | null;
  confidence_score: number | null;
  seniority: string | null;
  email_quality: string | null;
  email_type: string | null;
  normalized_title: string | null;
  normalized_company: string | null;
  domain: string | null;
  // AI enrichment layer (Phase 8)
  opportunity_score: number | null;
  buyer_fit: string | null;
  temperature: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  ai_reasoning: string | null;
};

type LeadForm = {
  company_name: string;
  website: string;
  contact_name: string;
  title: string;
  email: string;
  linkedin_url: string;
  country: string;
  source: string;
  notes: string;
};

type GenerateLog = {
  success: boolean;
  requested?: number;
  apollo_returned?: number;
  total_available?: number;
  inserted?: number;
  skipped?: number;
  errors?: string[];
  duration_ms?: number;
  final_status?: string;
  error?: string;
  params_used?: {
    job_titles: string[];
    industries: string[];
    countries: string[];
    company_sizes: string[];
    keywords: string[];
  };
};

type RerunLog = {
  success: boolean;
  job_id?: string;
  search_id?: string;
  is_baseline?: boolean;
  message?: string;
  stats?: { hot_count: number; warm_count: number; total_leads: number; avg_score: number };
  error?: string;
};

type MonitorRun = {
  job_id: string;
  plan: string;
  status: "processing" | "completed" | "failed";
  created_at: string;
  lead_count: number | null;
  hot_count: number | null;
  warm_count: number | null;
  avg_score: number | null;
  has_report: boolean;
  is_baseline: boolean;
  run_index: number | null;
  change_summary: { by_type?: Record<string, number>; client_visible_count?: number } | null;
};

type RunHistory = {
  search_id: string;
  total_runs: number;
  latest_status: string | null;
  latest_completed_at: string | null;
  has_processing_run: boolean;
  runs: MonitorRun[];
};

const EMPTY_FORM: LeadForm = {
  company_name: "", website: "", contact_name: "",
  title: "", email: "", linkedin_url: "",
  country: "", source: "", notes: "",
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["pending", "processing", "completed", "failed"] as const;

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
      borderRadius: 999, padding: "0.18rem 0.65rem",
      fontSize: "0.72rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      {status}
    </span>
  );
}

function Card({
  title, children, action,
}: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1.25rem" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "1rem", paddingBottom: "0.6rem", borderBottom: "1px solid #f8fafc", marginBottom: "0.6rem" }}>
      <span style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, minWidth: 160, textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: "0.1rem" }}>
        {label}
      </span>
      <span style={{ color: "#0f172a", fontSize: "0.875rem", flex: 1 }}>
        {value ?? <span style={{ color: "#94a3b8" }}>—</span>}
      </span>
    </div>
  );
}

function ArrRow({ label, arr }: { label: string; arr: string[] }) {
  return <Row label={label} value={arr.length > 0 ? arr.join(", ") : null} />;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#cbd5e1" }}>—</span>;
  let bg: string, color: string;
  if      (score >= 90) { bg = "#dcfce7"; color = "#15803d"; }
  else if (score >= 70) { bg = "#dbeafe"; color = "#1d4ed8"; }
  else if (score >= 50) { bg = "#fef9c3"; color = "#854d0e"; }
  else                  { bg = "#f1f5f9"; color = "#64748b"; }
  return (
    <span style={{ display: "inline-block", background: bg, color, borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700, minWidth: 26, textAlign: "center" }}>
      {score}
    </span>
  );
}

function QualityPill({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const map: Record<string, { bg: string; color: string }> = {
    high:    { bg: "#dcfce7", color: "#15803d" },
    medium:  { bg: "#fef9c3", color: "#854d0e" },
    low:     { bg: "#fee2e2", color: "#dc2626" },
    missing: { bg: "#f1f5f9", color: "#94a3b8" },
  };
  const s = map[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "capitalize" }}>
      {value}
    </span>
  );
}

function TempPill({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const map: Record<string, { bg: string; color: string }> = {
    Hot:  { bg: "#fee2e2", color: "#dc2626" },
    Warm: { bg: "#fef9c3", color: "#854d0e" },
    Cold: { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = map[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
      {value}
    </span>
  );
}

function FitPill({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const map: Record<string, { bg: string; color: string }> = {
    "Excellent fit": { bg: "#dcfce7", color: "#15803d" },
    "Good fit":      { bg: "#dbeafe", color: "#1d4ed8" },
    "Weak fit":      { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = map[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

// ─── Lead modal ───────────────────────────────────────────────────────────────

function LeadModal({
  mode, initial, onSave, onClose, saving, error,
}: {
  mode: "add" | "edit";
  initial: LeadForm;
  onSave: (f: LeadForm) => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<LeadForm>(initial);

  function field(key: keyof LeadForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.65rem",
    border: "1px solid #e2e8f0", borderRadius: "0.4rem",
    fontSize: "0.85rem", fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", color: "#0f172a",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.7rem", fontWeight: 700,
    color: "#374151", textTransform: "uppercase",
    letterSpacing: "0.05em", marginBottom: "0.3rem",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: "0.75rem", width: "min(680px, 95vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>
            {mode === "add" ? "Add Lead" : "Edit Lead"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#94a3b8", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelStyle}>Company name *</label>
            <input value={form.company_name} onChange={field("company_name")} style={inputStyle} placeholder="Acme Corp" />
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input value={form.website} onChange={field("website")} style={inputStyle} placeholder="https://acme.com" />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input value={form.country} onChange={field("country")} style={inputStyle} placeholder="United States" />
          </div>
          <div>
            <label style={labelStyle}>Contact name</label>
            <input value={form.contact_name} onChange={field("contact_name")} style={inputStyle} placeholder="Jane Doe" />
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={form.title} onChange={field("title")} style={inputStyle} placeholder="VP of Sales" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input value={form.email} onChange={field("email")} style={inputStyle} placeholder="jane@acme.com" />
          </div>
          <div>
            <label style={labelStyle}>LinkedIn URL</label>
            <input value={form.linkedin_url} onChange={field("linkedin_url")} style={inputStyle} placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <label style={labelStyle}>Source</label>
            <input value={form.source} onChange={field("source")} style={inputStyle} placeholder="Apollo, manual, LinkedIn…" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelStyle}>Internal notes</label>
            <textarea value={form.notes} onChange={field("notes")} rows={2} style={{ ...inputStyle, resize: "vertical" } as React.CSSProperties} placeholder="Internal notes about this lead…" />
          </div>
        </div>

        {error && (
          <div style={{ margin: "0 1.5rem 0.75rem", padding: "0.5rem 0.75rem", background: "#fee2e2", borderRadius: "0.4rem", fontSize: "0.78rem", color: "#dc2626" }}>
            {error}
          </div>
        )}

        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={saving} style={{ background: "#f1f5f9", color: "#374151", border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.1rem", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.company_name.trim()}
            style={{
              background: saving || !form.company_name.trim() ? "#e2e8f0" : "#0f172a",
              color:      saving || !form.company_name.trim() ? "#94a3b8" : "#fff",
              border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.25rem",
              fontWeight: 700, fontSize: "0.8rem",
              cursor: saving || !form.company_name.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Saving…" : mode === "add" ? "Add lead" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Apollo log display ───────────────────────────────────────────────────────

function ApolloLogPanel({ log }: { log: GenerateLog }) {
  const isError = !log.success;

  return (
    <div style={{
      marginTop: "0.75rem",
      background: isError ? "#fff8f8" : "#f0fdf4",
      border: `1px solid ${isError ? "#fca5a5" : "#bbf7d0"}`,
      borderRadius: "0.5rem",
      padding: "0.875rem 1rem",
      fontSize: "0.8rem",
      fontFamily: "monospace",
      lineHeight: 1.7,
      color: "#1e293b",
    }}>
      {/* Top-level Apollo error (e.g. bad key, timeout) */}
      {log.error && (
        <div style={{ color: "#dc2626", fontWeight: 700, marginBottom: "0.5rem" }}>
          Error: {log.error}
        </div>
      )}

      {/* Run stats */}
      {log.requested !== undefined && (
        <>
          <div><span style={{ color: "#64748b" }}>Requested: </span>{log.requested}</div>
          <div><span style={{ color: "#64748b" }}>Apollo returned: </span>{log.apollo_returned} {log.total_available !== undefined && log.total_available > (log.apollo_returned ?? 0) && <span style={{ color: "#64748b" }}>(of {log.total_available} available)</span>}</div>
          <div><span style={{ color: "#64748b" }}>Inserted: </span><strong style={{ color: log.inserted ? "#15803d" : "#94a3b8" }}>{log.inserted}</strong></div>
          <div><span style={{ color: "#64748b" }}>Duplicates skipped: </span>{log.skipped}</div>
          <div><span style={{ color: "#64748b" }}>Duration: </span>{log.duration_ms}ms</div>
          <div><span style={{ color: "#64748b" }}>Final status: </span><strong>{log.final_status}</strong></div>
        </>
      )}

      {/* Insert errors */}
      {log.errors && log.errors.length > 0 && (
        <div style={{ marginTop: "0.5rem", color: "#dc2626" }}>
          {log.errors.map((e, i) => <div key={i}>Insert error: {e}</div>)}
        </div>
      )}

      {/* Params used */}
      {log.params_used && (
        <details style={{ marginTop: "0.75rem" }}>
          <summary style={{ cursor: "pointer", color: "#64748b", fontSize: "0.75rem" }}>Params sent to Apollo</summary>
          <div style={{ marginTop: "0.4rem", paddingLeft: "0.5rem", borderLeft: "2px solid #e2e8f0" }}>
            {log.params_used.job_titles.length > 0  && <div><span style={{ color: "#64748b" }}>Titles: </span>{log.params_used.job_titles.join(", ")}</div>}
            {log.params_used.industries.length > 0   && <div><span style={{ color: "#64748b" }}>Industries/keywords: </span>{log.params_used.industries.join(", ")}</div>}
            {log.params_used.countries.length > 0    && <div><span style={{ color: "#64748b" }}>Countries: </span>{log.params_used.countries.join(", ")}</div>}
            {log.params_used.company_sizes.length > 0 && <div><span style={{ color: "#64748b" }}>Co. sizes: </span>{log.params_used.company_sizes.join(", ")}</div>}
            {log.params_used.keywords.length > 0     && <div><span style={{ color: "#64748b" }}>Keywords: </span>{log.params_used.keywords.join(", ")}</div>}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminSearchDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [search, setSearch]   = useState<LeadSearch | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [icp, setIcp]         = useState<Icp | null>(null);
  const [leads, setLeads]     = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError]     = useState("");

  // Status
  const [statusValue, setStatusValue]   = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // Admin notes
  const [notesValue, setNotesValue]   = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMsg, setNotesMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // Lead modal
  const [modalMode, setModalMode]     = useState<"add" | "edit" | null>(null);
  const [editingLead, setEditingLead] = useState<LeadResult | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError]   = useState("");

  // Apollo generation
  const [generating, setGenerating] = useState(false);
  const [genLog, setGenLog]         = useState<GenerateLog | null>(null);

  // Monthly Monitor AI rerun
  const [rerunning, setRerunning] = useState(false);
  const [rerunLog, setRerunLog]   = useState<RerunLog | null>(null);

  // Monthly Monitor run history
  const [runHistory, setRunHistory]   = useState<RunHistory | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    const res = await adminFetch(`/api/admin/searches/${id}/results`);
    if (res.ok) {
      const d = await res.json();
      setLeads((d.results ?? []) as LeadResult[]);
    }
    setLeadsLoading(false);
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await adminFetch(`/api/admin/searches/${id}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `Error ${res.status}`);
      setLoading(false);
      return;
    }
    const d = await res.json();
    setSearch(d.search   as LeadSearch);
    setProfile(d.profile as Profile | null);
    setIcp(d.icp         as Icp | null);
    setStatusValue(d.search.status);
    setNotesValue(d.search.admin_notes ?? "");
    setLoading(false);
  }, [id]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    const res = await adminFetch(`/api/admin/searches/${id}/runs`);
    if (res.ok) {
      const d = await res.json().catch(() => null);
      if (d?.runs) setRunHistory(d as RunHistory);
    }
    setRunsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    loadLeads();
    loadRuns();
  }, [load, loadLeads, loadRuns]);

  // ─── Status ────────────────────────────────────────────────────────────────

  async function handleSaveStatus() {
    if (!search || statusValue === search.status) return;
    setSavingStatus(true);
    setStatusMsg(null);
    const res = await adminFetch(`/api/admin/searches/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: statusValue }),
    });
    setSavingStatus(false);
    if (res.ok) {
      setStatusMsg({ ok: true, text: "Status updated." });
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setStatusMsg({ ok: false, text: d.error ?? "Update failed." });
    }
  }

  // ─── Admin notes ────────────────────────────────────────────────────────────

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesMsg(null);
    const res = await adminFetch(`/api/admin/searches/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ admin_notes: notesValue.trim() || null }),
    });
    setSavingNotes(false);
    if (res.ok) {
      setNotesMsg({ ok: true, text: "Notes saved." });
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setNotesMsg({ ok: false, text: d.error ?? "Save failed." });
    }
  }

  // ─── Lead CRUD ─────────────────────────────────────────────────────────────

  function openAdd()            { setModalMode("add"); setEditingLead(null);  setModalError(""); }
  function openEdit(l: LeadResult) { setModalMode("edit"); setEditingLead(l); setModalError(""); }
  function closeModal()         { setModalMode(null);  setEditingLead(null);  setModalError(""); }

  async function handleSaveLead(form: LeadForm) {
    setModalSaving(true);
    setModalError("");

    const payload = {
      company_name: form.company_name.trim(),
      website:      form.website.trim()      || null,
      contact_name: form.contact_name.trim() || null,
      title:        form.title.trim()        || null,
      email:        form.email.trim()        || null,
      linkedin_url: form.linkedin_url.trim() || null,
      country:      form.country.trim()      || null,
      source:       form.source.trim()       || null,
      notes:        form.notes.trim()        || null,
    };

    const res = modalMode === "add"
      ? await adminFetch(`/api/admin/searches/${id}/results`, { method: "POST", body: JSON.stringify(payload) })
      : await adminFetch(`/api/admin/results/${editingLead!.id}`, { method: "PATCH", body: JSON.stringify(payload) });

    setModalSaving(false);
    if (res.ok) { closeModal(); await loadLeads(); }
    else {
      const d = await res.json().catch(() => ({}));
      setModalError(d.error ?? "Save failed.");
    }
  }

  async function handleDeleteLead(lead: LeadResult) {
    if (!confirm(`Delete "${lead.company_name}"? This cannot be undone.`)) return;
    const res = await adminFetch(`/api/admin/results/${lead.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) await loadLeads();
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Delete failed."); }
  }

  // ─── Apollo generation ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!confirm(
      "Run Apollo lead search?\n\n" +
      "• Status will be set to 'processing'\n" +
      "• Apollo API credits will be consumed\n" +
      "• Results are inserted directly into leads\n\n" +
      "Proceed?"
    )) return;

    setGenerating(true);
    setGenLog(null);

    const res = await adminFetch(`/api/admin/searches/${id}/generate`, { method: "POST" });
    const d = await res.json().catch(() => ({ success: false, error: "Invalid response from server." }));
    setGenLog(d as GenerateLog);
    setGenerating(false);

    // Reload search (status may have changed) + leads
    await Promise.all([load(), loadLeads()]);
  }

  // ─── Monthly Monitor rerun ─────────────────────────────────────────────────

  async function handleRerun() {
    if (!confirm(
      "Run AI opportunity report for this search?\n\n" +
      "• Uses AI pipeline credits (~30–60 seconds)\n" +
      "• Snapshot saved and scoped to this search series\n" +
      "• Previous snapshot comparison active if baseline exists\n\n" +
      "Proceed?"
    )) return;

    setRerunning(true);
    setRerunLog(null);

    const res = await adminFetch(`/api/admin/searches/${id}/rerun`, { method: "POST" });
    const d = await res.json().catch(() => ({ success: false, error: "Invalid response from server." }));
    setRerunLog(d as RerunLog);
    setRerunning(false);

    await loadRuns();
  }

  // ─── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return <AdminLayout><div style={{ color: "#64748b", padding: "2rem" }}>Loading search…</div></AdminLayout>;
  }

  if (error || !search) {
    return (
      <AdminLayout>
        <Link href="/admin/searches" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Back to searches</Link>
        <div style={{ marginTop: "1rem", padding: "1.25rem", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", color: "#dc2626", fontSize: "0.875rem" }}>
          {error || "Search not found."}
        </div>
      </AdminLayout>
    );
  }

  const statusChanged = statusValue !== search.status;

  const modalInitial: LeadForm = editingLead ? {
    company_name: editingLead.company_name,
    website:      editingLead.website      ?? "",
    contact_name: editingLead.contact_name ?? "",
    title:        editingLead.title        ?? "",
    email:        editingLead.email        ?? "",
    linkedin_url: editingLead.linkedin_url ?? "",
    country:      editingLead.country      ?? "",
    source:       editingLead.source       ?? "",
    notes:        editingLead.notes        ?? "",
  } : EMPTY_FORM;

  return (
    <AdminLayout>
      {modalMode && (
        <LeadModal
          mode={modalMode}
          initial={modalInitial}
          onSave={handleSaveLead}
          onClose={closeModal}
          saving={modalSaving}
          error={modalError}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/admin/searches" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Back to searches</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem" }}>
          <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            {search.name}
          </h1>
          <StatusBadge status={search.status} />
        </div>
        <div style={{ marginTop: "0.35rem", color: "#94a3b8", fontSize: "0.72rem", fontFamily: "monospace" }}>{search.id}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.25rem", alignItems: "start" }}>

        {/* ── LEFT ── */}
        <div>
          {/* Customer */}
          <Card title="Customer">
            <Row label="Email"   value={profile?.email ?? search.user_id} />
            <Row label="User ID" value={<span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#64748b" }}>{search.user_id}</span>} />
            <Row label="Plan"    value={profile ? <span style={{ textTransform: "capitalize", fontWeight: 700 }}>{profile.plan}</span> : null} />
            <Row label="Credits" value={profile?.credits_remaining ?? null} />
          </Card>

          {/* Search details */}
          <Card title="Search details">
            <Row label="Name"            value={search.name} />
            <Row label="Status"          value={<StatusBadge status={search.status} />} />
            <Row label="Requested leads" value={search.requested_lead_count} />
            <ArrRow label="Countries"    arr={search.countries} />
            <ArrRow label="Industries"   arr={search.industries} />
            <Row label="Customer notes"  value={search.notes} />
            <Row label="Requested"       value={new Date(search.created_at).toLocaleString()} />
            <Row label="Last updated"    value={new Date(search.updated_at).toLocaleString()} />
          </Card>

          {/* Linked ICP */}
          <Card title={icp ? `ICP — ${icp.name}` : "ICP"}>
            {!icp ? (
              <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                {search.icp_id ? "The linked ICP no longer exists." : "No ICP linked to this search."}
              </div>
            ) : (
              <div>
                <Row label="Name"          value={icp.name} />
                <Row label="Priority"      value={<span style={{ textTransform: "capitalize", fontWeight: 600 }}>{icp.priority}</span>} />
                <ArrRow label="Countries"  arr={icp.target_countries} />
                <ArrRow label="Regions"    arr={icp.target_regions} />
                <ArrRow label="Industries" arr={icp.industries} />
                <ArrRow label="Co. sizes"  arr={icp.company_sizes} />
                <ArrRow label="Job titles" arr={icp.target_job_titles} />
                <ArrRow label="Keywords"   arr={icp.keywords} />
                <ArrRow label="Exclusions" arr={icp.exclusions} />
                {icp.notes && <Row label="ICP notes" value={icp.notes} />}
              </div>
            )}
          </Card>

          {/* Leads table */}
          <Card
            title={`Leads (${leads.length})`}
            action={
              <button
                onClick={openAdd}
                style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.4rem", padding: "0.35rem 0.85rem", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                + Add lead
              </button>
            }
          >
            {leadsLoading ? (
              <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Loading leads…</div>
            ) : leads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 0.5rem" }}>
                <div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>📋</div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", marginBottom: "0.25rem" }}>No leads yet</div>
                <div style={{ color: "#64748b", fontSize: "0.78rem" }}>Use "Generate Leads with Apollo" or "+ Add lead" to add leads manually.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto", margin: "-1.25rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Company", "Contact", "Title", "Email", "Seniority", "Email Quality", "Opportunity", "Buyer Fit", "Temp", ""].map(h => (
                        <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, i) => (
                      <tr key={lead.id} style={{ borderBottom: i < leads.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                          {lead.normalized_company ?? lead.company_name}
                          {lead.website && (
                            <a href={lead.website} target="_blank" rel="noreferrer" style={{ marginLeft: "0.3rem", color: "#0ea5e9", fontSize: "0.7rem", textDecoration: "none" }}>↗</a>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.78rem", color: "#0f172a", whiteSpace: "nowrap" }}>
                          {lead.contact_name ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                          {lead.linkedin_url && (
                            <a href={lead.linkedin_url} target="_blank" rel="noreferrer" style={{ marginLeft: "0.3rem", color: "#0ea5e9", fontSize: "0.68rem", textDecoration: "none" }}>in</a>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {lead.normalized_title ?? lead.title ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {lead.email
                            ? <a href={`mailto:${lead.email}`} style={{ color: "#0ea5e9", textDecoration: "none" }}>{lead.email}</a>
                            : <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {lead.seniority ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                        <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                          <QualityPill value={lead.email_quality} />
                        </td>
                        <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                          <ScoreBadge score={lead.opportunity_score ?? lead.lead_score} />
                        </td>
                        <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                          <FitPill value={lead.buyer_fit} />
                        </td>
                        <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                          <TempPill value={lead.temperature} />
                        </td>
                        <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}>
                          <button onClick={() => openEdit(lead)} style={{ background: "none", border: "none", color: "#0ea5e9", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer", marginRight: "0.5rem", fontFamily: "inherit" }}>Edit</button>
                          <button onClick={() => handleDeleteLead(lead)} style={{ background: "none", border: "none", color: "#ef4444", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT ── */}
        <div>
          {/* Apollo generation */}
          <Card title="Apollo lead generation">
            <p style={{ color: "#64748b", fontSize: "0.78rem", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              Searches Apollo using this ICP's job titles, industries, company sizes, countries, and keywords. Results are inserted directly into the leads table and status is set to <strong>completed</strong>.
            </p>

            {!icp && (
              <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "0.4rem", fontSize: "0.78rem", color: "#92400e" }}>
                No ICP linked — Apollo search will use search-level countries/industries only and may return broad results.
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                width: "100%", padding: "0.65rem 1rem",
                background: generating ? "#e2e8f0" : "#6366f1",
                color: generating ? "#94a3b8" : "#fff",
                border: "none", borderRadius: "0.5rem",
                fontWeight: 700, fontSize: "0.85rem",
                cursor: generating ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {generating ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                  Searching Apollo…
                </>
              ) : (
                "⚡ Generate Leads with Apollo"
              )}
            </button>

            <p style={{ color: "#94a3b8", fontSize: "0.7rem", margin: "0.5rem 0 0", textAlign: "center" }}>
              Consumes Apollo API credits · Max 100 leads per run
            </p>

            {genLog && <ApolloLogPanel log={genLog} />}
          </Card>

          {/* Monthly Monitor — AI pipeline rerun */}
          <Card title="Monthly Monitor — AI report">
            <p style={{ color: "#64748b", fontSize: "0.78rem", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              Manual admin-controlled monitor runs for this search. Snapshots are saved per series and used for change classification on future runs.
            </p>

            {/* Series summary */}
            {runHistory && runHistory.total_runs > 0 && (
              <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#334155", lineHeight: 1.7 }}>
                <div>
                  <span style={{ color: "#64748b" }}>Latest run: </span>
                  <StatusBadge status={runHistory.latest_status ?? "—"} />
                </div>
                <div><span style={{ color: "#64748b" }}>Total runs: </span><strong>{runHistory.total_runs}</strong></div>
                <div>
                  <span style={{ color: "#64748b" }}>Last completed: </span>
                  {runHistory.latest_completed_at
                    ? new Date(runHistory.latest_completed_at).toLocaleString()
                    : <span style={{ color: "#94a3b8" }}>never</span>}
                </div>
              </div>
            )}

            {runHistory?.has_processing_run && (
              <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "0.4rem", fontSize: "0.78rem", color: "#92400e" }}>
                A run is currently processing — a new run will be rejected until it finishes.
              </div>
            )}

            <button
              onClick={handleRerun}
              disabled={rerunning}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                width: "100%", padding: "0.65rem 1rem",
                background: rerunning ? "#e2e8f0" : "#0f172a",
                color: rerunning ? "#94a3b8" : "#fff",
                border: "none", borderRadius: "0.5rem",
                fontWeight: 700, fontSize: "0.85rem",
                cursor: rerunning ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {rerunning ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                  Running AI pipeline…
                </>
              ) : (
                "Run AI Report"
              )}
            </button>

            <p style={{ color: "#94a3b8", fontSize: "0.7rem", margin: "0.5rem 0 0", textAlign: "center" }}>
              Uses AI credits · ~30–60 seconds
            </p>

            {rerunLog && (
              <div style={{
                marginTop: "0.75rem",
                background: rerunLog.success ? "#f0fdf4" : "#fff8f8",
                border: `1px solid ${rerunLog.success ? "#bbf7d0" : "#fca5a5"}`,
                borderRadius: "0.5rem",
                padding: "0.875rem 1rem",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                lineHeight: 1.7,
                color: "#1e293b",
              }}>
                {rerunLog.error && (
                  <div style={{ color: "#dc2626", fontWeight: 700, marginBottom: "0.5rem" }}>
                    Error: {rerunLog.error}
                  </div>
                )}
                {rerunLog.success && (
                  <>
                    <div>
                      <span style={{ color: "#64748b" }}>Status: </span>
                      <strong style={{ color: "#15803d" }}>Complete</strong>
                      {rerunLog.is_baseline && (
                        <span style={{ marginLeft: "0.5rem", background: "#e0e7ff", color: "#4338ca", borderRadius: 999, padding: "0.1rem 0.45rem", fontSize: "0.68rem", fontWeight: 700 }}>
                          BASELINE
                        </span>
                      )}
                    </div>
                    {rerunLog.message && (
                      <div style={{ marginTop: "0.25rem", color: "#374151", fontFamily: "inherit", fontSize: "0.78rem" }}>
                        {rerunLog.message}
                      </div>
                    )}
                    {rerunLog.stats && (
                      <>
                        <div style={{ marginTop: "0.5rem" }}>
                          <span style={{ color: "#64748b" }}>Hot: </span>
                          <strong style={{ color: "#dc2626" }}>{rerunLog.stats.hot_count}</strong>
                          <span style={{ color: "#64748b", marginLeft: "0.75rem" }}>Warm: </span>
                          <strong style={{ color: "#854d0e" }}>{rerunLog.stats.warm_count}</strong>
                          <span style={{ color: "#64748b", marginLeft: "0.75rem" }}>Total: </span>
                          {rerunLog.stats.total_leads}
                        </div>
                        <div>
                          <span style={{ color: "#64748b" }}>Avg score: </span>
                          {rerunLog.stats.avg_score}
                        </div>
                      </>
                    )}
                    {rerunLog.job_id && (
                      <div style={{ marginTop: "0.25rem", color: "#94a3b8", fontSize: "0.72rem" }}>
                        job_id: {rerunLog.job_id}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Run history */}
            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                Run history
              </div>
              {runsLoading ? (
                <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Loading runs…</div>
              ) : !runHistory || runHistory.runs.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>No monitor runs yet. The first run establishes the baseline.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {runHistory.runs.map(run => {
                    const visibleChanges = run.change_summary?.client_visible_count ?? null;
                    return (
                      <div key={run.job_id} style={{ border: "1px solid #f1f5f9", borderRadius: "0.5rem", padding: "0.6rem 0.75rem", fontSize: "0.75rem", color: "#334155" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                          <span style={{ fontWeight: 600 }}>{new Date(run.created_at).toLocaleString()}</span>
                          <span style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                            {run.is_baseline && (
                              <span style={{ background: "#e0e7ff", color: "#4338ca", borderRadius: 999, padding: "0.1rem 0.45rem", fontSize: "0.65rem", fontWeight: 700 }}>
                                BASELINE
                              </span>
                            )}
                            {!run.is_baseline && run.status === "completed" && (
                              <span style={{ background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "0.1rem 0.45rem", fontSize: "0.65rem", fontWeight: 700 }}>
                                COMPARED
                              </span>
                            )}
                            <StatusBadge status={run.status} />
                          </span>
                        </div>
                        {run.status === "completed" ? (
                          <div style={{ color: "#64748b", lineHeight: 1.6 }}>
                            {run.lead_count ?? "—"} leads · <span style={{ color: "#dc2626", fontWeight: 600 }}>{run.hot_count ?? 0} hot</span> · <span style={{ color: "#854d0e", fontWeight: 600 }}>{run.warm_count ?? 0} warm</span> · avg {run.avg_score ?? "—"}
                            {visibleChanges != null && (
                              <> · {visibleChanges} visible change{visibleChanges === 1 ? "" : "s"}</>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: "#94a3b8" }}>
                            {run.status === "processing" ? "Run in progress…" : "Run failed — no report produced."}
                          </div>
                        )}
                        <div style={{ marginTop: "0.2rem", color: "#cbd5e1", fontFamily: "monospace", fontSize: "0.65rem" }}>{run.job_id}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Status */}
          <Card title="Update status">
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Status</label>
              <select
                value={statusValue}
                onChange={e => { setStatusValue(e.target.value); setStatusMsg(null); }}
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit", outline: "none" }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {statusMsg && (
              <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: statusMsg.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.4rem", fontSize: "0.78rem", color: statusMsg.ok ? "#15803d" : "#dc2626" }}>
                {statusMsg.text}
              </div>
            )}
            <button
              onClick={handleSaveStatus}
              disabled={savingStatus || !statusChanged}
              style={{
                background: savingStatus || !statusChanged ? "#e2e8f0" : "#0f172a",
                color:      savingStatus || !statusChanged ? "#94a3b8" : "#fff",
                border: "none", borderRadius: "0.5rem", padding: "0.6rem 1rem",
                fontWeight: 700, fontSize: "0.8rem",
                cursor: savingStatus || !statusChanged ? "not-allowed" : "pointer",
                fontFamily: "inherit", width: "100%",
              }}
            >
              {savingStatus ? "Saving…" : statusChanged ? `Set to "${statusValue}"` : "No change"}
            </button>
          </Card>

          {/* Admin notes */}
          <Card title="Admin notes">
            <p style={{ color: "#64748b", fontSize: "0.78rem", margin: "0 0 0.75rem" }}>
              Internal only. Customers can read but not write this field.
            </p>
            <textarea
              value={notesValue}
              onChange={e => { setNotesValue(e.target.value); setNotesMsg(null); }}
              rows={5}
              placeholder="Add internal notes about this search…"
              style={{ display: "block", width: "100%", padding: "0.65rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.85rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", marginBottom: "0.75rem", color: "#0f172a" } as React.CSSProperties}
            />
            {notesMsg && (
              <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: notesMsg.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.4rem", fontSize: "0.78rem", color: notesMsg.ok ? "#15803d" : "#dc2626" }}>
                {notesMsg.text}
              </div>
            )}
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              style={{ background: savingNotes ? "#7dd3fc" : "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.8rem", cursor: savingNotes ? "not-allowed" : "pointer", fontFamily: "inherit", width: "100%" }}
            >
              {savingNotes ? "Saving…" : "Save notes"}
            </button>
          </Card>

          {/* Delivery summary */}
          <Card title="Delivery summary">
            <Row label="Requested" value={search.requested_lead_count} />
            <Row label="Delivered" value={
              <span style={{ fontWeight: 700, color: leads.length >= search.requested_lead_count ? "#15803d" : "#0f172a" }}>
                {leads.length}
              </span>
            } />
            <Row label="Remaining" value={
              <span style={{ color: "#64748b" }}>
                {Math.max(0, search.requested_lead_count - leads.length)}
              </span>
            } />
          </Card>

          {/* Vault reuse */}
          {(search.vault_leads_used != null || search.apollo_leads_used != null) && (
            <Card title="Vault reuse">
              <Row label="Requested"      value={search.requested_lead_count} />
              <Row label="Vault leads"    value={
                <span style={{ fontWeight: 700, color: (search.vault_leads_used ?? 0) > 0 ? "#15803d" : "#64748b" }}>
                  {search.vault_leads_used ?? 0}
                </span>
              } />
              <Row label="Apollo leads"   value={
                <span style={{ fontWeight: 600, color: "#1d4ed8" }}>
                  {search.apollo_leads_used ?? 0}
                </span>
              } />
              <Row label="Vault hit rate" value={
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {(() => {
                    const pct = Math.round((search.vault_hit_rate ?? 0) * 100);
                    const color = pct >= 60 ? "#15803d" : pct >= 30 ? "#854d0e" : "#64748b";
                    return (
                      <>
                        <div style={{ width: 80, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color }}>{pct}%</span>
                      </>
                    );
                  })()}
                </div>
              } />
            </Card>
          )}

          {/* AI enrichment summary */}
          {leads.some(l => l.temperature != null) && (() => {
            const enriched = leads.filter(l => l.temperature != null);
            const hotCount  = enriched.filter(l => l.temperature === "Hot").length;
            const warmCount = enriched.filter(l => l.temperature === "Warm").length;
            const coldCount = enriched.filter(l => l.temperature === "Cold").length;
            const withOpp   = enriched.filter(l => l.opportunity_score != null);
            const avgOpp    = withOpp.length > 0
              ? Math.round(withOpp.reduce((s, l) => s + (l.opportunity_score ?? 0), 0) / withOpp.length)
              : null;
            const topOpp    = withOpp.length > 0
              ? Math.max(...withOpp.map(l => l.opportunity_score ?? 0))
              : null;
            return (
              <Card title="AI enrichment summary">
                <Row label="Hot leads"  value={<span style={{ fontWeight: 700, color: "#dc2626" }}>{hotCount}</span>} />
                <Row label="Warm leads" value={<span style={{ fontWeight: 700, color: "#854d0e" }}>{warmCount}</span>} />
                <Row label="Cold leads" value={<span style={{ color: "#64748b" }}>{coldCount}</span>} />
                <Row label="Avg opportunity" value={avgOpp != null ? <ScoreBadge score={avgOpp} /> : null} />
                <Row label="Top opportunity" value={topOpp != null ? <ScoreBadge score={topOpp} /> : null} />
              </Card>
            );
          })()}

          {/* Quality summary */}
          {leads.some(l => l.lead_score != null) && (() => {
            const scored   = leads.filter(l => l.lead_score != null);
            const avgScore = Math.round(scored.reduce((s, l) => s + (l.lead_score ?? 0), 0) / scored.length);
            const maxScore = Math.max(...scored.map(l => l.lead_score ?? 0));
            const corpCount    = leads.filter(l => l.email_type === "corporate").length;
            const genericCount = leads.filter(l => l.email_type === "generic").length;
            return (
              <Card title="Quality summary">
                <Row label="Avg score"        value={<ScoreBadge score={avgScore} />} />
                <Row label="Highest score"    value={<ScoreBadge score={maxScore} />} />
                <Row label="Corporate emails" value={<span style={{ fontWeight: 700, color: "#15803d" }}>{corpCount}</span>} />
                <Row label="Generic emails"   value={<span style={{ color: "#64748b" }}>{genericCount}</span>} />
                <Row label="Scored leads"     value={`${scored.length} of ${leads.length}`} />
              </Card>
            );
          })()}

          {/* Auto-process log */}
          {(search.process_started_at || search.process_error_message) && (
            <Card title="Auto-process log">
              {search.process_started_at && (
                <Row label="Started"   value={new Date(search.process_started_at).toLocaleString()} />
              )}
              {search.process_finished_at && (
                <Row label="Finished"  value={new Date(search.process_finished_at).toLocaleString()} />
              )}
              {search.process_duration_ms != null && (
                <Row label="Duration"  value={`${search.process_duration_ms} ms`} />
              )}
              {search.process_generated_count != null && (
                <Row label="Generated" value={search.process_generated_count} />
              )}
              {search.process_duplicates_skipped != null && (
                <Row label="Skipped"   value={search.process_duplicates_skipped} />
              )}
              {search.process_error_message && (
                <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.75rem", background: "#fee2e2", borderRadius: "0.4rem", fontSize: "0.78rem", color: "#dc2626", fontFamily: "monospace", lineHeight: 1.5 }}>
                  {search.process_error_message}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
