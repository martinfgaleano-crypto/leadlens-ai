"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface OnboardingRequest {
  id:                    string;
  full_name:             string;
  email:                 string;
  company_name:          string;
  website:               string | null;
  country:               string | null;
  linkedin_url:          string | null;
  what_you_sell:         string;
  value_proposition:     string | null;
  ideal_customer:        string | null;
  target_countries:      string[];
  target_industries:     string[];
  target_company_sizes:  string[];
  target_job_titles:     string[];
  buyer_persona:         string | null;
  exclusions:            string | null;
  logo_url:              string | null;
  brand_color:           string | null;
  sender_name:           string | null;
  sender_title:          string | null;
  sender_email:          string | null;
  credibility_statement: string | null;
  proof_point:           string | null;
  delivery_email:        string | null;
  notes:                 string | null;
  plan:                  string;
  lead_count:            number;
  status:                string;
  admin_notes:           string | null;
  user_id:               string | null;
  icp_id:                string | null;
  search_id:             string | null;
  created_at:            string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  new:                   { label: "New",               bg: "#fef9c3", color: "#a16207" },
  in_review:             { label: "In Review",         bg: "#dbeafe", color: "#1d4ed8" },
  ready_for_processing:  { label: "Ready to Process",  bg: "#ede9fe", color: "#6d28d9" },
  completed:             { label: "Completed",         bg: "#dcfce7", color: "#15803d" },
  // legacy
  pending:    { label: "Pending",    bg: "#fef9c3", color: "#a16207" },
  processing: { label: "Processing", bg: "#dbeafe", color: "#1d4ed8" },
  failed:     { label: "Failed",     bg: "#fee2e2", color: "#dc2626" },
};

const PLAN_INFO: Record<string, { label: string; price: string }> = {
  starter:  { label: "Starter",  price: "$29 · 25 leads"  },
  standard: { label: "Standard", price: "$97 · 50 leads"  },
  pro:      { label: "Pro",      price: "$197 · 100 leads" },
};

function getQualityStatus(req: OnboardingRequest): { label: string; bg: string; color: string } {
  const hasTargeting = req.target_job_titles.length > 0 || req.target_countries.length > 0 || req.target_industries.length > 0;
  const hasBusiness  = !!req.what_you_sell?.trim();
  const hasBrand     = !!(req.logo_url || req.credibility_statement || req.sender_name);
  if (hasBusiness && hasTargeting && hasBrand) return { label: "Complete",             bg: "#dcfce7", color: "#15803d" };
  if (hasBusiness && hasTargeting)             return { label: "Missing brand assets", bg: "#fef9c3", color: "#a16207" };
  if (hasBusiness)                             return { label: "Missing targeting",    bg: "#fee2e2", color: "#dc2626" };
  return                                              { label: "Needs review",         bg: "#f1f5f9", color: "#475569" };
}

const FILTERS = [
  { value: "",                   label: "All" },
  { value: "new",                label: "New" },
  { value: "in_review",          label: "In Review" },
  { value: "ready_for_processing", label: "Ready" },
  { value: "completed",          label: "Completed" },
];

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ background: "#e0f2fe", color: "#0369a1", borderRadius: "999px", padding: "0.18rem 0.55rem", fontSize: "0.72rem", fontWeight: 600 }}>{children}</span>;
}

export default function OnboardingAdminPage() {
  const [data, setData]         = useState<OnboardingRequest[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filter, setFilter]     = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback(async (p: number, s: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (s) params.set("status", s);
      const res  = await adminFetch(`/api/admin/onboarding?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Load failed"); return; }
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, filter); }, [load, page, filter]);

  function handleFilter(s: string) { setFilter(s); setPage(1); }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminLayout>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Customer Orders</h1>
          <p style={S.sub}>{total} onboarding {total === 1 ? "request" : "requests"} received</p>
        </div>
      </div>

      {/* Status filters */}
      <div style={S.filters}>
        {FILTERS.map(f => (
          <button key={f.value || "all"} onClick={() => handleFilter(f.value)}
            style={{ ...S.filterBtn, ...(filter === f.value ? S.filterActive : {}) }}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div style={S.errBox}>{error}</div>}
      {loading && <p style={S.muted}>Loading…</p>}
      {!loading && data.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
          <div>No onboarding requests yet.</div>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.3rem" }}>When customers submit /start, their orders appear here.</div>
        </div>
      )}

      {/* Order cards */}
      {!loading && data.map(req => {
        const sc      = STATUS_CONFIG[req.status] ?? { label: req.status, bg: "#f1f5f9", color: "#475569" };
        const pi      = PLAN_INFO[req.plan] ?? { label: req.plan, price: `${req.lead_count} leads` };
        const open    = expanded === req.id;
        const hasBrand = !!(req.logo_url || req.brand_color || req.sender_name);
        const quality = getQualityStatus(req);

        return (
          <div key={req.id} style={S.card}>
            {/* Card header row */}
            <div style={S.cardTop}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" as const }}>
                  <span style={S.cardCompany}>{req.company_name}</span>
                  <span style={{ ...S.badge, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  <span style={S.planBadge}>{pi.label}</span>
                  <span style={{ ...S.badge, background: quality.bg, color: quality.color, fontSize: "0.67rem" }}>{quality.label}</span>
                  {hasBrand && <span style={S.brandBadge}>🎨 Brand</span>}
                </div>
                <div style={S.cardMeta}>
                  {req.full_name} · <a href={`mailto:${req.email}`} style={{ color: "#0ea5e9", textDecoration: "none" }}>{req.email}</a>
                  {req.country ? ` · ${req.country}` : ""}
                </div>
                <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: "#64748b" }}>
                  <span style={{ marginRight: "1rem" }}>📦 {pi.price}</span>
                  {req.delivery_email && <span>✉️ Deliver to: <strong>{req.delivery_email}</strong></span>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                <span style={S.timeStamp}>{new Date(req.created_at).toLocaleDateString()}</span>
                <button type="button" onClick={() => setExpanded(open ? null : req.id)} style={S.toggleBtn}>
                  {open ? "▲" : "▼"}
                </button>
              </div>
            </div>

            {/* Expanded body */}
            {open && (
              <div style={S.cardBody}>

                {/* What they sell */}
                <div style={S.section}>
                  <div style={S.sectionLabel}>Product / Service</div>
                  <p style={S.detailVal}>{req.what_you_sell}</p>
                  {req.value_proposition && (
                    <>
                      <div style={{ ...S.sectionLabel, marginTop: "0.5rem" }}>Value Proposition</div>
                      <p style={S.detailVal}>{req.value_proposition}</p>
                    </>
                  )}
                  {req.ideal_customer && (
                    <>
                      <div style={{ ...S.sectionLabel, marginTop: "0.5rem" }}>Target Customer Type</div>
                      <p style={S.detailVal}>{req.ideal_customer}</p>
                    </>
                  )}
                </div>

                {/* Targeting */}
                <div style={S.section}>
                  <div style={S.sectionLabel}>Targeting</div>
                  <div style={S.grid2}>
                    {req.target_countries.length > 0 && (
                      <div>
                        <div style={S.miniLabel}>Countries</div>
                        <div style={S.tags}>{req.target_countries.map(c => <Tag key={c}>{c}</Tag>)}</div>
                      </div>
                    )}
                    {req.target_industries.length > 0 && (
                      <div>
                        <div style={S.miniLabel}>Industries</div>
                        <div style={S.tags}>{req.target_industries.map(i => <Tag key={i}>{i}</Tag>)}</div>
                      </div>
                    )}
                    {req.target_company_sizes && req.target_company_sizes.length > 0 && (
                      <div>
                        <div style={S.miniLabel}>Company Size</div>
                        <div style={S.tags}>{req.target_company_sizes.map(s => <Tag key={s}>{s}</Tag>)}</div>
                      </div>
                    )}
                    {req.target_job_titles.length > 0 && (
                      <div style={{ gridColumn: "span 2" }}>
                        <div style={S.miniLabel}>Job Titles</div>
                        <div style={S.tags}>{req.target_job_titles.map(t => <Tag key={t}>{t}</Tag>)}</div>
                      </div>
                    )}
                  </div>
                  {req.buyer_persona && (
                    <>
                      <div style={{ ...S.miniLabel, marginTop: "0.75rem" }}>Buyer Persona</div>
                      <p style={S.detailVal}>{req.buyer_persona}</p>
                    </>
                  )}
                  {req.exclusions && (
                    <>
                      <div style={{ ...S.miniLabel, marginTop: "0.5rem" }}>Exclusions</div>
                      <p style={{ ...S.detailVal, color: "#dc2626" }}>{req.exclusions}</p>
                    </>
                  )}
                </div>

                {/* Brand assets */}
                {hasBrand && (
                  <div style={S.section}>
                    <div style={S.sectionLabel}>Brand Assets</div>
                    <div style={S.grid2}>
                      {req.logo_url && (
                        <div>
                          <div style={S.miniLabel}>Logo</div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={req.logo_url} alt="logo" style={{ maxHeight: 48, maxWidth: 140, objectFit: "contain", marginTop: "0.25rem" }} />
                        </div>
                      )}
                      {req.brand_color && (
                        <div>
                          <div style={S.miniLabel}>Brand Color</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "0.35rem", background: req.brand_color, border: "1px solid #e2e8f0" }} />
                            <span style={{ fontSize: "0.78rem", fontFamily: "monospace", color: "#374151" }}>{req.brand_color}</span>
                          </div>
                        </div>
                      )}
                      {req.sender_name && (
                        <div>
                          <div style={S.miniLabel}>Sender</div>
                          <p style={S.detailVal}>{req.sender_name}{req.sender_title ? `, ${req.sender_title}` : ""}</p>
                          {req.sender_email && <p style={{ ...S.detailVal, color: "#0ea5e9" }}>{req.sender_email}</p>}
                        </div>
                      )}
                      {req.credibility_statement && (
                        <div>
                          <div style={S.miniLabel}>Credibility Statement</div>
                          <p style={{ ...S.detailVal, fontStyle: "italic" }}>{req.credibility_statement}</p>
                        </div>
                      )}
                      {req.proof_point && (
                        <div style={{ gridColumn: "span 2" }}>
                          <div style={S.miniLabel}>Proof Point</div>
                          <p style={{ ...S.detailVal, fontStyle: "italic" }}>{req.proof_point}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer notes */}
                {req.notes && (
                  <div style={S.section}>
                    <div style={S.sectionLabel}>Customer Notes</div>
                    <p style={S.detailVal}>{req.notes}</p>
                  </div>
                )}

                {/* Meta + links */}
                <div style={S.actionRow}>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" as const }}>
                    {req.search_id && (
                      <Link href={`/admin/searches/${req.search_id}`} style={S.actionLink}>
                        View Lead Search →
                      </Link>
                    )}
                    {req.website && (
                      <a href={req.website} target="_blank" rel="noreferrer" style={S.actionLink}>
                        Visit Website ↗
                      </a>
                    )}
                    {req.linkedin_url && (
                      <a href={req.linkedin_url} target="_blank" rel="noreferrer" style={S.actionLink}>
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                  {req.user_id && (
                    <span style={S.userId}>UID: {req.user_id.slice(0, 8)}…</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {pages > 1 && (
        <div style={S.pager}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={S.pageBtn}>← Prev</button>
          <span style={S.pageInfo}>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={S.pageBtn}>Next →</button>
        </div>
      )}
    </AdminLayout>
  );
}

const S = {
  header:       { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" } as React.CSSProperties,
  h1:           { color: "#0f172a", fontSize: "1.35rem", fontWeight: 800, margin: "0 0 0.2rem", letterSpacing: "-0.02em" } as React.CSSProperties,
  sub:          { color: "#64748b", fontSize: "0.82rem", margin: 0 } as React.CSSProperties,
  filters:      { display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" as const } as React.CSSProperties,
  filterBtn:    { padding: "0.4rem 0.875rem", borderRadius: "999px", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  filterActive: { background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff", fontWeight: 700 } as React.CSSProperties,
  errBox:       { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.82rem", marginBottom: "1rem" } as React.CSSProperties,
  muted:        { color: "#64748b", fontSize: "0.85rem" } as React.CSSProperties,
  empty:        { textAlign: "center" as const, color: "#94a3b8", padding: "3rem 1rem" } as React.CSSProperties,
  card:         { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.875rem", marginBottom: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  cardTop:      { display: "flex", alignItems: "flex-start", gap: "1rem", padding: "1rem 1.25rem" } as React.CSSProperties,
  cardCompany:  { fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" } as React.CSSProperties,
  cardMeta:     { color: "#64748b", fontSize: "0.78rem", marginTop: "0.25rem" } as React.CSSProperties,
  badge:        { padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700 } as React.CSSProperties,
  planBadge:    { padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 600, background: "#f1f5f9", color: "#475569" } as React.CSSProperties,
  brandBadge:   { padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 600, background: "#fef9c3", color: "#a16207" } as React.CSSProperties,
  timeStamp:    { fontSize: "0.72rem", color: "#94a3b8" } as React.CSSProperties,
  toggleBtn:    { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.3rem 0.6rem", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit", color: "#64748b" } as React.CSSProperties,
  cardBody:     { padding: "0 1.25rem 1.25rem", borderTop: "1px solid #f1f5f9" } as React.CSSProperties,
  section:      { padding: "0.875rem 0", borderBottom: "1px solid #f1f5f9" } as React.CSSProperties,
  sectionLabel: { fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: "0.4rem" } as React.CSSProperties,
  miniLabel:    { fontSize: "0.68rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "0.25rem" } as React.CSSProperties,
  detailVal:    { fontSize: "0.82rem", color: "#374151", margin: 0, lineHeight: 1.55 } as React.CSSProperties,
  grid2:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" } as React.CSSProperties,
  tags:         { display: "flex", flexWrap: "wrap" as const, gap: "0.3rem" } as React.CSSProperties,
  actionRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.875rem", flexWrap: "wrap" as const, gap: "0.5rem" } as React.CSSProperties,
  actionLink:   { color: "#0ea5e9", fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" } as React.CSSProperties,
  userId:       { color: "#94a3b8", fontSize: "0.7rem", fontFamily: "monospace" } as React.CSSProperties,
  pager:        { display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" } as React.CSSProperties,
  pageBtn:      { padding: "0.4rem 0.875rem", borderRadius: "0.4rem", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  pageInfo:     { color: "#64748b", fontSize: "0.8rem" } as React.CSSProperties,
};
