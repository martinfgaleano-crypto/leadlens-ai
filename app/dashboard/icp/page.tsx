"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/app/dashboard/_components/DashboardShell";
import { getSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Icp {
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
  created_at: string;
}

interface IcpForm {
  name: string;
  target_countries: string;
  target_regions: string;
  industries: string;
  company_sizes: string;
  target_job_titles: string;
  keywords: string;
  exclusions: string;
  priority: "volume" | "precision" | "balance";
  notes: string;
}

const EMPTY_FORM: IcpForm = {
  name: "",
  target_countries: "",
  target_regions: "",
  industries: "",
  company_sizes: "",
  target_job_titles: "",
  keywords: "",
  exclusions: "",
  priority: "balance",
  notes: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toArr(s: string): string[] {
  return s.split(",").map(v => v.trim()).filter(Boolean);
}
function fromArr(a: string[]): string {
  return a.join(", ");
}
function formFromIcp(icp: Icp): IcpForm {
  return {
    name:             icp.name,
    target_countries: fromArr(icp.target_countries),
    target_regions:   fromArr(icp.target_regions),
    industries:       fromArr(icp.industries),
    company_sizes:    fromArr(icp.company_sizes),
    target_job_titles:fromArr(icp.target_job_titles),
    keywords:         fromArr(icp.keywords),
    exclusions:       fromArr(icp.exclusions),
    priority:         icp.priority as IcpForm["priority"],
    notes:            icp.notes ?? "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IcpPage() {
  const router = useRouter();
  const [userEmail, setUserEmail]   = useState("");
  const [userId, setUserId]         = useState("");
  const [icps, setIcps]             = useState<Icp[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [formOpen, setFormOpen]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<IcpForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Auth + initial load ──────────────────────────────────────────────────

  const loadIcps = useCallback(async (uid: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error: fetchErr } = await supabase
      .from("icps")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!fetchErr) setIcps((data ?? []) as Icp[]);
  }, []);

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
      await loadIcps(uid);
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  // ─── Form helpers ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(icp: Icp) {
    setEditingId(icp.id);
    setForm(formFromIcp(icp));
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  }

  function setField(k: keyof IcpForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // ─── Save (create or update) ──────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("ICP name is required."); return; }
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setSaving(true);
    setFormError("");

    const payload = {
      name:              form.name.trim(),
      target_countries:  toArr(form.target_countries),
      target_regions:    toArr(form.target_regions),
      industries:        toArr(form.industries),
      company_sizes:     toArr(form.company_sizes),
      target_job_titles: toArr(form.target_job_titles),
      keywords:          toArr(form.keywords),
      exclusions:        toArr(form.exclusions),
      priority:          form.priority,
      notes:             form.notes.trim() || null,
    };

    if (editingId) {
      const { error: updateErr } = await supabase
        .from("icps")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", userId);
      if (updateErr) { setFormError(updateErr.message); setSaving(false); return; }
    } else {
      const { error: insertErr } = await supabase
        .from("icps")
        .insert({ ...payload, user_id: userId });
      if (insertErr) { setFormError(insertErr.message); setSaving(false); return; }
    }

    await loadIcps(userId);
    setSaving(false);
    closeForm();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Delete this ICP? This cannot be undone.")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setDeletingId(id);
    await supabase.from("icps").delete().eq("id", id).eq("user_id", userId);
    setDeletingId(null);
    await loadIcps(userId);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

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

  return (
    <DashboardShell email={userEmail} onLogout={handleLogout}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={S.pageTitle}>ICP Builder</h1>
          <p style={S.pageSub}>Define your Ideal Customer Profiles. These drive your lead searches.</p>
        </div>
        {!formOpen && (
          <button onClick={openCreate} style={S.btnPrimary}>+ New ICP</button>
        )}
      </div>

      {/* Create / Edit form */}
      {formOpen && (
        <div style={S.formCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2 style={S.formTitle}>{editingId ? "Edit ICP" : "New ICP"}</h2>
            <button onClick={closeForm} style={S.btnGhost}>Cancel</button>
          </div>

          <form onSubmit={handleSave}>
            <div style={S.formGrid}>
              <FormField label="ICP Name *" hint="A short label for this profile">
                <input style={S.input} value={form.name} onChange={e => setField("name", e.target.value)}
                  placeholder="e.g. SaaS CTOs — Series A — US" required />
              </FormField>

              <FormField label="Priority" hint="volume = more leads, precision = better match, balance = default">
                <select style={S.input} value={form.priority} onChange={e => setField("priority", e.target.value as IcpForm["priority"])}>
                  <option value="balance">Balance (default)</option>
                  <option value="volume">Volume — maximize lead count</option>
                  <option value="precision">Precision — maximize fit</option>
                </select>
              </FormField>

              <FormField label="Target Countries" hint="Comma-separated, e.g. United States, Canada">
                <input style={S.input} value={form.target_countries} onChange={e => setField("target_countries", e.target.value)}
                  placeholder="United States, Canada, United Kingdom" />
              </FormField>

              <FormField label="Target Regions / States" hint="Comma-separated, e.g. California, New York">
                <input style={S.input} value={form.target_regions} onChange={e => setField("target_regions", e.target.value)}
                  placeholder="California, New York, Texas" />
              </FormField>

              <FormField label="Industries" hint="Comma-separated">
                <input style={S.input} value={form.industries} onChange={e => setField("industries", e.target.value)}
                  placeholder="SaaS, FinTech, Healthcare IT" />
              </FormField>

              <FormField label="Company Sizes" hint="Comma-separated headcount ranges">
                <input style={S.input} value={form.company_sizes} onChange={e => setField("company_sizes", e.target.value)}
                  placeholder="11-50, 51-200, 201-500" />
              </FormField>

              <FormField label="Target Job Titles" hint="Comma-separated">
                <input style={S.input} value={form.target_job_titles} onChange={e => setField("target_job_titles", e.target.value)}
                  placeholder="CTO, VP of Engineering, Head of Growth" />
              </FormField>

              <FormField label="Keywords" hint="Topics, tech stack, tools — comma-separated">
                <input style={S.input} value={form.keywords} onChange={e => setField("keywords", e.target.value)}
                  placeholder="Salesforce, outbound sales, Series A" />
              </FormField>

              <FormField label="Exclusions" hint="Industries, titles, or companies to skip">
                <input style={S.input} value={form.exclusions} onChange={e => setField("exclusions", e.target.value)}
                  placeholder="e.g. Agencies, competitors, solopreneurs" />
              </FormField>

              <FormField label="Notes" hint="Internal notes for this ICP">
                <textarea style={{ ...S.input, resize: "vertical", minHeight: "4rem" }}
                  value={form.notes} onChange={e => setField("notes", e.target.value)}
                  placeholder="Any context that helps clarify this profile…" />
              </FormField>
            </div>

            {formError && <div style={{ ...S.errorBox, marginBottom: "1rem" }}>{formError}</div>}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={closeForm} style={S.btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} style={saving ? S.btnDisabled : S.btnPrimary}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create ICP"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ICP list */}
      {icps.length === 0 && !formOpen ? (
        <div style={S.section}>
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>🎯</div>
            <div style={S.emptyTitle}>No ICPs yet</div>
            <div style={S.emptySub}>
              An Ideal Customer Profile tells LeadLens exactly who you want to reach.
              Create your first ICP to start building lead searches.
            </div>
            <button onClick={openCreate} style={S.btnPrimary}>+ Create your first ICP</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {icps.map(icp => (
            <div key={icp.id} style={S.icpCard}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <span style={S.icpName}>{icp.name}</span>
                  <span style={S.priorityBadge(icp.priority)}>{icp.priority}</span>
                </div>
                <div style={S.icpMeta}>
                  {icp.industries.length > 0 && <Chip label={`Industries: ${icp.industries.join(", ")}`} />}
                  {icp.target_countries.length > 0 && <Chip label={`Countries: ${icp.target_countries.join(", ")}`} />}
                  {icp.target_job_titles.length > 0 && <Chip label={`Titles: ${icp.target_job_titles.join(", ")}`} />}
                  {icp.company_sizes.length > 0 && <Chip label={`Size: ${icp.company_sizes.join(", ")}`} />}
                </div>
                {icp.notes && <div style={S.icpNotes}>{icp.notes}</div>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "flex-start" }}>
                <button onClick={() => openEdit(icp)} style={S.btnGhost}>Edit</button>
                <button
                  onClick={() => handleDelete(icp.id)}
                  disabled={deletingId === icp.id}
                  style={S.btnDanger}
                >
                  {deletingId === icp.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={S.label}>
        <span style={S.labelText}>{label}</span>
        {hint && <span style={S.labelHint}>{hint}</span>}
        {children}
      </label>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span style={S.chip}>{label}</span>;
}

function priorityColor(p: string): string {
  if (p === "volume")    return "#7c3aed";
  if (p === "precision") return "#0ea5e9";
  return "#64748b";
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  pageTitle: { color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" } as React.CSSProperties,
  pageSub:   { color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.875rem" } as React.CSSProperties,

  formCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,
  formTitle: { color: "#0f172a", fontSize: "1rem", fontWeight: 700, margin: 0 } as React.CSSProperties,
  formGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.875rem", marginBottom: "1.25rem" } as React.CSSProperties,

  label:     { display: "block" } as React.CSSProperties,
  labelText: { display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: "0.15rem" },
  labelHint: { display: "block", fontSize: "0.68rem", color: "#94a3b8", marginBottom: "0.3rem" } as React.CSSProperties,

  input: {
    display: "block", width: "100%", padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0", borderRadius: "0.5rem",
    fontSize: "0.875rem", color: "#0f172a", background: "#fff",
    outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit",
  } as React.CSSProperties,

  section: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  emptyState: { padding: "3rem 2rem", textAlign: "center" as const },
  emptyIcon:  { fontSize: "2rem", marginBottom: "0.75rem" } as React.CSSProperties,
  emptyTitle: { color: "#0f172a", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" } as React.CSSProperties,
  emptySub:   { color: "#64748b", fontSize: "0.825rem", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 1.5rem" } as React.CSSProperties,

  icpCard: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem",
    padding: "1.25rem 1.5rem", display: "flex", gap: "1rem", alignItems: "flex-start",
  } as React.CSSProperties,
  icpName:  { color: "#0f172a", fontWeight: 700, fontSize: "0.95rem" } as React.CSSProperties,
  icpMeta:  { display: "flex", flexWrap: "wrap" as const, gap: "0.375rem", marginBottom: "0.4rem" },
  icpNotes: { color: "#64748b", fontSize: "0.78rem", marginTop: "0.4rem" } as React.CSSProperties,

  chip: {
    display: "inline-block", background: "#f1f5f9", border: "1px solid #e2e8f0",
    borderRadius: "0.375rem", padding: "0.15rem 0.5rem",
    fontSize: "0.7rem", color: "#475569",
  } as React.CSSProperties,

  priorityBadge: (p: string) => ({
    display: "inline-block",
    background: p === "volume" ? "#ede9fe" : p === "precision" ? "#e0f2fe" : "#f1f5f9",
    color: priorityColor(p),
    borderRadius: "99px",
    padding: "0.1rem 0.6rem",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  }),

  errorBox: { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", color: "#dc2626", fontSize: "0.85rem", lineHeight: 1.5 } as React.CSSProperties,

  btnPrimary: {
    background: "#0ea5e9", color: "#fff", border: "none",
    borderRadius: "0.5rem", padding: "0.6rem 1.25rem",
    fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
  } as React.CSSProperties,
  btnGhost: {
    background: "transparent", color: "#64748b", border: "1px solid #e2e8f0",
    borderRadius: "0.5rem", padding: "0.5rem 1rem",
    fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit",
  } as React.CSSProperties,
  btnDanger: {
    background: "transparent", color: "#dc2626", border: "1px solid #fca5a5",
    borderRadius: "0.5rem", padding: "0.5rem 0.875rem",
    fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit",
  } as React.CSSProperties,
  btnDisabled: {
    background: "#7dd3fc", color: "#fff", border: "none",
    borderRadius: "0.5rem", padding: "0.6rem 1.25rem",
    fontWeight: 700, fontSize: "0.875rem", cursor: "not-allowed", fontFamily: "inherit",
  } as React.CSSProperties,
};
