"use client";
import { useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalCount    { signal: string;   count: number }
interface IndustryCount { industry: string; count: number }
interface CategoryCount { category: string; count: number }

interface RecentRow {
  company:         string;
  industry:        string | null;
  segment:         string | null;
  category:        string | null;
  feedback_signal: string;
  buying_window:   string | null;
  created_at:      string;
}

interface FeedbackStats {
  total_feedback:          number;
  reusable_feedback_count: number;
  negative_feedback_count: number;
  feedback_by_signal:      SignalCount[];
  feedback_by_industry:    IndustryCount[];
  feedback_by_category:    CategoryCount[];
  top_positive_segments:   IndustryCount[];
  top_negative_segments:   IndustryCount[];
  recent_feedback:         RecentRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SIGNAL_LABEL: Record<string, string> = {
  useful:          "Useful",
  not_useful:      "Not useful",
  irrelevant:      "Irrelevant",
  contacted:       "Contacted",
  meeting_booked:  "Meeting booked",
  wrong_fit:       "Wrong fit",
  generic:         "Too generic",
  replied:         "Replied",
  add_to_vault:    "Add to Vault",
  exclude_similar: "Exclude similar",
};

const SIGNAL_COLOR: Record<string, { bg: string; color: string }> = {
  useful:          { bg: "#dcfce7", color: "#15803d" },
  meeting_booked:  { bg: "#d1fae5", color: "#065f46" },
  replied:         { bg: "#d1fae5", color: "#065f46" },
  add_to_vault:    { bg: "#e0e7ff", color: "#3730a3" },
  contacted:       { bg: "#f0fdf4", color: "#166534" },
  not_useful:      { bg: "#fef9c3", color: "#854d0e" },
  irrelevant:      { bg: "#fef9c3", color: "#854d0e" },
  wrong_fit:       { bg: "#fee2e2", color: "#dc2626" },
  generic:         { bg: "#fff7ed", color: "#c2410c" },
  exclude_similar: { bg: "#fee2e2", color: "#b91c1c" },
};

const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  HOT:     { bg: "#fee2e2", color: "#dc2626" },
  WARM:    { bg: "#fef3c7", color: "#d97706" },
  COLD:    { bg: "#dbeafe", color: "#1d4ed8" },
  DISCARD: { bg: "#f1f5f9", color: "#475569" },
  unknown: { bg: "#f8fafc", color: "#94a3b8" },
};

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem", borderTop: accent ? `3px solid ${accent}` : undefined }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

function Badge({ signal }: { signal: string }) {
  const s = SIGNAL_COLOR[signal] ?? { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.65rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.03em" }}>
      {SIGNAL_LABEL[signal] ?? signal}
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  const cat = category ?? "unknown";
  const s = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.unknown;
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.55rem", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em" }}>
      {cat}
    </span>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
      <div style={{ width: 140, fontSize: "0.8rem", color: "#334155", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#0ea5e9", borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <div style={{ width: 32, fontSize: "0.78rem", fontWeight: 700, color: "#0f172a", textAlign: "right" }}>{count}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1rem" }}>{title}</div>
      {children}
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackAnalyticsPage() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    adminFetch("/api/admin/feedback/stats")
      .then(async r => {
        if (!r.ok) { setError(`Error ${r.status}`); return; }
        setStats(await r.json());
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const maxSignal   = stats ? Math.max(...stats.feedback_by_signal.map(s => s.count),   1) : 1;
  const maxIndustry = stats ? Math.max(...stats.feedback_by_industry.map(s => s.count), 1) : 1;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Feedback Analytics
          </h1>
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: "#64748b" }}>
            Audit what LeadLens is learning from opportunity feedback — no personal data.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ color: "#64748b", fontSize: "0.9rem", padding: "3rem 0", textAlign: "center" }}>
            Loading feedback data…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "0.75rem", padding: "1rem 1.5rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && stats && stats.total_feedback === 0 && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "0.35rem" }}>No feedback yet</div>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
              Feedback will appear here once users rate opportunities in the pipeline results.
            </div>
          </div>
        )}

        {/* Data */}
        {!loading && !error && stats && stats.total_feedback > 0 && (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <StatCard label="Total Feedback"    value={stats.total_feedback} />
              <StatCard label="Positive Signals"  value={stats.reusable_feedback_count} accent="#22c55e"
                sub="useful · replied · meeting · vault" />
              <StatCard label="Negative Signals"  value={stats.negative_feedback_count} accent="#ef4444"
                sub="wrong fit · generic · exclude" />
              <StatCard label="Unique Signals"    value={stats.feedback_by_signal.length} />
              <StatCard label="Industries Seen"   value={stats.feedback_by_industry.length} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

              {/* By signal */}
              <Section title="Feedback by Signal">
                {stats.feedback_by_signal.map(s => (
                  <BarRow key={s.signal} label={SIGNAL_LABEL[s.signal] ?? s.signal} count={s.count} max={maxSignal} />
                ))}
              </Section>

              {/* By industry */}
              <Section title="Feedback by Industry">
                {stats.feedback_by_industry.length === 0
                  ? <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No industry data yet.</div>
                  : stats.feedback_by_industry.map(s => (
                    <BarRow key={s.industry} label={s.industry} count={s.count} max={maxIndustry} />
                  ))
                }
              </Section>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

              {/* By category */}
              <Section title="By Category">
                {stats.feedback_by_category.map(s => (
                  <div key={s.category} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <CategoryBadge category={s.category} />
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.875rem" }}>{s.count}</span>
                  </div>
                ))}
              </Section>

              {/* Top positive segments */}
              <Section title="Top Positive Segments">
                {stats.top_positive_segments.length === 0
                  ? <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No positive feedback yet.</div>
                  : stats.top_positive_segments.map((s, i) => (
                    <div key={s.industry} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#334155" }}>
                        <span style={{ color: "#22c55e", fontWeight: 700, marginRight: "0.4rem" }}>{i + 1}.</span>
                        {s.industry}
                      </span>
                      <span style={{ fontWeight: 700, color: "#15803d", fontSize: "0.875rem" }}>{s.count}</span>
                    </div>
                  ))
                }
              </Section>

              {/* Top negative segments */}
              <Section title="Top Negative Segments">
                {stats.top_negative_segments.length === 0
                  ? <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No negative feedback yet.</div>
                  : stats.top_negative_segments.map((s, i) => (
                    <div key={s.industry} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#334155" }}>
                        <span style={{ color: "#ef4444", fontWeight: 700, marginRight: "0.4rem" }}>{i + 1}.</span>
                        {s.industry}
                      </span>
                      <span style={{ fontWeight: 700, color: "#dc2626", fontSize: "0.875rem" }}>{s.count}</span>
                    </div>
                  ))
                }
              </Section>
            </div>

            {/* Recent feedback table */}
            <Section title={`Recent Feedback (last ${stats.recent_feedback.length})`}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      {["Company", "Industry", "Segment", "Category", "Signal", "Buying Window", "Date"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#64748b", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_feedback.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "#0f172a", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.company}</td>
                        <td style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>{row.industry ?? "—"}</td>
                        <td style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>{row.segment  ?? "—"}</td>
                        <td style={{ padding: "0.6rem 0.75rem" }}><CategoryBadge category={row.category} /></td>
                        <td style={{ padding: "0.6rem 0.75rem" }}><Badge signal={row.feedback_signal} /></td>
                        <td style={{ padding: "0.6rem 0.75rem", color: "#64748b", fontSize: "0.78rem" }}>{row.buying_window ?? "—"}</td>
                        <td style={{ padding: "0.6rem 0.75rem", color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap" }}>{fmt(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
