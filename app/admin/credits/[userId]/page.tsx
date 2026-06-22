"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Profile {
  id:         string;
  email:      string | null;
  full_name:  string | null;
  plan:       string;
  created_at: string;
}

interface Balance {
  credit_balance:   number;
  lifetime_credits: number;
}

interface Transaction {
  id:          string;
  type:        string;
  amount:      number;
  description: string | null;
  search_id:   string | null;
  created_at:  string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, [string, string]> = {
    grant:   ["#16a34a", "#f0fdf4"],
    refund:  ["#0ea5e9", "#f0f9ff"],
    manual:  ["#7c3aed", "#f5f3ff"],
    consume: ["#dc2626", "#fef2f2"],
  };
  const [color, bg] = map[type] ?? ["#64748b", "#f1f5f9"];
  return (
    <span style={{ background: bg, color, fontWeight: 700, fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: "1rem", border: `1px solid ${color}25`, textTransform: "capitalize" as const }}>
      {type}
    </span>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

const S = {
  card:      { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "1rem" } as React.CSSProperties,
  cardTitle: { fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "1rem" },
  row:       { display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #f8fafc" } as React.CSSProperties,
  label:     { fontSize: "0.82rem", color: "#64748b" },
  value:     { fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" },
  table:     { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.83rem" },
  th:        { textAlign: "left" as const, padding: "0.6rem 0.75rem", fontWeight: 700, color: "#64748b", fontSize: "0.71rem", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0" },
  td:        { padding: "0.7rem 0.75rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" as const },
  input:     { width: "100%", padding: "0.6rem 0.8rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#1e293b", outline: "none", boxSizing: "border-box" as const },
  btn:       { background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.65rem 1.5rem", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  btnDisabled: { background: "#7dd3fc", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.65rem 1.5rem", fontWeight: 700, fontSize: "0.875rem", cursor: "not-allowed", fontFamily: "inherit" } as React.CSSProperties,
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={S.value}>{value ?? "—"}</span>
    </div>
  );
}

export default function AdminCreditDetailPage() {
  const { userId } = useParams<{ userId: string }>();

  const [profile, setProfile]       = useState<Profile | null>(null);
  const [balance, setBalance]       = useState<Balance | null>(null);
  const [history, setHistory]       = useState<Transaction[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Grant form state
  const [grantAmount, setGrantAmount]   = useState("");
  const [grantDesc, setGrantDesc]       = useState("");
  const [granting, setGranting]         = useState(false);
  const [grantMsg, setGrantMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  function loadData() {
    setLoading(true);
    adminFetch(`/api/admin/credits/${userId}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Not found")))
      .then((d: { profile: Profile; balance: Balance; history: Transaction[] }) => {
        setProfile(d.profile);
        setBalance(d.balance);
        setHistory(d.history);
      })
      .catch(() => setError("Failed to load customer credits."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(grantAmount, 10);
    if (!amount || amount <= 0) { setGrantMsg({ ok: false, text: "Enter a valid positive amount." }); return; }
    if (!grantDesc.trim()) { setGrantMsg({ ok: false, text: "Description is required." }); return; }

    setGranting(true);
    setGrantMsg(null);
    try {
      const res = await adminFetch("/api/admin/credits/grant", {
        method:  "POST",
        body:    JSON.stringify({ user_id: userId, amount, description: grantDesc.trim() }),
      });
      const data = await res.json() as { success?: boolean; credit_balance?: number; error?: string };
      if (res.ok && data.success) {
        setGrantMsg({ ok: true, text: `Granted ${amount} credits. New balance: ${data.credit_balance}.` });
        setGrantAmount("");
        setGrantDesc("");
        loadData();
      } else {
        setGrantMsg({ ok: false, text: data.error ?? "Grant failed." });
      }
    } catch {
      setGrantMsg({ ok: false, text: "Network error." });
    } finally {
      setGranting(false);
    }
  }

  if (loading) {
    return <AdminLayout><div style={{ color: "#94a3b8", padding: "3rem", textAlign: "center" }}>Loading…</div></AdminLayout>;
  }
  if (error || !profile) {
    return <AdminLayout><div style={{ color: "#dc2626", padding: "2rem" }}>{error ?? "Not found."}</div></AdminLayout>;
  }

  const balColor = (balance?.credit_balance ?? 0) >= 100 ? "#16a34a" : (balance?.credit_balance ?? 0) >= 20 ? "#d97706" : "#dc2626";

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1.25rem", fontSize: "0.82rem", color: "#94a3b8" }}>
        <Link href="/admin/credits" style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}>
          ← Credits
        </Link>
      </div>

      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: "0 0 1.5rem" }}>
        {profile.email ?? profile.id}
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem", alignItems: "start" }}>

        {/* ── Left: history ─────────────────────────────────────────────────── */}
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Transaction History ({history.length})</div>
            {history.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>No transactions yet.</p>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Amount</th>
                    <th style={S.th}>Description</th>
                    <th style={S.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(t => (
                    <tr key={t.id}>
                      <td style={S.td}><TypeBadge type={t.type} /></td>
                      <td style={S.td}>
                        <span style={{ fontWeight: 700, color: t.amount >= 0 ? "#16a34a" : "#dc2626" }}>
                          {t.amount >= 0 ? "+" : ""}{t.amount}
                        </span>
                      </td>
                      <td style={S.td}><span style={{ color: "#64748b" }}>{t.description ?? "—"}</span></td>
                      <td style={S.td}><span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{fmtDate(t.created_at)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: summary + grant form ───────────────────────────────────── */}
        <div>
          {/* Customer info */}
          <div style={S.card}>
            <div style={S.cardTitle}>Customer</div>
            <InfoRow label="Email"      value={profile.email} />
            <InfoRow label="Full name"  value={profile.full_name} />
            <InfoRow label="Plan"       value={profile.plan} />
            <InfoRow label="Member since" value={fmtDate(profile.created_at)} />
          </div>

          {/* Credit balance */}
          <div style={S.card}>
            <div style={S.cardTitle}>Credits</div>
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "3rem", fontWeight: 900, color: balColor, lineHeight: 1 }}>
                {balance?.credit_balance ?? 0}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.35rem" }}>available credits</div>
            </div>
            <InfoRow label="Lifetime credits" value={balance?.lifetime_credits ?? 0} />
          </div>

          {/* Grant form */}
          <div style={S.card}>
            <div style={S.cardTitle}>Grant Credits</div>
            <form onSubmit={handleGrant}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                  Amount
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={grantAmount}
                  onChange={e => setGrantAmount(e.target.value)}
                  placeholder="e.g. 100"
                  required
                  style={S.input}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                  Description
                </label>
                <input
                  type="text"
                  value={grantDesc}
                  onChange={e => setGrantDesc(e.target.value)}
                  placeholder="e.g. Manual top-up for support request"
                  required
                  style={S.input}
                />
              </div>
              {grantMsg && (
                <div style={{
                  padding: "0.6rem 0.8rem", borderRadius: "0.5rem", marginBottom: "0.75rem", fontSize: "0.82rem",
                  background: grantMsg.ok ? "#f0fdf4" : "#fee2e2",
                  color: grantMsg.ok ? "#15803d" : "#dc2626",
                  border: `1px solid ${grantMsg.ok ? "#bbf7d0" : "#fca5a5"}`,
                }}>
                  {grantMsg.text}
                </div>
              )}
              <button type="submit" disabled={granting} style={granting ? S.btnDisabled : S.btn}>
                {granting ? "Granting…" : "Grant Credits"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
