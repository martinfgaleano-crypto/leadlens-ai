"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface SourceRow {
  id:              string;
  name:            string;
  description:     string | null;
  active:          boolean;
  total_runs:      number;
  total_results:   number;
  success_rate:    number | null;
  avg_duration_ms: number | null;
  last_run:        string | null;
}

interface GlobalStats {
  total_runs:           number;
  global_success_rate:  number;
  fastest_ms:           number | null;
  slowest_ms:           number | null;
  most_productive:      string | null;
  avg_duration_ms:      number | null;
  avg_results_per_run:  number | null;
  healthy_sources:      number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const SOURCE_LABELS: Record<string, string> = {
  apollo:           "Apollo.io",
  google_maps:      "Google Maps",
  linkedin:         "LinkedIn",
  company_websites: "Company Websites",
  directories:      "Directories",
  crunchbase:       "Crunchbase",
};

const SOURCE_ICONS: Record<string, string> = {
  apollo:           "A",
  google_maps:      "G",
  linkedin:         "in",
  company_websites: "W",
  directories:      "D",
  crunchbase:       "C",
};

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function healthStatus(src: SourceRow): { label: string; color: string; bg: string } {
  if (!src.active)           return { label: "Inactive",  color: "#94a3b8", bg: "#f1f5f9" };
  if (src.total_runs === 0)  return { label: "No runs",   color: "#d97706", bg: "#fffbeb" };
  const rate = src.success_rate ?? 0;
  if (rate >= 80)            return { label: "Healthy",   color: "#16a34a", bg: "#f0fdf4" };
  if (rate >= 50)            return { label: "Warning",   color: "#d97706", bg: "#fffbeb" };
  return                            { label: "Failing",   color: "#dc2626", bg: "#fef2f2" };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.5rem", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.35rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [stats, setStats]     = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/sources")
      .then(r => r.ok ? r.json() : null)
      .then((d: { sources: SourceRow[]; stats: GlobalStats } | null) => {
        if (d) { setSources(d.sources); setStats(d.stats); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Lead Sources</h1>
        <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{sources.length} sources</span>
      </div>

      {/* Global stats */}
      {stats && (
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <StatCard label="Total Runs"         value={stats.total_runs.toLocaleString()} />
          <StatCard label="Success Rate"       value={`${stats.global_success_rate}%`} />
          <StatCard label="Avg Duration"       value={fmtDuration(stats.avg_duration_ms)} />
          <StatCard label="Avg Leads / Run"    value={stats.avg_results_per_run ?? "—"} />
          <StatCard label="Top Source"         value={stats.most_productive ? SOURCE_LABELS[stats.most_productive] ?? stats.most_productive : "—"} />
          <StatCard label="Fastest Run"        value={fmtDuration(stats.fastest_ms)} />
          <StatCard label="Slowest Run"        value={fmtDuration(stats.slowest_ms)} />
          <StatCard label="Healthy Sources"    value={stats.healthy_sources} />
        </div>
      )}

      {/* Source cards grid */}
      {loading ? (
        <div style={{ color: "#94a3b8", textAlign: "center", padding: "3rem" }}>Loading sources…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {sources.map(src => {
            const health = healthStatus(src);
            const icon   = SOURCE_ICONS[src.name] ?? src.name[0]?.toUpperCase();
            const label  = SOURCE_LABELS[src.name] ?? src.name;
            return (
              <div key={src.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center",
                      background: src.active ? "#0ea5e9" : "#e2e8f0",
                      color: src.active ? "#fff" : "#94a3b8",
                      fontWeight: 800, fontSize: "0.8rem", flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>{label}</div>
                      {src.description && <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.1rem" }}>{src.description}</div>}
                    </div>
                  </div>
                  <span style={{ background: health.bg, color: health.color, fontWeight: 700, fontSize: "0.68rem", padding: "0.2rem 0.55rem", borderRadius: "1rem", border: `1px solid ${health.color}25`, whiteSpace: "nowrap" }}>
                    {health.label}
                  </span>
                </div>

                {/* Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { label: "Total Runs",   value: src.total_runs },
                    { label: "Leads Found",  value: src.total_results },
                    { label: "Success Rate", value: src.success_rate != null ? `${src.success_rate}%` : "—" },
                    { label: "Avg Duration", value: fmtDuration(src.avg_duration_ms) },
                  ].map(m => (
                    <div key={m.label} style={{ background: "#f8fafc", borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem", marginTop: "0.1rem" }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Last run */}
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" }}>
                  Last run: {fmtDate(src.last_run)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
