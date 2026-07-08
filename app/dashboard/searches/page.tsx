"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/app/dashboard/_components/DashboardShell";
import { getSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Icp {
  id: string;
  name: string;
}

interface LeadSearch {
  id: string;
  name: string;
  status: string;
  requested_lead_count: number;
  countries: string[];
  industries: string[];
  notes: string | null;
  icp_id: string | null;
  created_at: string;
}

interface SearchForm {
  name: string;
  icp_id: string;
  requested_lead_count: string;
  countries: string;
  industries: string;
  notes: string;
}

interface MonitorOverviewRow {
  search_id: string;
  name: string;
  search_status: string;
  total_runs: number;
  latest_run_status: string | null;
  latest_completed_at: string | null;
  latest_report_job_id: string | null;
  has_processing_run: boolean;
  has_onboarding_link?: boolean;
  is_baseline_only: boolean;
  has_comparison: boolean;
}

const EMPTY_FORM: SearchForm = {
  name: "",
  icp_id: "",
  requested_lead_count: "25",
  countries: "",
  industries: "",
  notes: "",
};

const POLL_INTERVAL_MS = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toArr(s: string): string[] {
  return s.split(",").map(v => v.trim()).filter(Boolean);
}

// Customer-facing status labels and styles
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:    { label: "Queued",            bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  processing: { label: "Analyzing accounts…", bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  completed:  { label: "Completed",         bg: "#dcfce7", color: "#14532d", border: "#86efac" },
  failed:     { label: "Failed",            bg: "#fee2e2", color: "#7f1d1d", border: "#fca5a5" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      borderRadius: "99px", padding: "0.15rem 0.65rem",
      fontSize: "0.68rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    } as React.CSSProperties}>
      {status === "processing" && (
        <span style={{ display: "inline-block", animation: "spin 1.2s linear infinite", fontSize: "0.65rem" }}>⟳</span>
      )}
      {cfg.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchesPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId]       = useState("");
  const [icps, setIcps]           = useState<Icp[]>([]);
  const [searches, setSearches]   = useState<LeadSearch[]>([]);
  const [monitorMap, setMonitorMap] = useState<Map<string, MonitorOverviewRow>>(new Map());
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [formOpen, setFormOpen]   = useState(false);
  const [form, setForm]           = useState<SearchForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  // Track whether any search is actively being processed
  const hasActiveSearches = searches.some(
    s => s.status === "pending" || s.status === "processing"
  );
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async (uid: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const [icpRes, searchRes] = await Promise.all([
      supabase.from("icps").select("id, name").eq("user_id", uid).order("name"),
      supabase.from("lead_searches").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);

    if (!icpRes.error)    setIcps((icpRes.data ?? []) as Icp[]);
    if (!searchRes.error) setSearches((searchRes.data ?? []) as LeadSearch[]);

    // Monitor overview — best-effort; list still works without it
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch("/api/monitor/overview", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (d?.monitors) {
            setMonitorMap(new Map(
              (d.monitors as MonitorOverviewRow[]).map(m => [m.search_id, m]),
            ));
          }
        }
      }
    } catch { /* best-effort */ }
  }, []);

  // ─── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) { setError("Supabase is not configured."); setLoading(false); }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const uid   = session.user.id;
      const email = session.user.email ?? "";
      if (!cancelled) { setUserId(uid); setUserEmail(email); }
      await loadData(uid);
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-refresh: poll every 15 s while any search is active ───────────────

  useEffect(() => {
    if (!hasActiveSearches || !userId) return;

    const interval = setInterval(() => {
      const uid = userIdRef.current;
      if (uid) loadData(uid);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hasActiveSearches, userId, loadData]);

  // ─── Logout ─────────────────────────────────────────────────────────────────

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  // ─── Form ───────────────────────────────────────────────────────────────────

  function openForm() {
    setForm({ ...EMPTY_FORM, icp_id: icps[0]?.id ?? "" });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() { setFormOpen(false); setFormError(""); }

  function setField(k: keyof SearchForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Search name is required."); return; }
    if (!form.icp_id)      { setFormError("Please select an ICP."); return; }

    const leadCount = parseInt(form.requested_lead_count, 10);
    if (isNaN(leadCount) || leadCount < 1 || leadCount > 500) {
      setFormError("Account count must be between 1 and 500.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setSaving(true);
    setFormError("");

    // Insert and get back the id so we can trigger processing
    const { data: inserted, error: insertErr } = await supabase
      .from("lead_searches")
      .insert({
        user_id:              userId,
        icp_id:               form.icp_id || null,
        name:                 form.name.trim(),
        status:               "pending",
        requested_lead_count: leadCount,
        countries:            toArr(form.countries),
        industries:           toArr(form.industries),
        notes:                form.notes.trim() || null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      setFormError(insertErr?.message ?? "Failed to create search.");
      setSaving(false);
      return;
    }

    // Fire processing — do NOT await. UI returns immediately; server runs async.
    fetch(`/api/process/search/${inserted.id}`, { method: "POST" }).catch(() => {});

    await loadData(userId);
    setSaving(false);
    closeForm();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardShell email="" onLogout={handleLogout}>
        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading…</div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell email={userEmail} onLogout={handleLogout}>
        <div style={S.errorBox}>{error}</div>
      </DashboardShell>
    );
  }

  const hasIcps = icps.length > 0;

  return (
    <DashboardShell email={userEmail} onLogout={handleLogout}>
      {/* Spin keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={S.pageTitle}>Account Searches</h1>
          <p style={S.pageSub}>
            {hasActiveSearches
              ? "Accounts are being analyzed automatically — this page refreshes every 15 seconds."
              : "Submit a search request. Account opportunities are generated automatically."}
          </p>
        </div>
        {hasIcps && !formOpen && (
          <button onClick={openForm} style={S.btnPrimary}>+ New Search</button>
        )}
      </div>

      {/* No ICP CTA */}
      {!hasIcps && (
        <div style={{ ...S.section, marginBottom: "1.5rem" }}>
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>🎯</div>
            <div style={S.emptyTitle}>Create an ICP first</div>
            <div style={S.emptySub}>
              You need at least one Ideal Customer Profile before you can request an account search.
            </div>
            <Link href="/dashboard/icp" style={S.linkBtn}>Go to ICP Builder →</Link>
          </div>
        </div>
      )}

      {/* New search form */}
      {formOpen && (
        <div style={S.formCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2 style={S.formTitle}>New Account Search</h2>
            <button onClick={closeForm} style={S.btnGhost}>Cancel</button>
          </div>

          <div style={{ marginBottom: "1rem", padding: "0.6rem 0.85rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#075985", lineHeight: 1.5 }}>
            Searches created here run account discovery right away. Monitor
            reports (monthly opportunity intelligence with change tracking)
            require the full onboarding setup — if you want this search as a
            monitor, complete onboarding or contact us after creating it.
          </div>

          <form onSubmit={handleSubmit}>
            <div style={S.formGrid}>
              <div>
                <label style={S.labelBlock}>
                  <span style={S.labelText}>Search Name *</span>
                  <input style={S.input} value={form.name}
                    onChange={e => setField("name", e.target.value)}
                    placeholder="e.g. US SaaS CTOs — June 2026" required />
                </label>
              </div>

              <div>
                <label style={S.labelBlock}>
                  <span style={S.labelText}>ICP *</span>
                  <select style={S.input} value={form.icp_id} onChange={e => setField("icp_id", e.target.value)} required>
                    <option value="">Select an ICP…</option>
                    {icps.map(icp => (
                      <option key={icp.id} value={icp.id}>{icp.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label style={S.labelBlock}>
                  <span style={S.labelText}>Requested Account Count</span>
                  <input style={S.input} type="number" min={1} max={500}
                    value={form.requested_lead_count}
                    onChange={e => setField("requested_lead_count", e.target.value)} />
                </label>
              </div>

              <div>
                <label style={S.labelBlock}>
                  <span style={S.labelText}>Countries Override <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.7rem" }}>(optional — overrides ICP)</span></span>
                  <input style={S.input} value={form.countries}
                    onChange={e => setField("countries", e.target.value)}
                    placeholder="United States, Canada" />
                </label>
              </div>

              <div>
                <label style={S.labelBlock}>
                  <span style={S.labelText}>Industries Override <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.7rem" }}>(optional)</span></span>
                  <input style={S.input} value={form.industries}
                    onChange={e => setField("industries", e.target.value)}
                    placeholder="SaaS, FinTech" />
                </label>
              </div>

              <div>
                <label style={S.labelBlock}>
                  <span style={S.labelText}>Notes <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.7rem" }}>(optional)</span></span>
                  <textarea style={{ ...S.input, resize: "vertical", minHeight: "3.5rem" }}
                    value={form.notes} onChange={e => setField("notes", e.target.value)}
                    placeholder="Anything special about this search batch…" />
                </label>
              </div>
            </div>

            {formError && <div style={{ ...S.errorBox, marginBottom: "1rem" }}>{formError}</div>}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={closeForm} style={S.btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} style={saving ? S.btnDisabled : S.btnPrimary}>
                {saving ? "Submitting…" : "Submit Search Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Searches list */}
      {hasIcps && (
        searches.length === 0 ? (
          <div style={S.section}>
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>📡</div>
              <div style={S.emptyTitle}>No monitors yet</div>
              <div style={S.emptySub}>
                A monitor tracks one target market for you: it finds the companies worth
                contacting, explains why they fit, and shows what changed each time it runs.
                Create your first search to get started — your first report becomes the
                baseline, and every run after that highlights what&apos;s new.
              </div>
              <button onClick={openForm} style={S.linkBtn as React.CSSProperties}>+ Create your first search</button>
            </div>
          </div>
        ) : (
          <div style={S.section}>
            <div style={S.tableHeader}>
              <span style={{ ...S.col, flex: 3 }}>Search</span>
              <span style={{ ...S.col, flex: 1 }}>Accounts</span>
              <span style={{ ...S.col, flex: 1.5 }}>Status</span>
              <span style={{ ...S.col, flex: 2 }}>Monitor</span>
              <span style={{ ...S.col, flex: 1.5 }}>Requested</span>
              <span style={{ ...S.col, flex: 1 }}></span>
            </div>
            {searches.map(s => (
              <div key={s.id} style={S.tableRow}>
                <span style={{ ...S.col, flex: 3, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
                <span style={{ ...S.col, flex: 1, color: "#64748b" }}>{s.requested_lead_count}</span>
                <span style={{ ...S.col, flex: 1.5 }}><StatusBadge status={s.status} /></span>
                <span style={{ ...S.col, flex: 2 }}>
                  {(() => {
                    const m = monitorMap.get(s.id);
                    if (m && m.has_onboarding_link === false) {
                      return <span style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 600 }}>Setup incomplete</span>;
                    }
                    if (!m || m.total_runs === 0) {
                      return <span style={{ color: "#cbd5e1", fontSize: "0.75rem" }}>No runs yet</span>;
                    }
                    if (m.has_processing_run) {
                      return <span style={{ color: "#075985", fontSize: "0.75rem", fontWeight: 600 }}>⟳ Run in progress</span>;
                    }
                    if (m.latest_report_job_id) {
                      return (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          <Link href={`/results/${m.latest_report_job_id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.75rem", textDecoration: "none" }}>
                            Latest report →
                          </Link>
                          <span style={{
                            background: m.has_comparison ? "#f0fdf4" : "#e0e7ff",
                            color: m.has_comparison ? "#15803d" : "#4338ca",
                            borderRadius: 999, padding: "0.1rem 0.45rem",
                            fontSize: "0.62rem", fontWeight: 700,
                          }}>
                            {m.has_comparison ? "COMPARED" : "BASELINE"}
                          </span>
                        </span>
                      );
                    }
                    if (m.latest_run_status === "failed") {
                      // Customer-safe copy — internal QA language stays internal
                      return <span style={{ color: "#854d0e", fontSize: "0.75rem", fontWeight: 600 }}>Needs internal review</span>;
                    }
                    return <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{m.total_runs} run{m.total_runs === 1 ? "" : "s"}</span>;
                  })()}
                </span>
                <span style={{ ...S.col, flex: 1.5, color: "#94a3b8", fontSize: "0.78rem" }}>
                  {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span style={{ ...S.col, flex: 1 }}>
                  <Link href={`/dashboard/searches/${s.id}`} style={S.viewLink}>View →</Link>
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </DashboardShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  pageTitle:   { color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" } as React.CSSProperties,
  pageSub:     { color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.875rem" } as React.CSSProperties,

  formCard:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "1.5rem" } as React.CSSProperties,
  formTitle:   { color: "#0f172a", fontSize: "1rem", fontWeight: 700, margin: 0 } as React.CSSProperties,
  formGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.875rem", marginBottom: "1.25rem" } as React.CSSProperties,

  labelBlock:  { display: "block" } as React.CSSProperties,
  labelText:   { display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: "0.3rem" },

  input: {
    display: "block", width: "100%", padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0", borderRadius: "0.5rem",
    fontSize: "0.875rem", color: "#0f172a", background: "#fff",
    outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit",
  } as React.CSSProperties,

  section:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  emptyState:  { padding: "3rem 2rem", textAlign: "center" as const },
  emptyIcon:   { fontSize: "2rem", marginBottom: "0.75rem" } as React.CSSProperties,
  emptyTitle:  { color: "#0f172a", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" } as React.CSSProperties,
  emptySub:    { color: "#64748b", fontSize: "0.825rem", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 1.5rem" } as React.CSSProperties,

  tableHeader: { display: "flex", padding: "0.625rem 1.25rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" } as React.CSSProperties,
  tableRow:    { display: "flex", padding: "0.875rem 1.25rem", alignItems: "center", borderBottom: "1px solid #f8fafc" } as React.CSSProperties,
  col:         { fontSize: "0.8rem", color: "#64748b", fontWeight: 600, letterSpacing: "0.02em", paddingRight: "0.75rem" } as React.CSSProperties,

  errorBox:    { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", color: "#dc2626", fontSize: "0.85rem", lineHeight: 1.5 } as React.CSSProperties,

  btnPrimary:  { background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  btnGhost:    { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  btnDisabled: { background: "#7dd3fc", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.875rem", cursor: "not-allowed", fontFamily: "inherit" } as React.CSSProperties,

  linkBtn:     { display: "inline-block", background: "#0ea5e9", color: "#fff", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" } as React.CSSProperties,
  viewLink:    { color: "#0ea5e9", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" } as React.CSSProperties,
};
