"use client";
import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateStats {
  total_candidates:     number;
  new_candidates:       number;
  needs_review:         number;
  approved_candidates:  number;
  rejected_candidates:  number;
  duplicate_candidates: number;
  promoted_candidates:  number;
  approval_rate_pct:    number;
  promotion_rate_pct:   number;
}

interface Candidate {
  id:                  string;
  company_name:        string;
  website:             string | null;
  domain:              string | null;
  country:             string | null;
  industry:            string | null;
  confidence_score:    number | null;
  review_status:       string;
  approved_for_vault:  boolean;
  claude_review_notes: string | null;
  raw_notes:           string | null;
  discovered_by:       string | null;
  source_type:         string | null;
  promoted_at:         string | null;
  created_at:          string;
  reviewed_at:         string | null;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const S = {
  card:  { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" } as React.CSSProperties,
  label: { fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "0.4rem" } as React.CSSProperties,
  val:   { fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.02em" } as React.CSSProperties,
  sub:   { fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.3rem" } as React.CSSProperties,
  btn:   (variant: "primary" | "ghost" | "danger" | "green") => ({
    padding: "0.35rem 0.75rem",
    borderRadius: "0.4rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    border: "1px solid",
    cursor: "pointer",
    fontFamily: "inherit",
    ...(variant === "primary" ? { background: "#0f172a", color: "#fff", borderColor: "#0f172a" }
      : variant === "green"   ? { background: "#15803d", color: "#fff", borderColor: "#15803d" }
      : variant === "danger"  ? { background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }
      :                         { background: "#fff", color: "#374151", borderColor: "#e2e8f0" }),
  }) as React.CSSProperties,
} as const;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new:          { bg: "#f1f5f9", color: "#475569" },
  needs_review: { bg: "#fef3c7", color: "#92400e" },
  approved:     { bg: "#dcfce7", color: "#15803d" },
  rejected:     { bg: "#fee2e2", color: "#dc2626" },
  duplicate:    { bg: "#e0e7ff", color: "#4338ca" },
};

const STATUS_OPTIONS = ["", "new", "needs_review", "approved", "rejected", "duplicate"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={S.card}>
      <div style={S.label}>{label}</div>
      <div style={S.val}>{value}</div>
      {sub && <div style={S.sub}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ display: "inline-block", background: c.bg, color: c.color, borderRadius: 999, padding: "0.18rem 0.6rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {status.replace("_", " ")}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#cbd5e1", fontSize: "0.75rem" }}>—</span>;
  const color = score >= 75 ? "#15803d" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ width: 60, height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VaultCandidatesPage() {
  const [stats, setStats]           = useState<CandidateStats | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [acting, setActing]         = useState<string | null>(null); // candidateId being actioned

  const perPage = 25;

  const load = useCallback(async (p = page, st = filterStatus, co = filterCountry, ind = filterIndustry) => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(p), per_page: String(perPage) });
    if (st)  params.set("status",   st);
    if (co)  params.set("country",  co);
    if (ind) params.set("industry", ind);

    try {
      const res = await adminFetch(`/api/admin/vault-candidates?${params}`);
      const d   = await res.json() as { stats: CandidateStats; candidates: Candidate[]; total: number };
      setStats(d.stats);
      setCandidates(d.candidates ?? []);
      setTotal(d.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterCountry, filterIndustry]);

  useEffect(() => { void load(1, "", "", ""); /* eslint-disable-next-line */ }, []);

  async function action(id: string, act: string, notes?: string) {
    setActing(id);
    try {
      await adminFetch(`/api/admin/vault-candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, ...(notes ? { notes } : {}) }),
      });
      await load(page, filterStatus, filterCountry, filterIndustry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  function applyFilters(st = filterStatus, co = filterCountry, ind = filterIndustry) {
    setPage(1);
    void load(1, st, co, ind);
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const fmt = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <AdminLayout>
      {/* ── Header ── */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          Vault Candidates
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.35rem 0 0" }}>
          Companies staged for review before entering the Vault.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.6rem", color: "#dc2626", fontSize: "0.82rem" }}>
          {error}
        </div>
      )}

      {/* ── Pipeline stats ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.875rem", marginBottom: "1.75rem" }}>
          <StatCard label="Total"      value={stats.total_candidates} />
          <StatCard label="New"        value={stats.new_candidates}       sub="Awaiting triage" />
          <StatCard label="Needs Review" value={stats.needs_review}       sub="Flagged for human" />
          <StatCard label="Approved"   value={stats.approved_candidates}  sub={`${stats.approval_rate_pct}% approval rate`} />
          <StatCard label="Rejected"   value={stats.rejected_candidates} />
          <StatCard label="Duplicates" value={stats.duplicate_candidates} />
          <StatCard label="Promoted"   value={stats.promoted_candidates}  sub={`${stats.promotion_rate_pct}% of approved`} />
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); applyFilters(e.target.value, filterCountry, filterIndustry); }}
          style={{ padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.82rem", background: "#fff", fontFamily: "inherit", color: "#0f172a" }}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === "" ? "All statuses" : s.replace("_", " ")}</option>)}
        </select>
        <input
          placeholder="Country filter"
          value={filterCountry}
          onChange={e => setFilterCountry(e.target.value)}
          onBlur={() => applyFilters()}
          onKeyDown={e => e.key === "Enter" && applyFilters()}
          style={{ padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.82rem", fontFamily: "inherit", width: 140 }}
        />
        <input
          placeholder="Industry filter"
          value={filterIndustry}
          onChange={e => setFilterIndustry(e.target.value)}
          onBlur={() => applyFilters()}
          onKeyDown={e => e.key === "Enter" && applyFilters()}
          style={{ padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.82rem", fontFamily: "inherit", width: 150 }}
        />
        <span style={{ color: "#94a3b8", fontSize: "0.78rem", marginLeft: "auto" }}>
          {total} candidate{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>Loading…</div>
        ) : candidates.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No candidates found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Company", "Website", "Country", "Industry", "Confidence", "Status", "Promoted", "Date", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.7rem 0.875rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < candidates.length - 1 ? "1px solid #f1f5f9" : "none", opacity: acting === c.id ? 0.5 : 1 }}>
                    <td style={{ padding: "0.65rem 0.875rem", maxWidth: 200 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.company_name}
                      </div>
                      {c.claude_review_notes && (
                        <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.claude_review_notes}>
                          {c.claude_review_notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem", maxWidth: 160 }}>
                      {c.website ? (
                        <span style={{ fontSize: "0.75rem", color: "#0ea5e9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {c.domain ?? c.website}
                        </span>
                      ) : <span style={{ color: "#cbd5e1", fontSize: "0.75rem" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem", fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap" }}>
                      {c.country ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem", fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap" }}>
                      {c.industry ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem" }}>
                      <ConfidenceBar score={c.confidence_score} />
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem" }}>
                      <StatusBadge status={c.review_status} />
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem", fontSize: "0.75rem", color: c.promoted_at ? "#15803d" : "#cbd5e1", whiteSpace: "nowrap" }}>
                      {c.promoted_at ? fmt(c.promoted_at) : "—"}
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem", fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {fmt(c.created_at)}
                    </td>
                    <td style={{ padding: "0.65rem 0.875rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        {/* Auto-review */}
                        {(c.review_status === "new" || c.review_status === "needs_review") && (
                          <button
                            style={S.btn("ghost")}
                            disabled={acting === c.id}
                            onClick={() => void action(c.id, "review")}
                            title="Run automated review checks"
                          >
                            Review
                          </button>
                        )}
                        {/* Manual approve */}
                        {c.review_status !== "approved" && c.review_status !== "rejected" && (
                          <button
                            style={S.btn("primary")}
                            disabled={acting === c.id}
                            onClick={() => void action(c.id, "approve")}
                          >
                            Approve
                          </button>
                        )}
                        {/* Reject */}
                        {c.review_status !== "rejected" && (
                          <button
                            style={S.btn("danger")}
                            disabled={acting === c.id}
                            onClick={() => void action(c.id, "reject")}
                          >
                            Reject
                          </button>
                        )}
                        {/* Promote */}
                        {c.review_status === "approved" && !c.promoted_at && (
                          <button
                            style={S.btn("green")}
                            disabled={acting === c.id}
                            onClick={() => void action(c.id, "promote")}
                            title="Move to Vault"
                          >
                            Promote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > perPage && (
          <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Page {page} of {totalPages}</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => { const p = page - 1; setPage(p); void load(p, filterStatus, filterCountry, filterIndustry); }}
                disabled={page === 1}
                style={{ padding: "0.4rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: page === 1 ? "#f8fafc" : "#fff", color: page === 1 ? "#cbd5e1" : "#374151", fontSize: "0.78rem", fontWeight: 600, cursor: page === 1 ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                ← Prev
              </button>
              <button
                onClick={() => { const p = page + 1; setPage(p); void load(p, filterStatus, filterCountry, filterIndustry); }}
                disabled={page >= totalPages}
                style={{ padding: "0.4rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: page >= totalPages ? "#f8fafc" : "#fff", color: page >= totalPages ? "#cbd5e1" : "#374151", fontSize: "0.78rem", fontWeight: 600, cursor: page >= totalPages ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
