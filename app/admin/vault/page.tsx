"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface CompanyView {
  id: string; name: string; domain: string | null; industry: string | null; country: string | null;
  companyType: string; first_seen_at: string | null; last_seen_at: string | null;
  observation_count: number | null; eventCount: number; sourceCount: number;
}
interface Summary {
  companies: number; events: number; sources: number; countries: number; companyTypes: number;
  newCompanies24h: number; reobserved24h: number; newCompanies7d: number; reobserved7d: number;
  newCompanies30d: number; reobserved30d: number; lastWriteAt: string | null; lastObservationAt: string | null;
  byCountry: Array<{ key: string; count: number }>; byType: Array<{ key: string; count: number }>;
}
interface Resp { summary: Summary; inventory: { items: CompanyView[]; total: number; page: number; pageSize: number; pages: number }; generatedAt?: string; }
interface WinCounts { total: number; last24h: number; last7d: number; last30d: number; last_activity_at: string | null }
interface OpsActivity {
  intelligence_runs: WinCounts & { distinct_runs: number };
  delivered_evaluations: WinCounts & { distinct_analyses: number };
  vault_new_companies: WinCounts;
  generated_at: string;
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.9rem 1rem" };
const label: React.CSSProperties = { fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const metric: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 700, color: "#0f172a" };
const th: React.CSSProperties = { textAlign: "left", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", padding: "0.5rem 0.6rem", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
const td: React.CSSProperties = { fontSize: "0.85rem", padding: "0.5rem 0.6rem", borderBottom: "1px solid #f1f5f9", color: "#0f172a" };
const sel: React.CSSProperties = { padding: "0.4rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: "0.85rem", background: "#fff" };
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" }) : "—";

export default function VaultPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [debouncedQ, country, type]);

  const [ops, setOps] = useState<OpsActivity | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (country) params.set("country", country);
    if (type) params.set("type", type);
    params.set("page", String(page));
    const res = await adminFetch(`/api/admin/vault?${params.toString()}`);
    if (!res.ok) { setError(res.status === 401 || res.status === 403 ? "Admin sign-in required." : `Failed to load (HTTP ${res.status}).`); setLoading(false); return; }
    setData(await res.json()); setLoading(false);
  }, [debouncedQ, country, type, page]);
  useEffect(() => { void load(); }, [load]);
  // Live operational activity (independent, always fresh) — real productive runs + delivered evaluations.
  useEffect(() => { void (async () => {
    try { const r = await adminFetch("/api/admin/operational-activity"); if (r.ok) { const b = await r.json(); setOps(b.activity ?? null); } } catch { /* panel shows unavailable */ }
  })(); }, []);

  const s = data?.summary;
  const inv = data?.inventory;
  const countryOptions = useMemo(() => s?.byCountry.map(c => c.key) ?? [], [s]);
  const typeOptions = useMemo(() => s?.byType.map(c => c.key) ?? [], [s]);

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "1rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem" }}>LeadLens Vault</h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 1rem" }}>
          Reusable account intelligence accumulated automatically from validated LeadLens research.
        </p>

        {error && <div style={{ ...card, borderColor: "#fca5a5", color: "#b91c1c", marginBottom: "1rem" }}>{error}</div>}

        {/* Top metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <div style={card}><div style={label}>Companies</div><div style={metric}>{s?.companies ?? "—"}</div></div>
          <div style={card}><div style={label}>Material Events</div><div style={metric}>{s?.events ?? "—"}</div></div>
          <div style={card}><div style={label}>Sources</div><div style={metric}>{s?.sources ?? "—"}</div></div>
          <div style={card}><div style={label}>Countries</div><div style={metric}>{s?.countries ?? "—"}</div></div>
          <div style={card}><div style={label}>Company Types</div><div style={metric}>{s?.companyTypes ?? "—"}</div></div>
        </div>
        {/* Vault growth */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "0.6rem", marginBottom: "0.4rem" }}>
          <div style={card}><div style={label}>New · 24h</div><div style={metric}>{s?.newCompanies24h ?? "—"}</div></div>
          <div style={card}><div style={label}>New · 7d</div><div style={metric}>{s?.newCompanies7d ?? "—"}</div></div>
          <div style={card}><div style={label}>New · 30d</div><div style={metric}>{s?.newCompanies30d ?? "—"}</div></div>
          <div style={card}><div style={label}>Re-observed · 7d</div><div style={metric}>{s?.reobserved7d ?? "—"}</div></div>
          <div style={card}><div style={label}>Re-observed · 30d</div><div style={metric}>{s?.reobserved30d ?? "—"}</div></div>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.72rem", margin: "0 0 1rem" }}>
          Last new company: <strong style={{ color: "#475569" }}>{fmtDate(s?.lastWriteAt ?? null)}</strong> · last observation: <strong style={{ color: "#475569" }}>{fmtDate(s?.lastObservationAt ?? null)}</strong>{data?.generatedAt ? ` · refreshed ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}
        </p>

        {/* Live operational activity — actual productive runs + delivered evaluations (canonical tables) */}
        <div style={{ ...card, marginBottom: "1rem", background: "#f8fafc" }}>
          <div style={{ ...label, marginBottom: "0.5rem" }}>Operational activity (live) {ops?.generated_at ? `· refreshed ${new Date(ops.generated_at).toLocaleTimeString()}` : ""}</div>
          {!ops ? <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Loading live activity… (unavailable if the operational sources cannot be read)</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.6rem" }}>
              <div><div style={label}>Intelligence runs</div><div style={metric}>{ops.intelligence_runs.distinct_runs}</div><div style={{ fontSize: "0.72rem", color: "#64748b" }}>24h {ops.intelligence_runs.last24h} · 7d {ops.intelligence_runs.last7d} · 30d {ops.intelligence_runs.last30d}</div><div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>last {fmtDate(ops.intelligence_runs.last_activity_at)}</div></div>
              <div><div style={label}>Delivered evaluations</div><div style={metric}>{ops.delivered_evaluations.total}</div><div style={{ fontSize: "0.72rem", color: "#64748b" }}>24h {ops.delivered_evaluations.last24h} · 7d {ops.delivered_evaluations.last7d} · 30d {ops.delivered_evaluations.last30d}</div><div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{ops.delivered_evaluations.distinct_analyses} distinct runs</div></div>
              <div><div style={label}>Vault new (30d)</div><div style={metric}>{ops.vault_new_companies.last30d}</div><div style={{ fontSize: "0.72rem", color: "#64748b" }}>24h {ops.vault_new_companies.last24h} · 7d {ops.vault_new_companies.last7d} · total {ops.vault_new_companies.total}</div><div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>last {fmtDate(ops.vault_new_companies.last_activity_at)}</div></div>
            </div>
          )}
        </div>

        {/* Composition */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
          <div style={card}>
            <div style={{ ...label, marginBottom: "0.4rem" }}>By Country</div>
            {(s?.byCountry ?? []).slice(0, 8).map(c => <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "0.15rem 0" }}><span>{c.key}</span><strong>{c.count}</strong></div>)}
            {!s && <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>…</div>}
          </div>
          <div style={card}>
            <div style={{ ...label, marginBottom: "0.4rem" }}>By Company Type</div>
            {(s?.byType ?? []).slice(0, 8).map(c => <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "0.15rem 0" }}><span>{c.key}</span><strong>{c.count}</strong></div>)}
            {!s && <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>…</div>}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company or domain…" style={{ ...sel, minWidth: 240, flex: 1 }} />
          <select value={country} onChange={e => setCountry(e.target.value)} style={sel}>
            <option value="">All countries</option>
            {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} style={sel}>
            <option value="">All types</option>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Inventory */}
        <div style={{ ...card, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr>
              <th style={th}>Company</th><th style={th}>Type</th><th style={th}>Industry</th><th style={th}>Country</th>
              <th style={th}>First Seen</th><th style={th}>Last Seen</th><th style={th}>Obs.</th><th style={th}>Events</th><th style={th}>Sources</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td style={td} colSpan={9}>Loading…</td></tr>}
              {!loading && inv?.items.length === 0 && <tr><td style={td} colSpan={9}>No companies match.</td></tr>}
              {!loading && inv?.items.map(c => (
                <tr key={c.id}>
                  <td style={td}><Link href={`/admin/vault/${c.id}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>{c.name}</Link>{c.domain && <div style={{ color: "#94a3b8", fontSize: "0.72rem" }}>{c.domain}</div>}</td>
                  <td style={td}>{c.companyType}</td>
                  <td style={td}>{c.industry || <span style={{ color: "#cbd5e1" }}>Unknown</span>}</td>
                  <td style={td}>{c.country || <span style={{ color: "#cbd5e1" }}>Unknown</span>}</td>
                  <td style={td}>{fmtDate(c.first_seen_at)}</td>
                  <td style={td}>{fmtDate(c.last_seen_at)}</td>
                  <td style={td}>{c.observation_count ?? 1}</td>
                  <td style={td}>{c.eventCount}</td>
                  <td style={td}>{c.sourceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {inv && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.6rem", fontSize: "0.85rem", color: "#475569" }}>
            <span>{inv.total === 0 ? "0" : `${(inv.page - 1) * inv.pageSize + 1}–${Math.min(inv.page * inv.pageSize, inv.total)}`} of {inv.total}</span>
            <span style={{ display: "flex", gap: "0.5rem" }}>
              <button disabled={inv.page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={sel}>Previous</button>
              <span style={{ padding: "0.4rem 0" }}>Page {inv.page} / {inv.pages}</span>
              <button disabled={inv.page >= inv.pages} onClick={() => setPage(p => p + 1)} style={sel}>Next</button>
            </span>
          </div>
        )}

        <p style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "1rem" }}>
          Companies and material events accrete automatically from productive Intelligence runs — no manual intake required.
          Human review is optional calibration and does not block productive Intelligence.
          {" "}<Link href="/admin/intelligence/review" style={{ color: "#64748b" }}>Calibration queue →</Link>
        </p>
      </div>
    </AdminLayout>
  );
}
