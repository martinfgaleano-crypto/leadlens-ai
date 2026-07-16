"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/app/dashboard/_components/DashboardShell";
import { getSupabaseClient } from "@/lib/supabase/client";
import { buildTimeline } from "@/lib/activity/build-timeline";
import type { ActivityEvent } from "@/lib/activity/build-timeline";

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

interface CreditTransaction {
  id:          string;
  type:        string;
  amount:      number;
  description: string | null;
  created_at:  string;
}

interface CompletedSearch {
  id:                      string;
  process_generated_count: number | null;
  process_finished_at:     string | null;
  created_at:              string;
}

interface DashboardNotification {
  id:         string;
  type:       string;
  title:      string;
  message:    string;
  is_read:    boolean;
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

interface MonitorOverviewRow {
  search_id: string;
  name: string;
  total_runs: number;
  latest_run_status: string | null;
  latest_completed_at: string | null;
  latest_report_job_id: string | null;
  has_processing_run: boolean;
  has_onboarding_link?: boolean;
  has_comparison: boolean;
}

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile]             = useState<Profile | null>(null);
  const [userEmail, setEmail]             = useState<string | null>(null);
  const [icpCount, setIcpCount]           = useState(0);
  const [searchCount, setSearchCount]     = useState(0);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [creditBalance, setCreditBalance]   = useState<number | null>(null);
  const [creditLifetime, setCreditLifetime] = useState<number | null>(null);
  const [creditTxns, setCreditTxns]         = useState<CreditTransaction[]>([]);
  const [completedSearches, setCompletedSearches] = useState<CompletedSearch[]>([]);
  const [totalCreditsSpent, setTotalCreditsSpent] = useState(0);
  const [dashNotifs, setDashNotifs]   = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [timeline, setTimeline]       = useState<ActivityEvent[]>([]);
  const [monitors, setMonitors]       = useState<MonitorOverviewRow[]>([]);
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

      // Monitor overview — best-effort, section hides on failure
      try {
        const res = await fetch("/api/monitor/overview", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && !cancelled) {
          const d = await res.json().catch(() => null);
          if (d?.monitors) setMonitors(d.monitors as MonitorOverviewRow[]);
        }
      } catch { /* best-effort */ }

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

      // Fetch all data in parallel — notifications query is gracefully degraded
      // (returns { data: null } if migration 014 hasn't been run yet)
      const [icpRes, searchRes, recentRes, creditsRes, txnRes, completedRes, consumeRes, notifRes] = await Promise.all([
        supabase.from("icps").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("lead_searches").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("lead_searches")
          .select("id, name, status, requested_lead_count, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("customer_credits")
          .select("credit_balance, lifetime_credits")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase.from("credit_transactions")
          .select("id, type, amount, description, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("lead_searches")
          .select("id, process_generated_count, process_finished_at, created_at")
          .eq("user_id", uid)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("credit_transactions")
          .select("amount")
          .eq("user_id", uid)
          .eq("type", "consume"),
        supabase.from("notifications")
          .select("id, type, title, message, is_read, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!cancelled) {
        setIcpCount(icpRes.count ?? 0);
        setSearchCount(searchRes.count ?? 0);

        const recent = (recentRes.data ?? []) as RecentSearch[];
        setRecentSearches(recent);

        const cred = creditsRes.data as { credit_balance: number; lifetime_credits: number } | null;
        setCreditBalance(cred?.credit_balance ?? 0);
        setCreditLifetime(cred?.lifetime_credits ?? 0);

        const txns = (txnRes.data ?? []) as CreditTransaction[];
        setCreditTxns(txns.slice(0, 5));

        const completed = (completedRes.data ?? []) as CompletedSearch[];
        setCompletedSearches(completed);

        const spent = ((consumeRes.data ?? []) as { amount: number }[])
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        setTotalCreditsSpent(spent);

        const notifs = (notifRes.data ?? []) as DashboardNotification[];
        setDashNotifs(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);

        // Build unified activity timeline
        const tl = buildTimeline(
          recent.map(s => ({ id: s.id, name: s.name, status: s.status, created_at: s.created_at })),
          txns.map(t => ({ id: t.id, type: t.type, amount: t.amount, description: t.description, created_at: t.created_at })),
          notifs.map(n => ({ id: n.id, type: n.type, title: n.title, created_at: n.created_at })),
          10,
        );
        setTimeline(tl);

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
      {/* Workspace hero */}
      <div data-customer-vault-delivery-version="customer-vault-delivery-v1" style={{ marginBottom: "2rem", background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 65%, #0c4a6e 100%)", borderRadius: "1rem", padding: "1.75rem 2rem", color: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7dd3fc", marginBottom: "0.4rem" }}>
          Your LeadLens Workspace
        </div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          Find the accounts worth contacting — and know exactly why.
        </h1>
        <p style={{ color: "rgba(224,242,254,0.75)", margin: "0.45rem 0 0", fontSize: "0.875rem", maxWidth: 560 }}>
          Monitor your target market, review account intelligence, and improve every run with feedback.
        </p>
      </div>

      {/* Account + plan stat cards */}
      <div style={S.statsGrid}>
        <StatCard label="Account"    value={displayEmail} small />
        <StatCard label="Plan"       value={planLabel}  color={profile?.plan === "free" ? "#64748b" : "#0ea5e9"} />
        <StatCard label="Credits"    value={profile?.credits_remaining ?? 0} />
        <StatCard label="ICPs"       value={icpCount}   color="#7c3aed" />
        <StatCard label="Monitors"   value={searchCount} />
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
          title="Monitors"
          desc={searchCount > 0 ? `${searchCount} monitor${searchCount !== 1 ? "s" : ""} created` : "Track a target market for opportunities"}
          cta="Open Monitors →"
        />
      </div>

      {/* Monitor command center */}
      {monitors.length > 0 && (() => {
        const reportsReady   = monitors.filter(m => m.latest_report_job_id != null);
        const processing     = monitors.filter(m => m.has_processing_run);
        const setupIncomplete = monitors.filter(m => m.has_onboarding_link === false);
        const needsAttention = monitors.filter(m => !m.has_processing_run && m.latest_run_status === "failed" && !m.latest_report_job_id);
        const latestReport = reportsReady
          .slice()
          .sort((a, b) => (b.latest_completed_at ?? "").localeCompare(a.latest_completed_at ?? ""))[0] ?? null;
        return (
          <div style={{ ...S.section, marginBottom: "1.25rem" }}>
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>Monitors</span>
              {latestReport?.latest_report_job_id && (
                <span style={{ display: "inline-flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Link href={`/results/${latestReport.latest_report_job_id}`} style={{ background: "#0ea5e9", color: "#fff", borderRadius: "0.45rem", padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.78rem", textDecoration: "none" }}>
                    Open latest report →
                  </Link>
                  <Link href={`/results/${latestReport.latest_report_job_id}/brief`} style={{ background: "#0f172a", color: "#fff", borderRadius: "0.45rem", padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.78rem", textDecoration: "none" }}>
                    Institutional brief →
                  </Link>
                </span>
              )}
            </div>
            <div style={{ padding: "1rem 1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
              {[
                { label: "Monitors", value: monitors.length, color: "#0f172a" },
                { label: "Reports ready", value: reportsReady.length, color: "#15803d" },
                { label: "Processing", value: processing.length, color: "#075985" },
                { label: "Needs attention", value: needsAttention.length, color: needsAttention.length > 0 ? "#dc2626" : "#64748b" },
                { label: "Setup incomplete", value: setupIncomplete.length, color: setupIncomplete.length > 0 ? "#d97706" : "#64748b" },
              ].map(item => (
                <div key={item.label} style={{ textAlign: "center", padding: "0.75rem 0.5rem", background: "#f8fafc", borderRadius: "0.5rem" }}>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.2rem" }}>{item.label}</div>
                </div>
              ))}
            </div>
            {(() => {
              const suggestion = setupIncomplete.length > 0
                ? { icon: "⚙️", text: `Complete setup on ${setupIncomplete.length} monitor${setupIncomplete.length === 1 ? "" : "s"} to unlock reports.`, href: "/dashboard/searches" }
                : processing.length > 0
                  ? { icon: "⏳", text: "A report is being generated — it will appear here when ready.", href: "/dashboard/searches" }
                  : latestReport?.latest_report_job_id
                    ? { icon: "📊", text: "Your latest report is ready to review.", href: `/results/${latestReport.latest_report_job_id}` }
                    : { icon: "🚀", text: "Run your first monitor to get your first opportunity report.", href: "/dashboard/searches" };
              return (
                <Link href={suggestion.href} style={{ textDecoration: "none" }}>
                  <div style={{ margin: "0 1.25rem 0.85rem", padding: "0.65rem 0.9rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.55rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "1rem" }}>{suggestion.icon}</span>
                    <div>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.08em" }}>Next suggested action</div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#075985" }}>{suggestion.text}</div>
                    </div>
                  </div>
                </Link>
              );
            })()}
            <div style={{ padding: "0 1.25rem 1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Monthly cadence is manual for now — open a monitor and use “Run monitor” when you want a fresh report. Automatic scheduling is not enabled yet.
            </div>
          </div>
        );
      })()}

      {/* Credits card */}
      <div style={{ ...S.section, marginBottom: "1.25rem" }}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>Credits</span>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Lifetime: {creditLifetime ?? 0}</span>
        </div>
        <div style={{ padding: "1rem 1.25rem" }}>
          {/* Balance */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: creditTxns.length > 0 ? "1rem" : 0 }}>
            <div>
              <div style={{ fontSize: "2.5rem", fontWeight: 900, color: (creditBalance ?? 0) >= 50 ? "#16a34a" : (creditBalance ?? 0) >= 10 ? "#d97706" : "#dc2626", lineHeight: 1 }}>
                {creditBalance ?? 0}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.2rem" }}>available credits</div>
            </div>
          </div>
          {/* Recent transactions */}
          {creditTxns.length > 0 && (
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Recent Activity
              </div>
              {creditTxns.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid #f8fafc", fontSize: "0.8rem" }}>
                  <span style={{ color: "#64748b" }}>{t.description ?? t.type}</span>
                  <span style={{ fontWeight: 700, color: t.amount >= 0 ? "#16a34a" : "#dc2626" }}>
                    {t.amount >= 0 ? "+" : ""}{t.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search statistics */}
      {searchCount > 0 && (() => {
        const avgLeads = completedSearches.length > 0
          ? Math.round(
              completedSearches.reduce((s, r) => s + (r.process_generated_count ?? 0), 0)
              / completedSearches.length
            )
          : null;
        const lastCompleted = completedSearches[0]?.process_finished_at ?? null;
        return (
          <div style={{ ...S.section, marginBottom: "1.25rem" }}>
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>Search Statistics</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0", borderBottom: "none" }}>
              {[
                { label: "Total Searches",     value: searchCount },
                { label: "Completed",          value: completedSearches.length },
                { label: "Credits Spent",      value: totalCreditsSpent },
                { label: "Avg Leads",          value: avgLeads ?? "—" },
              ].map((item, i) => (
                <div key={item.label} style={{ padding: "1rem 1.25rem", borderRight: i < 3 ? "1px solid #f1f5f9" : "none" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: "0.3rem" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>{item.value}</div>
                </div>
              ))}
            </div>
            {lastCompleted && (
              <div style={{ padding: "0.6rem 1.25rem", borderTop: "1px solid #f1f5f9", fontSize: "0.75rem", color: "#94a3b8" }}>
                Last completed: {new Date(lastCompleted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Notifications widget */}
      <div style={{ ...S.section, marginBottom: "1.25rem" }}>
        <div style={S.sectionHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={S.sectionTitle}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{ background: "#0ea5e9", color: "#fff", borderRadius: "99px", padding: "0.05rem 0.5rem", fontSize: "0.65rem", fontWeight: 800 }}>
                {unreadCount}
              </span>
            )}
          </div>
          <Link href="/dashboard/notifications" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>
            View all →
          </Link>
        </div>
        {dashNotifs.length === 0 ? (
          <div style={{ padding: "1rem 1.25rem", color: "#94a3b8", fontSize: "0.82rem" }}>No notifications yet.</div>
        ) : (
          dashNotifs.slice(0, 3).map((n, i) => {
            const notifColors: Record<string, string> = {
              search_completed: "#16a34a",
              search_failed:    "#dc2626",
              credits_low:      "#d97706",
              credits_added:    "#0ea5e9",
            };
            const dot = notifColors[n.type] ?? "#94a3b8";
            return (
              <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: i < 2 && i < dashNotifs.length - 1 ? "1px solid #f8fafc" : "none", background: n.is_read ? "#fff" : "#f0f9ff" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: n.is_read ? "#e2e8f0" : dot, flexShrink: 0, marginTop: "0.35rem" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: "0.82rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.1rem" }}>
                    {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recent Activity timeline */}
      {timeline.length > 0 && (
        <div style={{ ...S.section, marginBottom: "1.25rem" }}>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>Recent Activity</span>
          </div>
          <div style={{ padding: "0.25rem 0" }}>
            {timeline.map(ev => {
              const actColors: Record<string, string> = {
                search_completed: "#16a34a",
                search_failed:    "#dc2626",
                credits_consumed: "#d97706",
                credits_added:    "#0ea5e9",
                notification:     "#7c3aed",
              };
              const color = actColors[ev.type] ?? "#94a3b8";
              const meta = ev.meta ?? {};
              const sub =
                ev.type === "search_completed"  ? `${meta.leads ?? 0} account${meta.leads !== 1 ? "s" : ""} delivered` :
                ev.type === "search_failed"      ? "Search failed" :
                ev.type === "credits_consumed"   ? `-${meta.amount ?? 0} credits` :
                ev.type === "credits_added"      ? `+${meta.amount ?? 0} credits` :
                "";
              return (
                <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 1.25rem", borderBottom: "1px solid #f8fafc" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "0.82rem", color: "#1e293b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                      {ev.title}
                    </span>
                    {sub && <span style={{ fontSize: "0.72rem", color: color, fontWeight: 600 }}>{sub}</span>}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(ev.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            <div style={S.emptyTitle}>No monitors yet</div>
            <div style={S.emptySub}>
              {icpCount === 0
                ? "Start by defining a target profile, then create your first monitor."
                : "Your target profile is ready. Create your first monitor."}
            </div>
            <Link
              href={icpCount === 0 ? "/dashboard/icp" : "/dashboard/searches"}
              style={S.ctaLink}
            >
              {icpCount === 0 ? "→ Define your target profile" : "→ Create your first monitor"}
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
