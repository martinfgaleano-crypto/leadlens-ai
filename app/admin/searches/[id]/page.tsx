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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1.25rem" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{title}</span>
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSearchDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [search, setSearch]         = useState<LeadSearch | null>(null);
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [icp, setIcp]               = useState<Icp | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  // Status update state
  const [statusValue, setStatusValue]   = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // Admin notes state
  const [notesValue, setNotesValue]     = useState("");
  const [savingNotes, setSavingNotes]   = useState(false);
  const [notesMsg, setNotesMsg]         = useState<{ ok: boolean; text: string } | null>(null);

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
    setIcp(d.icp         as Icp     | null);
    setStatusValue(d.search.status);
    setNotesValue(d.search.admin_notes ?? "");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ─── Save status ────────────────────────────────────────────────────────────

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

  // ─── Save admin notes ────────────────────────────────────────────────────────

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

  // ─── Render states ───────────────────────────────────────────────────────────

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

  return (
    <AdminLayout>
      {/* Back link + header */}
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

        {/* ── LEFT COLUMN ── */}
        <div>

          {/* Customer */}
          <Card title="Customer">
            <Row label="Email"    value={profile?.email ?? search.user_id} />
            <Row label="User ID"  value={<span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#64748b" }}>{search.user_id}</span>} />
            <Row label="Plan"     value={profile ? <span style={{ textTransform: "capitalize", fontWeight: 700 }}>{profile.plan}</span> : null} />
            <Row label="Credits"  value={profile?.credits_remaining ?? null} />
          </Card>

          {/* Search details */}
          <Card title="Search details">
            <Row label="Name"           value={search.name} />
            <Row label="Status"         value={<StatusBadge status={search.status} />} />
            <Row label="Requested leads" value={search.requested_lead_count} />
            <ArrRow label="Countries"   arr={search.countries} />
            <ArrRow label="Industries"  arr={search.industries} />
            <Row label="Customer notes" value={search.notes} />
            <Row label="Requested"      value={new Date(search.created_at).toLocaleString()} />
            <Row label="Last updated"   value={new Date(search.updated_at).toLocaleString()} />
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
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div>

          {/* Update status */}
          <Card title="Update status">
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
                Status
              </label>
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
                border: "none", borderRadius: "0.5rem",
                padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.8rem",
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
              rows={6}
              placeholder="Add internal notes about this search, issues found, delivery plan…"
              style={{
                display: "block", width: "100%", padding: "0.65rem 0.75rem",
                border: "1px solid #e2e8f0", borderRadius: "0.5rem",
                fontSize: "0.85rem", fontFamily: "inherit",
                resize: "vertical", boxSizing: "border-box", outline: "none",
                marginBottom: "0.75rem", color: "#0f172a",
              } as React.CSSProperties}
            />

            {notesMsg && (
              <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: notesMsg.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.4rem", fontSize: "0.78rem", color: notesMsg.ok ? "#15803d" : "#dc2626" }}>
                {notesMsg.text}
              </div>
            )}

            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              style={{
                background: savingNotes ? "#7dd3fc" : "#0ea5e9",
                color: "#fff", border: "none", borderRadius: "0.5rem",
                padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.8rem",
                cursor: savingNotes ? "not-allowed" : "pointer",
                fontFamily: "inherit", width: "100%",
              }}
            >
              {savingNotes ? "Saving…" : "Save notes"}
            </button>
          </Card>

          {/* Lead results placeholder */}
          <Card title="Lead results">
            <div style={{ textAlign: "center", padding: "1rem 0.5rem" }}>
              {search.status === "completed" ? (
                <>
                  <div style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a", marginBottom: "0.25rem" }}>Search completed</div>
                  <div style={{ color: "#64748b", fontSize: "0.78rem" }}>Lead delivery UI coming in Phase 4.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>⏳</div>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a", marginBottom: "0.25rem" }}>
                    {search.status === "processing" ? "Processing" : search.status === "failed" ? "Failed" : "Pending"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.78rem" }}>
                    {search.status === "failed"
                      ? "Mark resolved in status above and add notes."
                      : `Set status to "processing" to start, then "completed" when done.`}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
