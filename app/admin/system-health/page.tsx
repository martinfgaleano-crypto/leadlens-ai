"use client";
import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface HealthData {
  apollo_key_set:            boolean;
  supabase_url_set:          boolean;
  supabase_service_set:      boolean;
  ls_secret_set:             boolean;
  ls_variants_configured:    boolean;
  app_url_set:               boolean;
  supabase_reachable?:       boolean;
  tables?:                   Record<string, boolean>;
  pending_searches?:         number;
  processing_searches?:      number;
  new_onboarding_requests?:  number;
  logos_bucket_exists?:      boolean;
  storage_buckets?:          string[];
  storage_error?:            string;
  apollo_configured:         boolean;
}

const S = {
  page:    { padding: "2rem", maxWidth: "900px", margin: "0 auto" } as React.CSSProperties,
  h1:      { fontSize: "1.4rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  sub:     { fontSize: "0.82rem", color: "#64748b", marginBottom: "2rem" } as React.CSSProperties,
  section: { marginBottom: "2rem" } as React.CSSProperties,
  sTitle:  { fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.75rem" } as React.CSSProperties,
  grid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" } as React.CSSProperties,
  card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.875rem 1rem" } as React.CSSProperties,
  row:     { display: "flex", alignItems: "center", gap: "0.625rem" } as React.CSSProperties,
  label:   { fontSize: "0.82rem", color: "#0f172a", fontWeight: 500 } as React.CSSProperties,
  value:   { fontSize: "0.78rem", color: "#64748b" } as React.CSSProperties,
  badge: (ok: boolean): React.CSSProperties => ({
    display: "inline-block", borderRadius: "99px", padding: "0.15rem 0.55rem",
    fontSize: "0.7rem", fontWeight: 700,
    background: ok ? "#dcfce7" : "#fee2e2",
    color:      ok ? "#15803d" : "#dc2626",
  }),
  statCard: (color: string): React.CSSProperties => ({
    background: "#fff", border: `2px solid ${color}`, borderRadius: "8px",
    padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
  }),
  statNum:  { fontSize: "2rem", fontWeight: 800, color: "#0f172a" } as React.CSSProperties,
  statLbl:  { fontSize: "0.75rem", color: "#64748b" } as React.CSSProperties,
  btn:      { padding: "0.45rem 1rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" } as React.CSSProperties,
} as const;

function Check({ ok, label, sub }: { ok: boolean; label: string; sub?: string }) {
  return (
    <div style={S.card}>
      <div style={S.row}>
        <span style={S.badge(ok)}>{ok ? "OK" : "MISSING"}</span>
        <span style={S.label}>{label}</span>
      </div>
      {sub && <p style={{ ...S.value, marginTop: "0.25rem", paddingLeft: "0" }}>{sub}</p>}
    </div>
  );
}

export default function SystemHealthPage() {
  const [data, setData]       = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [ts, setTs]           = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/system-health");
      const json = await res.json();
      setData(json);
      setTs(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const tables    = data?.tables ?? {};
  const allTables = Object.values(tables).every(Boolean);

  const envOk = !!(
    data?.apollo_key_set &&
    data?.supabase_url_set &&
    data?.supabase_service_set &&
    data?.app_url_set
  );

  const lsOk = !!(data?.ls_secret_set && data?.ls_variants_configured);

  const overallOk = envOk && allTables && data?.logos_bucket_exists;

  return (
    <AdminLayout>
      <div style={S.page}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <h1 style={S.h1}>System Health</h1>
          <button style={S.btn} onClick={() => void refresh()} disabled={loading}>
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
        <p style={S.sub}>
          {ts ? `Last checked: ${ts}` : "Checking…"}&ensp;·&ensp;
          <span style={{ fontWeight: 700, color: overallOk ? "#15803d" : "#dc2626" }}>
            {overallOk ? "All systems operational" : "Action required"}
          </span>
        </p>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.5rem", fontSize: "0.82rem", color: "#991b1b" }}>
            {error}
          </div>
        )}

        {/* Queue stats */}
        <div style={S.section}>
          <p style={S.sTitle}>Live Queue</p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" as const }}>
            <div style={S.statCard((data?.new_onboarding_requests ?? 0) > 0 ? "#f59e0b" : "#e2e8f0")}>
              <span style={S.statNum}>{data?.new_onboarding_requests ?? "—"}</span>
              <span style={S.statLbl}>New onboarding requests</span>
            </div>
            <div style={S.statCard((data?.pending_searches ?? 0) > 0 ? "#f59e0b" : "#e2e8f0")}>
              <span style={S.statNum}>{data?.pending_searches ?? "—"}</span>
              <span style={S.statLbl}>Pending searches</span>
            </div>
            <div style={S.statCard((data?.processing_searches ?? 0) > 0 ? "#3b82f6" : "#e2e8f0")}>
              <span style={S.statNum}>{data?.processing_searches ?? "—"}</span>
              <span style={S.statLbl}>Searches in processing</span>
            </div>
          </div>
        </div>

        {/* Critical env */}
        <div style={S.section}>
          <p style={S.sTitle}>Configuration</p>
          <div style={S.grid}>
            <Check ok={!!data?.apollo_key_set}       label="APOLLO_API_KEY"          sub="Required for lead generation" />
            <Check ok={!!data?.supabase_url_set}     label="SUPABASE_URL"             sub="Database connection" />
            <Check ok={!!data?.supabase_service_set} label="SUPABASE_SERVICE_ROLE_KEY" sub="Admin DB operations" />
            <Check ok={!!data?.app_url_set}          label="NEXT_PUBLIC_APP_URL"      sub="Magic links + redirects" />
            <Check ok={!!data?.ls_secret_set}        label="LS_WEBHOOK_SECRET"        sub="Webhook signature verification" />
            <Check ok={!!data?.ls_variants_configured} label="LS Variant IDs"         sub="starter / standard / pro mapped" />
          </div>
        </div>

        {/* Database tables */}
        <div style={S.section}>
          <p style={S.sTitle}>Database Tables</p>
          <div style={S.grid}>
            {Object.entries(tables).map(([name, ok]) => (
              <Check key={name} ok={ok} label={name} />
            ))}
          </div>
        </div>

        {/* Storage */}
        <div style={S.section}>
          <p style={S.sTitle}>Storage</p>
          <div style={S.grid}>
            <Check
              ok={!!data?.logos_bucket_exists}
              label="logos bucket"
              sub={data?.storage_error ? `Error: ${data.storage_error}` : data?.storage_buckets?.join(", ") ?? ""}
            />
          </div>
        </div>

        {/* Lemon Squeezy */}
        <div style={S.section}>
          <p style={S.sTitle}>Payments (Lemon Squeezy)</p>
          <div style={S.grid}>
            <Check ok={lsOk} label="Lemon Squeezy configured" sub={lsOk ? "Secret + variant IDs set" : "Missing secret or variant IDs"} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
