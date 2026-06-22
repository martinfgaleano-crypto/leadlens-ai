"use client";
import { useState, useEffect } from "react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  pending:    { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  processing: { bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  completed:  { bg: "#dcfce7", color: "#14532d", border: "#86efac" },
  failed:     { bg: "#fee2e2", color: "#7f1d1d", border: "#fca5a5" },
};

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span style={{
      display: "inline-block",
      background: st.bg, color: st.color,
      border: `1px solid ${st.border}`,
      borderRadius: "99px", padding: "0.2rem 0.85rem",
      fontSize: "0.75rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.05em",
    } as React.CSSProperties}>
      {status}
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
  const router  = useRouter();
  const params  = useParams();
  const searchId = typeof params?.id === "string" ? params.id : "";

  const [userEmail, setUserEmail] = useState("");
  const [search, setSearch]       = useState<LeadSearch | null>(null);
  const [icpName, setIcpName]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!searchId) { if (!cancelled) setNotFound(true); setLoading(false); return; }

      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) { setError("Supabase is not configured."); setLoading(false); }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const uid   = session.user.id;
      const email = session.user.email ?? "";
      if (!cancelled) setUserEmail(email);

      // Fetch search — RLS ensures only own rows are visible
      const { data, error: fetchErr } = await supabase
        .from("lead_searches")
        .select("*")
        .eq("id", searchId)
        .eq("user_id", uid)  // explicit ownership check on top of RLS
        .single();

      if (fetchErr || !data) {
        if (!cancelled) { setNotFound(true); setLoading(false); }
        return;
      }

      if (!cancelled) setSearch(data as LeadSearch);

      // Fetch linked ICP name if available
      if (data.icp_id) {
        const { data: icpData } = await supabase
          .from("icps")
          .select("name")
          .eq("id", data.icp_id)
          .eq("user_id", uid)
          .single();
        if (!cancelled && icpData) setIcpName(icpData.name as string);
      }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId]);

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardShell email="" onLogout={handleLogout}>
        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading search…</div>
      </DashboardShell>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <DashboardShell email={userEmail} onLogout={handleLogout}>
        <div style={S.errorBox}>{error}</div>
      </DashboardShell>
    );
  }

  // ─── Not found ──────────────────────────────────────────────────────────

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

  // ─── Detail view ────────────────────────────────────────────────────────

  return (
    <DashboardShell email={userEmail} onLogout={handleLogout}>
      {/* Back link */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard/searches" style={S.backLink}>← Back to searches</Link>
      </div>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={S.pageTitle}>{search.name}</h1>
          <div style={{ marginTop: "0.5rem" }}>
            <StatusBadge status={search.status} />
          </div>
        </div>
      </div>

      {/* Detail card */}
      <div style={{ ...S.section, marginBottom: "1.25rem" }}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>Search Details</span>
        </div>
        <div style={S.detailGrid}>
          <DetailRow label="Status"              value={<StatusBadge status={search.status} />} />
          <DetailRow label="Requested Leads"     value={search.requested_lead_count} />
          <DetailRow label="ICP"                 value={icpName ?? (search.icp_id ? "ICP no longer exists" : "None")} />
          <DetailRow label="Countries"           value={search.countries.length > 0 ? search.countries.join(", ") : "—"} />
          <DetailRow label="Industries"          value={search.industries.length > 0 ? search.industries.join(", ") : "—"} />
          <DetailRow label="Notes"               value={search.notes ?? "—"} />
          <DetailRow label="Requested"           value={formatDate(search.created_at)} />
          <DetailRow label="Last Updated"        value={formatDate(search.updated_at)} />
          {search.admin_notes && (
            <DetailRow label="Admin Notes" value={search.admin_notes} highlight />
          )}
        </div>
      </div>

      {/* Lead results placeholder */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>Lead Results</span>
        </div>
        <div style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
          {search.status === "completed" ? (
            <>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>✅</div>
              <div style={{ color: "#0f172a", fontWeight: 700, marginBottom: "0.5rem" }}>Search completed</div>
              <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Lead results display is coming in the next phase. Contact support if you need your leads now.
              </div>
            </>
          ) : search.status === "failed" ? (
            <>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>❌</div>
              <div style={{ color: "#0f172a", fontWeight: 700, marginBottom: "0.5rem" }}>Search failed</div>
              <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                There was a problem processing this search. Please contact support.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>⏳</div>
              <div style={{ color: "#0f172a", fontWeight: 700, marginBottom: "0.5rem" }}>
                {search.status === "processing" ? "Search in progress" : "Search queued"}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Lead results will appear here when this search is completed.
                {search.status === "pending" && " We'll process your request within 24–48 hours."}
              </div>
            </>
          )}
        </div>
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
      <span style={{ color: "#0f172a", fontSize: "0.875rem", flex: 1 }}>
        {value}
      </span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  pageTitle:   { color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" } as React.CSSProperties,
  backLink:    { color: "#64748b", fontSize: "0.825rem", fontWeight: 600, textDecoration: "none" } as React.CSSProperties,
  section:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  sectionHeader:{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
  sectionTitle: { fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" } as React.CSSProperties,
  detailGrid:  { display: "flex", flexDirection: "column" as const },
  errorBox:    { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", color: "#dc2626", fontSize: "0.85rem", lineHeight: 1.5 } as React.CSSProperties,
  linkBtn:     { display: "inline-block", background: "#0ea5e9", color: "#fff", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" } as React.CSSProperties,
};
