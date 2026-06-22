"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultLead {
  id: string;
  company_name: string;
  normalized_company: string | null;
  website: string | null;
  domain: string | null;
  contact_name: string | null;
  title: string | null;
  normalized_title: string | null;
  seniority: string | null;
  email: string | null;
  email_quality: string | null;
  email_type: string | null;
  linkedin_url: string | null;
  country: string | null;
  industry: string | null;
  company_size: string | null;
  source: string | null;
  lead_score: number | null;
  confidence_score: number | null;
  opportunity_score: number | null;
  buyer_fit: string | null;
  temperature: string | null;
  ai_reasoning: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  times_seen: number;
  last_seen: string;
  created_at: string;
}

interface SearchHistoryItem {
  search_id: string;
  search_name: string;
  created_at: string;
}

interface SimilarLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  title: string | null;
  country: string | null;
  opportunity_score: number | null;
  temperature: string | null;
  buyer_fit: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#cbd5e1" }}>—</span>;
  let bg: string, color: string;
  if      (score >= 90) { bg = "#dcfce7"; color = "#15803d"; }
  else if (score >= 70) { bg = "#dbeafe"; color = "#1d4ed8"; }
  else if (score >= 50) { bg = "#fef9c3"; color = "#854d0e"; }
  else                  { bg = "#f1f5f9"; color = "#64748b"; }
  return (
    <span style={{ display: "inline-block", background: bg, color, borderRadius: 999, padding: "0.2rem 0.65rem", fontSize: "0.75rem", fontWeight: 700, minWidth: 28, textAlign: "center" }}>
      {score}
    </span>
  );
}

function TempBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const m: Record<string, { bg: string; color: string }> = {
    Hot:  { bg: "#fee2e2", color: "#dc2626" },
    Warm: { bg: "#fef9c3", color: "#854d0e" },
    Cold: { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = m[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.6rem", fontSize: "0.72rem", fontWeight: 700 }}>{value}</span>;
}

function FitBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const m: Record<string, { bg: string; color: string }> = {
    "Excellent fit": { bg: "#dcfce7", color: "#15803d" },
    "Good fit":      { bg: "#dbeafe", color: "#1d4ed8" },
    "Weak fit":      { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = m[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.6rem", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>;
}

function QualityPill({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const m: Record<string, { bg: string; color: string }> = {
    high:    { bg: "#dcfce7", color: "#15803d" },
    medium:  { bg: "#fef9c3", color: "#854d0e" },
    low:     { bg: "#fee2e2", color: "#dc2626" },
    missing: { bg: "#f1f5f9", color: "#94a3b8" },
  };
  const s = m[value] ?? { bg: "#f1f5f9", color: "#64748b" };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "capitalize" as const }}>{value}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1.25rem" }}>
      <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{title}</span>
      </div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "1rem", paddingBottom: "0.6rem", borderBottom: "1px solid #f8fafc", marginBottom: "0.6rem", alignItems: "flex-start" }}>
      <span style={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 600, minWidth: 150, textTransform: "uppercase" as const, letterSpacing: "0.04em", paddingTop: "0.1rem" }}>
        {label}
      </span>
      <span style={{ color: "#0f172a", fontSize: "0.875rem", flex: 1 }}>
        {value ?? <span style={{ color: "#94a3b8" }}>—</span>}
      </span>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VaultDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [lead, setLead]       = useState<VaultLead | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [similar, setSimilar] = useState<SimilarLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminFetch(`/api/admin/vault/${id}`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setError((d as { error?: string }).error ?? `Error ${r.status}`);
        } else {
          const d = await r.json();
          setLead(d.lead as VaultLead);
          setHistory((d.search_history ?? []) as SearchHistoryItem[]);
          setSimilar((d.similar ?? []) as SimilarLead[]);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <AdminLayout><div style={{ color: "#64748b", padding: "2rem" }}>Loading vault lead…</div></AdminLayout>;
  }

  if (error || !lead) {
    return (
      <AdminLayout>
        <Link href="/admin/vault" style={S.back}>← Back to Vault</Link>
        <div style={{ marginTop: "1rem", padding: "1.25rem", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", color: "#dc2626", fontSize: "0.875rem" }}>
          {error || "Vault lead not found."}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/admin/vault" style={S.back}>← Back to Vault</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <h1 style={{ color: "#0f172a", fontSize: "1.35rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            {lead.normalized_company ?? lead.company_name}
            {lead.contact_name && ` — ${lead.contact_name}`}
          </h1>
          <TempBadge value={lead.temperature} />
          <FitBadge  value={lead.buyer_fit} />
        </div>
        <div style={{ marginTop: "0.3rem", color: "#94a3b8", fontSize: "0.7rem", fontFamily: "monospace" }}>{lead.id}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.25rem", alignItems: "start" }}>

        {/* ── LEFT ── */}
        <div>
          {/* Full lead profile */}
          <Card title="Lead Profile">
            <Row label="Company"          value={lead.company_name} />
            {lead.normalized_company && lead.normalized_company !== lead.company_name && (
              <Row label="Normalised name" value={lead.normalized_company} />
            )}
            <Row label="Website"          value={lead.website
              ? <a href={lead.website} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", textDecoration: "none" }}>{lead.website}</a>
              : null} />
            <Row label="Domain"           value={lead.domain} />
            <Row label="Contact"          value={lead.contact_name} />
            <Row label="Title"            value={lead.normalized_title ?? lead.title} />
            <Row label="Seniority"        value={lead.seniority} />
            <Row label="Email"            value={lead.email
              ? <a href={`mailto:${lead.email}`} style={{ color: "#0ea5e9", textDecoration: "none" }}>{lead.email}</a>
              : null} />
            <Row label="Email quality"    value={<QualityPill value={lead.email_quality} />} />
            <Row label="LinkedIn"         value={lead.linkedin_url
              ? <a href={lead.linkedin_url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", textDecoration: "none" }}>View profile</a>
              : null} />
            <Row label="Country"          value={lead.country} />
            <Row label="Industry"         value={lead.industry} />
            <Row label="Company size"     value={lead.company_size} />
            <Row label="Source"           value={lead.source} />
          </Card>

          {/* Quality metrics */}
          <Card title="Quality Metrics">
            <Row label="Lead score"        value={<ScoreBadge score={lead.lead_score} />} />
            <Row label="Confidence score"  value={<ScoreBadge score={lead.confidence_score} />} />
            <Row label="Opportunity score" value={<ScoreBadge score={lead.opportunity_score} />} />
            <Row label="Buyer fit"         value={<FitBadge value={lead.buyer_fit} />} />
            <Row label="Temperature"       value={<TempBadge value={lead.temperature} />} />
          </Card>

          {/* AI reasoning */}
          {lead.ai_reasoning && (
            <Card title="AI Reasoning">
              <p style={{ color: "#0f172a", fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
                {lead.ai_reasoning}
              </p>
            </Card>
          )}

          {/* Strengths + Weaknesses */}
          {((lead.strengths?.length ?? 0) > 0 || (lead.weaknesses?.length ?? 0) > 0) && (
            <Card title="Signal Analysis">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>Strengths</div>
                  {(lead.strengths ?? []).length === 0
                    ? <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>None identified</div>
                    : (lead.strengths ?? []).map(s => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", color: "#15803d", marginBottom: "0.3rem" }}>
                          <span style={{ fontWeight: 700 }}>✓</span>{s}
                        </div>
                      ))
                  }
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>Weaknesses</div>
                  {(lead.weaknesses ?? []).length === 0
                    ? <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>None identified</div>
                    : (lead.weaknesses ?? []).map(w => (
                        <div key={w} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", color: "#dc2626", marginBottom: "0.3rem" }}>
                          <span style={{ fontWeight: 700 }}>✗</span>{w}
                        </div>
                      ))
                  }
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div>
          {/* Vault metadata */}
          <Card title="Vault Intelligence">
            <Row label="Times seen"  value={
              <span style={{ fontWeight: 700, color: lead.times_seen > 1 ? "#854d0e" : "#0f172a" }}>
                {lead.times_seen}×
              </span>
            } />
            <Row label="First seen"  value={fmt(lead.created_at)} />
            <Row label="Last seen"   value={fmt(lead.last_seen)} />
          </Card>

          {/* Search history */}
          <Card title={`Search History (${history.length})`}>
            {history.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>No linked searches found.</div>
            ) : (
              <div>
                {history.map(h => (
                  <div key={h.search_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.55rem", borderBottom: "1px solid #f8fafc", marginBottom: "0.55rem" }}>
                    <Link
                      href={`/admin/searches/${h.search_id}`}
                      style={{ color: "#0ea5e9", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}
                    >
                      {h.search_name}
                    </Link>
                    <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>{fmt(h.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Similar leads */}
          {similar.length > 0 && (
            <Card title="Similar in Vault">
              {similar.map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.55rem", borderBottom: "1px solid #f8fafc", marginBottom: "0.55rem" }}>
                  <div>
                    <Link href={`/admin/vault/${s.id}`} style={{ color: "#0ea5e9", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
                      {s.company_name}
                    </Link>
                    {s.contact_name && (
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.1rem" }}>{s.contact_name}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
                    <ScoreBadge score={s.opportunity_score} />
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{s.country}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  back: { color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" } as React.CSSProperties,
};
