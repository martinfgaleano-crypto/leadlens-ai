"use client";
// Vault → Report bridge control room: preview which approved Vault
// opportunities would feed a report for a given ICP, and inspect the exact
// report-compatible LeadCandidate[] payload (dry-run). Nothing here records
// usage or creates customer reports.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  sub: { color: "#64748b", fontSize: "0.85rem", marginBottom: "1.25rem" } as React.CSSProperties,
  banner: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: "0.6rem", padding: "0.7rem 1rem", fontSize: "0.8rem", marginBottom: "1.25rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" } as React.CSSProperties,
  label: { display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.25rem" },
  input: { width: "100%", padding: "0.45rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.4rem", fontSize: "0.85rem", boxSizing: "border-box" as const },
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.1rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", marginRight: "0.5rem" } as React.CSSProperties,
  btnAlt: { background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "0.5rem", padding: "0.55rem 1.1rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
  pill: (bg: string, fg: string) => ({ display: "inline-block", background: bg, color: fg, borderRadius: "999px", padding: "0.1rem 0.55rem", fontSize: "0.68rem", fontWeight: 700, marginRight: "0.35rem" }) as React.CSSProperties,
  empty: { background: "#fefce8", border: "1px solid #fde68a", color: "#854d0e", borderRadius: "0.6rem", padding: "0.9rem 1rem", fontSize: "0.85rem" } as React.CSSProperties,
  pre: { background: "#0f172a", color: "#e2e8f0", borderRadius: "0.6rem", padding: "1rem", fontSize: "0.72rem", overflowX: "auto" as const, maxHeight: 420 },
};

type Opp = {
  vault_company_id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  region: string | null;
  country: string | null;
  signal_type: string | null;
  signal_summary: string | null;
  signal_date: string | null;
  freshness_status: string;
  source_url: string | null;
  source_title: string | null;
  usage_rights_status: string;
  confidence_score: number | null;
  reservation_status: string;
  match_score: { total: number } | null;
  match_reasons: string[];
};

type RunRow = {
  job_id: string;
  status: string;
  plan: string;
  created_at: string;
  customer_email: string | null;
  selected_count: number;
  lead_count: number | null;
  error: string | null;
  usage_recorded: number | null;
  stale_processing: boolean;
  retried_from: string | null;
  search_id: string | null;
  delivery: "workspace" | "link_only";
};

type SelectionResult = {
  ok: boolean;
  selected: Opp[];
  rejected_counts: Record<string, number>;
  total_considered: number;
  sparse: boolean;
  message: string;
  unavailable_reason?: string;
};

export default function VaultReportBridgePage() {
  const [form, setForm] = useState({
    target_market: "", icp_notes: "", region: "", country: "", industry: "",
    customer_email: "", search_id: "", max_candidates: "10", min_confidence: "0", freshness_preference: "any",
  });
  const [result, setResult] = useState<SelectionResult | null>(null);
  const [dryRunPayload, setDryRunPayload] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState<"preview" | "dry_run" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ report_url: string; job_id: string; selected_count: number; reservation_count: number; anthropic_key_present?: boolean; workspace_visible?: boolean; delivery_note?: string; note?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runsBusy, setRunsBusy] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/vault-report-bridge/runs");
      if (res.ok) setRuns((await res.json()).items ?? []);
    } catch { /* runs list is best-effort */ }
  }, []);
  useEffect(() => { loadRuns(); }, [loadRuns]);

  type QualityGroup = Record<string, { review_ready: number; judged: number; correct: number; precision: number | null }>;
  type Quality = {
    benchmark: { run: string; gates_version: string; funnel: { adjudicated: number; review_ready: number; gated_out: number }; top_rejection_reasons: { reason: string; n: number }[]; precision: { overall: number | null; target: number; met: boolean | null; judged: number }; by_provider: QualityGroup; by_region: QualityGroup } | null;
    clean_report: { job_id: string; status: string; companies_used: number; non_production_companies: number | null; clean: boolean | null } | null;
  };
  const [quality, setQuality] = useState<Quality | null>(null);
  useEffect(() => {
    adminFetch("/api/admin/vault-report-bridge/quality").then(async (res) => { if (res.ok) setQuality(await res.json()); }).catch(() => {});
  }, []);

  async function runAction(jobId: string, action: "retry" | "release-reservations") {
    if (action === "retry" && !window.confirm("Retry re-validates the selection from scratch and queues a NEW generation. Continue?")) return;
    setRunsBusy(jobId);
    try {
      const res = await adminFetch(`/api/admin/vault-report-bridge/runs/${jobId}/${action}`, { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `${action} failed (${res.status})`);
      else setError(null);
      await loadRuns();
    } finally {
      setRunsBusy(null);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function criteria() {
    return {
      target_market: form.target_market || null,
      icp_notes: form.icp_notes || null,
      region: form.region || null,
      country: form.country || null,
      industry: form.industry || null,
      customer_email: form.customer_email || null,
      search_id: form.search_id.trim() || null,
      max_candidates: parseInt(form.max_candidates, 10) || 10,
      min_confidence: parseInt(form.min_confidence, 10) || 0,
      freshness_preference: form.freshness_preference,
    };
  }

  async function run(mode: "preview" | "dry_run") {
    setLoading(mode); setError(null); setDryRunPayload(null);
    try {
      const res = await adminFetch(`/api/admin/vault-report-bridge/${mode === "preview" ? "preview" : "dry-run"}`, {
        method: "POST", body: JSON.stringify(criteria()),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? `Request failed (${res.status})`); return; }
      setResult(data.result);
      if (mode === "dry_run") setDryRunPayload(data.lead_candidates ?? []);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(null);
    }
  }

  async function generate() {
    if (!form.customer_email.trim()) { setError("customer_email is required to generate a real report."); return; }
    if (!window.confirm("This reserves the selected Vault opportunities and creates a customer-accessible report. Continue?")) return;
    setLoading("generate"); setError(null); setGenerated(null);
    try {
      const res = await adminFetch("/api/admin/vault-report-bridge/generate", {
        method: "POST", body: JSON.stringify(criteria()),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ? `${data.error}${data.reason ? ` (${data.reason})` : ""}` : `Generate failed (${res.status})`); return; }
      setGenerated(data);
      loadRuns();
    } catch {
      setError("Network error while queueing — check the runs list below and Vault reservations.");
    } finally {
      setLoading(null);
    }
  }

  const freshPill = (f: string) =>
    f === "fresh" ? S.pill("#dcfce7", "#166534") : f === "recent" ? S.pill("#e0f2fe", "#075985") : f === "stale" ? S.pill("#fef3c7", "#92400e") : S.pill("#f1f5f9", "#64748b");

  return (
    <AdminLayout>
      <h1 style={S.h1}>Vault → Report Bridge</h1>
      <p style={S.sub}>Control room: select approved Vault opportunities for an ICP and preview the exact report-compatible payload. Preview and dry-run record no usage and create no reports.</p>
      <div style={S.banner}>
        Selection excludes by default: unapproved records, non-production data (demo/fixture/synthetic/internal QA — fail-closed), suppressed companies, restricted or unresolved usage rights, reserved-for-other, and accounts already used for the same customer/order/monitor.
      </div>

      {quality && (quality.benchmark || quality.clean_report) && (
        <div style={S.card}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.3rem" }}>Discovery quality (latest high-precision benchmark)</div>
          {quality.benchmark && (
            <div style={{ fontSize: "0.74rem", color: "#334155" }}>
              <div><strong>Funnel:</strong> {quality.benchmark.funnel.adjudicated} adjudicated → {quality.benchmark.funnel.review_ready} review-ready · {quality.benchmark.funnel.gated_out} gated out ({quality.benchmark.gates_version})</div>
              <div><strong>Top exclusions:</strong> {quality.benchmark.top_rejection_reasons.map((r) => `${r.reason}:${r.n}`).join(" · ") || "—"}</div>
              <div>
                <strong>Precision (review-ready, benchmark-only labels):</strong>{" "}
                {quality.benchmark.precision.overall === null ? "not yet judged" : `${Math.round(quality.benchmark.precision.overall * 100)}% (target ≥${Math.round(quality.benchmark.precision.target * 100)}%, ${quality.benchmark.precision.met ? "met" : "NOT met"}, n=${quality.benchmark.precision.judged})`}
              </div>
              <div><strong>By provider:</strong> {Object.entries(quality.benchmark.by_provider).map(([k, g]) => `${k}: ${g.review_ready} ready${g.precision !== null ? `, ${Math.round(g.precision * 100)}%` : ""}`).join(" · ") || "—"}</div>
              <div><strong>By region:</strong> {Object.entries(quality.benchmark.by_region).map(([k, g]) => `${k}: ${g.review_ready} ready${g.precision !== null ? `, ${Math.round(g.precision * 100)}%` : ""}`).join(" · ") || "—"}</div>
            </div>
          )}
          {quality.clean_report && (
            <div style={{ fontSize: "0.74rem", color: "#334155", marginTop: "0.25rem" }}>
              <strong>Latest report:</strong> {quality.clean_report.job_id} · {quality.clean_report.status} · {quality.clean_report.companies_used} companies ·{" "}
              {quality.clean_report.clean === true ? "✓ production-only" : quality.clean_report.clean === false ? `✗ ${quality.clean_report.non_production_companies} non-production` : "origin check unavailable (apply migration 037)"}
            </div>
          )}
          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.25rem" }}>Benchmark-only adjudication labels — never customer performance, never auto-promoted.</div>
        </div>
      )}

      <div style={S.card}>
        <div style={S.grid}>
          <div><label style={S.label}>Target market</label><input style={S.input} value={form.target_market} onChange={set("target_market")} placeholder="B2B SaaS ops tooling" /></div>
          <div><label style={S.label}>Region</label><input style={S.input} value={form.region} onChange={set("region")} placeholder="LATAM" /></div>
          <div><label style={S.label}>Country</label><input style={S.input} value={form.country} onChange={set("country")} placeholder="Colombia" /></div>
          <div><label style={S.label}>Industry</label><input style={S.input} value={form.industry} onChange={set("industry")} placeholder="logistics" /></div>
          <div><label style={S.label}>Customer email (optional)</label><input style={S.input} value={form.customer_email} onChange={set("customer_email")} placeholder="cliente@empresa.com" /></div>
          <div><label style={S.label}>Link to monitor — search_id (optional)</label><input style={S.input} value={form.search_id} onChange={set("search_id")} placeholder="uuid from /admin/searches" title="With a search_id the report appears in the customer's workspace and monitor history. Without it, the report is link-only." /></div>
          <div><label style={S.label}>Max candidates</label><input style={S.input} type="number" min={1} max={25} value={form.max_candidates} onChange={set("max_candidates")} /></div>
          <div><label style={S.label}>Min confidence (0–100)</label><input style={S.input} type="number" min={0} max={100} value={form.min_confidence} onChange={set("min_confidence")} /></div>
          <div>
            <label style={S.label}>Freshness</label>
            <select style={S.input} value={form.freshness_preference} onChange={set("freshness_preference")}>
              <option value="any">Any</option>
              <option value="fresh_or_recent">Fresh or recent (≤90d)</option>
              <option value="fresh_only">Fresh only (≤30d)</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: "0.9rem" }}>
          <label style={S.label}>ICP notes</label>
          <textarea style={{ ...S.input, minHeight: 60 }} value={form.icp_notes} onChange={set("icp_notes")} placeholder="Who is the ideal account and why would they buy now?" />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <button style={S.btn} onClick={() => run("preview")} disabled={loading !== null}>
            {loading === "preview" ? "Selecting…" : "Preview Vault opportunities"}
          </button>
          <button style={S.btnAlt} onClick={() => run("dry_run")} disabled={loading !== null}>
            {loading === "dry_run" ? "Building payload…" : "Dry-run report payload"}
          </button>
        </div>
        {result && result.selected.length > 0 && (
          <div style={{ marginTop: "1rem", borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }} data-vault-generation-version="vault-generation-v0">
            <p style={{ fontSize: "0.78rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "0.5rem", padding: "0.6rem 0.8rem", marginBottom: "0.7rem" }}>
              ⚠ This reserves the {result.selected.length} selected Vault opportunities and creates a <strong>customer-accessible report</strong> for the customer email above. Usage is recorded on success; reservations are released on failure. Sources/rights/freshness shown above apply.
            </p>
            <button style={{ ...S.btn, background: "#166534" }} onClick={generate} disabled={loading !== null || !form.customer_email.trim()}>
              {loading === "generate" ? "Queueing generation…" : `Queue Vault report generation (${result.selected.length})`}
            </button>
            {!form.customer_email.trim() && <span style={{ fontSize: "0.72rem", color: "#b91c1c", marginLeft: "0.6rem" }}>customer email required</span>}
          </div>
        )}
        {generated && (
          <div style={{ marginTop: "0.9rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "0.6rem", padding: "0.8rem 1rem", fontSize: "0.82rem", color: "#1e40af" }}>
            <strong>Generation queued (202).</strong> {generated.selected_count} opportunities reserved ({generated.reservation_count} reservations, 24h TTL) · job <code>{generated.job_id}</code>.
            <div style={{ marginTop: "0.3rem" }}>Report is processing. Open the link to watch status — it flips to the full report when the processor finishes.</div>
            {generated.delivery_note && (
              <div style={{ marginTop: "0.3rem", color: generated.workspace_visible ? "#166534" : "#92400e" }}>
                {generated.workspace_visible ? "🏠 " : "🔗 "}{generated.delivery_note}
              </div>
            )}
            {generated.anthropic_key_present === false && (
              <div style={{ color: "#b91c1c", marginTop: "0.3rem" }}>⚠ ANTHROPIC_API_KEY missing — the processor will fail. Configure it before expecting results.</div>
            )}
            <div style={{ marginTop: "0.45rem" }}>
              <a href={generated.report_url} target="_blank" rel="noreferrer" style={{ color: "#0369a1", fontWeight: 700 }}>Open report (processing) →</a>
              <button
                style={{ ...S.btnAlt, marginLeft: "0.75rem", padding: "0.25rem 0.7rem", fontSize: "0.72rem" }}
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${generated.report_url}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
              >
                {copied ? "Copied ✓" : "Copy customer link"}
              </button>
            </div>
          </div>
        )}
        {error && <p style={{ color: "#b91c1c", fontSize: "0.8rem", marginTop: "0.75rem" }}>{error}</p>}
      </div>

      {result && (
        <div style={S.card}>
          <p style={{ fontSize: "0.85rem", color: "#334155", marginBottom: "0.75rem" }}>
            <strong>{result.message}</strong>
            {result.unavailable_reason && <span style={{ display: "block", color: "#92400e", marginTop: "0.25rem" }}>{result.unavailable_reason}</span>}
          </p>
          {Object.keys(result.rejected_counts).length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.75rem" }}>
              Exclusions: {Object.entries(result.rejected_counts).map(([r, c]) => `${c} × ${r.replace(/_/g, " ")}`).join(" · ")}
            </p>
          )}
          {result.sparse && result.selected.length > 0 && (
            <div style={{ ...S.empty, marginBottom: "0.9rem" }}>Sparse selection — fewer opportunities than requested. Promote more approved candidates to the Vault or relax criteria.</div>
          )}
          {result.selected.length === 0 ? (
            <div style={S.empty}>Not enough approved Vault opportunities yet. Run the Lead Hunter, approve candidates, and promote them to the Vault.</div>
          ) : (
            result.selected.map((o) => (
              <div key={`${o.vault_company_id}-${o.signal_type ?? "none"}-${o.signal_date ?? ""}`} style={{ borderTop: "1px solid #f1f5f9", padding: "0.8rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{o.company_name}{o.domain ? <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {o.domain}</span> : null}</strong>
                  <span style={S.pill("#eef2ff", "#3730a3")}>match {o.match_score?.total ?? 0}</span>
                </div>
                <div style={{ margin: "0.35rem 0" }}>
                  {o.signal_type && <span style={S.pill("#f0fdf4", "#166534")}>{o.signal_type}</span>}
                  <span style={freshPill(o.freshness_status)}>{o.freshness_status}</span>
                  <span style={S.pill("#f8fafc", "#475569")}>rights: {o.usage_rights_status}</span>
                  {o.confidence_score != null && <span style={S.pill("#f8fafc", "#475569")}>conf {o.confidence_score}</span>}
                  {o.reservation_status !== "none" && <span style={S.pill("#fef3c7", "#92400e")}>{o.reservation_status.replace(/_/g, " ")}</span>}
                </div>
                {o.signal_summary && <p style={{ fontSize: "0.8rem", color: "#334155", margin: "0.25rem 0" }}>{o.signal_summary}{o.signal_date ? ` (${o.signal_date})` : ""}</p>}
                {o.match_reasons.length > 0 && <p style={{ fontSize: "0.72rem", color: "#64748b", margin: "0.2rem 0" }}>Why: {o.match_reasons.join(" · ")}</p>}
                {o.source_url && <a href={o.source_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.72rem", color: "#0369a1" }}>{o.source_title ?? o.source_url}</a>}
              </div>
            ))
          )}
        </div>
      )}

      <div style={S.card} data-vault-generation-ops-version="vault-generation-ops-v0">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Recent Vault generation runs</h2>
          <button style={{ ...S.btnAlt, padding: "0.3rem 0.7rem", fontSize: "0.72rem" }} onClick={loadRuns}>Refresh</button>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.6rem" }}>
          Generation depends on active Anthropic API credits (console.anthropic.com → Plans &amp; Billing). Retry re-validates the selection and queues a new job; it never touches completed runs.
        </p>
        {runs.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>No Vault generation runs yet.</p>
        ) : runs.map((r) => (
          <div key={r.job_id} style={{ borderTop: "1px solid #f1f5f9", padding: "0.6rem 0", fontSize: "0.78rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <span style={
                r.status === "completed" ? S.pill("#dcfce7", "#166534")
                : r.status === "failed" ? S.pill("#fee2e2", "#991b1b")
                : r.stale_processing ? S.pill("#fef3c7", "#92400e")
                : S.pill("#e0f2fe", "#075985")
              }>
                {r.status === "processing" && r.stale_processing ? "stuck (stale)" : r.status}
              </span>
              <code style={{ color: "#334155" }}>{r.job_id}</code>
              <span style={r.delivery === "workspace" ? S.pill("#f0fdf4", "#166534") : S.pill("#fffbeb", "#92400e")} title={r.delivery === "workspace" ? `Appears in the customer's workspace (monitor ${r.search_id})` : "Link-only: visible via the copied /results link, not in workspace lists"}>
                {r.delivery === "workspace" ? "workspace" : "link-only"}
              </span>
              <span style={{ color: "#64748b" }}>{r.customer_email ?? "—"} · {r.selected_count} selected{r.lead_count != null ? ` · ${r.lead_count} leads` : ""}{r.usage_recorded != null ? ` · usage ${r.usage_recorded}` : ""}</span>
              {r.retried_from && <span style={S.pill("#f1f5f9", "#64748b")}>retry of {r.retried_from.slice(0, 18)}…</span>}
            </div>
            {r.error && <div style={{ color: "#991b1b", marginTop: "0.2rem" }}>{r.error}</div>}
            <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.5rem" }}>
              <a href={`/results/${r.job_id}`} target="_blank" rel="noreferrer" style={{ color: "#0369a1", fontSize: "0.72rem", fontWeight: 600 }}>Open report</a>
              <button
                style={{ ...S.btnAlt, padding: "0.15rem 0.55rem", fontSize: "0.68rem" }}
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/results/${r.job_id}`)}
              >Copy link</button>
              {(r.status === "failed" || r.stale_processing) && (
                <>
                  <button style={{ ...S.btnAlt, padding: "0.15rem 0.55rem", fontSize: "0.68rem", color: "#166534" }} disabled={runsBusy === r.job_id} onClick={() => runAction(r.job_id, "retry")}>
                    {runsBusy === r.job_id ? "…" : "Retry"}
                  </button>
                  <button style={{ ...S.btnAlt, padding: "0.15rem 0.55rem", fontSize: "0.68rem", color: "#92400e" }} disabled={runsBusy === r.job_id} onClick={() => runAction(r.job_id, "release-reservations")}>
                    Release reservations
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {dryRunPayload && (
        <div style={S.card}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>Report-compatible LeadCandidate[] payload ({dryRunPayload.length})</h2>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.6rem" }}>Exactly what the report pipeline would receive. No usage recorded, no reservations created, no report generated.</p>
          <pre style={S.pre}>{JSON.stringify(dryRunPayload, null, 2)}</pre>
        </div>
      )}
    </AdminLayout>
  );
}
