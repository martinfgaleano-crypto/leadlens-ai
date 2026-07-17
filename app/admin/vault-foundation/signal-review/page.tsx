"use client";
// Governed review of provider-search Vault signals. Grouped by company; per
// signal: rights, evidence tier, dedupe cluster, verdicts, reason codes.
// Nothing auto-approved; every decision audited + revocable.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.2rem" } as React.CSSProperties,
  banner: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: "0.6rem", padding: "0.6rem 1rem", fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.7rem", padding: "0.9rem 1.1rem", marginBottom: "0.9rem" } as React.CSSProperties,
  pill: (bg: string, fg: string) => ({ display: "inline-block", background: bg, color: fg, borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.64rem", fontWeight: 700, marginRight: "0.3rem" }) as React.CSSProperties,
  chip: (on: boolean) => ({ border: `1px solid ${on ? "#7dd3fc" : "#e2e8f0"}`, background: on ? "#f0f9ff" : "#fff", color: on ? "#075985" : "#64748b", borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.66rem", cursor: "pointer", marginRight: "0.25rem", marginBottom: "0.2rem" }) as React.CSSProperties,
  btn: (bg: string) => ({ background: bg, color: "#fff", border: "none", borderRadius: "0.4rem", padding: "0.25rem 0.6rem", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", marginRight: "0.3rem", marginTop: "0.3rem" }) as React.CSSProperties,
  sel: { fontSize: "0.7rem", padding: "0.15rem 0.3rem", borderRadius: 4, border: "1px solid #cbd5e1", marginRight: "0.4rem" } as React.CSSProperties,
};

type Sig = {
  signal_id: string; signal_type: string; claim: string | null; signal_date: string | null; freshness: string | null;
  confidence: number | null; source_url: string | null; source_type: string | null; provider: string | null;
  rights_status: string; proposed_tier: string; cluster_size: number; cluster_role: string; signal_status: string;
  active_review: { review_status: string; rights_status: string | null; evidence_tier: string | null; reviewed_at?: string; review_origin?: string; reviewer_agent?: string | null; requires_human_confirmation?: boolean } | null;
};
type Group = { company_id: string; company: string; region: string | null; country: string | null; identity_suspect?: boolean; entity_repaired?: boolean; signals: Sig[] };

const RIGHTS = ["", "customer_display_allowed", "link_and_summary_allowed", "short_excerpt_allowed", "internal_only", "metadata_only", "restricted", "unknown"];
const TIERS = ["", "A", "B", "C", "D", "E"];
const REASONS = ["correct_company", "wrong_company", "valid_date", "grounded_claim", "unsupported_claim", "valid_signal", "generic_mention", "stale_signal", "duplicate_event", "syndicated_source", "insufficient_evidence", "rights_restricted", "customer_display_allowed", "monitor_only", "contradiction", "qualified_opportunity"];

export default function SignalReviewPage() {
  const [data, setData] = useState<{ groups: Group[]; progress: { reviewed: number; total: number }; distributions?: { rights: Record<string, number>; proposed_tier: Record<string, number> }; review_metrics?: Record<string, number>; migration_missing?: boolean; review_fetch_error?: string | null; banner: string } | null>(null);
  const [draft, setDraft] = useState<Record<string, { rights?: string; tier?: string; reasons: string[] }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/vault-foundation/signal-review");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const d = (id: string) => draft[id] ?? { reasons: [] };
  const setField = (id: string, k: "rights" | "tier", v: string) => setDraft((p) => ({ ...p, [id]: { ...d(id), [k]: v } }));
  const toggleReason = (id: string, r: string) => setDraft((p) => { const cur = d(id); const reasons = cur.reasons.includes(r) ? cur.reasons.filter((x) => x !== r) : [...cur.reasons, r]; return { ...p, [id]: { ...cur, reasons } }; });

  async function decide(sig: Sig, decision: string) {
    setBusy(sig.signal_id);
    try {
      const cur = d(sig.signal_id);
      const res = await adminFetch("/api/admin/vault-foundation/signal-review", { method: "POST", body: JSON.stringify({
        signal_id: sig.signal_id, decision, rights_status: cur.rights || (decision === "approved" ? "link_and_summary_allowed" : undefined),
        evidence_tier: cur.tier || sig.proposed_tier, reason_codes: cur.reasons,
        verdicts: { company_match: !cur.reasons.includes("wrong_company"), date_valid: !!sig.signal_date, claim: !cur.reasons.includes("unsupported_claim") },
      }) });
      const j = await res.json();
      if (!res.ok) alert(j.error ?? j.result?.reason ?? "failed");
      await load();
    } finally { setBusy(null); }
  }

  if (!data) return <AdminLayout><p style={{ color: "#64748b" }}>Loading…</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 style={S.h1}>Signal Review — provider-search governance</h1>
      <div style={S.banner}>{data.banner}</div>
      {data.migration_missing && <div style={S.card}>Migration 034 not applied — reviews cannot persist. Apply <code>supabase/migrations/034_vault_signal_review.sql</code>.</div>}
      {data.review_fetch_error && <div style={{ ...S.card, borderColor: "#fecaca", color: "#991b1b" }}>Saved reviews could not be loaded — decisions below may look unreviewed. ({data.review_fetch_error})</div>}
      <div style={S.card}>
        <strong style={{ fontSize: "0.82rem" }}>Progress:</strong> {data.progress.reviewed}/{data.progress.total} signals reviewed
        {data.distributions && <span style={{ fontSize: "0.72rem", color: "#64748b" }}> · proposed tiers: {Object.entries(data.distributions.proposed_tier).map(([t, n]) => `${t}:${n}`).join(" ")} · rights: {Object.entries(data.distributions.rights).map(([r, n]) => `${r.slice(0, 10)}:${n}`).join(" ")}</span>}
        {data.review_metrics && (
          <div style={{ fontSize: "0.72rem", color: "#334155", marginTop: "0.35rem" }}>
            <strong>Active decisions by origin:</strong> human-reviewed {data.review_metrics.human_reviewed} · AI-assisted {data.review_metrics.ai_reviewed} (not human-reviewed) · auto-evaluated {data.review_metrics.auto_evaluated}
            <br />
            approved {data.review_metrics.approved} · monitor-only {data.review_metrics.approved_monitor_only} · rejected {data.review_metrics.rejected} · quarantined {data.review_metrics.quarantined} · duplicate {data.review_metrics.duplicate} · requires human confirmation {data.review_metrics.requires_human_confirmation} · report-eligible {data.review_metrics.report_eligible}
          </div>
        )}
        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.3rem" }}>Small sample — do not tune thresholds from these counts.</div>
      </div>

      {data.groups.slice(0, 20).map((g) => (
        <div key={g.company_id} style={S.card}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
            {g.company}
            {g.identity_suspect && <span style={{ ...S.pill("#fee2e2", "#991b1b"), marginLeft: "0.4rem" }}>⚠ identity suspect — fix before approving</span>}
            {g.entity_repaired && !g.identity_suspect && <span style={{ ...S.pill("#e0f2fe", "#075985"), marginLeft: "0.4rem" }}>entity repaired — verify name</span>}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.4rem" }}>{[g.region, g.country].filter(Boolean).join(" · ")}</div>
          {g.signals.map((s) => {
            const active = s.active_review?.review_status;
            return (
              <div key={s.signal_id} style={{ borderTop: "1px solid #f1f5f9", padding: "0.5rem 0", fontSize: "0.76rem" }}>
                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.2rem" }}>
                  <span style={S.pill("#f0fdf4", "#166534")}>{s.signal_type}</span>
                  <span style={S.pill("#eef2ff", "#3730a3")}>Tier {s.proposed_tier} (proposed)</span>
                  {s.cluster_size > 1 && <span style={S.pill("#fef3c7", "#92400e")}>{s.cluster_role} ×{s.cluster_size}</span>}
                  <span style={S.pill("#f8fafc", "#64748b")}>rights: {s.rights_status}</span>
                  {active && <span style={S.pill(active.startsWith("approved") ? "#dcfce7" : active === "revoked" ? "#e0f2fe" : "#fee2e2", "#334155")}>{active}</span>}
                </div>
                <div style={{ color: "#334155" }}>{s.claim ?? "(no claim)"}</div>
                <div style={{ color: "#94a3b8", fontSize: "0.7rem" }}>{s.signal_date ?? "no date"} · {s.freshness ?? "-"} · {s.provider ?? "-"} · {s.source_type ?? "-"} {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>source</a>}</div>
                {s.active_review && (
                  <div style={{ marginTop: "0.25rem", fontSize: "0.7rem", color: "#334155", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.25rem 0.5rem" }}>
                    <strong>Saved:</strong> {s.active_review.review_status}
                    {" · rights: "}{s.active_review.rights_status ?? "—"}
                    {" · tier: "}{s.active_review.evidence_tier ?? "—"}
                    {" · by: "}{s.active_review.review_origin === "ai_assisted" ? `AI-assisted (${s.active_review.reviewer_agent ?? "agent"})` : (s.active_review.review_origin ?? "human")}
                    {s.active_review.reviewed_at && <> · {new Date(s.active_review.reviewed_at).toLocaleString()}</>}
                    {s.active_review.requires_human_confirmation && <span style={{ ...S.pill("#fef3c7", "#92400e"), marginLeft: "0.35rem" }}>requires human confirmation</span>}
                  </div>
                )}
                <div style={{ marginTop: "0.3rem" }}>
                  <select style={S.sel} value={d(s.signal_id).rights ?? ""} onChange={(e) => setField(s.signal_id, "rights", e.target.value)}>{RIGHTS.map((r) => <option key={r} value={r}>{r || "rights…"}</option>)}</select>
                  <select style={S.sel} value={d(s.signal_id).tier ?? ""} onChange={(e) => setField(s.signal_id, "tier", e.target.value)}>{TIERS.map((t) => <option key={t} value={t}>{t ? `Tier ${t}` : "tier…"}</option>)}</select>
                </div>
                <div style={{ marginTop: "0.25rem" }}>{REASONS.map((r) => <button key={r} style={S.chip(d(s.signal_id).reasons.includes(r))} onClick={() => toggleReason(s.signal_id, r)}>{r.replace(/_/g, " ")}</button>)}</div>
                <div>
                  <button style={S.btn("#166534")} disabled={busy === s.signal_id} onClick={() => decide(s, "approved")}>Approve</button>
                  <button style={S.btn("#0369a1")} disabled={busy === s.signal_id} onClick={() => decide(s, "approved_monitor_only")}>Monitor-only</button>
                  <button style={S.btn("#b45309")} disabled={busy === s.signal_id} onClick={() => decide(s, "quarantined")}>Quarantine</button>
                  <button style={S.btn("#7c3aed")} disabled={busy === s.signal_id} onClick={() => decide(s, "duplicate")}>Duplicate</button>
                  <button style={S.btn("#991b1b")} disabled={busy === s.signal_id} onClick={() => decide(s, "rejected")}>Reject</button>
                  {active && active.startsWith("approved") && <button style={S.btn("#64748b")} disabled={busy === s.signal_id} onClick={() => decide(s, "revoked")}>Revoke</button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </AdminLayout>
  );
}
