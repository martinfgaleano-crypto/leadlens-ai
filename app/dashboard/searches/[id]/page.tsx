"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/app/dashboard/_components/DashboardShell";
import { getSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadSearch {
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
  // Vault-first metrics (added by migration 015)
  vault_leads_used?:  number | null;
  apollo_leads_used?: number | null;
  vault_hit_rate?:    number | null;
}

interface LeadResult {
  id: string;
  company_name: string;
  website: string | null;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  country: string | null;
  source: string | null;
  // Quality layer (Phase 7)
  lead_score: number | null;
  confidence_score: number | null;
  seniority: string | null;
  email_quality: string | null;
  normalized_title: string | null;
  // AI enrichment layer (Phase 8)
  opportunity_score: number | null;
  buyer_fit: string | null;
  temperature: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  ai_reasoning: string | null;
}

interface MonitorRun {
  job_id: string;
  status: "processing" | "completed" | "failed";
  created_at: string;
  lead_count: number | null;
  hot_count: number | null;
  warm_count: number | null;
  avg_score: number | null;
  is_baseline: boolean;
  visible_changes: number | null;
}

interface MonitorHistory {
  search_id: string;
  total_runs: number;
  latest_status: string | null;
  latest_completed_at: string | null;
  latest_report_job_id: string | null;
  has_processing_run: boolean;
  runs: MonitorRun[];
}

const POLL_INTERVAL_MS = 15_000;

// ─── Badges ───────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#cbd5e1" }}>—</span>;
  let bg: string, color: string;
  if      (score >= 90) { bg = "#dcfce7"; color = "#15803d"; }
  else if (score >= 70) { bg = "#dbeafe"; color = "#1d4ed8"; }
  else if (score >= 50) { bg = "#fef9c3"; color = "#854d0e"; }
  else                  { bg = "#f1f5f9"; color = "#64748b"; }
  return (
    <span style={{ display: "inline-block", background: bg, color, borderRadius: 999, padding: "0.15rem 0.55rem", fontSize: "0.72rem", fontWeight: 700, minWidth: 28, textAlign: "center" }}>
      {score}
    </span>
  );
}

function TempBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const map: Record<string, { bg: string; color: string }> = {
    Hot:  { bg: "#fee2e2", color: "#dc2626" },
    Warm: { bg: "#fef9c3", color: "#854d0e" },
    Cold: { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = map[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.15rem 0.55rem", fontSize: "0.72rem", fontWeight: 700 }}>
      {value}
    </span>
  );
}

function FitBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const map: Record<string, { bg: string; color: string }> = {
    "Excellent fit": { bg: "#dcfce7", color: "#15803d" },
    "Good fit":      { bg: "#dbeafe", color: "#1d4ed8" },
    "Weak fit":      { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = map[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.15rem 0.55rem", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(leads: LeadResult[], filename: string) {
  const SCALAR_COLS: (keyof LeadResult)[] = [
    "company_name", "website", "contact_name", "title",
    "email", "linkedin_url", "country", "source",
    "lead_score", "confidence_score", "seniority", "email_quality",
    "opportunity_score", "buyer_fit", "temperature", "ai_reasoning",
  ];

  function escape(v: string | number | null | undefined): string {
    if (v == null || v === "") return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const header = [
    ...SCALAR_COLS,
    "strengths", "weaknesses",
  ].join(",");

  const rows = leads.map(l => [
    ...SCALAR_COLS.map(c => escape(l[c] as string | number | null)),
    escape((l.strengths ?? []).join("; ")),
    escape((l.weaknesses ?? []).join("; ")),
  ].join(","));

  const csv  = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  pending:    { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  processing: { bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  completed:  { bg: "#dcfce7", color: "#14532d", border: "#86efac" },
  failed:     { bg: "#fee2e2", color: "#7f1d1d", border: "#fca5a5" },
};

const STATUS_LABELS: Record<string, string> = {
  pending:    "Queued",
  processing: "Generating leads…",
  completed:  "Completed",
  failed:     "Failed",
};

function StatusBadge({ status }: { status: string }) {
  const st  = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const lbl = STATUS_LABELS[status] ?? status;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      background: st.bg, color: st.color, border: `1px solid ${st.border}`,
      borderRadius: "99px", padding: "0.2rem 0.85rem",
      fontSize: "0.75rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.05em",
    } as React.CSSProperties}>
      {status === "processing" && (
        <span style={{ display: "inline-block", animation: "spin 1.2s linear infinite" }}>⟳</span>
      )}
      {lbl}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ─── AI Insight panel (expandable) ────────────────────────────────────────────

function AiInsightPanel({ lead }: { lead: LeadResult }) {
  const hasEnrichment = lead.ai_reasoning || (lead.strengths?.length ?? 0) > 0 || (lead.weaknesses?.length ?? 0) > 0;
  if (!hasEnrichment) {
    return (
      <div style={{ padding: "0.75rem 1.25rem", color: "#94a3b8", fontSize: "0.8rem", fontStyle: "italic" }}>
        AI insights not available for this lead.
      </div>
    );
  }
  return (
    <div style={{ padding: "0.85rem 1.25rem", background: "#f8fafc", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
      {/* Reasoning */}
      <div>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>AI Reasoning</div>
        <div style={{ fontSize: "0.8rem", color: "#0f172a", lineHeight: 1.5 }}>
          {lead.ai_reasoning ?? "—"}
        </div>
      </div>
      {/* Strengths */}
      <div>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Strengths</div>
        {(lead.strengths?.length ?? 0) === 0
          ? <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>None identified</div>
          : (lead.strengths ?? []).map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", color: "#15803d", marginBottom: "0.2rem" }}>
                <span>✓</span>{s}
              </div>
            ))
        }
      </div>
      {/* Weaknesses */}
      <div>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Weaknesses</div>
        {(lead.weaknesses?.length ?? 0) === 0
          ? <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>None identified</div>
          : (lead.weaknesses ?? []).map(w => (
              <div key={w} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.2rem" }}>
                <span>✗</span>{w}
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchDetailPage() {
  const router   = useRouter();
  const params   = useParams();
  const searchId = typeof params?.id === "string" ? params.id : "";

  const [userEmail, setUserEmail]       = useState("");
  const [userId, setUserId]             = useState("");
  const [search, setSearch]             = useState<LeadSearch | null>(null);
  const [icpName, setIcpName]           = useState<string | null>(null);
  const [leads, setLeads]               = useState<LeadResult[]>([]);
  const [sortedLeads, setSortedLeads]   = useState<LeadResult[]>([]);
  const [sortByScore, setSortByScore]   = useState(true);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [notFound, setNotFound]         = useState(false);
  const [error, setError]               = useState("");
  const [monitor, setMonitor]           = useState<MonitorHistory | null>(null);

  const supabaseRef = useRef(getSupabaseClient());
  const userIdRef   = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ─── Sort leads ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sortByScore) { setSortedLeads([...leads]); return; }
    const sorted = [...leads].sort((a, b) => {
      const sa = a.opportunity_score ?? a.lead_score ?? -1;
      const sb = b.opportunity_score ?? b.lead_score ?? -1;
      return sb - sa;
    });
    setSortedLeads(sorted);
  }, [leads, sortByScore]);

  // ─── Fetch leads ──────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase || !searchId) return;
    setLeadsLoading(true);
    const { data } = await supabase
      .from("lead_results")
      .select("id, company_name, website, contact_name, title, email, linkedin_url, country, source, lead_score, confidence_score, seniority, email_quality, normalized_title, opportunity_score, buyer_fit, temperature, strengths, weaknesses, ai_reasoning")
      .eq("search_id", searchId)
      .order("created_at", { ascending: true });
    setLeads((data ?? []) as LeadResult[]);
    setLeadsLoading(false);
  }, [searchId]);

  // ─── Fetch search ─────────────────────────────────────────────────────────

  const fetchSearch = useCallback(async (uid: string): Promise<string | null> => {
    const supabase = supabaseRef.current;
    if (!supabase || !searchId) return null;
    const { data, error: err } = await supabase
      .from("lead_searches")
      .select("*")
      .eq("id", searchId)
      .eq("user_id", uid)
      .single();
    if (err || !data) { setNotFound(true); return null; }
    setSearch(data as LeadSearch);
    return data.status as string;
  }, [searchId]);

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!searchId) { setNotFound(true); setLoading(false); return; }
      const supabase = supabaseRef.current;
      if (!supabase) {
        if (!cancelled) { setError("Supabase is not configured."); setLoading(false); }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const uid   = session.user.id;
      const email = session.user.email ?? "";
      if (!cancelled) { setUserId(uid); setUserEmail(email); }
      const status = await fetchSearch(uid);
      if (cancelled) return;
      if (status === null) { setLoading(false); return; }
      // ICP name
      const searchData = await supabase.from("lead_searches").select("icp_id").eq("id", searchId).single();
      if (!cancelled && searchData.data?.icp_id) {
        const { data: icpData } = await supabase.from("icps").select("name").eq("id", searchData.data.icp_id as string).eq("user_id", uid).single();
        if (!cancelled && icpData) setIcpName(icpData.name as string);
      }
      if (status === "completed") await fetchLeads();
      // Monitor run history — best-effort; the section stays hidden on failure
      try {
        const res = await fetch(`/api/monitor/${searchId}/runs`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && !cancelled) {
          const d = await res.json().catch(() => null);
          if (d?.runs) setMonitor(d as MonitorHistory);
        }
      } catch { /* best-effort */ }
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId]);

  // ─── Polling ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const status = search?.status;
    if (status !== "pending" && status !== "processing") return;
    const interval = setInterval(async () => {
      const uid = userIdRef.current;
      if (!uid) return;
      const newStatus = await fetchSearch(uid);
      if (newStatus === "completed") await fetchLeads();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [search?.status, fetchSearch, fetchLeads]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleLogout() {
    const supabase = supabaseRef.current;
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  function handleExportCsv() {
    if (!search) return;
    const slug = search.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    exportCsv(sortedLeads, `leadlens-${slug}.csv`);
  }

  function toggleInsight(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardShell email="" onLogout={handleLogout}>
        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading search…</div>
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

  if (notFound || !search) {
    return (
      <DashboardShell email={userEmail} onLogout={handleLogout}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link href="/dashboard/searches" style={S.backLink}>← Back to searches</Link>
        </div>
        <div style={S.section}>
          <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔍</div>
            <div style={{ color: "#0f172a", fontWeight: 700, marginBottom: "0.5rem" }}>Search not found</div>
            <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              This search does not exist or does not belong to your account.
            </div>
            <Link href="/dashboard/searches" style={S.linkBtn}>Back to searches</Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const isCompleted  = search.status === "completed";
  const isFailed     = search.status === "failed";
  const isProcessing = search.status === "processing";
  const isPending    = search.status === "pending";
  const isActive     = isPending || isProcessing;
  const hasScores    = leads.some(l => l.opportunity_score != null || l.lead_score != null);
  const hasEnrichment = leads.some(l => l.temperature != null);

  return (
    <DashboardShell email={userEmail} onLogout={handleLogout}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:0.3; } 50% { opacity:1; } }
      `}</style>

      {/* Back */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard/searches" style={S.backLink}>← Back to searches</Link>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={S.pageTitle}>{search.name}</h1>
          <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <StatusBadge status={search.status} />
            {isActive && <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Auto-refreshing every 15 s</span>}
          </div>
        </div>
      </div>

      {/* Detail card */}
      <div style={{ ...S.section, marginBottom: "1.25rem" }}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>Search Details</span>
        </div>
        <div style={S.detailGrid}>
          <DetailRow label="Status"          value={<StatusBadge status={search.status} />} />
          <DetailRow label="Requested Leads" value={search.requested_lead_count} />
          <DetailRow label="ICP"             value={icpName ?? (search.icp_id ? "ICP no longer exists" : "None")} />
          <DetailRow label="Countries"       value={search.countries.length > 0 ? search.countries.join(", ") : "—"} />
          <DetailRow label="Industries"      value={search.industries.length > 0 ? search.industries.join(", ") : "—"} />
          <DetailRow label="Notes"           value={search.notes ?? "—"} />
          <DetailRow label="Requested"       value={formatDate(search.created_at)} />
          <DetailRow label="Last Updated"    value={formatDate(search.updated_at)} />
          {search.admin_notes && (
            <DetailRow label="Note from us" value={search.admin_notes} highlight />
          )}
        </div>
      </div>

      {/* Monthly Monitor — account opportunity runs for this search series */}
      {monitor && (
        <div style={{ ...S.section, marginBottom: "1.25rem" }}>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>Monthly Monitor</span>
            {monitor.latest_report_job_id && (
              <Link
                href={`/results/${monitor.latest_report_job_id}`}
                style={{ background: "#0ea5e9", color: "#fff", borderRadius: "0.45rem", padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.78rem", textDecoration: "none" }}
              >
                Open latest report →
              </Link>
            )}
          </div>

          {monitor.total_runs === 0 ? (
            <div style={{ padding: "1.25rem", color: "#64748b", fontSize: "0.85rem", lineHeight: 1.6 }}>
              LeadLens monitors this search as a recurring series. No monitor runs yet —
              once your first account opportunity report is generated, it will appear here
              as the baseline, and future runs will show what changed.
            </div>
          ) : (
            <>
              <div style={{ padding: "0.85rem 1.25rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", borderBottom: "1px solid #f1f5f9" }}>
                {[
                  { label: "Total runs", value: String(monitor.total_runs) },
                  { label: "Latest run", value: monitor.latest_status ?? "—" },
                  { label: "Last completed", value: monitor.latest_completed_at ? new Date(monitor.latest_completed_at).toLocaleDateString() : "—" },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center", padding: "0.6rem", background: "#f8fafc", borderRadius: "0.5rem" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>{item.label}</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", textTransform: "capitalize" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {monitor.has_processing_run && (
                <div style={{ margin: "0.75rem 1.25rem 0", padding: "0.5rem 0.75rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "0.4rem", fontSize: "0.78rem", color: "#92400e" }}>
                  A monitor run is currently in progress.
                </div>
              )}

              <div style={{ padding: "0.85rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {monitor.runs.map(run => (
                  <div key={run.job_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", border: "1px solid #f1f5f9", borderRadius: "0.5rem", padding: "0.6rem 0.85rem", fontSize: "0.8rem" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        {new Date(run.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        {run.is_baseline && (
                          <span style={{ marginLeft: "0.5rem", background: "#e0e7ff", color: "#4338ca", borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.65rem", fontWeight: 700 }}>BASELINE</span>
                        )}
                        {!run.is_baseline && run.status === "completed" && (
                          <span style={{ marginLeft: "0.5rem", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.65rem", fontWeight: 700 }}>COMPARED</span>
                        )}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                        {run.status === "completed"
                          ? <>{run.lead_count ?? "—"} accounts · {run.hot_count ?? 0} hot · {run.warm_count ?? 0} warm{run.visible_changes != null && <> · {run.visible_changes} change{run.visible_changes === 1 ? "" : "s"}</>}</>
                          : run.status === "processing" ? "In progress…" : "Run did not complete"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
                      {run.status === "completed" && (
                        <Link href={`/results/${run.job_id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.75rem", textDecoration: "none" }}>
                          View report
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Lead Source Summary — only when vault data exists */}
      {search.status === "completed" && (
        (search.vault_leads_used != null || search.apollo_leads_used != null) &&
        ((search.vault_leads_used ?? 0) + (search.apollo_leads_used ?? 0)) > 0
      ) && (
        <div style={{ ...S.section, marginBottom: "1.25rem" }}>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>Lead Source Summary</span>
          </div>
          <div style={{ padding: "1rem 1.25rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
            {[
              { label: "Requested", value: search.requested_lead_count, color: "#0f172a" },
              { label: "From Vault", value: search.vault_leads_used ?? 0, color: "#15803d" },
              { label: "From Apollo", value: search.apollo_leads_used ?? 0, color: "#1d4ed8" },
              { label: "Vault Hit Rate", value: `${Math.round((search.vault_hit_rate ?? 0) * 100)}%`, color: "#0f172a" },
            ].map(item => (
              <div key={item.label} style={{ textAlign: "center", padding: "0.875rem", background: "#f8fafc", borderRadius: "0.5rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>{item.label}</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: item.color, letterSpacing: "-0.02em" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead results */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>
            {isCompleted ? `Lead Results (${leads.length})` : "Lead Results"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {isCompleted && hasScores && (
              <button
                onClick={() => setSortByScore(s => !s)}
                style={{
                  background: sortByScore ? "#0f172a" : "#f1f5f9",
                  color: sortByScore ? "#fff" : "#64748b",
                  border: "none", borderRadius: "0.4rem", padding: "0.35rem 0.8rem",
                  fontWeight: 600, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {sortByScore ? "↓ By Score" : "By Date"}
              </button>
            )}
            {isCompleted && leads.length > 0 && (
              <button onClick={handleExportCsv} style={S.exportBtn}>↓ Export CSV</button>
            )}
          </div>
        </div>

        {/* ── Queued ── */}
        {isPending && (
          <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>🕐</div>
            <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>Queued</div>
            <div style={{ color: "#64748b", fontSize: "0.875rem", maxWidth: 360, margin: "0 auto" }}>
              Your search is queued for automatic processing. Lead generation will begin shortly — this page updates automatically.
            </div>
          </div>
        )}

        {/* ── Generating ── */}
        {isProcessing && (
          <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem", display: "inline-block", animation: "spin 2s linear infinite" }}>⚙️</div>
            <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>Generating leads…</div>
            <div style={{ color: "#64748b", fontSize: "0.875rem", maxWidth: 380, margin: "0 auto" }}>
              Apollo is running your search. Results will appear here automatically — no need to refresh.
            </div>
            <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              {[0, 0.3, 0.6].map(delay => (
                <div key={delay} style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", animation: `pulse 1.5s ease-in-out ${delay}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Failed ── */}
        {isFailed && (() => {
          const isNoLeads = search.admin_notes?.includes("No leads found") ||
                            search.notes?.includes("No leads found");
          return (
            <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>
                {isNoLeads ? "🔍" : "⚠️"}
              </div>
              <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>
                {isNoLeads ? "No leads found" : "Search could not be completed"}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.85rem", maxWidth: 400, margin: "0 auto" }}>
                {isNoLeads
                  ? "Our search returned no results for your criteria. No credits were charged."
                  : "Something went wrong during lead generation. Our team has been notified."}
              </div>

              {isNoLeads && (
                <div style={{ marginTop: "1.25rem", padding: "1rem 1.25rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.625rem", textAlign: "left", maxWidth: 380, margin: "1.25rem auto 0" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Possible reasons</div>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#64748b", fontSize: "0.82rem", lineHeight: 1.8 }}>
                    <li>Filters may be too restrictive — try broadening countries or industries</li>
                    <li>No available leads matching your ICP in this region</li>
                    <li>Data provider returned no results for this query</li>
                  </ul>
                  <div style={{ marginTop: "0.875rem", fontSize: "0.8rem", color: "#0ea5e9", fontWeight: 600 }}>
                    Try creating a new search with different parameters.
                  </div>
                </div>
              )}

              {!isNoLeads && (
                <div style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#94a3b8" }}>
                  Reference ID: <span style={{ fontFamily: "monospace" }}>{search.id}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Loading leads ── */}
        {isCompleted && leadsLoading && (
          <div style={{ padding: "2rem 1.25rem", color: "#64748b", fontSize: "0.875rem" }}>Loading leads…</div>
        )}

        {/* ── No leads ── */}
        {isCompleted && !leadsLoading && leads.length === 0 && (
          <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>📋</div>
            <div style={{ color: "#0f172a", fontWeight: 700, marginBottom: "0.5rem" }}>Leads coming soon</div>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
              Your search completed. Leads will appear here shortly — contact support if they don&apos;t arrive.
            </div>
          </div>
        )}

        {/* ── Leads table ── */}
        {isCompleted && !leadsLoading && sortedLeads.length > 0 && (
          <>
            <div style={{ padding: "0.75rem 1.25rem", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#15803d" }}>
                {leads.length} lead{leads.length !== 1 ? "s" : ""}
                {search.requested_lead_count > 0 && ` of ${search.requested_lead_count} requested`}
              </span>
              {hasEnrichment && (
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Click any row for AI insight
                </span>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: hasEnrichment ? 860 : 640 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "Company", "Contact", "Title", "Email", "Country",
                      ...(hasScores ? ["Opportunity"] : []),
                      ...(hasEnrichment ? ["Buyer Fit", "Temperature"] : []),
                    ].map(h => (
                      <th key={h} style={{ padding: "0.65rem 1.25rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLeads.map((lead, i) => {
                    const isExpanded = expandedId === lead.id;
                    const isLast     = i === sortedLeads.length - 1;
                    return (
                      <>
                        <tr
                          key={lead.id}
                          onClick={() => toggleInsight(lead.id)}
                          style={{
                            borderBottom: isExpanded ? "none" : (isLast ? "none" : "1px solid #f1f5f9"),
                            cursor: hasEnrichment ? "pointer" : "default",
                            background: isExpanded ? "#f0f9ff" : undefined,
                          }}
                        >
                          <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                            {lead.company_name}
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ marginLeft: "0.4rem", color: "#0ea5e9", fontSize: "0.72rem", fontWeight: 400, textDecoration: "none" }}>↗</a>
                            )}
                          </td>
                          <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.82rem", color: "#0f172a", whiteSpace: "nowrap" }}>
                            {lead.contact_name ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                            {lead.linkedin_url && (
                              <a href={lead.linkedin_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ marginLeft: "0.4rem", color: "#0ea5e9", fontSize: "0.7rem", textDecoration: "none" }}>in</a>
                            )}
                          </td>
                          <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                            {lead.normalized_title ?? lead.title ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                          </td>
                          <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                            {lead.email
                              ? <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} style={{ color: "#0ea5e9", textDecoration: "none" }}>{lead.email}</a>
                              : <span style={{ color: "#cbd5e1" }}>—</span>}
                          </td>
                          <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                            {lead.country ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                          </td>
                          {hasScores && (
                            <td style={{ padding: "0.75rem 1.25rem", whiteSpace: "nowrap" }}>
                              <ScoreBadge score={lead.opportunity_score ?? lead.lead_score} />
                            </td>
                          )}
                          {hasEnrichment && (
                            <>
                              <td style={{ padding: "0.75rem 1.25rem", whiteSpace: "nowrap" }}>
                                <FitBadge value={lead.buyer_fit} />
                              </td>
                              <td style={{ padding: "0.75rem 1.25rem", whiteSpace: "nowrap" }}>
                                <TempBadge value={lead.temperature} />
                              </td>
                            </>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr key={`${lead.id}-insight`} style={{ borderBottom: isLast ? "none" : "1px solid #e2e8f0" }}>
                            <td colSpan={5 + (hasScores ? 1 : 0) + (hasEnrichment ? 2 : 0)} style={{ padding: 0 }}>
                              <AiInsightPanel lead={lead} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", gap: "1rem", padding: "0.75rem 1.25rem",
      borderBottom: "1px solid #f8fafc", alignItems: "flex-start",
      background: highlight ? "#fefce8" : undefined,
    }}>
      <span style={{ minWidth: 140, color: "#64748b", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", paddingTop: "0.1rem" }}>
        {label}
      </span>
      <span style={{ color: highlight ? "#854d0e" : "#0f172a", fontSize: "0.875rem", flex: 1 }}>
        {value}
      </span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  pageTitle:    { color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" } as React.CSSProperties,
  backLink:     { color: "#64748b", fontSize: "0.825rem", fontWeight: 600, textDecoration: "none" } as React.CSSProperties,
  section:      { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  sectionHeader:{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
  sectionTitle: { fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" } as React.CSSProperties,
  detailGrid:   { display: "flex", flexDirection: "column" as const },
  errorBox:     { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", color: "#dc2626", fontSize: "0.85rem", lineHeight: 1.5 } as React.CSSProperties,
  linkBtn:      { display: "inline-block", background: "#0ea5e9", color: "#fff", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" } as React.CSSProperties,
  exportBtn:    { background: "#0f172a", color: "#f0f9ff", border: "none", borderRadius: "0.45rem", padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
};
