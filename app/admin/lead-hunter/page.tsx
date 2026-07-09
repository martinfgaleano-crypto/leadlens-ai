"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// Lead Hunter command center — signal-based, review-first account discovery.

type Candidate = { review_status: string; safety_status: string; vault_company_id: string | null; confidence_score: number | null; signal_type: string | null; source_category: string };

export default function LeadHunterHub() {
  const [briefs, setBriefs] = useState<number | null>(null);
  const [runs, setRuns] = useState<number | null>(null);
  const [cands, setCands] = useState<Candidate[] | null>(null);

  useEffect(() => {
    (async () => {
      const [b, r, c] = await Promise.all([
        adminFetch("/api/admin/lead-hunter/briefs"),
        adminFetch("/api/admin/lead-hunter/runs"),
        adminFetch("/api/admin/lead-hunter/candidates"),
      ]);
      if (b.ok) setBriefs(((await b.json())?.items ?? []).length);
      if (r.ok) setRuns(((await r.json())?.items ?? []).length);
      if (c.ok) setCands(((await c.json())?.items ?? []) as Candidate[]);
    })();
  }, []);

  const pending  = cands?.filter(c => c.review_status === "pending_review").length ?? null;
  const approved = cands?.filter(c => c.review_status === "approved").length ?? null;
  const promoted = cands?.filter(c => c.vault_company_id).length ?? null;
  const blocked  = cands?.filter(c => c.safety_status === "blocked").length ?? null;
  const needsRev = cands?.filter(c => c.safety_status === "needs_review").length ?? null;
  const avgConf  = cands && cands.length > 0
    ? Math.round(cands.reduce((s, c) => s + (c.confidence_score ?? 0), 0) / cands.length)
    : null;

  const cards = [
    { label: "Briefs", value: briefs, href: "/admin/lead-hunter/briefs", color: "#0f172a" },
    { label: "Runs", value: runs, href: "/admin/lead-hunter/runs", color: "#0f172a" },
    { label: "Candidates", value: cands?.length ?? null, href: "/admin/lead-hunter/candidates", color: "#0f172a" },
    { label: "Pending review", value: pending, href: "/admin/lead-hunter/candidates?review_status=pending_review", color: "#d97706" },
    { label: "Approved", value: approved, href: "/admin/lead-hunter/candidates?review_status=approved", color: "#15803d" },
    { label: "Promoted to Vault", value: promoted, href: "/admin/vault-foundation", color: "#0ea5e9" },
    { label: "Rights need review", value: needsRev, href: "/admin/lead-hunter/candidates?safety_status=needs_review", color: "#d97706" },
    { label: "Blocked", value: blocked, href: "/admin/lead-hunter/candidates?safety_status=blocked", color: "#dc2626" },
  ];

  const steps = ["Brief", "Sources", "Candidates", "Review", "Vault"];

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.1rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Lead Hunter</h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.35rem 0 0", maxWidth: 720 }}>
          Lead Hunter discovers source-backed account opportunities for the Vault.
          It does not scrape LinkedIn, enrich contacts, or send outreach.
        </p>
      </div>

      {/* Pipeline strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginBottom: "1.25rem" }}>
        {steps.map((st, i) => (
          <span key={st} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ background: "#0f172a", color: "#fff", borderRadius: 999, padding: "0.25rem 0.8rem", fontSize: "0.72rem", fontWeight: 700 }}>
              {i + 1}. {st}
            </span>
            {i < steps.length - 1 && <span style={{ color: "#cbd5e1" }}>→</span>}
          </span>
        ))}
        <span style={{ color: "#94a3b8", fontSize: "0.72rem", marginLeft: "0.5rem" }}>review-first, manual sources in v0</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {cards.map(c => (
          <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.6rem", padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: c.color }}>{c.value == null ? "—" : c.value}</div>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>{c.label}</div>
            </div>
          </Link>
        ))}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.6rem", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>{avgConf == null ? "—" : `${avgConf}`}</div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Avg confidence</div>
        </div>
      </div>

      <div style={{ padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "0.5rem", color: "#92400e", fontSize: "0.8rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
        ⚠ <strong>Sourcing policy:</strong> only permitted public sources (company sites,
        news, job posts, events, registries). Restricted sources are blocked and can
        never reach the Vault. Unverified usage rights require admin resolution before
        approval or promotion. See LEADLENS_DATA_SOURCING_COMPLIANCE.md.
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link href="/admin/lead-hunter/briefs" style={{ background: "#0f172a", color: "#fff", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
          + Create a hunter brief
        </Link>
        <Link href="/admin/lead-hunter/candidates?review_status=pending_review" style={{ background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
          Review queue
        </Link>
      </div>
    </AdminLayout>
  );
}
