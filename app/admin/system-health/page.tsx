"use client";
import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface Scores {
  onboarding: number;
  processing: number;
  enrichment: number;
  credits:    number;
  delivery:   number;
  export:     number;
  payments:   number;
  overall:    number;
}

interface HealthData {
  apollo_key_set:            boolean;
  supabase_url_set:          boolean;
  supabase_service_set:      boolean;
  ls_secret_set:             boolean;
  ls_variants_configured:    boolean;
  app_url_set:               boolean;
  supabase_reachable?:       boolean;
  all_tables_ok?:            boolean;
  tables?:                   Record<string, boolean>;
  pending_searches?:         number;
  processing_searches?:      number;
  delivery_ready_searches?:  number;
  new_onboarding_requests?:  number;
  logos_bucket_exists?:      boolean;
  storage_buckets?:          string[];
  storage_error?:            string;
  total_leads_in_db?:        number;
  unenriched_leads?:         number;
  enrichment_coverage_pct?:  number;
  enrichment_ok?:            boolean;
  delivery_score?:           number;
  scores?:                   Scores;
}

const S = {
  page:     { padding: "2rem", maxWidth: "960px", margin: "0 auto" } as React.CSSProperties,
  h1:       { fontSize: "1.4rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  sub:      { fontSize: "0.82rem", color: "#64748b", marginBottom: "2rem" } as React.CSSProperties,
  section:  { marginBottom: "2rem" } as React.CSSProperties,
  sTitle:   { fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: "0.75rem" } as React.CSSProperties,
  grid2:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.625rem" } as React.CSSProperties,
  card:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.75rem 1rem" } as React.CSSProperties,
  row:      { display: "flex", alignItems: "center", gap: "0.5rem" } as React.CSSProperties,
  label:    { fontSize: "0.8rem", color: "#0f172a", fontWeight: 500 } as React.CSSProperties,
  sub2:     { fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.2rem" } as React.CSSProperties,
  btn:      { padding: "0.4rem 0.9rem", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" } as React.CSSProperties,
} as const;

function statusColor(score: number) {
  if (score >= 80) return "#15803d";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function statusBg(score: number) {
  if (score >= 80) return "#f0fdf4";
  if (score >= 50) return "#fffbeb";
  return "#fef2f2";
}

function statusLabel(score: number) {
  if (score >= 80) return "Ready";
  if (score >= 50) return "Partial";
  return "Not ready";
}

function ScoreCard({ label, score, sub }: { label: string; score: number; sub?: string }) {
  const color = statusColor(score);
  const bg    = statusBg(score);
  return (
    <div style={{ ...S.card, background: bg, borderColor: color + "40" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={S.label}>{label}</span>
        <span style={{ fontSize: "1.1rem", fontWeight: 800, color }}>{score}%</span>
      </div>
      <div style={{ marginTop: "0.4rem", background: "#e2e8f0", borderRadius: "99px", height: "4px", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: "99px", transition: "width 0.5s ease" }} />
      </div>
      {sub && <p style={{ ...S.sub2, marginTop: "0.35rem" }}>{sub}</p>}
    </div>
  );
}

function Check({ ok, label, sub }: { ok: boolean; label: string; sub?: string }) {
  return (
    <div style={S.card}>
      <div style={S.row}>
        <span style={{
          display: "inline-block", borderRadius: "99px", padding: "0.12rem 0.5rem",
          fontSize: "0.68rem", fontWeight: 700,
          background: ok ? "#dcfce7" : "#fee2e2",
          color:      ok ? "#15803d" : "#dc2626",
          flexShrink: 0,
        }}>{ok ? "OK" : "MISSING"}</span>
        <span style={S.label}>{label}</span>
      </div>
      {sub && <p style={{ ...S.sub2, paddingLeft: "0.125rem" }}>{sub}</p>}
    </div>
  );
}

function StatCard({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${color ?? "#e2e8f0"}` }}>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
      <div style={S.sub2}>{label}</div>
    </div>
  );
}

export default function SystemHealthPage() {
  const [data, setData]       = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [ts, setTs]           = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await adminFetch("/api/admin/system-health");
      const json = await res.json() as HealthData;
      setData(json);
      setTs(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const overall = data?.scores?.overall ?? 0;
  const tables  = data?.tables ?? {};

  return (
    <AdminLayout>
      <div style={S.page}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <div>
            <h1 style={S.h1}>System Health</h1>
            <p style={S.sub}>
              {ts ? `Last checked ${ts}` : "Checking…"}&ensp;·&ensp;
              <span style={{ fontWeight: 700, color: statusColor(overall) }}>
                {overall}% — {statusLabel(overall)}
              </span>
            </p>
          </div>
          <button style={S.btn} onClick={() => void refresh()} disabled={loading}>
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.5rem", fontSize: "0.82rem", color: "#991b1b" }}>
            {error}
          </div>
        )}

        {/* Delivery score breakdown */}
        <div style={S.section}>
          <p style={S.sTitle}>Delivery Readiness Score</p>
          <div style={S.grid2}>
            <ScoreCard label="Overall"     score={data?.scores?.overall    ?? 0} />
            <ScoreCard label="Onboarding"  score={data?.scores?.onboarding ?? 0} sub="Form → account → ICP → search" />
            <ScoreCard label="Processing"  score={data?.scores?.processing ?? 0} sub="Apollo key + DB tables" />
            <ScoreCard label="Enrichment"  score={data?.scores?.enrichment ?? 0} sub={`${data?.enrichment_coverage_pct ?? 0}% of leads enriched`} />
            <ScoreCard label="Credits"     score={data?.scores?.credits    ?? 0} sub="Balance + ledger + notifications" />
            <ScoreCard label="Delivery"    score={data?.scores?.delivery   ?? 0} sub="Packages table + storage bucket" />
            <ScoreCard label="CSV Export"  score={data?.scores?.export     ?? 0} sub="lead_results schema ready" />
            <ScoreCard label="Payments"    score={data?.scores?.payments   ?? 0} sub="LS secret + variant IDs" />
          </div>
        </div>

        {/* Live queue */}
        <div style={S.section}>
          <p style={S.sTitle}>Live Queue</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" as const }}>
            <StatCard value={data?.new_onboarding_requests  ?? "—"} label="New onboarding requests" color={(data?.new_onboarding_requests ?? 0) > 0 ? "#f59e0b" : "#e2e8f0"} />
            <StatCard value={data?.pending_searches         ?? "—"} label="Pending searches"         color={(data?.pending_searches       ?? 0) > 0 ? "#f59e0b" : "#e2e8f0"} />
            <StatCard value={data?.processing_searches      ?? "—"} label="Searches processing"      color={(data?.processing_searches    ?? 0) > 0 ? "#3b82f6" : "#e2e8f0"} />
            <StatCard value={data?.delivery_ready_searches  ?? "—"} label="Delivery-ready searches"  color={(data?.delivery_ready_searches ?? 0) > 0 ? "#10b981" : "#e2e8f0"} />
            <StatCard value={data?.total_leads_in_db        ?? "—"} label="Total leads in DB"        color="#e2e8f0" />
            <StatCard value={data?.unenriched_leads ?? 0}           label="Unenriched leads"         color={(data?.unenriched_leads ?? 0) > 0 ? "#dc2626" : "#e2e8f0"} />
          </div>
        </div>

        {/* Config */}
        <div style={S.section}>
          <p style={S.sTitle}>Configuration</p>
          <div style={S.grid2}>
            <Check ok={!!data?.apollo_key_set}         label="APOLLO_API_KEY"           sub="Required for all lead generation" />
            <Check ok={!!data?.supabase_url_set}       label="SUPABASE_URL"              sub="Database connection" />
            <Check ok={!!data?.supabase_service_set}   label="SUPABASE_SERVICE_ROLE_KEY" sub="Admin DB operations" />
            <Check ok={!!data?.app_url_set}            label="NEXT_PUBLIC_APP_URL"       sub="Magic links, webhooks, processing triggers" />
            <Check ok={!!data?.ls_secret_set}          label="LS_WEBHOOK_SECRET"         sub="Webhook signature verification" />
            <Check ok={!!data?.ls_variants_configured} label="LS Variant IDs"            sub="starter / standard / pro mapped" />
          </div>
        </div>

        {/* DB tables */}
        <div style={S.section}>
          <p style={S.sTitle}>Database Tables</p>
          <div style={S.grid2}>
            {Object.entries(tables).map(([name, ok]) => (
              <Check key={name} ok={ok as boolean} label={name} />
            ))}
          </div>
        </div>

        {/* Storage */}
        <div style={S.section}>
          <p style={S.sTitle}>Storage</p>
          <div style={S.grid2}>
            <Check
              ok={!!data?.logos_bucket_exists}
              label="logos bucket"
              sub={data?.storage_error ? `Error: ${data.storage_error}` : (data?.storage_buckets?.join(", ") ?? "Checking…")}
            />
          </div>
        </div>

        {/* Enrichment */}
        <div style={S.section}>
          <p style={S.sTitle}>Enrichment Consistency</p>
          <div style={S.grid2}>
            <Check
              ok={!!data?.enrichment_ok}
              label={`${data?.enrichment_coverage_pct ?? 0}% leads enriched`}
              sub={
                (data?.unenriched_leads ?? 0) > 0
                  ? `${data?.unenriched_leads} leads missing lead_score (pre-pipeline inserts)`
                  : "All leads have quality scores"
              }
            />
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
