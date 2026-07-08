"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// Generic admin list + manual-create page for Vault Foundation resources.
// Internal only; renders gracefully against an empty/unconfigured Supabase.

export interface VaultField {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "date";
  placeholder?: string;
  options?: string[]; // renders a <select>
}

export default function VaultResourcePage({
  title, description, endpoint, columns, createFields,
}: {
  title: string;
  description: string;
  endpoint: string; // /api/admin/vault-foundation/<resource>
  columns: { key: string; label: string }[];
  createFields: VaultField[];
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch(endpoint);
    if (res.ok) {
      const d = await res.json().catch(() => null);
      setItems((d?.items ?? []) as Record<string, unknown>[]);
      setError("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `Error ${res.status}`);
    }
    setLoading(false);
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const payload: Record<string, unknown> = {};
    for (const f of createFields) {
      const v = (form[f.key] ?? "").trim();
      if (f.required && !v) {
        setMsg({ ok: false, text: `${f.label} is required.` });
        setSaving(false);
        return;
      }
      if (v) payload[f.key] = f.type === "number" ? Number(v) : v;
    }
    const res = await adminFetch(endpoint, { method: "POST", body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: "Created." });
      setForm({});
      setFormOpen(false);
      await load();
    } else {
      setMsg({ ok: false, text: d.error ?? "Create failed." });
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.6rem" }}>
          <div>
            <h1 style={{ color: "#0f172a", fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>{title}</h1>
            <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.3rem 0 0", maxWidth: 640 }}>{description}</p>
          </div>
          <button
            onClick={() => { setFormOpen(o => !o); setMsg(null); }}
            style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            {formOpen ? "Cancel" : "+ Add manually"}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: "1rem", padding: "0.6rem 0.9rem", background: msg.ok ? "#dcfce7" : "#fee2e2", border: `1px solid ${msg.ok ? "#86efac" : "#fca5a5"}`, borderRadius: "0.5rem", fontSize: "0.8rem", color: msg.ok ? "#15803d" : "#dc2626" }}>
          {msg.text}
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem", marginBottom: "1rem" }}>
            {createFields.map(f => (
              <label key={f.key} style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.3rem" }}>
                  {f.label}{f.required ? " *" : ""}
                </span>
                {f.options ? (
                  <select value={form[f.key] ?? ""} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={inputStyle}>
                    <option value="">Select…</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={inputStyle}
                  />
                )}
              </label>
            ))}
          </div>
          <button type="submit" disabled={saving} style={{ background: saving ? "#e2e8f0" : "#0ea5e9", color: saving ? "#94a3b8" : "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.25rem", fontWeight: 700, fontSize: "0.8rem", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Create"}
          </button>
        </form>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2rem", color: "#94a3b8", fontSize: "0.85rem" }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: "1.25rem", color: "#dc2626", fontSize: "0.85rem" }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "2rem", color: "#94a3b8", fontSize: "0.85rem", textAlign: "center" }}>
            Nothing here yet. If Supabase is configured and migration 029 is applied, use “+ Add manually”.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {columns.map(c => (
                    <th key={c.key} style={{ padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={(it.id as string) ?? i} style={{ borderBottom: "1px solid #f8fafc" }}>
                    {columns.map(c => (
                      <td key={c.key} style={{ padding: "0.6rem 1rem", fontSize: "0.8rem", color: "#334155", whiteSpace: "nowrap", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {it[c.key] == null || it[c.key] === "" ? <span style={{ color: "#cbd5e1" }}>—</span> : String(it[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
