"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface Company {
  id: string; name: string; domain: string | null; website_url: string | null; industry: string | null;
  region: string | null; country: string | null; companyType: string;
  first_seen_at: string | null; last_seen_at: string | null; observation_count: number | null;
}
interface EventRow { id: string; type: string; claim: string | null; date: string | null; observedAt: string; hasSource: boolean; }
interface SourceRow { id: string; url: string | null; type: string; publishedAt: string | null; retrievedAt: string | null; }
interface Detail { company: Company; events: EventRow[]; sources: SourceRow[]; }

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "1rem" };
const label: React.CSSProperties = { fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const th: React.CSSProperties = { textAlign: "left", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", padding: "0.5rem 0.6rem", borderBottom: "1px solid #e2e8f0" };
const td: React.CSSProperties = { fontSize: "0.85rem", padding: "0.5rem 0.6rem", borderBottom: "1px solid #f1f5f9", color: "#0f172a", verticalAlign: "top" };
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function VaultCompanyDetail() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const res = await adminFetch(`/api/admin/vault/${id}`);
    if (!res.ok) { setError(res.status === 404 ? "Company not found." : res.status === 401 || res.status === 403 ? "Admin sign-in required." : `Failed to load (HTTP ${res.status}).`); setLoading(false); return; }
    setD(await res.json()); setLoading(false);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const c = d?.company;
  return (
    <AdminLayout>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1rem" }}>
        <Link href="/admin/vault" style={{ color: "#64748b", fontSize: "0.8rem", textDecoration: "none" }}>← Vault</Link>
        {error && <div style={{ ...card, borderColor: "#fca5a5", color: "#b91c1c", marginTop: "0.6rem" }}>{error}</div>}
        {loading && <div style={{ marginTop: "0.6rem", color: "#64748b" }}>Loading…</div>}

        {c && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: "0.5rem 0 0.1rem" }}>{c.name}</h1>
            <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1rem" }}>
              {c.companyType}{c.industry ? ` · ${c.industry}` : ""}{c.country ? ` · ${c.country}` : ""}
              {c.domain && <> · <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{c.domain}</a></>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.6rem", marginBottom: "1.2rem" }}>
              <div style={card}><div style={label}>First Seen</div><div style={{ fontWeight: 600, marginTop: 4 }}>{fmt(c.first_seen_at)}</div></div>
              <div style={card}><div style={label}>Last Seen</div><div style={{ fontWeight: 600, marginTop: 4 }}>{fmt(c.last_seen_at)}</div></div>
              <div style={card}><div style={label}>Observations</div><div style={{ fontWeight: 600, marginTop: 4 }}>{c.observation_count ?? 1}</div></div>
              <div style={card}><div style={label}>Material Events</div><div style={{ fontWeight: 600, marginTop: 4 }}>{d?.events.length ?? 0}</div></div>
              <div style={card}><div style={label}>Sources</div><div style={{ fontWeight: 600, marginTop: 4 }}>{d?.sources.length ?? 0}</div></div>
            </div>

            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>Material Events</h2>
            <div style={{ ...card, padding: 0, overflowX: "auto", marginBottom: "1.2rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={th}>Event Date</th><th style={th}>Type</th><th style={th}>Claim</th><th style={th}>Sourced</th></tr></thead>
                <tbody>
                  {(d?.events ?? []).length === 0 && <tr><td style={td} colSpan={4}>No material events recorded.</td></tr>}
                  {d?.events.map(e => (
                    <tr key={e.id}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(e.date)}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{e.type}</td>
                      <td style={td}>{e.claim || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                      <td style={td}>{e.hasSource ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>Sources</h2>
            <div style={{ ...card, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={th}>Source</th><th style={th}>Type</th><th style={th}>Published</th><th style={th}>Retrieved</th></tr></thead>
                <tbody>
                  {(d?.sources ?? []).length === 0 && <tr><td style={td} colSpan={4}>No sources recorded.</td></tr>}
                  {d?.sources.map(s => (
                    <tr key={s.id}>
                      <td style={td}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", wordBreak: "break-all" }}>{s.url}</a> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{s.type}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(s.publishedAt)}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(s.retrievedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
