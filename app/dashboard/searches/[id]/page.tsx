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
}

const POLL_INTERVAL_MS = 15_000;

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#cbd5e1" }}>—</span>;

  let bg: string, color: string;
  if (score >= 90)      { bg = "#dcfce7"; color = "#15803d"; }
  else if (score >= 70) { bg = "#dbeafe"; color = "#1d4ed8"; }
  else if (score >= 50) { bg = "#fef9c3"; color = "#854d0e"; }
  else                  { bg = "#f1f5f9"; color = "#64748b"; }

  return (
    <span style={{
      display: "inline-block", background: bg, color,
      borderRadius: 999, padding: "0.15rem 0.55rem",
      fontSize: "0.72rem", fontWeight: 700, minWidth: 28, textAlign: "center",
    }}>
      {score}
    </span>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(leads: LeadResult[], filename: string) {
  const COLS: (keyof LeadResult)[] = [
    "company_name", "website", "contact_name", "title",
    "email", "linkedin_url", "country", "source",
    "lead_score", "confidence_score", "seniority", "email_quality",
  ];

  function escape(v: string | number | null | undefined): string {
    if (v == null || v === "") return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const header = COLS.join(",");
  const rows   = leads.map(l => COLS.map(c => escape(l[c] as string | null)).join(","));
  const csv    = [header, ...rows].join("\n");
  const blob   = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      background: st.bg, color: st.color,
      border: `1px solid ${st.border}`,
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
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [notFound, setNotFound]         = useState(false);
  const [error, setError]               = useState("");

  const supabaseRef = useRef(getSupabaseClient());
  const userIdRef   = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ─── Sort leads ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sortByScore) {
      setSortedLeads([...leads]);
      return;
    }
    const sorted = [...leads].sort((a, b) => {
      const sa = a.lead_score ?? -1;
      const sb = b.lead_score ?? -1;
      return sb - sa;
    });
    setSortedLeads(sorted);
  }, [leads, sortByScore]);

  // ─── Fetch leads for completed search ─────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase || !searchId) return;
    setLeadsLoading(true);
    const { data } = await supabase
      .from("lead_results")
      .select("id, company_name, website, contact_name, title, email, linkedin_url, country, source, lead_score, confidence_score, seniority, email_quality, normalized_title")
      .eq("search_id", searchId)
      .order("created_at", { ascending: true });
    setLeads((data ?? []) as LeadResult[]);
    setLeadsLoading(false);
  }, [searchId]);

  // ─── Fetch search record ───────────────────────────────────────────────────

  const fetchSearch = useCallback(async (uid: string): Promise<string | null> => {
    const supabase = supabaseRef.current;
    if (!supabase || !searchId) return null;

    const { data, error: fetchErr } = await supabase
      .from("lead_searches")
      .select("*")
      .eq("id", searchId)
      .eq("user_id", uid)
      .single();

    if (fetchErr || !data) { setNotFound(true); return null; }

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

      // Fetch ICP name
      const searchData = await supabase
        .from("lead_searches")
        .select("icp_id")
        .eq("id", searchId)
        .single();

      if (!cancelled && searchData.data?.icp_id) {
        const { data: icpData } = await supabase
          .from("icps")
          .select("name")
          .eq("id", searchData.data.icp_id as string)
          .eq("user_id", uid)
          .single();
        if (!cancelled && icpData) setIcpName(icpData.name as string);
      }

      if (status === "completed") await fetchLeads();

      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId]);

  // ─── Polling: refresh every 15 s while pending or processing ──────────────

  useEffect(() => {
    const status = search?.status;
    if (status !== "pending" && status !== "processing") return;

    const interval = setInterval(async () => {
      const currentUid = userIdRef.current;
      if (!currentUid) return;
      const newStatus = await fetchSearch(currentUid);
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

  // ─── Loading ──────────────────────────────────────────────────────────────

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
  const hasScores    = leads.some(l => l.lead_score != null);

  return (
    <DashboardShell email={userEmail} onLogout={handleLogout}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:0.3; } 50% { opacity:1; } }
      `}</style>

      {/* Back link */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard/searches" style={S.backLink}>← Back to searches</Link>
      </div>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={S.pageTitle}>{search.name}</h1>
          <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <StatusBadge status={search.status} />
            {isActive && (
              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                Auto-refreshing every 15 s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Detail card */}
      <div style={{ ...S.section, marginBottom: "1.25rem" }}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>Search Details</span>
        </div>
        <div style={S.detailGrid}>
          <DetailRow label="Status"           value={<StatusBadge status={search.status} />} />
          <DetailRow label="Requested Leads"  value={search.requested_lead_count} />
          <DetailRow label="ICP"              value={icpName ?? (search.icp_id ? "ICP no longer exists" : "None")} />
          <DetailRow label="Countries"        value={search.countries.length > 0 ? search.countries.join(", ") : "—"} />
          <DetailRow label="Industries"       value={search.industries.length > 0 ? search.industries.join(", ") : "—"} />
          <DetailRow label="Notes"            value={search.notes ?? "—"} />
          <DetailRow label="Requested"        value={formatDate(search.created_at)} />
          <DetailRow label="Last Updated"     value={formatDate(search.updated_at)} />
          {search.admin_notes && (
            <DetailRow label="Note from us" value={search.admin_notes} highlight />
          )}
        </div>
      </div>

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
                  border: "none", borderRadius: "0.4rem",
                  padding: "0.35rem 0.8rem",
                  fontWeight: 600, fontSize: "0.72rem",
                  cursor: "pointer", fontFamily: "inherit",
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
            <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>
              Queued
            </div>
            <div style={{ color: "#64748b", fontSize: "0.875rem", maxWidth: 360, margin: "0 auto" }}>
              Your search is queued for automatic processing. Lead generation will begin shortly — this page updates automatically.
            </div>
          </div>
        )}

        {/* ── Generating ── */}
        {isProcessing && (
          <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem", display: "inline-block", animation: "spin 2s linear infinite" }}>⚙️</div>
            <div style={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>
              Generating leads…
            </div>
            <div style={{ color: "#64748b", fontSize: "0.875rem", maxWidth: 380, margin: "0 auto" }}>
              Apollo is running your search. Results will appear here automatically — no need to refresh.
            </div>
            <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", animation: "pulse 1.5s ease-in-out 0.3s infinite" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", animation: "pulse 1.5s ease-in-out 0.6s infinite" }} />
            </div>
          </div>
        )}

        {/* ── Failed ── */}
        {isFailed && (
          <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>❌</div>
            <div style={{ color: "#0f172a", fontWeight: 700, marginBottom: "0.5rem" }}>Search failed</div>
            <div style={{ color: "#64748b", fontSize: "0.85rem", maxWidth: 360, margin: "0 auto" }}>
              Something went wrong while generating leads for this search. Please contact support and reference your search ID.
            </div>
            {search.admin_notes && (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#92400e", textAlign: "left", maxWidth: 420, margin: "1rem auto 0" }}>
                {search.admin_notes}
              </div>
            )}
          </div>
        )}

        {/* ── Completed — loading ── */}
        {isCompleted && leadsLoading && (
          <div style={{ padding: "2rem 1.25rem", color: "#64748b", fontSize: "0.875rem" }}>Loading leads…</div>
        )}

        {/* ── Completed — no leads ── */}
        {isCompleted && !leadsLoading && leads.length === 0 && (
          <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>📋</div>
            <div style={{ color: "#0f172a", fontWeight: 700, marginBottom: "0.5rem" }}>Leads coming soon</div>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
              Your search completed. Leads will appear here shortly — contact support if they don&apos;t arrive.
            </div>
          </div>
        )}

        {/* ── Completed — leads table ── */}
        {isCompleted && !leadsLoading && sortedLeads.length > 0 && (
          <>
            <div style={{ padding: "0.75rem 1.25rem", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#15803d" }}>
                {leads.length} lead{leads.length !== 1 ? "s" : ""}
                {search.requested_lead_count > 0 && ` of ${search.requested_lead_count} requested`}
              </span>
              {hasScores && (
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Scores: &nbsp;
                  <ScoreLegend />
                </span>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: hasScores ? 780 : 640 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Company", "Contact", "Title", "Email", "Country",
                      ...(hasScores ? ["Score", "Confidence"] : [])
                    ].map(h => (
                      <th key={h} style={{ padding: "0.65rem 1.25rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLeads.map((lead, i) => (
                    <tr key={lead.id} style={{ borderBottom: i < sortedLeads.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                        {lead.company_name}
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noreferrer" style={{ marginLeft: "0.4rem", color: "#0ea5e9", fontSize: "0.72rem", fontWeight: 400, textDecoration: "none" }}>↗</a>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.82rem", color: "#0f172a", whiteSpace: "nowrap" }}>
                        {lead.contact_name ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                        {lead.linkedin_url && (
                          <a href={lead.linkedin_url} target="_blank" rel="noreferrer" style={{ marginLeft: "0.4rem", color: "#0ea5e9", fontSize: "0.7rem", textDecoration: "none" }}>in</a>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {lead.normalized_title ?? lead.title ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {lead.email
                          ? <a href={`mailto:${lead.email}`} style={{ color: "#0ea5e9", textDecoration: "none" }}>{lead.email}</a>
                          : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {lead.country ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      {hasScores && (
                        <>
                          <td style={{ padding: "0.75rem 1.25rem", whiteSpace: "nowrap" }}>
                            <ScoreBadge score={lead.lead_score} />
                          </td>
                          <td style={{ padding: "0.75rem 1.25rem", whiteSpace: "nowrap" }}>
                            <ScoreBadge score={lead.confidence_score} />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// ─── Score legend chip row ─────────────────────────────────────────────────────

function ScoreLegend() {
  const items = [
    { label: "90+",   bg: "#dcfce7", color: "#15803d" },
    { label: "70–89", bg: "#dbeafe", color: "#1d4ed8" },
    { label: "50–69", bg: "#fef9c3", color: "#854d0e" },
    { label: "<50",   bg: "#f1f5f9", color: "#64748b" },
  ];
  return (
    <span style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
      {items.map(it => (
        <span key={it.label} style={{ background: it.bg, color: it.color, borderRadius: 999, padding: "0.1rem 0.45rem", fontSize: "0.68rem", fontWeight: 700 }}>
          {it.label}
        </span>
      ))}
    </span>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

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
