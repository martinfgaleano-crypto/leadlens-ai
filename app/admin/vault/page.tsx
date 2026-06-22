"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultLead {
  id: string;
  company_name: string;
  normalized_company: string | null;
  contact_name: string | null;
  title: string | null;
  normalized_title: string | null;
  email: string | null;
  country: string | null;
  industry: string | null;
  source: string | null;
  times_seen: number;
  lead_score: number | null;
  opportunity_score: number | null;
  temperature: string | null;
  buyer_fit: string | null;
  seniority: string | null;
  created_at: string;
  last_seen: string;
}

interface ListResponse {
  leads: VaultLead[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

interface Stats {
  total: number;
  countries: number;
  industries: number;
  avg_opportunity: number;
  top_score: number;
  repeat_rate: number;
  repeat_count: number;
}

const PER_PAGE = 25;
const TEMPERATURES = ["Hot", "Warm", "Cold"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#cbd5e1" }}>—</span>;
  let bg: string, color: string;
  if      (score >= 90) { bg = "#dcfce7"; color = "#15803d"; }
  else if (score >= 70) { bg = "#dbeafe"; color = "#1d4ed8"; }
  else if (score >= 50) { bg = "#fef9c3"; color = "#854d0e"; }
  else                  { bg = "#f1f5f9"; color = "#64748b"; }
  return (
    <span style={{ display: "inline-block", background: bg, color, borderRadius: 999, padding: "0.15rem 0.55rem", fontSize: "0.72rem", fontWeight: 700, minWidth: 26, textAlign: "center" }}>
      {score}
    </span>
  );
}

function TempPill({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const map: Record<string, { bg: string; color: string }> = {
    Hot:  { bg: "#fee2e2", color: "#dc2626" },
    Warm: { bg: "#fef9c3", color: "#854d0e" },
    Cold: { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = map[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.68rem", fontWeight: 700 }}>
      {value}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.65rem", padding: "1rem 1.25rem", minWidth: 110 }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "0.2rem" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const [leads, setLeads]         = useState<VaultLead[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError]         = useState("");

  // Filters
  const [q, setQ]                     = useState("");
  const [debouncedQ, setDebouncedQ]   = useState("");
  const [country, setCountry]         = useState("");
  const [industry, setIndustry]       = useState("");
  const [temperature, setTemperature] = useState("");

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Load stats once
  useEffect(() => {
    setStatsLoading(true);
    adminFetch("/api/admin/vault/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d as Stats); })
      .finally(() => setStatsLoading(false));
  }, []);

  // Load leads on filter/page change
  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (debouncedQ)   params.set("q", debouncedQ);
    if (country)      params.set("country", country);
    if (industry)     params.set("industry", industry);
    if (temperature)  params.set("temperature", temperature);

    const res = await adminFetch(`/api/admin/vault?${params}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? `Error ${res.status}`);
    } else {
      const d = await res.json() as ListResponse;
      setLeads(d.leads);
      setTotal(d.total);
      setTotalPages(d.total_pages);
    }
    setLoading(false);
  }, [page, debouncedQ, country, industry, temperature]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedQ, country, industry, temperature]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          LeadLens Vault
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.8rem", margin: "0.35rem 0 0" }}>
          Global lead intelligence — every contact ever discovered, deduplicated and enriched.
        </p>
      </div>

      {/* Stats row */}
      {!statsLoading && stats && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <StatCard label="Total leads"   value={stats.total.toLocaleString()} />
          <StatCard label="Countries"     value={stats.countries} />
          <StatCard label="Industries"    value={stats.industries} />
          <StatCard label="Avg opp. score" value={stats.avg_opportunity} />
          <StatCard label="Top score"     value={stats.top_score} />
          <StatCard
            label="Repeat rate"
            value={`${stats.repeat_rate}%`}
            sub={`${stats.repeat_count} seen 2+ times`}
          />
        </div>
      )}
      {statsLoading && (
        <div style={{ marginBottom: "1.5rem", color: "#94a3b8", fontSize: "0.8rem" }}>Loading stats…</div>
      )}

      {/* Filters */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          placeholder="Search company, contact, email…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ flex: "1 1 220px", padding: "0.55rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.45rem", fontSize: "0.875rem", fontFamily: "inherit", outline: "none", color: "#0f172a" }}
        />
        <select value={country} onChange={e => setCountry(e.target.value)} style={selectStyle}>
          <option value="">All countries</option>
          <option value="United States">United States</option>
          <option value="Canada">Canada</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="Australia">Australia</option>
          <option value="Germany">Germany</option>
          <option value="France">France</option>
        </select>
        <select value={industry} onChange={e => setIndustry(e.target.value)} style={selectStyle}>
          <option value="">All industries</option>
          <option value="Technology">Technology</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Finance">Finance</option>
          <option value="Manufacturing">Manufacturing</option>
          <option value="Retail">Retail</option>
        </select>
        <select value={temperature} onChange={e => setTemperature(e.target.value)} style={selectStyle}>
          <option value="">All temperatures</option>
          {TEMPERATURES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(q || country || industry || temperature) && (
          <button
            onClick={() => { setQ(""); setCountry(""); setIndustry(""); setTemperature(""); }}
            style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.65rem", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.85rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>
            Vault Leads {!loading && `(${total.toLocaleString()})`}
          </span>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Read-only · Click row to view profile</span>
        </div>

        {loading ? (
          <div style={{ padding: "3rem 1.25rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
            Loading vault…
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: "3rem 1.25rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🏛️</div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: "0.3rem" }}>
              {total === 0 ? "Vault is empty" : "No results"}
            </div>
            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
              {total === 0
                ? "Vault will populate automatically as searches are processed."
                : "Try adjusting your search or filters."}
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Company", "Contact", "Title", "Country", "Industry", "Source", "Seen", "Lead Score", "Opportunity", "Temp"].map(h => (
                      <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.67rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr
                      key={lead.id}
                      style={{ borderBottom: i < leads.length - 1 ? "1px solid #f1f5f9" : "none", cursor: "pointer" }}
                      onClick={() => window.location.href = `/admin/vault/${lead.id}`}
                    >
                      <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                        {lead.normalized_company ?? lead.company_name}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", fontSize: "0.8rem", color: "#0f172a", whiteSpace: "nowrap" }}>
                        {lead.contact_name ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {lead.normalized_title ?? lead.title ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {lead.country ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {lead.industry ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", fontSize: "0.72rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {lead.source
                          ? <span style={{ background: "#f1f5f9", borderRadius: 999, padding: "0.1rem 0.45rem", fontWeight: 600 }}>{lead.source}</span>
                          : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-block",
                          background: lead.times_seen > 1 ? "#fef9c3" : "#f1f5f9",
                          color:      lead.times_seen > 1 ? "#854d0e" : "#64748b",
                          borderRadius: 999, padding: "0.1rem 0.5rem",
                          fontSize: "0.72rem", fontWeight: 700,
                        }}>
                          {lead.times_seen}×
                        </span>
                      </td>
                      <td style={{ padding: "0.7rem 1rem", whiteSpace: "nowrap" }}>
                        <ScoreBadge score={lead.lead_score} />
                      </td>
                      <td style={{ padding: "0.7rem 1rem", whiteSpace: "nowrap" }}>
                        <ScoreBadge score={lead.opportunity_score} />
                      </td>
                      <td style={{ padding: "0.7rem 1rem", whiteSpace: "nowrap" }}>
                        <TempPill value={lead.temperature} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ ...paginationBtn, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: "0.78rem", color: "#64748b", padding: "0.4rem 0.5rem" }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ ...paginationBtn, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: "0.5rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: "0.45rem",
  fontSize: "0.825rem", background: "#fff", fontFamily: "inherit", outline: "none",
  color: "#374151", minWidth: 130,
};

const paginationBtn: React.CSSProperties = {
  background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "0.4rem",
  padding: "0.4rem 0.85rem", fontSize: "0.78rem", fontWeight: 600,
  color: "#374151", fontFamily: "inherit",
};
