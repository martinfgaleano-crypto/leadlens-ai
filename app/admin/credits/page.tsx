"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface CustomerRow {
  user_id:         string;
  credit_balance:  number;
  lifetime_credits: number;
  updated_at:      string;
  profiles:        { email: string } | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function BalanceBadge({ value }: { value: number }) {
  const color = value >= 100 ? "#16a34a" : value >= 20 ? "#d97706" : "#dc2626";
  return (
    <span style={{
      background: color + "18", color, fontWeight: 700, fontSize: "0.82rem",
      padding: "0.2rem 0.6rem", borderRadius: "1rem", border: `1px solid ${color}30`,
    }}>
      {value}
    </span>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

const S = {
  header:  { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" } as React.CSSProperties,
  h1:      { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 } as React.CSSProperties,
  card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  table:   { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.85rem" },
  th:      { textAlign: "left" as const, padding: "0.65rem 1rem", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0" },
  td:      { padding: "0.8rem 1rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" as const },
};

export default function AdminCreditsPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);

  useEffect(() => {
    adminFetch("/api/admin/credits")
      .then(r => r.ok ? r.json() : null)
      .then((d: { customers: CustomerRow[] } | null) => {
        if (d) { setCustomers(d.customers); setTotal(d.customers.length); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div style={S.header}>
        <h1 style={S.h1}>Credits</h1>
        <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{total} customers</span>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Customer</th>
              <th style={S.th}>Current Balance</th>
              <th style={S.th}>Lifetime Credits</th>
              <th style={S.th}>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>No customers yet.</td></tr>
            ) : (
              customers.map(c => (
                <tr
                  key={c.user_id}
                  onClick={() => { window.location.href = `/admin/credits/${c.user_id}`; }}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>
                      {c.profiles?.email ?? <span style={{ color: "#94a3b8" }}>—</span>}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.1rem" }}>{c.user_id}</div>
                  </td>
                  <td style={S.td}><BalanceBadge value={c.credit_balance} /></td>
                  <td style={S.td}><span style={{ color: "#64748b" }}>{c.lifetime_credits}</span></td>
                  <td style={S.td}><span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{fmtDate(c.updated_at)}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
