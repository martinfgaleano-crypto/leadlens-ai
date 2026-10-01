"use client";
import { useState } from "react";
import { AMOR_PILOT2 } from "@/lib/intelligence/amor-de-gea-pilot2";
import { AMOR_PILOT1_FEEDBACK } from "@/lib/intelligence/amor-de-gea-pilot1-feedback";
import { PILOT2_US_ROUTES, PILOT2_EXPORT_DEPENDENCIES, PILOT2_CLASSIFICATION_QUESTION } from "@/lib/intelligence/pilot2-us-routes";

const C = { ink: "#0f172a", sub: "#334155", muted: "#64748b", line: "#e2e8f0", faint: "#f8fafc", cobalt: "#0284c7", ok: "#047857", warn: "#b45309", hold: "#7c3aed" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  page: { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.ink, maxWidth: 1080, margin: "0 auto", padding: "0 4px 48px" },
  eyebrow: { fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.cobalt },
  h1: { fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", margin: "4px 0 2px" },
  tabs: { display: "flex", flexWrap: "wrap", gap: 6, margin: "18px 0 20px", borderBottom: `1px solid ${C.line}`, paddingBottom: 10 },
  tab: (a: boolean): React.CSSProperties => ({ fontSize: 13, fontWeight: 700, padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: "none", background: a ? C.cobalt : C.faint, color: a ? "#fff" : C.sub }),
  card: { border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14, background: "#fff" },
  h2: { fontSize: 15, fontWeight: 800, margin: "0 0 10px" },
  row: { display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${C.faint}`, fontSize: 13 },
  k: { color: C.muted }, v: { fontWeight: 700, textAlign: "right" as const },
  chip: (bg: string): React.CSSProperties => ({ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: bg, color: "#fff", marginRight: 6 }),
  li: { fontSize: 13, color: C.sub, padding: "2px 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 },
  stat: { border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", background: C.faint },
  statN: { fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }, statL: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12.5 },
  th: { textAlign: "left" as const, fontWeight: 700, color: C.muted, borderBottom: `2px solid ${C.line}`, padding: "6px 8px" },
  td: { borderBottom: `1px solid ${C.faint}`, padding: "6px 8px", verticalAlign: "top" as const },
};
const decColor = (d: string) => d === "prioritize" ? C.ok : d === "validate" ? C.cobalt : d === "monitor" ? C.warn : C.hold;

const ROUTES = PILOT2_US_ROUTES;
const DEPS = PILOT2_EXPORT_DEPENDENCIES;

interface Durable { contextConfirmed: boolean; contextUpdatedAt: string | null; contextSummary: string | null; contextVersion: number | null; feedbackCount: number }
// Minimal shape of CustomerJobState (customer-job-v1) for Admin observability.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Job = any;

export default function Pilot2Workspace({ durable, job }: { durable?: Durable; job?: Job }) {
  const [tab, setTab] = useState("overview");
  const p = AMOR_PILOT2, fb = AMOR_PILOT1_FEEDBACK;
  const TABS = [["overview", "Overview"], ["feedback", "Pilot 1 Feedback"], ["reconcile", "Reconciliation"], ["objective", "Objective"], ["routes", "US Routes"], ["deps", "Export Deps"], ["universe", "Account Universe"], ["tiers", "Tiers"], ["compare", "Pilot 1 vs 2"], ["custfb", "Customer Feedback"]];
  return (
    <div style={S.page}>
      <div style={S.eyebrow}>Amor de Gea · Pilot 2 · US Export</div>
      <h1 style={S.h1}>Pilot 2 Workspace</h1>
      <div style={{ fontSize: 13, color: C.muted }}>{p.objective}</div>
      <div style={S.tabs}>{TABS.map(([id, label]) => <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>)}</div>

      {tab === "overview" && <>
        <div style={S.card}><div style={S.h2}>Overview</div>
          <div style={S.grid}>
            <div style={S.stat}><div style={S.statN}>{p.research.candidate_universe ?? "—"}</div><div style={S.statL}>Candidates</div></div>
            <div style={S.stat}><div style={S.statN}>{p.research.delivered_accounts ?? "—"}</div><div style={S.statL}>Qualified US</div></div>
            <div style={S.stat}><div style={S.statN}>${p.research.provider_spend_usd ?? "—"}</div><div style={S.statL}>Provider spend</div></div>
            <div style={S.stat}><div style={{ ...S.statN, color: C.warn }}>{p.research.supply_state}</div><div style={S.statL}>Supply</div></div>
          </div>
          <div style={{ marginTop: 12 }}>
            {[["Client", p.client], ["Objective", "US export market entry"], ["Source → Target", "Colombia → United States"], ["Template", p.template], ["Approval", p.approval_state], ["Vault reuse", p.research.vault_reuse], ["Feedback source", p.feedback_source], ["Run", p.research.run_id]].map(([k, v]) => <div key={k as string} style={S.row}><span style={S.k}>{k}</span><span style={S.v}>{v}</span></div>)}
          </div>
          <div style={{ ...S.li, marginTop: 8, color: C.warn }}>{p.research.supply_note}</div>
        </div>
        {job && <div style={S.card}><div style={S.h2}>Multi-pass Customer Job (customer-job-v1)</div>
          <div style={S.grid}>
            <div style={S.stat}><div style={{ ...S.statN, color: C.ok }}>{job.qualified?.length ?? 0}</div><div style={S.statL}>Qualified</div></div>
            <div style={S.stat}><div style={S.statN}>{job.candidates?.length ?? 0}</div><div style={S.statL}>Candidates</div></div>
            <div style={S.stat}><div style={S.statN}>{job.passesCompleted ?? 0}</div><div style={S.statL}>Passes</div></div>
            <div style={S.stat}><div style={{ ...S.statN, color: C.cobalt }}>{job.status}</div><div style={S.statL}>Status</div></div>
          </div>
          <div style={{ marginTop: 12 }}>
            {["Preview", "Brief", "Portfolio", "Premium"].map((t) => { const r = job.tierReadiness?.[t]; return r ? <div key={t} style={S.row}><span style={S.k}>{t} readiness</span><span style={{ ...S.v, color: r.deliveryReady ?? r.full ? C.ok : C.warn }}>{r.actual}/{r.target} · capacity {r.capacityReady ?? r.actual >= r.target ? "READY" : "PARTIAL"} · actionability {r.actionabilityRequired ? (r.actionabilityReady ? "READY" : "RESEARCH REQUIRED") : "NOT REQUIRED"} · delivery {r.deliveryReady ?? r.full ? "READY" : "BLOCKED"}</span></div> : null; })}
          </div>
          {job.actionabilityEscalation && <div style={{ marginTop: 10 }}>
            <div style={{ ...S.li, fontWeight: 700, color: C.ink }}>Actionability research escalation</div>
            <div style={S.row}><span style={S.k}>Status / pass</span><span style={S.v}>{job.actionabilityEscalation.status} · {job.actionabilityEscalation.pass}/{job.actionabilityEscalation.maxPasses}</span></div>
            <div style={S.row}><span style={S.k}>Deepened / newly discovered</span><span style={S.v}>{job.actionabilityEscalation.accountsDeepened} / {job.actionabilityEscalation.accountsDiscovered}</span></div>
            <div style={S.row}><span style={S.k}>Mechanisms / access / timing / Prioritize</span><span style={S.v}>{job.actionabilityEscalation.mechanismsVerified} / {job.actionabilityEscalation.accessPathsIdentified} / {job.actionabilityEscalation.currentTimingSignals} / {job.actionabilityEscalation.prioritizeFound}</span></div>
            <div style={S.row}><span style={S.k}>Stop condition</span><span style={S.v}>{job.actionabilityEscalation.stopCondition ?? "running"}</span></div>
          </div>}
          {job.canonicalIntelligence && <div style={{ marginTop: 10 }}>
            <div style={{ ...S.li, fontWeight: 700, color: C.ink }}>Canonical above-account intelligence</div>
            <div style={S.row}><span style={S.k}>Market Intelligence</span><span style={S.v}>{job.canonicalIntelligence.market_intelligence?.state ?? "NOT_MEASURED"}</span></div>
            <div style={S.row}><span style={S.k}>Selected / capacity target</span><span style={S.v}>{job.canonicalIntelligence.scope?.selected ?? 0} / {job.canonicalIntelligence.scope?.capacity_target ?? 0}</span></div>
            <div style={S.row}><span style={S.k}>Commercial routes / buyer types</span><span style={S.v}>{job.canonicalIntelligence.market_intelligence?.routes?.length ?? 0} / {job.canonicalIntelligence.market_intelligence?.buyer_types?.length ?? 0}</span></div>
            <div style={S.row}><span style={S.k}>Benchmark accounts / visual datasets</span><span style={S.v}>{job.canonicalIntelligence.benchmark?.accounts?.length ?? 0} / {job.canonicalIntelligence.charts?.length ?? 0}</span></div>
            {job.canonicalIntelligence.market_research_universe && <>
              <div style={S.row}><span style={S.k}>Market / account / selected populations</span><span style={S.v}>{job.canonicalIntelligence.market_research_universe.population?.population_size ?? 0} / {job.canonicalIntelligence.market_research_universe.account_population?.population_size ?? 0} / {job.canonicalIntelligence.market_research_universe.selected_population?.population_size ?? 0}</span></div>
              <div style={S.row}><span style={S.k}>Routes researched / supported</span><span style={S.v}>{job.canonicalIntelligence.market_research_universe.coverage?.routes_researched ?? 0} / {job.canonicalIntelligence.market_research_universe.coverage?.routes_supported ?? 0}</span></div>
              <div style={S.row}><span style={S.k}>Mechanisms researched / found / verified</span><span style={S.v}>{job.canonicalIntelligence.market_research_universe.coverage?.mechanisms_researched ?? 0} / {job.canonicalIntelligence.market_research_universe.coverage?.mechanisms_found ?? 0} / {job.canonicalIntelligence.market_research_universe.coverage?.mechanisms_verified ?? 0}</span></div>
              <div style={S.row}><span style={S.k}>Corroboration attempted / achieved</span><span style={S.v}>{job.canonicalIntelligence.market_research_universe.coverage?.corroboration_attempted ?? 0} / {job.canonicalIntelligence.market_research_universe.coverage?.corroboration_achieved ?? 0}</span></div>
              <div style={{ ...S.li, color: C.warn }}>Market coverage is bounded route research; it is not complete US market coverage and is not inferred from the selected portfolio.</div>
            </>}
            <div style={{ ...S.li, color: C.muted }}>{job.canonicalIntelligence.scope?.scope_note}</div>
          </div>}
          {(() => { const q = job.qualified ?? []; const d = { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<string, number>; for (const a of q) d[a.decision] = (d[a.decision] ?? 0) + 1; const holdShare = q.length ? d.hold / q.length : 0; return <>
            <div style={{ ...S.li, marginTop: 10, fontWeight: 700, color: C.ink }}>Decision distribution (calibrated)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "4px 0" }}>{(["prioritize", "validate", "monitor", "hold"] as const).map((k) => <span key={k} style={S.chip(decColor(k))}>{k} {d[k]}</span>)}</div>
            {q.length >= 3 && holdShare > 0.8 && <div style={{ ...S.li, color: C.warn }}>⚠ HOLD &gt; 80% — calibration diagnostic: verify channel-access assessment + search universe breadth (decision-calibration tests gate the logic).</div>}
          </>; })()}
          <div style={{ ...S.li, marginTop: 10, fontWeight: 700, color: C.ink }}>Vault write-through (reconciliation §6.2)</div>
          <div style={S.row}><span style={S.k}>Discovered (fresh, evaluated)</span><span style={S.v}>{job.vault?.discovered ?? 0}</span></div>
          <div style={S.row}><span style={S.k}>Net-new companies inserted</span><span style={{ ...S.v, color: C.ok }}>{job.vault?.newInserted ?? 0}</span></div>
          <div style={S.row}><span style={S.k}>Re-observed (already in Vault)</span><span style={S.v}>{job.vault?.existingReused ?? 0}</span></div>
          <div style={S.row}><span style={S.k}>Vault-first matches NOT selected (§2)</span><span style={S.v}>{job.vault?.vaultFirstMatches ?? 0}</span></div>
          <div style={S.row}><span style={S.k}>Rejected non-account</span><span style={S.v}>{job.vault?.rejectedNonAccount ?? 0}</span></div>
          <div style={{ ...S.li, marginTop: 4, color: C.muted }}>Vault-selection policy: below 5,000 companies Vault is inventory/dedup/memory — the shortlist is driven by fresh external discovery, not Vault reuse (§2).</div>
          <div style={{ ...S.li, marginTop: 10, fontWeight: 700, color: C.ink }}>Qualified foundation ({job.qualified?.length ?? 0})</div>
          <div style={{ overflowX: "auto" }}><table style={S.table}><thead><tr><th style={S.th}>Account</th><th style={S.th}>Route</th><th style={S.th}>Decision</th></tr></thead>
            <tbody>{(job.qualified ?? []).map((q: { key: string; company: string; route: string; decision: string }) => <tr key={q.key}><td style={S.td}><b>{q.company}</b></td><td style={S.td}>{q.route}</td><td style={S.td}><span style={S.chip(decColor(q.decision))}>{q.decision}</span></td></tr>)}</tbody></table></div>
          <div style={{ ...S.li, marginTop: 10, fontWeight: 700, color: C.ink }}>Per-route yield</div>
          {(Object.values(job.routeYield ?? {}) as Array<{ route: string; passes: number; uniqueCandidates: number; qualified: number }>).map((r) => <div key={r.route} style={S.row}><span style={S.k}>{r.route}</span><span style={S.v}>{r.passes} pass · {r.uniqueCandidates} cand · {r.qualified} qual</span></div>)}
          <div style={{ ...S.li, marginTop: 8, color: C.muted }}>Multi-pass accumulation (customer-job-v1): Vault-first → route/geo-diverse discovery → Vault write-through → union/dedup/rejection-memory → research+qualify NEW → adapt. Job id {job.jobId}.</div>
        </div>}
        <div style={S.card}><div style={S.h2}>Durable state (migration 065)</div>
          {durable ? <>
            <div style={S.row}><span style={S.k}>Customer Context</span><span style={{ ...S.v, color: durable.contextConfirmed ? C.ok : C.muted }}>{durable.contextConfirmed ? `confirmed (v${durable.contextVersion})` : "not persisted — using static"}</span></div>
            <div style={S.row}><span style={S.k}>Context last updated</span><span style={S.v}>{durable.contextUpdatedAt ? new Date(durable.contextUpdatedAt).toLocaleString() : "—"}</span></div>
            <div style={S.row}><span style={S.k}>Persisted feedback records</span><span style={S.v}>{durable.feedbackCount}</span></div>
            {durable.contextSummary && <><div style={{ ...S.li, marginTop: 8, color: C.muted }}>Bounded interpretation summary ({durable.contextSummary.length}/600):</div><div style={{ fontSize: 12, color: C.sub, background: C.faint, borderRadius: 8, padding: "8px 10px" }}>{durable.contextSummary}</div></>}
          </> : <div style={S.li}>Store not wired / 065 not applied — Admin shows static modules.</div>}
        </div>
        <div style={S.card}><div style={S.h2}>Provider status (why supply is limited)</div>
          {(["brave","tavily","serper","exa_firecrawl"] as const).map((k) => <div key={k} style={S.row}><span style={S.k}>{k.replace("_"," / ")}</span><span style={{ ...S.v, color: /healthy/.test((p.research as any).provider_status?.[k] ?? "") ? C.warn : C.muted, fontWeight: 600, maxWidth: 620 }}>{(p.research as any).provider_status?.[k] ?? "—"}</span></div>)}
          <div style={{ ...S.row }}><span style={S.k}>operating mode</span><span style={{ ...S.v, color: C.warn }}>{(p.research as any).provider_status?.operating_mode ?? "—"}</span></div>
          <div style={{ ...S.li, marginTop: 8, color: C.muted }}>The discovery engine refused under-corroborated candidates (truth gate held). Full counts need provider capacity restored — not a code fix.</div>
        </div>
        <div style={S.card}><div style={S.h2}>Section status</div>
          {p.sections.map((s) => <div key={s.id} style={S.row}><span style={S.k}>{s.label}{s.note ? ` — ${s.note}` : ""}</span><span style={{ ...S.v, color: s.status === "ready_for_review" ? C.ok : s.status === "blocked" ? C.warn : C.muted }}>{s.status.replace(/_/g, " ")}</span></div>)}
        </div>
      </>}

      {tab === "feedback" && <>
        <div style={S.card}><div style={S.h2}>Real Pilot 1 feedback — {fb.provenance.respondent}, {fb.provenance.role} ({fb.provenance.date})</div>
          <div style={{ ...S.li, color: C.muted, marginBottom: 10 }}>{fb.provenance.note}</div>
          <div style={S.grid}>{Object.entries(fb.ratings).map(([k, v]) => <div key={k} style={S.stat}><div style={{ ...S.statN, color: v >= 5 ? C.ok : v >= 4 ? C.cobalt : C.warn }}>{v}/5</div><div style={S.statL}>{k.replace(/_/g, " ")}</div></div>)}</div>
        </div>
        <div style={S.card}><div style={S.h2}>Valued</div>{fb.valued.map((x) => <div key={x} style={S.li}>✓ {x}</div>)}</div>
        <div style={S.card}><div style={S.h2}>Wants deeper</div>{fb.wants_deeper.map((x) => <div key={x} style={S.li}>→ {x}</div>)}</div>
        <div style={S.card}><div style={S.h2}>Accounts (all new) — operational priority</div>
          {fb.accounts.operational_priority_order.map((a, i) => <div key={a} style={S.li}><b>{i + 1}.</b> {a}</div>)}
          <div style={{ ...S.li, color: C.muted, marginTop: 6 }}>Validate-first: {fb.accounts.validate_first.join(", ")}. {fb.accounts.note}</div>
        </div>
        <div style={S.card}><div style={S.h2}>Route preference (Colombia — context, not copied to US)</div>
          {Object.entries(fb.route_preference_colombia).map(([k, v]) => <div key={k} style={S.row}><span style={S.k}>{k.replace(/_/g, " ")}</span><span style={S.v}>{v}/5</span></div>)}
        </div>
        <div style={S.card}><div style={S.h2}>Commercial priorities (become critical for US export)</div>
          {Object.entries(fb.priorities).map(([k, v]) => <div key={k} style={{ marginBottom: 6 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{k.replace(/_/g, " ")}</div><div style={S.li}>{[...(v as readonly string[])].join(" · ")}</div></div>)}
        </div>
      </>}

      {tab === "reconcile" && <div style={S.card}><div style={S.h2}>Feedback → LeadLens response (§ reconciliation)</div>
        <table style={S.table}><thead><tr><th style={S.th}>Customer ask</th><th style={S.th}>Current status</th><th style={S.th}>Pilot 2 response</th></tr></thead><tbody>
          {[["Buyer / decision-maker", "Partial — inferred stakeholder functions (Premium)", "Keep functions + buyer-access state"],
            ["Contactability", "Not a contact DB by design", "Buyer-access classification; public contact only where legitimate"],
            ["Purchase mechanism", "Partial (channel inference)", "Explicit purchase-mechanism model"],
            ["Comparable-purchase evidence", "Evidence discipline present", "Surface as evidence, never intent"],
            ["Timing / trigger", "Already improved (What Changed)", "Reuse; no observed event → no timing claim"],
            ["Volume", "New framing", "KNOWN / BOUNDED / UNKNOWN only"],
            ["Price / margin", "New (Intake V1)", "Constraints envelope + route-economics questions"],
            ["Current suppliers", "Already improved (counterevidence)", "Show as counter-signal"],
            ["Repeat probability", "Monitor relationship", "UNKNOWN / to-validate; never a fabricated probability"],
            ["Next step", "Already improved", "Reuse"]].map((r) => <tr key={r[0]}><td style={S.td}><b>{r[0]}</b></td><td style={S.td}>{r[1]}</td><td style={S.td}>{r[2]}</td></tr>)}
        </tbody></table>
        <div style={{ ...S.li, marginTop: 10, color: C.muted }}>Guardrails: not a contact database (not Apollo), not a legal opinion, not a financial model. Canonical adoptions go to founder review (not auto-merged).</div>
      </div>}

      {tab === "objective" && <div style={S.card}><div style={S.h2}>US export objective</div>
        <div style={S.li}>{p.objective}</div>
        <div style={{ ...S.li, marginTop: 8 }}><b>Constraint reinterpretation (inference — validate):</b> glass → international freight breakage + case-pack + warehouse handling; MOQ ~50 units → likely below importer viability threshold (recompute pilot economics); premium positioning → must survive the landed-cost stack (freight + duty + importer/distributor margin).</div>
        <div style={{ ...S.li, marginTop: 8 }}><b>Product classification:</b> UNCERTAIN (food/beverage vs supplement vs cosmetic) → FOUNDER_CONFIRMATION_REQUIRED before any compliance specificity.</div>
      </div>}

      {tab === "routes" && <div style={S.card}><div style={S.h2}>US commercial routes (decisions, not scores)</div>
        <table style={S.table}><thead><tr><th style={S.th}>Route</th><th style={S.th}>Decision</th><th style={S.th}>Buyer function</th><th style={S.th}>Purchase mechanism</th><th style={S.th}>Key unknown / what changes it</th></tr></thead><tbody>
          {ROUTES.map((r) => <tr key={r.route}><td style={S.td}><b>{r.route}</b></td><td style={S.td}><span style={S.chip(decColor(r.decision))}>{r.decision}</span></td><td style={S.td}>{r.buyer_function}</td><td style={S.td}>{r.purchase_mechanism}</td><td style={S.td}>{r.unknowns}<div style={{ color: C.muted, marginTop: 3 }}>→ {r.changes_decision}</div></td></tr>)}
        </tbody></table>
        <div style={{ ...S.li, marginTop: 8, color: C.muted }}>Colombia route preferences are customer context, not copied to the US; US evidence sets the ranking. Each route carries discovery-query seeds for the next fresh-quota run.</div>
      </div>}

      {tab === "deps" && <div style={S.card}><div style={S.h2}>Export / import dependency map — commercial, not legal advice</div>
        <table style={S.table}><thead><tr><th style={S.th}>Dependency</th><th style={S.th}>Classification</th><th style={S.th}>Commercial impact</th></tr></thead><tbody>
          {DEPS.map((d) => <tr key={d.item}><td style={S.td}><b>{d.item}</b></td><td style={S.td}>{d.classification}</td><td style={S.td}>{d.commercial_impact}</td></tr>)}
        </tbody></table>
        <div style={{ ...S.li, marginTop: 10, color: C.warn }}>Not a legal opinion. Items are commercial dependencies requiring specialist confirmation for Amor de Gea's exact product classification.</div>
        <div style={{ ...S.h2, marginTop: 14, fontSize: 13.5 }}>Classification question (founder/customer)</div>
        <div style={S.li}>{PILOT2_CLASSIFICATION_QUESTION}</div>
      </div>}

      {tab === "universe" && <div style={S.card}><div style={S.h2}>Account universe (durable latest customer foundation)</div>
        <table style={S.table}><thead><tr><th style={S.th}>Company</th><th style={S.th}>Route</th><th style={S.th}>Decision</th></tr></thead><tbody>
          {(job?.qualified ?? []).map((q: { key: string; company: string; route: string; decision: string }) =>
            <tr key={q.key}><td style={S.td}><b>{q.company}</b></td><td style={S.td}>{q.route}</td><td style={S.td}><span style={S.chip(decColor(q.decision))}>{q.decision}</span></td></tr>)}
        </tbody></table>
        {!job && <div style={{ ...S.li, marginTop: 8, color: C.warn }}>No durable customer-job foundation is currently available.</div>}
        {job && <>
          <div style={{ ...S.li, marginTop: 8, color: C.muted }}>{job.qualified?.length ?? 0} qualified from {job.candidates?.length ?? 0} canonical candidates. This table is derived from the latest durable customer job, not a static Pilot 2 claim.</div>
          <div style={{ ...S.li, marginTop: 10, fontWeight: 700, color: C.ink }}>Excluded before customer selection ({job.excluded?.length ?? 0})</div>
          {(job.excluded ?? []).map((x: { company: string; reason: string }) => <div key={`${x.company}:${x.reason}`} style={S.row}><span style={S.k}>{x.company}</span><span style={S.v}>{x.reason}</span></div>)}
          <div style={{ ...S.li, marginTop: 10, fontWeight: 700, color: C.ink }}>Qualified but not selected ({job.selection?.qualifiedNotSelected?.length ?? 0})</div>
          {(job.selection?.qualifiedNotSelected ?? []).map((x: { key: string; company: string; reason: string }) => <div key={x.key} style={S.row}><span style={S.k}>{x.company}</span><span style={S.v}>{x.reason}</span></div>)}
        </>}
      </div>}

      {tab === "tiers" && <div style={S.card}><div style={S.h2}>Four tiers (one foundation; nesting verified)</div>
        <table style={S.table}><thead><tr><th style={S.th}>Tier</th><th style={S.th}>Target</th><th style={S.th}>Delivered</th><th style={S.th}>Status</th><th style={S.th}>PDF</th></tr></thead><tbody>
          {p.tiers.map((t) => { const live = job?.tierReadiness?.[t.tier]; const partial = live ? !live.full : t.partial; return <tr key={t.tier}><td style={S.td}><b>{t.tier}</b></td><td style={S.td}>{live?.target ?? t.target}</td><td style={S.td}>{live?.actual ?? t.delivered ?? "—"}</td><td style={S.td}><span style={S.chip(partial ? C.warn : C.ok)}>{partial ? "PARTIAL" : "FULL"}</span> PILOT/FOUNDER_REVIEW</td><td style={S.td}>{t.pdf}</td></tr>; })}
        </tbody></table>
        <div style={{ ...S.li, marginTop: 8, color: C.muted }}>Rendered via the canonical V2.4 renderer from one durable foundation. Live readiness comes from the latest customer job; no tier is padded when fewer eligible accounts survive.</div>
      </div>}

      {tab === "compare" && <div style={S.card}><div style={S.h2}>Pilot 1 vs Pilot 2</div>
        <table style={S.table}><thead><tr><th style={S.th}>Dimension</th><th style={S.th}>Pilot 1 (Colombia)</th><th style={S.th}>Pilot 2 (US export)</th></tr></thead><tbody>
          {[["Objective", "Colombia domestic opportunity", "Colombia → US export (interpreted, US ICP built)"],
            ["Context depth", "Founder-curated", "Customer Context Intake V1 (guided + AI-assisted)"],
            ["Accounts", "10 curated + 5 excluded", job ? `${job.qualified?.length ?? 0} qualified US from the latest national multi-pass foundation` : "No durable Pilot 2 foundation available"],
            ["Buyer intelligence", "Route-level", "Stakeholder functions + buyer-access model"],
            ["Timing", "Present", "Correctly absent → HOLD (no fake intent)"],
            ["Economics", "Notes", "Constraints envelope + route-economics questions"],
            ["Deliverables", "Pilot 1 PDFs", "4 canonical V2.4 tiers, deterministic nesting; Premium may remain partial rather than fill"]].map((r) => <tr key={r[0]}><td style={S.td}><b>{r[0]}</b></td><td style={S.td}>{r[1]}</td><td style={S.td}>{r[2]}</td></tr>)}
        </tbody></table>
      </div>}

      {tab === "custfb" && <div style={S.card}><div style={S.h2}>Pilot 2 customer feedback instrument</div>
        {["Did LeadLens understand the US-export objective?", "Are the proposed market-entry routes realistic? Which is most plausible?", "Are the accounts commercially relevant?", "Does buyer-function / access information help?", "Does the purchase-mechanism view help?", "Does timing / trigger improve actionability?", "Are export/import dependencies useful (commercial, not legal)?", "Are the commercial unknowns clear?", "What would you validate first?", "Which tier feels most valuable? What did Brief add over Preview? Portfolio over Brief? Premium over Portfolio?", "What information is still missing?", "Would this reduce US-entry research time?", "Would this be worth paying for? Why?"].map((q, i) => <div key={i} style={S.li}><b>{i + 1}.</b> {q}</div>)}
        <div style={{ ...S.li, marginTop: 8, color: C.muted }}>Capture: 1–5 rating + free text per item, per-tier value, account/route corrections, new customer facts.</div>
      </div>}
    </div>
  );
}
