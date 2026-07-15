"use client";
// Human calibration of source-benchmark auto-flags. Admin records per-result
// verdicts; agreement stays honest until enough reviews exist.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.25rem" } as React.CSSProperties,
  banner: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: "0.6rem", padding: "0.7rem 1rem", fontSize: "0.82rem", fontWeight: 600, marginBottom: "1rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "0.9rem" } as React.CSSProperties,
  pill: (bg: string, fg: string) => ({ display: "inline-block", background: bg, color: fg, borderRadius: "999px", padding: "0.1rem 0.5rem", fontSize: "0.64rem", fontWeight: 700, marginRight: "0.3rem" }) as React.CSSProperties,
  vbtn: (on: boolean, yes: boolean) => ({ border: `1px solid ${on ? (yes ? "#86efac" : "#fca5a5") : "#e2e8f0"}`, background: on ? (yes ? "#f0fdf4" : "#fef2f2") : "#fff", color: on ? (yes ? "#166534" : "#991b1b") : "#64748b", borderRadius: "0.4rem", padding: "0.15rem 0.5rem", fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", marginRight: "0.25rem" }) as React.CSSProperties,
  save: { background: "#0f172a", color: "#fff", border: "none", borderRadius: "0.45rem", padding: "0.35rem 0.9rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
};

type Item = {
  result_key: string; query_id: string; region: string; signal: string; url: string; canonical_url: string;
  title: string | null; company_guess: string; provider_first_seen: string; source_type: string | null;
  bucket: string; provider_date: string | null; in_brave: boolean; in_serper: boolean;
  resolved_date: { date: string | null; confidence: string; validation_method: string; conflict: boolean };
  auto_flags: Record<string, boolean | string>;
};
type Verdict = Record<string, unknown> & { result_key: string };

const AXES: { key: string; label: string }[] = [
  { key: "company_match", label: "Company match" },
  { key: "relevant", label: "Relevant" },
  { key: "date_valid", label: "Date valid" },
  { key: "grounded_claim", label: "Grounded claim" },
  { key: "valid_signal", label: "Valid signal" },
  { key: "qualified_opportunity", label: "Qualified" },
];

export default function SourceReviewPage() {
  const [data, setData] = useState<{ sample: Item[]; verdicts: Verdict[]; calibration: { reviewed: number; of: number; qualified_agreement: number | null; note: string }; migration_missing?: boolean; banner: string; total_available: number } | null>(null);
  const [draft, setDraft] = useState<Record<string, Record<string, boolean>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/intelligence/source-review");
    if (res.ok) {
      const d = await res.json();
      setData(d);
      const seed: Record<string, Record<string, boolean>> = {};
      for (const v of d.verdicts ?? []) {
        seed[v.result_key] = {};
        for (const a of AXES) if (typeof v[a.key] === "boolean") seed[v.result_key][a.key] = v[a.key];
      }
      setDraft(seed);
      setSaved(new Set((d.verdicts ?? []).map((v: Verdict) => v.result_key)));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setAxis = (key: string, axis: string, val: boolean) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [axis]: d[key]?.[axis] === val ? undefined as unknown as boolean : val } }));

  async function save(it: Item) {
    setBusy(it.result_key);
    try {
      const res = await adminFetch("/api/admin/intelligence/source-review", { method: "POST", body: JSON.stringify({
        canonical_url: it.canonical_url, query_id: it.query_id, region: it.region, provider: it.provider_first_seen,
        auto_flags: it.auto_flags, ...(draft[it.result_key] ?? {}),
      }) });
      if (res.ok) { setSaved((s) => new Set(s).add(it.result_key)); await load(); }
    } finally { setBusy(null); }
  }

  if (!data) return <AdminLayout><p style={{ color: "#64748b" }}>Loading…</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 style={S.h1}>Source Review — human calibration</h1>
      <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.75rem" }}>Confirm or correct the auto-flags on a balanced sample. Agreement stays honest until enough verdicts exist.</p>
      <div style={S.banner}>{data.banner}</div>

      <div style={S.card}>
        <strong style={{ fontSize: "0.85rem" }}>Calibration</strong>
        <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: "0.3rem" }}>
          Reviewed {data.calibration.reviewed}/{data.calibration.of} · sample from {data.total_available} benchmark results ·
          qualified agreement: {data.calibration.qualified_agreement === null ? <em>{data.calibration.note}</em> : `${Math.round(data.calibration.qualified_agreement * 100)}%`}
        </div>
        {data.migration_missing && <div style={{ color: "#92400e", fontSize: "0.78rem", marginTop: "0.4rem" }}>Migration 033 not applied — verdicts cannot persist yet. Apply <code>supabase/migrations/033_source_review.sql</code>.</div>}
        {data.sample.length === 0 && <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.4rem" }}>No benchmark artifact found — run <code>npm run sources:benchmark</code> first.</div>}
      </div>

      {data.sample.map((it) => {
        const af = it.auto_flags as Record<string, boolean>;
        return (
          <div key={it.result_key} style={S.card}>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.3rem" }}>
              <span style={S.pill("#eef2ff", "#3730a3")}>{it.region}</span>
              <span style={S.pill("#f0fdf4", "#166534")}>{it.signal}</span>
              <span style={S.pill("#f8fafc", "#475569")}>{it.provider_first_seen}{it.in_serper && it.in_brave ? " (both)" : ""}</span>
              <span style={S.pill(it.bucket === "qualified" ? "#dcfce7" : it.bucket === "rejected" ? "#fee2e2" : "#fef3c7", "#334155")}>{it.bucket.replace(/_/g, " ")}</span>
              {saved.has(it.result_key) && <span style={S.pill("#dbeafe", "#1e40af")}>reviewed</span>}
            </div>
            <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>{it.company_guess}</strong>
            <div style={{ fontSize: "0.78rem", color: "#334155", margin: "0.2rem 0" }}>{it.title}</div>
            <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.35rem" }}>
              date: {it.resolved_date.date ?? "unknown"} ({it.resolved_date.confidence}, {it.resolved_date.validation_method}){it.resolved_date.conflict ? " · ⚠ conflict" : ""} · source: {it.source_type ?? "—"}
              {" · "}<a href={it.url} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>open source</a>
            </div>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: "0.4rem" }}>
              auto: {AXES.map((a) => `${a.label} ${af[a.key] ? "✓" : "✗"}`).join(" · ")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              {AXES.map((a) => (
                <span key={a.key} style={{ fontSize: "0.68rem" }}>
                  <span style={{ color: "#64748b", marginRight: "0.2rem" }}>{a.label}</span>
                  <button style={S.vbtn(draft[it.result_key]?.[a.key] === true, true)} onClick={() => setAxis(it.result_key, a.key, true)}>yes</button>
                  <button style={S.vbtn(draft[it.result_key]?.[a.key] === false, false)} onClick={() => setAxis(it.result_key, a.key, false)}>no</button>
                </span>
              ))}
              <button style={S.save} disabled={busy === it.result_key} onClick={() => save(it)}>{busy === it.result_key ? "…" : "Save verdict"}</button>
            </div>
          </div>
        );
      })}
    </AdminLayout>
  );
}
