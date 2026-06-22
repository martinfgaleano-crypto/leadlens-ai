"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/app/dashboard/_components/DashboardShell";
import { getSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  plan: string;
  credits_remaining: number;
  onboarding_completed: boolean;
  created_at: string;
}

interface RecentSearch {
  id: string;
  name: string;
  status: string;
  requested_lead_count: number;
  created_at: string;
}

// ─── Status badge (inline, minimal) ──────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef9c3", color: "#854d0e" },
  processing: { bg: "#e0f2fe", color: "#075985" },
  completed:  { bg: "#dcfce7", color: "#14532d" },
  failed:     { bg: "#fee2e2", color: "#7f1d1d" },
};

function StatusBadge({ status }: { status: string }) {
  const { bg, color } = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <span style={{ background: bg, color, borderRadius: "99px", padding: "0.1rem 0.55rem", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" } as React.CSSProperties}>
      {status}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile]             = useState<Profile | null>(null);
  const [userEmail, setEmail]             = useState<string | null>(null);
  const [icpCount, setIcpCount]           = useState(0);
  const [searchCount, setSearchCount]     = useState(0);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) { setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment."); setLoading(false); }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const uid   = session.user.id;
      const email = session.user.email ?? null;
      if (!cancelled) setEmail(email);

      // Fetch profile (create lazily on first visit)
      const { data: existing, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();

      let prof: Profile | null = null;

      if (fetchError && fetchError.code !== "PGRST116") {
        if (!cancelled) { setError("Could not load profile. Please refresh."); setLoading(false); }
        return;
      }

      if (existing) {
        prof = existing as Profile;
      } else {
        const { data: created, error: createError } = await supabase
          .from("profiles")
          .insert({ id: uid, email: email ?? "" })
          .select()
          .single();
        if (createError) {
          if (!cancelled) { setError("Could not create your profile. Please try refreshing."); setLoading(false); }
          return;
        }
        prof = created as Profile;
      }

      if (!cancelled) setProfile(prof);

      // Fetch ICP count, search count, and 5 most recent searches in parallel
      const [icpRes, searchRes, recentRes] = await Promise.all([
        supabase.from("icps").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("lead_searches").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("lead_searches")
          .select("id, name, status, requested_lead_count, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (!cancelled) {
        setIcpCount(icpRes.count ?? 0);
        setSearchCount(searchRes.count ?? 0);
        setRecentSearches((recentRes.data ?? []) as RecentSearch[]);
        setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardShell email="" onLogout={handleLogout}>
        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading your dashboard…</div>
      </DashboardShell>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <DashboardShell email={userEmail ?? ""} onLogout={handleLogout}>
        <div style={S.errorBox}>{error}</div>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
          <button onClick={() => window.location.reload()} style={S.btnSecondary}>Retry</button>
          <button onClick={handleLogout} style={S.btnGhost}>Log out</button>
        </div>
      </DashboardShell>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  const planLabel    = PLAN_LABELS[profile?.plan ?? "free"] ?? profile?.plan ?? "Free";
  const displayEmail = profile?.email ?? userEmail ?? "—";

  return (
    <DashboardShell email={displayEmail} onLogout={handleLogout}>
      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={S.pageTitle}>Dashboard</h1>
        <p style={S.pageSub}>Welcome to LeadLens — your B2B lead generation workspace.</p>
      </div>

      {/* Account + plan stat cards */}
      <div style={S.statsGrid}>
        <StatCard label="Account"    value={displayEmail} small />
        <StatCard label="Plan"       value={planLabel}  color={profile?.plan === "free" ? "#64748b" : "#0ea5e9"} />
        <StatCard label="Credits"    value={profile?.credits_remaining ?? 0} />
        <StatCard label="ICPs"       value={icpCount}   color="#7c3aed" />
        <StatCard label="Searches"   value={searchCount} />
        <StatCard
          label="Onboarding"
          value={profile?.onboarding_completed ? "Complete" : "Pending"}
          color={profile?.onboarding_completed ? "#16a34a" : "#d97706"}
        />
      </div>

      {/* Quick links */}
      <div style={S.quickGrid}>
        <QuickLink
          href="/dashboard/icp"
          icon="🎯"
          title="ICP Builder"
          desc={icpCount > 0 ? `${icpCount} profile${icpCount !== 1 ? "s" : ""} saved` : "Define your ideal customer"}
          cta="Open ICP Builder →"
        />
        <QuickLink
          href="/dashboard/searches"
          icon="🔍"
          title="Lead Searches"
          desc={searchCount > 0 ? `${searchCount} search${searchCount !== 1 ? "es" : ""} submitted` : "Request qualified B2B leads"}
          cta="Open Lead Searches →"
        />
      </div>

      {/* Recent searches */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>Recent Searches</span>
          {searchCount > 0 && (
            <Link href="/dashboard/searches" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>
              View all →
            </Link>
          )}
        </div>

        {recentSearches.length === 0 ? (
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>🔍</div>
            <div style={S.emptyTitle}>No lead searches yet</div>
            <div style={S.emptySub}>
              {icpCount === 0
                ? "Start by creating an ICP, then submit a lead search request."
                : "You have ICPs ready. Submit your first lead search request."}
            </div>
            <Link
              href={icpCount === 0 ? "/dashboard/icp" : "/dashboard/searches"}
              style={S.ctaLink}
            >
              {icpCount === 0 ? "→ Create your first ICP" : "→ Create Lead Search"}
            </Link>
          </div>
        ) : (
          <>
            <div style={S.tableHeader}>
              <span style={{ ...S.col, flex: 3 }}>Search</span>
              <span style={{ ...S.col, flex: 1 }}>Leads</span>
              <span style={{ ...S.col, flex: 1 }}>Status</span>
              <span style={{ ...S.col, flex: 1.5 }}>Date</span>
              <span style={{ ...S.col, flex: 1 }}></span>
            </div>
            {recentSearches.map(s => (
              <div key={s.id} style={S.tableRow}>
                <span style={{ ...S.col, flex: 3, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
                <span style={{ ...S.col, flex: 1, color: "#64748b" }}>{s.requested_lead_count}</span>
                <span style={{ ...S.col, flex: 1 }}><StatusBadge status={s.status} /></span>
                <span style={{ ...S.col, flex: 1.5, color: "#94a3b8", fontSize: "0.78rem" }}>
                  {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span style={{ ...S.col, flex: 1 }}>
                  <Link href={`/dashboard/searches/${s.id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" }}>
                    View →
                  </Link>
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Plan upgrade hint (only for free plan) */}
      {profile?.plan === "free" && (
        <div style={{ ...S.upgradeHint, marginTop: "1.25rem" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.875rem" }}>Ready to get leads?</div>
          <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            Purchase a batch from the{" "}
            <Link href="/demo-pipeline" style={{ color: "#0ea5e9", fontWeight: 600, textDecoration: "none" }}>
              pricing page
            </Link>{" "}
            to get started.
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color = "#0f172a", small }: { label: string; value: string | number; color?: string; small?: boolean }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ color, fontSize: small ? "0.85rem" : "1.5rem", fontWeight: small ? 500 : 800, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

function QuickLink({ href, icon, title, desc, cta }: { href: string; icon: string; title: string; desc: string; cta: string }) {
  return (
    <Link href={href} style={S.quickCard}>
      <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{icon}</div>
      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem", marginBottom: "0.25rem" }}>{title}</div>
      <div style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "0.75rem", flex: 1 }}>{desc}</div>
      <div style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 700 }}>{cta}</div>
    </Link>
  );
}

// ─── Plan display labels ──────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free:     "Free",
  sample:   "Sample ($7)",
  starter:  "Starter ($29)",
  standard: "Standard ($79)",
  pro:      "Pro ($149)",
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  pageTitle: { color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" } as React.CSSProperties,
  pageSub:   { color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.875rem" } as React.CSSProperties,

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "1.25rem" } as React.CSSProperties,
  statCard:  { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" } as React.CSSProperties,
  statLabel: { color: "#64748b", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: "0.4rem" },

  quickGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.25rem" } as React.CSSProperties,
  quickCard: {
    display: "flex", flexDirection: "column" as const,
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem",
    padding: "1.25rem 1.5rem", textDecoration: "none",
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  section:       { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  sectionHeader: { padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
  sectionTitle:  { fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" } as React.CSSProperties,

  emptyState: { padding: "2.5rem 2rem", textAlign: "center" as const },
  emptyIcon:  { fontSize: "2rem", marginBottom: "0.75rem" } as React.CSSProperties,
  emptyTitle: { color: "#0f172a", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" } as React.CSSProperties,
  emptySub:   { color: "#64748b", fontSize: "0.825rem", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 1rem" } as React.CSSProperties,

  tableHeader: { display: "flex", padding: "0.625rem 1.25rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" } as React.CSSProperties,
  tableRow:    { display: "flex", padding: "0.875rem 1.25rem", alignItems: "center", borderBottom: "1px solid #f8fafc" } as React.CSSProperties,
  col:         { fontSize: "0.8rem", color: "#64748b", fontWeight: 600, paddingRight: "0.75rem" } as React.CSSProperties,

  ctaLink: { display: "inline-block", color: "#0ea5e9", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" } as React.CSSProperties,

  upgradeHint: { background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.75rem", padding: "1rem 1.25rem" } as React.CSSProperties,
  errorBox:    { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", color: "#dc2626", fontSize: "0.85rem", lineHeight: 1.5 } as React.CSSProperties,

  btnSecondary: { background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  btnGhost:     { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
};
