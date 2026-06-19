"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

type Order = {
  id: string;
  external_order_id: string | null;
  customer_email: string;
  customer_name: string | null;
  plan: string;
  amount_cents: number;
  status: string;
  intake_status: string;
  delivery_status: string;
  payment_provider: string;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    paid:            { bg: "#dcfce7", color: "#15803d" },
    delivered:       { bg: "#dcfce7", color: "#15803d" },
    complete:        { bg: "#dcfce7", color: "#15803d" },
    received:        { bg: "#dbeafe", color: "#1d4ed8" },
    pending:         { bg: "#fef3c7", color: "#92400e" },
    in_progress:     { bg: "#e0e7ff", color: "#4338ca" },
    processing:      { bg: "#e0e7ff", color: "#4338ca" },
    error:           { bg: "#fee2e2", color: "#dc2626" },
    failed:          { bg: "#fee2e2", color: "#dc2626" },
    refunded:        { bg: "#f1f5f9", color: "#475569" },
    cancelled:       { bg: "#f1f5f9", color: "#475569" },
    disputed:        { bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.55rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PLAN_COLOR: Record<string, string> = {
  sample: "#7c3aed", starter: "#0ea5e9", standard: "#0284c7", pro: "#0f172a",
};

export default function OrdersListPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter]     = useState("");

  useEffect(() => {
    adminFetch("/api/admin/orders?limit=100")
      .then(async (r) => {
        if (!r.ok) { setError(`Error ${r.status}`); setLoading(false); return; }
        const d = await r.json();
        const list = (d.orders ?? []) as Order[];
        setOrders(list);
        setFiltered(list);
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  useEffect(() => {
    let out = orders;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(o =>
        o.customer_email.toLowerCase().includes(q) ||
        (o.customer_name ?? "").toLowerCase().includes(q) ||
        (o.external_order_id ?? "").toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter) out = out.filter(o => o.status === statusFilter || o.delivery_status === statusFilter);
    if (planFilter)   out = out.filter(o => o.plan === planFilter);
    setFiltered(out);
  }, [search, statusFilter, planFilter, orders]);

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Orders</h1>
          <p style={{ color: "#64748b", margin: "0.2rem 0 0", fontSize: "0.875rem" }}>{orders.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <input
          placeholder="Search email, name, order ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: "1 1 220px", padding: "0.6rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0f172a", fontFamily: "inherit", outline: "none" }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "0.6rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0f172a", background: "#fff", fontFamily: "inherit", outline: "none" }}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending delivery</option>
          <option value="in_progress">In progress</option>
          <option value="delivered">Delivered</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          style={{ padding: "0.6rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0f172a", background: "#fff", fontFamily: "inherit", outline: "none" }}>
          <option value="">All plans</option>
          <option value="sample">Sample ($7)</option>
          <option value="starter">Starter ($29)</option>
          <option value="standard">Standard ($79)</option>
          <option value="pro">Pro ($149)</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading && <div style={{ padding: "2rem", color: "#64748b", fontSize: "0.875rem" }}>Loading orders...</div>}
        {error   && <div style={{ padding: "2rem", color: "#dc2626", fontSize: "0.875rem" }}>{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.4rem" }}>No orders found</div>
            <div style={{ fontSize: "0.8rem" }}>
              {orders.length === 0
                ? "No orders yet. Configure Lemon Squeezy webhook to auto-create orders on payment."
                : "Try adjusting your search or filters."}
            </div>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Date", "Customer", "Plan", "Amount", "Payment", "Intake", "Delivery", ""].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}>{o.customer_email}</div>
                    {o.customer_name && <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{o.customer_name}</div>}
                    {o.external_order_id && <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontFamily: "monospace" }}>LS: {o.external_order_id}</div>}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.8rem", color: PLAN_COLOR[o.plan] ?? "#0f172a", textTransform: "capitalize" }}>{o.plan}</span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#16a34a" }}>
                    ${(o.amount_cents / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}><StatusBadge status={o.status} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><StatusBadge status={o.intake_status} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><StatusBadge status={o.delivery_status} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link href={`/admin/orders/${o.id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" }}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
