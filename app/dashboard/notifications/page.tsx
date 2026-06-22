"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/app/dashboard/_components/DashboardShell";
import { getSupabaseClient } from "@/lib/supabase/client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Notification {
  id:         string;
  type:       string;
  title:      string;
  message:    string;
  is_read:    boolean;
  created_at: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const TYPE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  search_completed: { color: "#16a34a", bg: "#f0fdf4", label: "Completed" },
  search_failed:    { color: "#dc2626", bg: "#fef2f2", label: "Failed"    },
  credits_low:      { color: "#d97706", bg: "#fffbeb", label: "Credits"   },
  credits_added:    { color: "#0ea5e9", bg: "#f0f9ff", label: "Credits"   },
};

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLES[type] ?? { color: "#64748b", bg: "#f1f5f9", label: type };
  return (
    <span style={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: "0.65rem", padding: "0.15rem 0.55rem", borderRadius: "1rem", border: `1px solid ${s.color}25`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function NotificationsPage() {
  const router = useRouter();

  const [userEmail, setEmail]     = useState("");
  const [token, setToken]         = useState<string | null>(null);
  const [userId, setUserId]       = useState<string | null>(null);
  const [notifications, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnread]  = useState(0);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [filter, setFilter]       = useState<"all" | "unread">("all");
  const [loading, setLoading]     = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const PER_PAGE = 20;

  // Auth init
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) { router.replace("/login"); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setEmail(session.user.email ?? "");
      setToken(session.access_token);
      setUserId(session.user.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (p: number, f: "all" | "unread", tok: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE), filter: f });
      const res = await fetch(`/api/notifications?${params}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const d = await res.json() as { notifications: Notification[]; total: number; unread_count: number };
        setNotifs(d.notifications);
        setTotal(d.total);
        setUnread(d.unread_count);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) load(page, filter, token);
  }, [token, page, filter, load]);

  async function markRead(id: string) {
    if (!token) return;
    const res = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    }
  }

  async function markAllRead() {
    if (!token || !userId) return;
    setMarkingAll(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", userId)
          .eq("is_read", false);
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnread(0);
      }
    } finally {
      setMarkingAll(false);
    }
  }

  function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) supabase.auth.signOut();
    router.replace("/login");
  }

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <DashboardShell email={userEmail} onLogout={handleLogout}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ display: "inline-block", marginTop: "0.25rem", background: "#0ea5e9", color: "#fff", borderRadius: "99px", padding: "0.1rem 0.6rem", fontSize: "0.72rem", fontWeight: 700 }}>
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            style={{ padding: "0.4rem 0.9rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.8rem", fontWeight: 600, color: "#475569", cursor: markingAll ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {markingAll ? "Marking…" : "Mark all read"}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["all", "unread"] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            style={{
              padding: "0.35rem 0.9rem",
              borderRadius: "0.5rem",
              border: "1px solid",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              borderColor: filter === f ? "#0ea5e9" : "#e2e8f0",
              background:  filter === f ? "#f0f9ff" : "#fff",
              color:       filter === f ? "#0369a1" : "#64748b",
            }}
          >
            {f === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>Loading…</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </div>
        ) : (
          notifications.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "1rem 1.25rem",
                borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none",
                background: n.is_read ? "#fff" : "#f0f9ff",
              }}
            >
              {/* Unread dot */}
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.is_read ? "transparent" : "#0ea5e9", flexShrink: 0, marginTop: "0.4rem" }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{n.title}</span>
                  <TypeBadge type={n.type} />
                </div>
                <div style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>{n.message}</div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.35rem" }}>{fmtDate(n.created_at)}</div>
              </div>

              {/* Mark read */}
              {!n.is_read && (
                <button
                  onClick={() => markRead(n.id)}
                  style={{ padding: "0.25rem 0.65rem", border: "1px solid #bae6fd", borderRadius: "0.4rem", fontSize: "0.72rem", fontWeight: 600, color: "#0369a1", background: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem" }}>
          <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{total} total — page {page} of {totalPages}</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: "0.3rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.8rem", background: page <= 1 ? "#f8fafc" : "#fff", color: page <= 1 ? "#94a3b8" : "#1e293b", cursor: page <= 1 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              ← Prev
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: "0.3rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.8rem", background: page >= totalPages ? "#f8fafc" : "#fff", color: page >= totalPages ? "#94a3b8" : "#1e293b", cursor: page >= totalPages ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
