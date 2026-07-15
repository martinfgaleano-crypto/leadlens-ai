"use client";
// Source Access Layer — provider health + multiprovider benchmark. Credentials
// shown by presence only; an API call is never presented as intelligence.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" } as React.CSSProperties,
  input: { width: "100%", maxWidth: 420, padding: "0.45rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "0.4rem", fontSize: "0.85rem" } as React.CSSProperties,
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", marginLeft: "0.5rem" } as React.CSSProperties,
  pill: (bg: string, fg: string) => ({ display: "inline-block", background: bg, color: fg, borderRadius: "999px", padding: "0.1rem 0.55rem", fontSize: "0.66rem", fontWeight: 700 }) as React.CSSProperties,
};

type Health = { provider: string; status: string; reason: string | null; credentials_present: boolean };
type ValidationSummary = {
  ran_at?: string; banner?: string; queries?: number; status?: string; note?: string;
  overall?: Record<string, number | null>;
  by_region?: Record<string, Record<string, number | null>>;
  search_comparison?: Record<string, number>;
  extract_calls?: { total: number; tavily_primary: number; firecrawl_fallbacks: number };
  cost_estimates_usd?: { note: string; total: number; per_valid_signal: number | null; per_qualified_opportunity: number | null };
};
type BenchRow = { provider: string; ok: boolean; error: string | null; results_returned: number; unique_urls: number; unique_domains: number; dated_result_ratio: number | null; official_source_ratio: number | null; latency_ms: number; marginal_unique_urls: number; overlap_with_others_ratio: number | null };

export default function SourcesPage() {
  const [providers, setProviders] = useState<Health[]>([]);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [query, setQuery] = useState("logistics company expansion Colombia announcement");
  const [bench, setBench] = useState<{ rows: BenchRow[]; notes: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/intelligence/sources");
    if (res.ok) {
      const d = await res.json();
      setProviders(d.providers ?? []);
      setValidation(d.validation_benchmark ?? null);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runBenchmark() {
    setBusy(true); setError(null);
    try {
      const res = await adminFetch("/api/admin/intelligence/sources", { method: "POST", body: JSON.stringify({ query, include_fixture: false }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? `Benchmark failed (${res.status})`); return; }
      setBench(d.result);
    } finally { setBusy(false); }
  }

  return (
    <AdminLayout>
      <h1 style={S.h1}>Source Access Layer</h1>
      <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "1.25rem" }}>Provider-agnostic search access. Value = unique grounded contribution, never call volume.</p>

      <div style={S.card}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>Provider health</h2>
        {providers.map((p) => (
          <div key={p.provider} style={{ borderTop: "1px solid #f1f5f9", padding: "0.55rem 0", fontSize: "0.8rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ fontWeight: 700, minWidth: 110 }}>{p.provider}</code>
            <span style={S.pill(p.status === "available" ? "#f0fdf4" : "#fef2f2", p.status === "available" ? "#166534" : "#991b1b")}>{p.status}</span>
            <span style={S.pill("#f8fafc", "#64748b")}>credentials: {p.credentials_present ? "present" : "missing"}</span>
            {p.reason && <span style={{ color: "#92400e", fontSize: "0.72rem" }}>{p.reason}</span>}
          </div>
        ))}
      </div>

      {validation && (
        <div style={S.card}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>Source Quality Validation (última corrida)</h2>
          {validation.status === "not_run_in_this_environment" ? (
            <p style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{validation.note}</p>
          ) : (
            <>
              <p style={{ fontSize: "0.68rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "0.4rem", padding: "0.4rem 0.6rem", marginBottom: "0.7rem" }}>{validation.banner}</p>
              <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.6rem" }}>
                {validation.queries} queries · {validation.ran_at?.slice(0, 16)} · extract: {validation.extract_calls?.tavily_primary} Tavily + {validation.extract_calls?.firecrawl_fallbacks} Firecrawl fallbacks
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.72rem", borderCollapse: "collapse" }}>
                  <thead><tr style={{ textAlign: "left", color: "#94a3b8" }}>
                    {["scope", "n", "relevant", "company", "official", "prov-date", "resolved-date", "fresh", "extract-ok", "grounded", "valid-signal", "qualified"].map((h) => <th key={h} style={{ padding: "0.25rem 0.45rem", borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[["overall", validation.overall], ...Object.entries(validation.by_region ?? {})].map(([scope, m]) => m && (
                      <tr key={scope as string} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.25rem 0.45rem", fontWeight: 700 }}>{scope as string}</td>
                        <td style={{ padding: "0.25rem 0.45rem" }}>{(m as Record<string, number | null>).sample_size}</td>
                        {["relevant_rate", "company_match_rate", "official_source_rate", "provider_date_rate", "resolved_date_rate", "fresh_rate", "extraction_success_rate", "grounded_claim_rate", "valid_signal_yield", "qualified_opportunity_yield"].map((k) => {
                          const v = (m as Record<string, number | null>)[k];
                          return <td key={k} style={{ padding: "0.25rem 0.45rem" }}>{v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validation.cost_estimates_usd && (
                <p style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.5rem" }}>
                  Costo estimado (lista, no facturado): ${validation.cost_estimates_usd.total} total · ${validation.cost_estimates_usd.per_valid_signal ?? "—"}/señal válida · ${validation.cost_estimates_usd.per_qualified_opportunity ?? "—"}/oportunidad calificada
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div style={S.card}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>Multiprovider benchmark</h2>
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.6rem" }}>Runs the same query on every credentialed provider and measures unique/marginal contribution, freshness and latency.</p>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <input style={S.input} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button style={S.btn} onClick={runBenchmark} disabled={busy || query.trim().length < 3}>{busy ? "Running…" : "Run benchmark"}</button>
        </div>
        {error && <p style={{ color: "#b91c1c", fontSize: "0.78rem", marginTop: "0.5rem" }}>{error}</p>}
        {bench && (
          <div style={{ marginTop: "0.9rem", overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
              <thead><tr style={{ textAlign: "left", color: "#94a3b8" }}>
                {["provider", "ok", "results", "unique URLs", "domains", "dated %", "official %", "marginal unique", "overlap", "latency"].map((h) => <th key={h} style={{ padding: "0.3rem 0.5rem", borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {bench.rows.map((r) => (
                  <tr key={r.provider} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.3rem 0.5rem", fontWeight: 700 }}>{r.provider}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.ok ? "✅" : `❌ ${r.error ?? ""}`}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.results_returned}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.unique_urls}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.unique_domains}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.dated_result_ratio === null ? "—" : `${Math.round(r.dated_result_ratio * 100)}%`}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.official_source_ratio === null ? "—" : `${Math.round(r.official_source_ratio * 100)}%`}</td>
                    <td style={{ padding: "0.3rem 0.5rem", fontWeight: 700 }}>{r.marginal_unique_urls}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.overlap_with_others_ratio === null ? "—" : `${Math.round(r.overlap_with_others_ratio * 100)}%`}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>{r.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bench.notes.map((n, i) => <p key={i} style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.4rem" }}>ℹ {n}</p>)}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
