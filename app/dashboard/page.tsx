"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [userEmail, setEmail]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = getSupabaseClient();

      // No anon client = Supabase not configured
      if (!supabase) {
        if (!cancelled) setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.");
        if (!cancelled) setLoading(false);
        return;
      }

      // Check auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const uid   = session.user.id;
      const email = session.user.email ?? null;
      if (!cancelled) setEmail(email);

      // Fetch profile — create it lazily if it doesn't exist yet
      const { data: existing, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 = "no rows found" — that's expected on first login
        if (!cancelled) setError("Could not load profile. Please refresh.");
        if (!cancelled) setLoading(false);
        return;
      }

      if (existing) {
        if (!cancelled) { setProfile(existing as Profile); setLoading(false); }
        return;
      }

      // Profile doesn't exist yet (first login after email confirmation, or
      // profile creation failed during signup) — create it now.
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({ id: uid, email: email ?? "" })
        .select()
        .single();

      if (createError) {
        if (!cancelled) setError("Could not create your profile. Please try refreshing.");
        if (!cancelled) setLoading(false);
        return;
      }

      if (!cancelled) { setProfile(created as Profile); setLoading(false); }
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
      <div style={S.root}>
        <div style={S.sidebar}>
          <SidebarBrand />
        </div>
        <main style={S.main}>
          <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading your dashboard…</div>
        </main>
      </div>
    );
  }

  // ─── Error (unconfigured or auth failure) ────────────────────────────────

  if (error) {
    return (
      <div style={S.root}>
        <div style={S.sidebar}>
          <SidebarBrand />
        </div>
        <main style={S.main}>
          <div style={S.errorBox}>{error}</div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
            <button onClick={() => window.location.reload()} style={S.btnSecondary}>Retry</button>
            <button onClick={handleLogout} style={S.btnGhost}>Log out</button>
          </div>
        </main>
      </div>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  const planLabel = PLAN_LABELS[profile?.plan ?? "free"] ?? profile?.plan ?? "Free";
  const displayEmail = profile?.email ?? userEmail ?? "—";

  return (
    <div style={S.root}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <SidebarBrand />
        <nav style={S.nav}>
          <div style={S.navSection}>Workspace</div>
          <NavItem href="/dashboard" label="Dashboard" active />
          {/* Future nav items added in Phase 2+ */}
          <NavItem href="/dashboard/searches" label="Lead Searches" active={false} disabled />
          <NavItem href="/dashboard/account" label="Account" active={false} disabled />
        </nav>
        <div style={S.sidebarFooter}>
          <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayEmail}
          </div>
          <button onClick={handleLogout} style={S.logoutBtn}>Log out</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={S.main}>
        {/* Page header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={S.pageTitle}>Dashboard</h1>
          <p style={S.pageSub}>Welcome to LeadLens — your B2B lead generation workspace.</p>
        </div>

        {/* Profile summary cards */}
        <div style={S.statsGrid}>
          <StatCard label="Account" value={displayEmail} small />
          <StatCard label="Plan" value={planLabel} color={profile?.plan === "free" ? "#64748b" : "#0ea5e9"} />
          <StatCard label="Credits" value={profile?.credits_remaining ?? 0} />
          <StatCard
            label="Onboarding"
            value={profile?.onboarding_completed ? "Complete" : "Pending"}
            color={profile?.onboarding_completed ? "#16a34a" : "#d97706"}
          />
        </div>

        {/* Lead searches — empty state */}
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>Lead Searches</span>
          </div>
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>🔍</div>
            <div style={S.emptyTitle}>No lead searches yet</div>
            <div style={S.emptySub}>
              Create your first search by defining your Ideal Customer Profile.
              LeadLens will find qualified B2B leads and write personalized outreach for each one.
            </div>
            {/* CTA — disabled until Phase 2 implements ICP builder */}
            <button
              disabled
              title="ICP builder coming in the next release"
              style={S.ctaDisabled}
            >
              + Create Lead Search
              <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 400, marginTop: "0.2rem", opacity: 0.8 }}>
                Coming soon — ICP builder in progress
              </span>
            </button>
          </div>
        </div>

        {/* Plan upgrade hint (only for free plan) */}
        {profile?.plan === "free" && (
          <div style={S.upgradeHint}>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.875rem" }}>Ready to get leads?</div>
              <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                Purchase a batch from the{" "}
                <Link href="/demo-pipeline" style={{ color: "#0ea5e9", fontWeight: 600, textDecoration: "none" }}>
                  pricing page
                </Link>{" "}
                to get started.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarBrand() {
  return (
    <div style={S.brand}>
      <Link href="/dashboard" style={{ textDecoration: "none" }}>
        <span style={S.brandName}>LeadLens</span>
        <span style={S.brandTag}>AI</span>
      </Link>
    </div>
  );
}

function NavItem({ href, label, active, disabled }: { href: string; label: string; active: boolean; disabled?: boolean }) {
  if (disabled) {
    return (
      <div style={{ ...S.navLink, color: "#475569", cursor: "default", opacity: 0.5 }}>
        {label}
        <span style={{ fontSize: "0.6rem", marginLeft: "0.4rem", opacity: 0.7 }}>soon</span>
      </div>
    );
  }
  return (
    <Link href={href} style={{ ...S.navLink, ...(active ? S.navLinkActive : {}) }}>
      {label}
    </Link>
  );
}

function StatCard({ label, value, color = "#0f172a", small }: { label: string; value: string | number; color?: string; small?: boolean }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, color, fontSize: small ? "0.85rem" : "1.5rem", fontWeight: small ? 500 : 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
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
  root: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    background: "#f8fafc",
  } as React.CSSProperties,
  sidebar: {
    width: 220,
    minWidth: 220,
    background: "#0f172a",
    display: "flex",
    flexDirection: "column" as const,
    padding: "1.5rem 0",
    position: "fixed" as const,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
  },
  brand: {
    padding: "0 1.25rem 1.5rem",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: "1rem",
  } as React.CSSProperties,
  brandName: {
    color: "#f0f9ff",
    fontWeight: 800,
    fontSize: "1.05rem",
    letterSpacing: "-0.02em",
  } as React.CSSProperties,
  brandTag: {
    color: "#38bdf8",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    marginLeft: "0.3rem",
  },
  nav: { flex: 1, padding: "0 0.75rem" } as React.CSSProperties,
  navSection: {
    color: "#475569",
    fontSize: "0.625rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "0.5rem 0.5rem 0.25rem",
    marginTop: "0.5rem",
  },
  navLink: {
    display: "block",
    padding: "0.5rem 0.75rem",
    borderRadius: "0.5rem",
    color: "#94a3b8",
    fontWeight: 400,
    fontSize: "0.875rem",
    textDecoration: "none",
    background: "transparent",
    borderLeft: "2px solid transparent",
    marginBottom: "0.125rem",
  } as React.CSSProperties,
  navLinkActive: {
    color: "#f0f9ff",
    fontWeight: 600,
    background: "rgba(14,165,233,0.15)",
    borderLeft: "2px solid #0ea5e9",
  } as React.CSSProperties,
  sidebarFooter: {
    padding: "1rem 1.25rem 0.5rem",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: "auto",
  } as React.CSSProperties,
  logoutBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#94a3b8",
    borderRadius: "0.4rem",
    padding: "0.4rem 0.75rem",
    fontSize: "0.75rem",
    cursor: "pointer",
    width: "100%",
    textAlign: "left" as const,
    fontFamily: "inherit",
  },
  main: {
    marginLeft: 220,
    flex: 1,
    padding: "2rem 2.5rem",
    maxWidth: "calc(100vw - 220px)",
  } as React.CSSProperties,
  pageTitle: {
    color: "#0f172a",
    fontSize: "1.5rem",
    fontWeight: 800,
    margin: 0,
    letterSpacing: "-0.02em",
  } as React.CSSProperties,
  pageSub: {
    color: "#64748b",
    margin: "0.25rem 0 0",
    fontSize: "0.875rem",
  } as React.CSSProperties,
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  } as React.CSSProperties,
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "1.25rem 1.5rem",
  } as React.CSSProperties,
  statLabel: {
    color: "#64748b",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    marginBottom: "0.4rem",
  },
  statValue: {
    lineHeight: 1.2,
  } as React.CSSProperties,
  section: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    overflow: "hidden",
    marginBottom: "1.25rem",
  } as React.CSSProperties,
  sectionHeader: {
    padding: "1rem 1.25rem",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  sectionTitle: {
    fontWeight: 700,
    fontSize: "0.875rem",
    color: "#0f172a",
  } as React.CSSProperties,
  emptyState: {
    padding: "3rem 2rem",
    textAlign: "center" as const,
  },
  emptyIcon: {
    fontSize: "2rem",
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  emptyTitle: {
    color: "#0f172a",
    fontWeight: 700,
    fontSize: "0.95rem",
    marginBottom: "0.5rem",
  } as React.CSSProperties,
  emptySub: {
    color: "#64748b",
    fontSize: "0.825rem",
    lineHeight: 1.6,
    maxWidth: 440,
    margin: "0 auto 1.5rem",
  } as React.CSSProperties,
  ctaDisabled: {
    background: "#e2e8f0",
    color: "#94a3b8",
    border: "none",
    borderRadius: "0.625rem",
    padding: "0.75rem 1.5rem",
    fontWeight: 700,
    fontSize: "0.875rem",
    cursor: "not-allowed",
    fontFamily: "inherit",
    lineHeight: 1.3,
  } as React.CSSProperties,
  upgradeHint: {
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: "0.75rem",
    padding: "1rem 1.25rem",
  } as React.CSSProperties,
  errorBox: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    borderRadius: "0.75rem",
    padding: "1rem 1.25rem",
    color: "#dc2626",
    fontSize: "0.85rem",
    lineHeight: 1.5,
  } as React.CSSProperties,
  btnSecondary: {
    background: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: "0.5rem",
    padding: "0.5rem 1rem",
    fontWeight: 600,
    fontSize: "0.8rem",
    cursor: "pointer",
    fontFamily: "inherit",
  } as React.CSSProperties,
  btnGhost: {
    background: "transparent",
    color: "#64748b",
    border: "1px solid #e2e8f0",
    borderRadius: "0.5rem",
    padding: "0.5rem 1rem",
    fontWeight: 600,
    fontSize: "0.8rem",
    cursor: "pointer",
    fontFamily: "inherit",
  } as React.CSSProperties,
};
