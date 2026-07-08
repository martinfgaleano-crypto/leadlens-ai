"use client";
import { useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// Manual candidate intake: company/contact/signal/source bundle from a
// permitted/public source. No scraping, no external fetch, no Apollo.

const FIELDS: { key: string; label: string; required?: boolean; type?: string; options?: string[] }[] = [
  { key: "company_name", label: "Company name", required: true },
  { key: "domain", label: "Domain" },
  { key: "website_url", label: "Website URL" },
  { key: "region", label: "Region" },
  { key: "country", label: "Country" },
  { key: "industry", label: "Industry" },
  { key: "contact_name", label: "Contact name (optional)" },
  { key: "contact_title", label: "Contact title (optional)" },
  { key: "email", label: "Contact email (optional)" },
  { key: "source_url", label: "Source URL", required: true },
  { key: "source_type", label: "Source type", required: true, options: ["customer_provided", "company_website", "public_directory", "public_job_post", "public_event", "public_news", "business_registry", "licensed_provider", "other_public"] },
  { key: "signal_type", label: "Signal type (optional)", options: ["hiring", "expansion", "funding", "product_launch", "leadership_change", "event_participation", "regulatory", "other"] },
  { key: "signal_summary", label: "Signal summary" },
  { key: "signal_date", label: "Signal date", type: "date" },
  { key: "confidence_score", label: "Confidence (0-100)", type: "number" },
  { key: "usage_rights_status", label: "Usage rights", options: ["unverified", "permitted", "licensed", "restricted"] },
  { key: "notes", label: "Notes" },
];

export default function NewCandidatePage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of FIELDS) {
      if (f.required && !(form[f.key] ?? "").trim()) {
        setResult({ ok: false, text: `${f.label} is required.` });
        return;
      }
    }
    setSaving(true);
    setResult(null);
    const payload: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const v = (form[f.key] ?? "").trim();
      if (v) payload[f.key] = f.type === "number" ? Number(v) : v;
    }
    const res = await adminFetch("/api/admin/vault-foundation/candidates", { method: "POST", body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setResult({ ok: true, text: `Candidate saved as pending review. Company ${d.company_existed ? "matched by domain" : "created"}${d.contact_id ? ", contact created" : ""}${d.signal_id ? ", signal created" : ""}, source recorded.` });
      setForm({});
    } else {
      setResult({ ok: false, text: d.error ?? "Could not save candidate." });
    }
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.65rem", border: "1px solid #e2e8f0",
    borderRadius: "0.4rem", fontSize: "0.85rem", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", color: "#0f172a", background: "#fff",
  };

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.25rem" }}>
        <Link href="/admin/vault-foundation" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Vault Foundation</Link>
        <h1 style={{ color: "#0f172a", fontSize: "1.3rem", fontWeight: 800, margin: "0.6rem 0 0" }}>New Vault Candidate</h1>
        <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.3rem 0 0", maxWidth: 640 }}>
          Add a company/contact/signal bundle discovered from a permitted or public source.
          Source URL and type are mandatory — every record must be traceable. Everything
          lands as pending review.
        </p>
      </div>

      {result && (
        <div style={{ marginBottom: "1rem", padding: "0.7rem 1rem", background: result.ok ? "#dcfce7" : "#fee2e2", border: `1px solid ${result.ok ? "#86efac" : "#fca5a5"}`, borderRadius: "0.5rem", fontSize: "0.82rem", color: result.ok ? "#15803d" : "#dc2626" }}>
          {result.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.5rem", maxWidth: 860 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.9rem", marginBottom: "1.25rem" }}>
          {FIELDS.map(f => (
            <label key={f.key} style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.3rem" }}>
                {f.label}{f.required ? " *" : ""}
              </span>
              {f.options ? (
                <select value={form[f.key] ?? ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={form[f.key] ?? ""}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              )}
            </label>
          ))}
        </div>
        <button type="submit" disabled={saving} style={{ background: saving ? "#e2e8f0" : "#0ea5e9", color: saving ? "#94a3b8" : "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1.5rem", fontWeight: 700, fontSize: "0.85rem", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {saving ? "Saving…" : "Save candidate"}
        </button>
      </form>
    </AdminLayout>
  );
}
