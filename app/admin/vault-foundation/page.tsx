"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// Vault Foundation hub — compliance-safe research memory. Internal only.

const SECTIONS = [
  { href: "/admin/vault-foundation/companies",  label: "Companies",  endpoint: "/api/admin/vault-foundation/companies" },
  { href: "/admin/vault-foundation/contacts",   label: "Contacts",   endpoint: "/api/admin/vault-foundation/contacts" },
  { href: "/admin/vault-foundation/signals",    label: "Signals",    endpoint: "/api/admin/vault-foundation/signals" },
  { href: "/admin/vault-foundation/sources",    label: "Sources",    endpoint: "/api/admin/vault-foundation/sources" },
  { href: "/admin/vault-foundation/suppression", label: "Suppressed", endpoint: "/api/admin/vault-foundation/suppression" },
];

export default function VaultFoundationHub() {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [pendingReview, setPendingReview] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const next: Record<string, number | null> = {};
      let pending = 0;
      for (const s of SECTIONS) {
        try {
          const res = await adminFetch(s.endpoint);
          const d = res.ok ? await res.json().catch(() => null) : null;
          const items = (d?.items ?? []) as { review_status?: string }[];
          next[s.label] = res.ok ? items.length : null;
          pending += items.filter(i => i.review_status === "pending_review").length;
        } catch { next[s.label] = null; }
      }
      setCounts(next);
      setPendingReview(pending);
    })();
  }, []);

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Vault Foundation</h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.35rem 0 0", maxWidth: 680 }}>
          Compliance-safe research memory: companies, contacts, signals, and provenance.
          Manual intake only — no scraping, no automatic discovery, internal use only.
        </p>
      </div>

      <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "0.5rem", color: "#92400e", fontSize: "0.8rem", lineHeight: 1.6 }}>
        ⚠ <strong>Compliance:</strong> Apollo and other licensed providers require explicit
        customer-facing data rights. Every record must have a source with usage rights
        tracked. See LEADLENS_DATA_SOURCING_COMPLIANCE.md.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.6rem", padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
                {counts[s.label] == null ? "—" : counts[s.label]}
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>{s.label}</div>
            </div>
          </Link>
        ))}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.6rem", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: pendingReview ? "#d97706" : "#64748b" }}>
            {pendingReview == null ? "—" : pendingReview}
          </div>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Pending review</div>
        </div>
      </div>

      <Link href="/admin/vault-foundation/signal-review" style={{ display: "inline-block", background: "#166534", color: "#fff", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none", marginRight: "0.6rem" }}>
        Signal Review (provider-search) →
      </Link>
      <Link href="/admin/vault-foundation/candidates/new" style={{ display: "inline-block", background: "#0f172a", color: "#fff", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
        + Add candidate (manual intake)
      </Link>
      <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginTop: "0.5rem" }}>
        Counts show the latest 100 rows per table. Empty state is expected until Supabase migration 029 is applied.
      </p>
    </AdminLayout>
  );
}
