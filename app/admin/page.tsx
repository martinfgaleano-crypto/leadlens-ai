"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminLayout from "./_components/AdminLayout";
import { adminFetch, clearAdminToken } from "@/lib/admin/admin-client";

type Order = { id: string; plan: string; amount_cents: number; customer_email: string; status: string; delivery_status: string; created_at: string };
type Job   = { id: string; order_id: string; plan: string; status: string; progress: number; created_at: string };
type Settings = {
  supabase_configured: boolean;
  admin_token_configured: boolean;
  dev_bypass_active: boolean;
  demo_mode: boolean;
  anthropic_configured: boolean;
  lemonsqueezy_webhook_secret_configured: boolean;
};

function badge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    paid:             { bg: "#dcfce7", color: "#15803d" },
    delivered:        { bg: "#dcfce7", color: "#15803d" },
    completed:        { bg: "#dcfce7", color: "#15803d" },
    pending:          { bg: "#fef3c7", color: "#92400e" },
    awaiting_intake:  { bg: "#fef3c7", color: "#92400e" },
    intake_received:  { bg: "#dbeafe", color: "#1d4ed8" },
    processing:       { bg: "#e0e7ff", color: "#4338ca" },
    in_progress:      { bg: "#e0e7ff", color: "#4338ca" },
    error:            { bg: "#fee2e2", color: "#dc2626" },
    failed:           { bg: "#fee2e2", color: "#dc2626" },
    refunded:         { bg: "#f1f5f9", color: "#475569" },
    cancelled:        { bg: "#f1f5f9", color: "#475569" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.2rem 0.6rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StatCard({ label, value, color = "#0f172a", sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" }}>
      <div style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.4rem" }}>{label}</div>
      <div style={{ color, fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.3rem" }}>{sub}</div>}
    </div>
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

export default function AdminOverviewPage() {
  const router = useRouter();
  const [orders, setOrders]     = useState<Order[]>([]);
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsError, setSettingsError] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [authError, setAuthError] = useState(false);
  const [seeding, setSeeding]   = useState(false);
  const [seedResult, setSeedResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    // Load settings independently so a single failed request doesn't poison the others
    const fetchSettings = adminFetch("/api/admin/settings")
      .then(r => {
        if (r.ok) return r.json().then((d: Settings) => setSettings(d));
        setSettingsError(true);
      })
      .catch(() => setSettingsError(true));

    const fetchData = Promise.all([
      adminFetch("/api/admin/orders?limit=50"),
      adminFetch("/api/admin/jobs?limit=50"),
    ]).then(async ([oRes, jRes]) => {
      if (oRes.status === 401 || oRes.status === 403) {
        setAuthError(true);
        return;
      }
      const [oData, jData] = await Promise.all([oRes.json(), jRes.json()]);
      setOrders(oData.orders ?? []);
      setJobs(jData.jobs ?? []);
    }).catch(() => {
      // Network or parse error — leave empty arrays, don't crash
    });

    Promise.all([fetchSettings, fetchData]).finally(() => setLoading(false));
  }, []);

  async function seedOrder() {
    setSeeding(true);
    setSeedResult(null);
    const res = await adminFetch("/api/admin/dev/seed-order", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setSeeding(false);
    if (res.ok) {
      setSeedResult({ ok: true, msg: `Created order ${d.order_id?.slice(0, 8)}… (${d.plan}) for ${d.customer_email}` });
      // Reload data
      const [oRes, jRes] = await Promise.all([
        adminFetch("/api/admin/orders?limit=50"),
        adminFetch("/api/admin/jobs?limit=50"),
      ]);
      if (oRes.ok && jRes.ok) {
        const [oData, jData] = await Promise.all([oRes.json(), jRes.json()]);
        setOrders(oData.orders ?? []);
        setJobs(jData.jobs ?? []);
      }
    } else {
      setSeedResult({ ok: false, msg: d.error ?? "Seed failed" });
    }
  }

  if (loading) return <AdminLayout><div style={{ color: "#64748b", padding: "2rem" }}>Loading dashboard...</div></AdminLayout>;

  if (authError) {
    return (
      <AdminLayout>
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1.5rem 2rem", color: "#dc2626", marginBottom: "1rem" }}>
          Invalid or expired admin token. Please log in again.
        </div>
        <button onClick={() => { clearAdminToken(); router.replace("/admin/login"); }}
          style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}>
          Back to login
        </button>
      </AdminLayout>
    );
  }

  // Derived stats
  const totalRevenue   = orders.reduce((s, o) => s + o.amount_cents, 0) / 100;
  const pendingDelivery = orders.filter(o => o.delivery_status === "pending").length;
  const inProgress     = jobs.filter(j => j.status === "processing").length;
  const jobsCompleted  = jobs.filter(j => j.status === "completed" || j.status === "delivered").length;
  const jobsFailed     = jobs.filter(j => j.status === "error").length;

  // Only surface warnings when we KNOW something is false — never when settings is null/unavailable
  const supabaseMissing   = settings !== null && settings.admin_token_configured !== undefined && !settings.supabase_configured;
  const adminTokenMissing = settings !== null && settings.admin_token_configured === false;
  const lsWebhookMissing  = settings !== null && !settings.lemonsqueezy_webhook_secret_configured;
  const devBypassActive   = settings?.dev_bypass_active === true;

  // All critical items OK (token, Supabase, LS webhook)
  const allCoreOk = settings !== null &&
    settings.admin_token_configured &&
    settings.supabase_configured &&
    settings.lemonsqueezy_webhook_secret_configured;

  const hasWarnings = supabaseMissing || adminTokenMissing || lsWebhookMissing;

  const recentOrders = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const recentJobs   = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Overview</h1>
        <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>LeadLens beta operations dashboard</p>
      </div>

      {/* Settings load error (non-blocking) */}
      {settingsError && (
        <div style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "0.875rem 1.25rem", marginBottom: "1.25rem", fontSize: "0.8rem", color: "#64748b" }}>
          Configuration status unavailable — could not reach /api/admin/settings. Check server logs.
        </div>
      )}

      {/* Dev bypass notice */}
      {devBypassActive && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: 700, color: "#713f12", fontSize: "0.8rem", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dev bypass active</div>
          <div style={{ color: "#713f12", fontSize: "0.8rem", lineHeight: 1.5 }}>
            <code style={{ background: "rgba(0,0,0,0.08)", padding: "0.1rem 0.3rem", borderRadius: "0.25rem", fontFamily: "monospace" }}>ADMIN_SECRET_TOKEN</code> is not set — all admin routes are open without authentication. Add it to <code style={{ background: "rgba(0,0,0,0.08)", padding: "0.1rem 0.3rem", borderRadius: "0.25rem", fontFamily: "monospace" }}>.env.local</code>, then <strong>restart the dev server</strong> to enable token protection.
          </div>
        </div>
      )}

      {/* Config warnings — only shown for explicitly missing items */}
      {hasWarnings && !devBypassActive && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.8rem", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Configuration warnings</div>
          {supabaseMissing  && <div style={{ color: "#92400e", fontSize: "0.8rem", marginBottom: "0.3rem" }}>Supabase not configured — orders will not be persisted. Add NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.</div>}
          {adminTokenMissing && <div style={{ color: "#92400e", fontSize: "0.8rem", marginBottom: "0.3rem" }}>ADMIN_SECRET_TOKEN not set — dashboard is unprotected. Add it to .env.local and restart the dev server.</div>}
          {lsWebhookMissing  && <div style={{ color: "#92400e", fontSize: "0.8rem" }}>Lemon Squeezy webhook secret not configured — orders will not be auto-created on payment. Add LEMONSQUEEZY_WEBHOOK_SECRET.</div>}
          <div style={{ marginTop: "0.625rem" }}>
            <Link href="/admin/settings" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600 }}>View full configuration checklist →</Link>
          </div>
        </div>
      )}

      {/* All core OK banner */}
      {allCoreOk && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.75rem", padding: "0.875rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "#15803d", fontSize: "1.1rem", fontWeight: 800 }}>✓</span>
          <span style={{ color: "#15803d", fontSize: "0.875rem", fontWeight: 600 }}>Core admin configuration ready — token, Supabase, and Lemon Squeezy webhook are all configured.</span>
        </div>
      )}

      {/* Dev tools — only visible in development, never in production */}
      {IS_DEV && settings?.supabase_configured && (
        <div style={{ background: "#fafafa", border: "1px dashed #d1d5db", borderRadius: "0.75rem", padding: "0.875rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dev only</span>
          <button onClick={seedOrder} disabled={seeding}
            style={{ background: seeding ? "#e2e8f0" : "#0f172a", color: seeding ? "#94a3b8" : "#fff", border: "none", borderRadius: "0.4rem", padding: "0.45rem 0.875rem", fontWeight: 700, fontSize: "0.78rem", cursor: seeding ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {seeding ? "Creating..." : "Seed test order"}
          </button>
          {seedResult && (
            <span style={{ fontSize: "0.78rem", color: seedResult.ok ? "#15803d" : "#dc2626" }}>{seedResult.msg}</span>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard label="Total orders"   value={orders.length} />
        <StatCard label="Revenue (est)"  value={`$${totalRevenue.toFixed(0)}`} color="#16a34a" sub="gross USD" />
        <StatCard label="Pending"        value={pendingDelivery} color="#d97706" />
        <StatCard label="In progress"    value={inProgress} color="#4338ca" />
        <StatCard label="Completed"      value={jobsCompleted} color="#15803d" />
        <StatCard label="Errors"         value={jobsFailed} color={jobsFailed > 0 ? "#dc2626" : "#0f172a"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Recent orders */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Recent orders</span>
            <Link href="/admin/orders" style={{ color: "#0ea5e9", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none" }}>View all →</Link>
          </div>
          {recentOrders.length === 0
            ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ color: "#64748b", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem" }}>No orders yet</div>
                <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Orders will appear here after Lemon Squeezy webhook creates them on payment.</div>
              </div>
            )
            : recentOrders.map(o => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} style={{ display: "block", padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: "0.8rem", fontWeight: 600 }}>{o.customer_email}</div>
                    <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: "0.1rem" }}>{o.plan} · ${(o.amount_cents / 100).toFixed(0)} · {new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  {badge(o.delivery_status)}
                </div>
              </Link>
            ))}
        </div>

        {/* Recent jobs */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Recent jobs</span>
            <Link href="/admin/jobs" style={{ color: "#0ea5e9", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none" }}>View all →</Link>
          </div>
          {recentJobs.length === 0
            ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ color: "#64748b", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem" }}>No jobs yet</div>
                <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Jobs are created automatically when orders are received.</div>
              </div>
            )
            : recentJobs.map(j => (
              <Link key={j.id} href={`/admin/jobs/${j.id}`} style={{ display: "block", padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace" }}>{j.id.slice(0, 8)}…</div>
                    <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: "0.1rem" }}>{j.plan} · {new Date(j.created_at).toLocaleDateString()}</div>
                  </div>
                  {badge(j.status)}
                </div>
              </Link>
            ))}
        </div>
      </div>
    </AdminLayout>
  );
}
