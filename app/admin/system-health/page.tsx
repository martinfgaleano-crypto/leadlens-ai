"use client";
import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface Scores {
  onboarding:      number;
  payments:        number;
  processing:      number;
  apollo:          number;
  vault:           number;
  credits:         number;
  delivery:        number;
  customer_access: number;
  exports:         number;
  overall:         number;
}

interface HealthData {
  apollo_key_set:            boolean;
  supabase_url_set:          boolean;
  supabase_service_set:      boolean;
  ls_secret_set:             boolean;
  ls_variants_configured:    boolean;
  app_url_set:               boolean;
  resend_key_set:            boolean;
  resend_from_set:           boolean;
  cron_secret_set:           boolean;
  supabase_reachable?:       boolean;
  all_tables_ok?:            boolean;
  tables?:                   Record<string, boolean>;
  pending_searches?:         number;
  processing_searches?:      number;
  delivery_ready_searches?:  number;
  new_onboarding_requests?:  number;
  processing_ready_stuck?:   number;
  logos_bucket_exists?:      boolean;
  deliveries_bucket_exists?: boolean;
  storage_buckets?:          string[];
  storage_error?:            string;
  total_leads_in_db?:        number;
  unenriched_leads?:         number;
  enrichment_coverage_pct?:  number;
  enrichment_ok?:            boolean;
  delivery_packages_ready?:  number;
  delivery_packages_pending?: number;
  delivery_emails_sent?:     number;
  delivery_score?:           number;
  scores?:                   Scores;
}

const S = {
  page:  { padding: "2rem", maxWidth: "1020px", margin: "0 auto" } as React.CSSProperties,
  h1:    { fontSize: "1.4rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  sub:   { fontSize: "0.82rem", color: "#64748b", marginBottom: "2rem" } as React.CSSProperties,
  sec:   { marginBottom: "2rem" } as React.CSSProperties,
  stit:  { fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: "0.75rem" } as React.CSSProperties,
  grid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0.625rem" } as React.CSSProperties,
  card:  { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.75rem 1rem" } as React.CSSProperties,
  row:   { display: "flex", alignItems: "center", gap: "0.5rem" } as React.CSSProperties,
  label: { fontSize: "0.8rem", color: "#0f172a", fontWeight: 500 } as React.CSSProperties,
  sub2:  { fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.2rem" } as React.CSSProperties,
  btn:   { padding: "0.4rem 0.9rem", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" } as React.CSSProperties,
} as const;

function scoreColor(s: number) { return s >= 80 ? "#15803d" : s >= 50 ? "#d97706" : "#dc2626"; }
function scoreBg(s: number)    { return s >= 80 ? "#f0fdf4" : s >= 50 ? "#fffbeb" : "#fef2f2"; }
function scoreLabel(s: number) { return s >= 80 ? "Ready"   : s >= 50 ? "Partial" : "Not ready"; }

function ScoreCard({ label, score, sub }: { label: string; score: number; sub?: string }) {
  const color = scoreColor(score);
  return (
    <div style={{ ...S.card, background: scoreBg(score), borderColor: color + "40" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={S.label}>{label}</span>
        <span style={{ fontSize: "1.1rem", fontWeight: 800, color }}>{score}%</span>
      </div>
      <div style={{ marginTop: "0.4rem", background: "#e2e8f0", borderRadius: "99px", height: "4px", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: "99px", transition: "width 0.5s" }} />
      </div>
      {sub && <p style={{ ...S.sub2, marginTop: "0.35rem" }}>{sub}</p>}
    </div>
  );
}

function Check({ ok, label, sub, warn }: { ok: boolean; label: string; sub?: string; warn?: boolean }) {
  const bg    = ok ? "#dcfce7" : warn ? "#fef9c3" : "#fee2e2";
  const color = ok ? "#15803d" : warn ? "#a16207" : "#dc2626";
  const badge = ok ? "OK"      : warn ? "WARN"    : "MISSING";
  return (
    <div style={S.card}>
      <div style={S.row}>
        <span style={{ display: "inline-block", borderRadius: "99px", padding: "0.12rem 0.5rem", fontSize: "0.68rem", fontWeight: 700, background: bg, color, flexShrink: 0 }}>{badge}</span>
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
    setLoading(true); setError(null);
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
              <span style={{ fontWeight: 700, color: scoreColor(overall) }}>
                {overall}% — {scoreLabel(overall)}
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

        {/* Delivery readiness score */}
        <div style={S.sec}>
          <p style={S.stit}>Production Readiness Score</p>
          <div style={S.grid}>
            <ScoreCard label="Overall"         score={data?.scores?.overall          ?? 0} />
            <ScoreCard label="Onboarding"      score={data?.scores?.onboarding       ?? 0} sub="Form → account → ICP → search" />
            <ScoreCard label="Payments"        score={data?.scores?.payments         ?? 0} sub="Lemon Squeezy secret + variants" />
            <ScoreCard label="Processing"      score={data?.scores?.processing       ?? 0} sub="Apollo + DB tables" />
            <ScoreCard label="Apollo"          score={data?.scores?.apollo           ?? 0} sub="APOLLO_API_KEY" />
            <ScoreCard label="Vault"           score={data?.scores?.vault            ?? 0} sub="Cross-search lead reuse" />
            <ScoreCard label="Credits"         score={data?.scores?.credits          ?? 0} sub="Balance + ledger + notifications" />
            <ScoreCard label="Delivery"        score={data?.scores?.delivery         ?? 0} sub="Packages table + storage + Resend" />
            <ScoreCard label="Customer Access" score={data?.scores?.customer_access  ?? 0} sub="Resend email with download link" />
            <ScoreCard label="Exports"         score={data?.scores?.exports          ?? 0} sub="lead_results → CSV" />
          </div>
        </div>

        {/* Live queue */}
        <div style={S.sec}>
          <p style={S.stit}>Live Queue</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" as const }}>
            <StatCard value={data?.new_onboarding_requests  ?? "—"} label="New onboarding requests"    color={(data?.new_onboarding_requests  ?? 0) > 0 ? "#f59e0b" : undefined} />
            <StatCard value={data?.pending_searches         ?? "—"} label="Pending searches"            color={(data?.pending_searches         ?? 0) > 0 ? "#f59e0b" : undefined} />
            <StatCard value={data?.processing_searches      ?? "—"} label="Searches processing"         color={(data?.processing_searches      ?? 0) > 0 ? "#3b82f6" : undefined} />
            <StatCard value={data?.delivery_ready_searches  ?? "—"} label="Delivery-ready searches"     color={(data?.delivery_ready_searches  ?? 0) > 0 ? "#10b981" : undefined} />
            <StatCard value={data?.processing_ready_stuck   ?? "—"} label="Stuck (processing_ready)"    color={(data?.processing_ready_stuck   ?? 0) > 0 ? "#dc2626" : undefined} />
            <StatCard value={data?.delivery_packages_ready  ?? "—"} label="Packages ready"              color={(data?.delivery_packages_ready  ?? 0) > 0 ? "#10b981" : undefined} />
            <StatCard value={data?.delivery_emails_sent     ?? "—"} label="Delivery emails sent"        color={(data?.delivery_emails_sent     ?? 0) > 0 ? "#10b981" : undefined} />
            <StatCard value={data?.total_leads_in_db        ?? "—"} label="Total leads in DB"           />
            <StatCard value={data?.unenriched_leads         ?? 0}   label="Unenriched leads"            color={(data?.unenriched_leads         ?? 0) > 0 ? "#dc2626" : undefined} />
          </div>
        </div>

        {/* Configuration */}
        <div style={S.sec}>
          <p style={S.stit}>Configuration</p>
          <div style={S.grid}>
            <Check ok={!!data?.apollo_key_set}         label="APOLLO_API_KEY"             sub="Required for all lead generation" />
            <Check ok={!!data?.supabase_url_set}       label="SUPABASE_URL"                sub="Database connection" />
            <Check ok={!!data?.supabase_service_set}   label="SUPABASE_SERVICE_ROLE_KEY"   sub="Admin DB operations" />
            <Check ok={!!data?.app_url_set}            label="NEXT_PUBLIC_APP_URL"          sub="Processing triggers + magic links" />
            <Check ok={!!data?.ls_secret_set}          label="LS_WEBHOOK_SECRET"            sub="Signature verification" />
            <Check ok={!!data?.ls_variants_configured} label="LS Variant IDs"               sub="starter / standard / pro mapped" />
            <Check ok={!!data?.resend_key_set}         label="RESEND_API_KEY"               sub="Customer delivery emails" />
            <Check ok={!!data?.resend_from_set}        label="RESEND_FROM_EMAIL"            sub="Sender address for delivery emails" warn={!data?.resend_from_set} />
            <Check ok={!!data?.cron_secret_set}        label="CRON_SECRET"                  sub="Vercel Cron for /api/admin/process-ready" warn={!data?.cron_secret_set} />
          </div>
        </div>

        {/* Storage */}
        <div style={S.sec}>
          <p style={S.stit}>Storage Buckets</p>
          <div style={S.grid}>
            <Check ok={!!data?.logos_bucket_exists}      label="logos bucket"      sub="Customer logo uploads" />
            <Check ok={!!data?.deliveries_bucket_exists} label="deliveries bucket" sub="Packaged CSV files — auto-created on first delivery" warn={!data?.deliveries_bucket_exists} />
          </div>
          {data?.storage_error && (
            <p style={{ fontSize: "0.78rem", color: "#dc2626", marginTop: "0.5rem" }}>Storage error: {data.storage_error}</p>
          )}
        </div>

        {/* DB tables */}
        <div style={S.sec}>
          <p style={S.stit}>Database Tables</p>
          <div style={S.grid}>
            {Object.entries(tables).map(([name, ok]) => (
              <Check key={name} ok={ok as boolean} label={name} />
            ))}
          </div>
        </div>

        {/* Enrichment */}
        <div style={S.sec}>
          <p style={S.stit}>Enrichment Consistency</p>
          <div style={S.grid}>
            <Check
              ok={!!data?.enrichment_ok}
              label={`${data?.enrichment_coverage_pct ?? 0}% leads enriched`}
              sub={
                (data?.unenriched_leads ?? 0) > 0
                  ? `${data?.unenriched_leads} leads missing lead_score (pre-pipeline inserts)`
                  : "All leads have quality + AI scores"
              }
            />
          </div>
        </div>

        {/* Reliability */}
        <div style={S.sec}>
          <p style={S.stit}>Reliability</p>
          <div style={S.grid}>
            <Check
              ok={(data?.processing_ready_stuck ?? 0) === 0}
              label="No stuck searches"
              sub={
                (data?.processing_ready_stuck ?? 0) > 0
                  ? `${data?.processing_ready_stuck} searches are processing_ready but still pending — call POST /api/admin/process-ready`
                  : "All processing_ready searches are running or complete"
              }
              warn={(data?.processing_ready_stuck ?? 0) > 0}
            />
            <Check
              ok={!!data?.cron_secret_set}
              label="Vercel Cron wired"
              sub="Add CRON_SECRET + vercel.json cron to auto-process stuck searches"
              warn={!data?.cron_secret_set}
            />
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
