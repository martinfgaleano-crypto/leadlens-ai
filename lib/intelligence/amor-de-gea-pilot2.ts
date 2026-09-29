// Amor de Gea — Pilot 2 (US export) Admin record. Data module in the SAME pattern as
// amor-de-gea-pilot1-finalization.ts, so the existing Admin pilot architecture can surface Pilot 2
// WITHOUT rewriting the hardcoded Pilot 1 workspace (Pilot 1 stays intact — §57). No customer PII, no
// fabricated accounts: account counts come from the real pipeline run and are set truthfully (§24/§49).

export type Pilot2SectionStatus = "not_started" | "in_progress" | "ready_for_review" | "approved" | "blocked";

export interface Pilot2Section {
  id: string;
  label: string;
  status: Pilot2SectionStatus;
  note?: string;
}

export const AMOR_PILOT2 = {
  pilot_id: "amor-de-gea",
  pilot_number: 2,
  version: "amor-pilot2-us-export-v1",
  client: "Amor de Gea",
  objective:
    "Begin exporting from Colombia to the United States — identify US commercial routes and accounts (specialty/natural retail, wellness hospitality/spa, premium gifting, specialty importers/distributors) for a premium botanical wellness beverage in glass.",
  template: "CUSTOMER_DELIVERABLES_V2_4",
  approval_state: "PILOT / FOUNDER_REVIEW", // never production-approved from here (§73)
  feedback_source: "founder-provided Pilot 1 feedback themes (repo form is the blank instrument)",
  repeat_suppression: true,
  // The 15 Pilot 1 (Colombia) accounts to suppress in Pilot 2 (US); naturally satisfied by the US geo gate.
  suppressed_accounts: [
    "Éteka", "Celestino Hotel Boutique & Spa", "Sinergy On", "Vitálica", "Ser Saludable",
    "Masaya Collection", "Natural + Mente", "Hotel Charleston Santa Teresa Spa", "Habibi Plantitas", "Funat",
    "BioPlaza", "Distribuidora DAM", "Hotel Spa La Colina", "Tu Tienda Saludable", "Somos Consiente",
  ],
  // Research/delivery telemetry — set truthfully from the real run (partial supply is recorded, not padded).
  research: {
    geography_target: "United States",
    vault_reuse: "OFF", // US stays fresh-discovery per standing policy
    run_id: "intel_644f3bd29d102276027c1e09654441d9",
    ran_at: "2026-09-29",
    provider_spend_usd: 0.19,          // real usage delta (Anthropic; Serper/Tavily free/errored)
    candidate_universe: 2,             // only 2 candidates surfaced — provider discovery skipped (quota exhausted)
    delivered_accounts: 1,             // 1 qualified US account (Chex Finer Foods, HOLD); Beehive Botanicals DISCARD
    supply_state: "insufficient" as "pending" | "sufficient" | "partial" | "insufficient",
    supply_note:
      "Diagnosed (2026-09-29, direct engine probe): NOT a lazy query and NOT blanket quota. Brave healthy for a single query but rate-limits under the multi-query discovery load; Tavily rate-limited (HTTP 433); Serper unfunded (no credits). Discovery engine ran 5 queries, grounded 1 name, ACCEPTED 0 — it correctly refused under-corroborated candidates (truth gate held, no fabrication). Best real foundation = 1 (Chex Finer Foods, HOLD, from a prior run). Full 2/6/12/18 needs provider capacity restored (fund Serper and/or fresh Brave/Tavily window); Exa/Firecrawl are not wired into discovery and must not be added here (§12).",
    provider_status: {
      brave: "healthy for a single query; rate-limits across a multi-query discovery run (free-tier + heavy same-day use)",
      tavily: "rate-limited (HTTP 433)",
      serper: "unfunded (no credits)",
      exa_firecrawl: "defined but NOT wired into discovery (do not add per §12)",
      operating_mode: "provider_limited",
    },
  },
  // Tier artifacts (regenerated through the canonical pipeline + V2.4 renderer — §66). Counts are truthful;
  // a tier below its target is labeled PARTIAL.
  // All four rendered from ONE foundation (nesting verified). delivered=1 each → every tier is PARTIAL vs
  // target; labeled honestly (§49/§81). Real US account: Chex Finer Foods (HOLD, Fit=Strong, Timing=none).
  tiers: [
    { tier: "Preview", target: 2, pdf: "LeadLens_AmorDeGea_Pilot2_Preview.pdf", delivered: 1, partial: true },
    { tier: "Brief", target: 6, pdf: "LeadLens_AmorDeGea_Pilot2_Brief.pdf", delivered: 1, partial: true },
    { tier: "Portfolio", target: 12, pdf: "LeadLens_AmorDeGea_Pilot2_Portfolio.pdf", delivered: 1, partial: true },
    { tier: "Premium", target: 18, pdf: "LeadLens_AmorDeGea_Pilot2_Premium.pdf", delivered: 1, partial: true },
  ],
  docs: {
    intake: "docs/customer-context/LEADLENS_CUSTOMER_CONTEXT_INTAKE_V1.md",
    plan: "docs/customer-deliverables/LEADLENS_AMORDEGEA_PILOT2_PLAN.md",
    feedback_reconciliation: "docs/customer-deliverables/LEADLENS_AMORDEGEA_PILOT2_FEEDBACK_RECONCILIATION.md",
    feedback_package: "docs/customer-deliverables/LEADLENS_AMORDEGEA_PILOT2_FEEDBACK_PACKAGE.md",
    comparison: "docs/customer-deliverables/LEADLENS_AMORDEGEA_PILOT1_VS_PILOT2.md",
  },
  sections: [
    { id: "overview", label: "Overview", status: "ready_for_review" },
    { id: "customer_context", label: "Customer Context", status: "ready_for_review", note: "Intake V1 schema + AI-assisted prompt" },
    { id: "intake", label: "Intake", status: "ready_for_review" },
    { id: "pilot1_feedback", label: "Pilot 1 Feedback", status: "ready_for_review", note: "founder-provided themes" },
    { id: "feedback_reconciliation", label: "Feedback Reconciliation", status: "ready_for_review" },
    { id: "objective", label: "US Export Objective", status: "ready_for_review" },
    { id: "us_entry_research", label: "US Entry Research", status: "in_progress", note: "live run; supply recorded truthfully" },
    { id: "route_analysis", label: "Route Analysis", status: "in_progress" },
    { id: "export_dependencies", label: "Export Dependencies", status: "in_progress", note: "commercial dependency map + disclaimer (not legal advice)" },
    { id: "account_universe", label: "Account Universe", status: "in_progress" },
    { id: "preview", label: "Preview", status: "in_progress" },
    { id: "brief", label: "Brief", status: "in_progress" },
    { id: "portfolio", label: "Portfolio", status: "in_progress" },
    { id: "premium", label: "Premium", status: "in_progress" },
    { id: "pilot1_vs_pilot2", label: "Pilot 1 vs Pilot 2", status: "in_progress" },
    { id: "customer_feedback", label: "Customer Feedback", status: "ready_for_review" },
  ] as Pilot2Section[],
} as const;
