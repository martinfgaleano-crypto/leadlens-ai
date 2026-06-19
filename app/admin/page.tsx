"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminLayout from "./_components/AdminLayout";
import { adminFetch, clearAdminToken } from "@/lib/admin/admin-client";

type Order = { id: string; plan: string; amount_cents: number; customer_email: string; status: string; delivery_status: string; created_at: string };
type Job   = { id: string; order_id: string; plan: string; status: string; progress: number; created_at: string };

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
    <span style={{
      display: "inline-block",
      background: s.bg,
      color: s.color,
      borderRadius: 999,
      padding: "0.2rem 0.6rem",
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.03em",
      textTransform: "uppercase",
    }}>
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

export default function AdminOverviewPage() {
  const router = useRouter();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    Promise.all([
      adminFetch("/api/admin/orders?limit=50"),
      adminFetch("/api/admin/jobs?limit=50"),
      adminFetch("/api/admin/settings"),
    ]).then(async ([oRes, jRes, sRes]) => {
      if (oRes.status === 401 || oRes.status === 403) { setAuthError(true); setLoading(false); return; }
      const [oData, jData, sData] = await Promise.all([oRes.json(), jRes.json(), sRes.json()]);
      setOrders(oData.orders ?? []);
      setJobs(jData.jobs ?? []);
      setSettings(sData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout><div style={{ color: "#64748b", padding: "2rem" }}>Loading dashboard...</div></AdminLayout>;

  if (authError) {
    return (
      <AdminLayout>
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1.5rem 2rem", color: "#dc2626", marginBottom: "1rem" }}>
          Invalid or expired admin token.
        </div>
        <button onClick={() => { clearAdminToken(); router.replace("/admin/login"); }}
          style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}>
          Back to login
        </button>
      </AdminLayout>
    );
  }

  // Derived stats
  const totalRevenue = orders.reduce((s, o) => s + o.amount_cents, 0) / 100;
  const pendingIntake  = orders.filter(o => o.delivery_status === "pending").length;
  const inProgress     = jobs.filter(j => j.status === "processing").length;
  const jobsCompleted  = jobs.filter(j => j.status === "completed" || j.status === "delivered").length;
  const jobsFailed     = jobs.filter(j => j.status === "error").length;

  const supabaseOk = settings?.supabase_configured as boolean;
  const adminOk    = settings?.admin_token_configured as boolean;
  const lsWebhook  = settings?.lemonsqueezy_webhook_secret_configured as boolean;
  const hasWarnings = !supabaseOk || !adminOk || !lsWebhook;

  const recentOrders = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const recentJobs   = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Overview</h1>
        <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>LeadLens beta operations dashboard</p>
      </div>

      {/* Config warnings */}
      {hasWarnings && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.8rem", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Configuration warnings</div>
          {!supabaseOk  && <div style={{ color: "#92400e", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Supabase not configured — orders will not be persisted.</div>}
          {!adminOk     && <div style={{ color: "#92400e", fontSize: "0.8rem", marginBottom: "0.2rem" }}>ADMIN_SECRET_TOKEN not set in env — set it before going to production.</div>}
          {!lsWebhook   && <div style={{ color: "#92400e", fontSize: "0.8rem" }}>Lemon Squeezy webhook secret not configured — orders won't be auto-created on payment.</div>}
          <div style={{ marginTop: "0.5rem" }}>
            <Link href="/admin/settings" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600 }}>View configuration checklist →</Link>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard label="Total orders"  value={orders.length} />
        <StatCard label="Revenue (est)" value={`$${totalRevenue.toFixed(0)}`} color="#16a34a" sub="gross USD" />
        <StatCard label="Pending"       value={pendingIntake} color="#d97706" />
        <StatCard label="In progress"   value={inProgress} color="#4338ca" />
        <StatCard label="Completed"     value={jobsCompleted} color="#15803d" />
        <StatCard label="Errors"        value={jobsFailed} color={jobsFailed > 0 ? "#dc2626" : "#0f172a"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Recent orders */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>Recent orders</span>
            <Link href="/admin/orders" style={{ color: "#0ea5e9", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none" }}>View all →</Link>
          </div>
          {recentOrders.length === 0
            ? <div style={{ padding: "2rem", color: "#94a3b8", fontSize: "0.85rem", textAlign: "center" }}>No orders yet</div>
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
            ? <div style={{ padding: "2rem", color: "#94a3b8", fontSize: "0.85rem", textAlign: "center" }}>No jobs yet</div>
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
