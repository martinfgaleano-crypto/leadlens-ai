"use client";
// Admin Delivery Hub — internal preview/download of generated portable
// deliverables. No terminal required. Files are fetched through adminFetch (so
// the admin token/cookie is always sent), then previewed/downloaded via a blob;
// the customer artifact itself remains login-free once delivered.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface FileInfo { name: string; kind: "html" | "portfolioCsv" | "evidenceCsv"; sizeKb: number }
interface Deliverable {
  id: string; slug: string; date: string; client: string | null; tier: string | null;
  accounts: number | null; generatedAt: string | null; kind: "customer" | "fixture";
  html: string | null; portfolioCsv: string | null; evidenceCsv: string | null; files: FileInfo[];
}
interface ReportTemplate {
  version: string; approvalState: string; effectiveDate: string; renderingSystem: string;
  chartSystem: string[]; brandTokens: Record<string, string>; languages: Array<"en" | "es">;
  tiers: Array<{ tier: string; label: string; maxAccounts: number; price: number }>;
  knownLimitations: string[]; sourceCommit: string;
}
const APPROVAL_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: "#f1f5f9", fg: "#475569" },
  FOUNDER_REVIEW: { bg: "#fffbeb", fg: "#b45309" },
  APPROVED: { bg: "#ecfdf5", fg: "#047857" },
  RETIRED: { bg: "#fef2f2", fg: "#b91c1c" },
};

const S: Record<string, React.CSSProperties> = {
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px", marginBottom: 14 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  name: { fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 },
  meta: { fontSize: 12.5, color: "#64748b", marginTop: 4 },
  tag: { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 9px", borderRadius: 999 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 },
  btn: { appearance: "none", border: "1px solid #cbd5e1", background: "#fff", color: "#0369a1", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnPrimary: { background: "#0284c7", color: "#fff", border: "1px solid #0284c7" },
};

export default function AdminDeliverables() {
  const [items, setItems] = useState<Deliverable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [lang, setLang] = useState<"es" | "en">("es");

  useEffect(() => {
    (async () => {
      const r = await adminFetch("/api/admin/deliverables");
      if (!r.ok) { setError(r.status === 401 ? "Admin authorization required." : `Failed to load (${r.status}).`); setItems([]); return; }
      const j = await r.json();
      setItems(j.deliverables ?? []);
    })();
    (async () => {
      const r = await adminFetch("/api/admin/deliverables/template");
      if (r.ok) { const j = await r.json(); setTemplate(j.template ?? null); }
    })();
  }, []);

  // Open the deterministic sample PDF for a tier (admin-authorized; no customer data, no credit).
  const openTemplatePdf = useCallback(async (tier: string, mode: "preview" | "download") => {
    setBusy(`tpl:${tier}:${mode}`);
    try {
      const r = await adminFetch(`/api/admin/deliverables/template/preview?tier=${encodeURIComponent(tier)}&lang=${lang}&mode=${mode}`);
      if (!r.ok) { alert(`Could not render sample (${r.status}).`); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (mode === "preview") { window.open(url, "_blank", "noopener"); }
      else {
        const a = document.createElement("a");
        a.href = url; a.download = `LeadLens_${tier}_${template?.version ?? "V2"}_sample.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally { setBusy(null); }
  }, [lang, template]);

  const fileUrl = (d: Deliverable, file: string, mode: "preview" | "download") =>
    `/api/admin/deliverables/file?slug=${encodeURIComponent(d.slug)}&date=${encodeURIComponent(d.date)}&file=${encodeURIComponent(file)}&mode=${mode}`;

  const act = useCallback(async (d: Deliverable, file: string, mode: "preview" | "download") => {
    setBusy(`${d.id}:${file}:${mode}`);
    try {
      const r = await adminFetch(fileUrl(d, file, mode));
      if (!r.ok) { alert(`Could not open (${r.status}).`); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        window.open(url, "_blank", "noopener");
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = file;
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally { setBusy(null); }
  }, []);

  return (
    <AdminLayout>
      <div style={{ maxWidth: 860 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>Deliverables</h1>
        <p style={{ fontSize: 13.5, color: "#64748b", margin: "0 0 20px" }}>
          Generated portable customer artifacts. Preview or download without a terminal. The customer HTML requires no login once delivered.
        </p>

        {/* ── Report Templates (versioned canonical formats) ── */}
        {template && (
          <div style={{ ...S.card, borderColor: "#dbeafe" }}>
            <div style={S.head}>
              <div>
                <h2 style={S.name}>Report templates</h2>
                <div style={S.meta}>
                  <strong style={{ color: "#0f172a" }}>{template.version}</strong> · source {template.sourceCommit === "local" ? "local" : template.sourceCommit.slice(0, 7)} · effective {template.effectiveDate}
                </div>
              </div>
              <span style={{ ...S.tag, background: (APPROVAL_COLORS[template.approvalState] ?? APPROVAL_COLORS.DRAFT).bg, color: (APPROVAL_COLORS[template.approvalState] ?? APPROVAL_COLORS.DRAFT).fg }}>
                {template.approvalState.replace("_", " ")}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Sample language:</span>
              {(["es", "en"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  style={{ ...S.btn, padding: "4px 12px", ...(lang === l ? S.btnPrimary : {}) }}>
                  {l === "es" ? "Español" : "English"}
                </button>
              ))}
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Samples use synthetic data — no customer research, no credit.</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, marginTop: 10 }}>
              {template.tiers.map((t) => (
                <div key={t.tier} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f172a" }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b", margin: "2px 0 10px" }}>${t.price} · {t.maxAccounts} companies</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={{ ...S.btn, ...S.btnPrimary, padding: "6px 11px" }} disabled={!!busy} onClick={() => openTemplatePdf(t.tier, "preview")}>Preview PDF</button>
                    <button style={{ ...S.btn, padding: "6px 11px" }} disabled={!!busy} onClick={() => openTemplatePdf(t.tier, "download")}>Download</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: "#64748b" }}>
              <div style={{ marginBottom: 4 }}><strong style={{ color: "#334155" }}>Rendering:</strong> {template.renderingSystem}</div>
              <div style={{ marginBottom: 4 }}><strong style={{ color: "#334155" }}>Charts:</strong> {template.chartSystem.join(" · ")}</div>
              <div style={{ marginBottom: 4 }}><strong style={{ color: "#334155" }}>Languages:</strong> {template.languages.join(", ")}</div>
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", color: "#0369a1", fontWeight: 600 }}>Known limitations ({template.knownLimitations.length})</summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {template.knownLimitations.map((k, i) => <li key={i} style={{ marginBottom: 3 }}>{k}</li>)}
                </ul>
              </details>
            </div>
          </div>
        )}

        {items === null && <p style={{ color: "#64748b" }}>Loading…</p>}
        {error && <div style={{ ...S.card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}
        {items && items.length === 0 && !error && (
          <div style={S.card}>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13.5 }}>No deliverables generated yet. Generate one locally with:</p>
            <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, overflowX: "auto", marginTop: 10 }}>npm run deliverable:generate -- --fixture amor</pre>
          </div>
        )}

        {items?.map((d) => (
          <div key={d.id} style={S.card}>
            <div style={S.head}>
              <div>
                <h2 style={S.name}>{d.client ?? d.slug}</h2>
                <div style={S.meta}>
                  {[d.tier, d.accounts != null ? `${d.accounts} accounts` : null, d.generatedAt ? `Generated ${d.generatedAt.slice(0, 10)}` : `Dated ${d.date}`]
                    .filter(Boolean).join(" · ")}
                </div>
                <div style={{ ...S.meta, color: "#94a3b8" }}>{d.files.map((f) => `${f.name.split("_").pop()} ${f.sizeKb} KB`).join(" · ")}</div>
              </div>
              <span style={{ ...S.tag, background: d.kind === "customer" ? "#e0f2fe" : "#f1f5f9", color: d.kind === "customer" ? "#0369a1" : "#64748b" }}>
                {d.kind === "customer" ? "Customer" : "Fixture (dev)"}
              </span>
            </div>
            <div style={S.actions}>
              {d.html && <button style={{ ...S.btn, ...S.btnPrimary }} disabled={!!busy} onClick={() => act(d, d.html!, "preview")}>Preview</button>}
              {d.html && <button style={S.btn} disabled={!!busy} onClick={() => act(d, d.html!, "download")}>Download HTML</button>}
              {d.portfolioCsv && <button style={S.btn} disabled={!!busy} onClick={() => act(d, d.portfolioCsv!, "download")}>Portfolio CSV</button>}
              {d.evidenceCsv && <button style={S.btn} disabled={!!busy} onClick={() => act(d, d.evidenceCsv!, "download")}>Evidence CSV</button>}
            </div>
            <p style={{ ...S.meta, color: "#94a3b8", marginTop: 10 }}>PDF: open Preview, then use the artifact&apos;s &quot;Print / Save as PDF&quot; button.</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
