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

export default function Pilot2Workspace({ durable }: { durable?: Durable }) {
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

      {tab === "universe" && <div style={S.card}><div style={S.h2}>Account universe (real)</div>
        <table style={S.table}><thead><tr><th style={S.th}>Company</th><th style={S.th}>Geo</th><th style={S.th}>Route</th><th style={S.th}>Decision</th><th style={S.th}>Note</th></tr></thead><tbody>
          <tr><td style={S.td}><b>Chex Finer Foods</b></td><td style={S.td}>United States</td><td style={S.td}>Specialty importer/distributor</td><td style={S.td}><span style={S.chip(C.hold)}>hold</span></td><td style={S.td}>Fit=Strong but Timing=none (no current trigger) + Evidence=Limited → honest HOLD. 3 sources, counter-signal + next-step present.</td></tr>
          <tr><td style={S.td}>Beehive Botanicals, Inc.</td><td style={S.td}>United States</td><td style={S.td}>—</td><td style={S.td}><span style={S.chip(C.muted)}>discard</span></td><td style={S.td}>Rejected in qualification (score 1.5).</td></tr>
        </tbody></table>
        <div style={{ ...S.li, marginTop: 8, color: C.warn }}>Only 2 candidates surfaced (provider discovery skipped — same-day quota exhausted). NOT padded. A fresh-quota run is required for a 50–100 candidate universe.</div>
      </div>}

      {tab === "tiers" && <div style={S.card}><div style={S.h2}>Four tiers (one foundation; nesting verified)</div>
        <table style={S.table}><thead><tr><th style={S.th}>Tier</th><th style={S.th}>Target</th><th style={S.th}>Delivered</th><th style={S.th}>Status</th><th style={S.th}>PDF</th></tr></thead><tbody>
          {p.tiers.map((t) => <tr key={t.tier}><td style={S.td}><b>{t.tier}</b></td><td style={S.td}>{t.target}</td><td style={S.td}>{t.delivered ?? "—"}</td><td style={S.td}><span style={S.chip(t.partial ? C.warn : C.ok)}>{t.partial ? "PARTIAL" : "FULL"}</span> PILOT/FOUNDER_REVIEW</td><td style={S.td}>{t.pdf}</td></tr>)}
        </tbody></table>
        <div style={{ ...S.li, marginTop: 8, color: C.muted }}>Rendered via the canonical V2.4 renderer from ONE foundation; every tier PARTIAL (1/target). Not final customer deliverables until a fresh-quota run reaches real counts.</div>
      </div>}

      {tab === "compare" && <div style={S.card}><div style={S.h2}>Pilot 1 vs Pilot 2</div>
        <table style={S.table}><thead><tr><th style={S.th}>Dimension</th><th style={S.th}>Pilot 1 (Colombia)</th><th style={S.th}>Pilot 2 (US export)</th></tr></thead><tbody>
          {[["Objective", "Colombia domestic opportunity", "Colombia → US export (interpreted, US ICP built)"],
            ["Context depth", "Founder-curated", "Customer Context Intake V1 (guided + AI-assisted)"],
            ["Accounts", "10 curated + 5 excluded", "1 qualified US (Chex Finer Foods) — supply-capped"],
            ["Buyer intelligence", "Route-level", "Stakeholder functions + buyer-access model"],
            ["Timing", "Present", "Correctly absent → HOLD (no fake intent)"],
            ["Economics", "Notes", "Constraints envelope + route-economics questions"],
            ["Deliverables", "Pilot 1 PDFs", "4 canonical V2.4 tiers (PARTIAL), verified nesting"]].map((r) => <tr key={r[0]}><td style={S.td}><b>{r[0]}</b></td><td style={S.td}>{r[1]}</td><td style={S.td}>{r[2]}</td></tr>)}
        </tbody></table>
      </div>}

      {tab === "custfb" && <div style={S.card}><div style={S.h2}>Pilot 2 customer feedback instrument</div>
        {["Did LeadLens understand the US-export objective?", "Are the proposed market-entry routes realistic? Which is most plausible?", "Are the accounts commercially relevant?", "Does buyer-function / access information help?", "Does the purchase-mechanism view help?", "Does timing / trigger improve actionability?", "Are export/import dependencies useful (commercial, not legal)?", "Are the commercial unknowns clear?", "What would you validate first?", "Which tier feels most valuable? What did Brief add over Preview? Portfolio over Brief? Premium over Portfolio?", "What information is still missing?", "Would this reduce US-entry research time?", "Would this be worth paying for? Why?"].map((q, i) => <div key={i} style={S.li}><b>{i + 1}.</b> {q}</div>)}
        <div style={{ ...S.li, marginTop: 8, color: C.muted }}>Capture: 1–5 rating + free text per item, per-tier value, account/route corrections, new customer facts.</div>
      </div>}
    </div>
  );
}
