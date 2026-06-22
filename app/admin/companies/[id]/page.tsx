"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Company {
  id:                 string;
  company_name:       string;
  normalized_company: string;
  domain:             string | null;
  industry:           string | null;
  company_size:       string | null;
  contacts_count:     number;
  times_seen:         number;
  average_score:      number | null;
  top_score:          number | null;
  countries_seen:     string[];
  titles_seen:        string[];
  first_seen:         string;
  last_seen:          string;
  created_at:         string;
}

interface Contact {
  id:               string;
  contact_name:     string | null;
  title:            string | null;
  normalized_title: string | null;
  seniority:        string | null;
  email:            string | null;
  country:          string | null;
  opportunity_score: number | null;
  buyer_fit:        string | null;
  temperature:      string | null;
  linkedin_url:     string | null;
}

interface RecentSearch {
  id:         string;
  name:       string;
  created_at: string;
  status:     string;
}

interface SimilarCompany {
  id:                 string;
  company_name:       string;
  normalized_company: string;
  industry:           string | null;
  contacts_count:     number;
  top_score:          number | null;
  average_score:      number | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TempBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const map: Record<string, [string, string]> = {
    Hot:  ["#dc2626", "#fef2f2"],
    Warm: ["#d97706", "#fffbeb"],
    Cold: ["#475569", "#f1f5f9"],
  };
  const [color, bg] = map[value] ?? ["#475569", "#f1f5f9"];
  return (
    <span style={{ background: bg, color, fontWeight: 700, fontSize: "0.72rem", padding: "0.2rem 0.5rem", borderRadius: "1rem", border: `1px solid ${color}25` }}>
      {value}
    </span>
  );
}

function FitBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const map: Record<string, [string, string]> = {
    "Excellent fit": ["#16a34a", "#f0fdf4"],
    "Good fit":      ["#0ea5e9", "#f0f9ff"],
    "Weak fit":      ["#94a3b8", "#f8fafc"],
  };
  const [color, bg] = map[value] ?? ["#94a3b8", "#f8fafc"];
  return (
    <span style={{ background: bg, color, fontWeight: 600, fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: "1rem", border: `1px solid ${color}30` }}>
      {value}
    </span>
  );
}

function ScoreBadge({ value }: { value: number | null; }) {
  if (value == null) return <span style={{ color: "#94a3b8" }}>—</span>;
  const color = value >= 70 ? "#16a34a" : value >= 50 ? "#d97706" : "#dc2626";
  return (
    <span style={{ background: color + "18", color, fontWeight: 700, fontSize: "0.8rem", padding: "0.2rem 0.55rem", borderRadius: "1rem", border: `1px solid ${color}30` }}>
      {value}
    </span>
  );
}

/* ── Shared styles ───────────────────────────────────────────────────────────── */

const S = {
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "1rem" } as React.CSSProperties,
  cardTitle: { fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "1rem" },
  row: { display: "flex", gap: "0.4rem 0", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9" } as React.CSSProperties,
  label: { fontSize: "0.82rem", color: "#64748b" },
  value: { fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", textAlign: "right" as const },
  tag: { display: "inline-block", background: "#f1f5f9", color: "#475569", fontSize: "0.75rem", fontWeight: 500, padding: "0.2rem 0.6rem", borderRadius: "1rem", margin: "0.2rem" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.83rem" },
  th: { textAlign: "left" as const, padding: "0.6rem 0.75rem", fontWeight: 700, color: "#64748b", fontSize: "0.71rem", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0" },
  td: { padding: "0.65rem 0.75rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" as const },
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ ...S.row, borderBottom: "1px solid #f8fafc" }}>
      <span style={S.label}>{label}</span>
      <span style={S.value}>{value ?? "—"}</span>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany]           = useState<Company | null>(null);
  const [contacts, setContacts]         = useState<Contact[]>([]);
  const [recentSearches, setSearches]   = useState<RecentSearch[]>([]);
  const [similar, setSimilar]           = useState<SimilarCompany[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    adminFetch(`/api/admin/companies/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Not found")))
      .then((data: { company: Company; top_contacts: Contact[]; recent_searches: RecentSearch[]; similar: SimilarCompany[] }) => {
        setCompany(data.company);
        setContacts(data.top_contacts ?? []);
        setSearches(data.recent_searches ?? []);
        setSimilar(data.similar ?? []);
      })
      .catch(() => setError("Failed to load company."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ textAlign: "center", color: "#94a3b8", padding: "3rem", fontSize: "0.95rem" }}>
          Loading company profile…
        </div>
      </AdminLayout>
    );
  }

  if (error || !company) {
    return (
      <AdminLayout>
        <div style={{ color: "#dc2626", padding: "2rem" }}>{error ?? "Company not found."}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1.25rem", fontSize: "0.82rem", color: "#94a3b8" }}>
        <Link href="/admin/companies" style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}>
          ← Companies
        </Link>
      </div>

      {/* Page title */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
          {company.company_name}
        </h1>
        {company.domain && (
          <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>{company.domain}</div>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

        {/* ── Left column ───────────────────────────────────────────────────────── */}
        <div>
          {/* Company Profile */}
          <div style={S.card}>
            <div style={S.cardTitle}>Company Profile</div>
            <InfoRow label="Official name"      value={company.company_name} />
            <InfoRow label="Normalized name"    value={company.normalized_company} />
            <InfoRow label="Domain"             value={company.domain} />
            <InfoRow label="Industry"           value={company.industry} />
            <InfoRow label="Company size"       value={company.company_size} />
          </div>

          {/* Top Contacts */}
          <div style={S.card}>
            <div style={S.cardTitle}>Top Contacts ({contacts.length})</div>
            {contacts.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>No contacts found in Vault.</p>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Name</th>
                    <th style={S.th}>Title</th>
                    <th style={S.th}>Seniority</th>
                    <th style={S.th}>Email</th>
                    <th style={S.th}>Country</th>
                    <th style={S.th}>Score</th>
                    <th style={S.th}>Fit</th>
                    <th style={S.th}>Temp</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id}
                      onClick={() => { window.location.href = `/admin/vault/${c.id}`; }}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={S.td}><span style={{ fontWeight: 600 }}>{c.contact_name ?? "—"}</span></td>
                      <td style={S.td}><span style={{ color: "#64748b", fontSize: "0.8rem" }}>{c.normalized_title ?? c.title ?? "—"}</span></td>
                      <td style={S.td}><span style={{ color: "#475569", fontSize: "0.8rem" }}>{c.seniority ?? "—"}</span></td>
                      <td style={S.td}><span style={{ color: "#64748b", fontSize: "0.8rem" }}>{c.email ?? "—"}</span></td>
                      <td style={S.td}><span style={{ color: "#64748b" }}>{c.country ?? "—"}</span></td>
                      <td style={S.td}><ScoreBadge value={c.opportunity_score} /></td>
                      <td style={S.td}><FitBadge value={c.buyer_fit} /></td>
                      <td style={S.td}><TempBadge value={c.temperature} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Recent Searches ({recentSearches.length})</div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Search name</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSearches.map(s => (
                    <tr key={s.id}
                      onClick={() => { window.location.href = `/admin/searches/${s.id}`; }}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={S.td}><span style={{ fontWeight: 600, color: "#0ea5e9" }}>{s.name}</span></td>
                      <td style={S.td}><span style={{ color: "#64748b", fontSize: "0.8rem" }}>{s.status}</span></td>
                      <td style={S.td}><span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{fmtDate(s.created_at)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────────────────── */}
        <div>
          {/* Company Intelligence */}
          <div style={S.card}>
            <div style={S.cardTitle}>Company Intelligence</div>
            <InfoRow label="Times seen"       value={company.times_seen} />
            <InfoRow label="Total contacts"   value={company.contacts_count} />
            <InfoRow label="Average score"    value={<ScoreBadge value={company.average_score} />} />
            <InfoRow label="Top score"        value={<ScoreBadge value={company.top_score} />} />
            <InfoRow label="First seen"       value={fmtDate(company.first_seen)} />
            <InfoRow label="Last seen"        value={fmtDate(company.last_seen)} />
          </div>

          {/* Countries Seen */}
          {company.countries_seen.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Countries Seen ({company.countries_seen.length})</div>
              <div>
                {company.countries_seen.map(c => (
                  <span key={c} style={S.tag}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Titles Seen */}
          {company.titles_seen.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Titles Seen ({company.titles_seen.length})</div>
              <div>
                {company.titles_seen.map(t => (
                  <span key={t} style={S.tag}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Similar Companies */}
          {similar.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Similar Companies</div>
              {similar.map(c => (
                <div
                  key={c.id}
                  onClick={() => { window.location.href = `/admin/companies/${c.id}`; }}
                  style={{
                    padding: "0.65rem 0", borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.85rem" }}>{c.company_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {c.industry ?? "Unknown industry"} · {c.contacts_count} contacts
                    </div>
                  </div>
                  <ScoreBadge value={c.top_score} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
