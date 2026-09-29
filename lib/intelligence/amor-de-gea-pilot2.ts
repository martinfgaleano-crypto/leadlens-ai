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
    run_id: "intel_e3e119b1b73f738e3eeb58e1d48f8d01",
    ran_at: "2026-09-29",
    provider_spend_usd: 0.24,          // real usage delta this run (Anthropic; search providers free-tier)
    candidate_universe: 3,             // 3 candidates researched (BASF Coatings + Singota DISCARD off-target; Whole Foods qualified)
    delivered_accounts: 1,             // 1 qualified US account: Whole Foods (HOLD, Fit=Strong, Timing=none)
    supply_state: "partial" as "pending" | "sufficient" | "partial" | "insufficient",
    supply_note:
      "Discovery COLLAPSE root-caused and FIXED (2026-09-29), not 'quota'. Root causes were reusable product defects: (1) no pacing/backoff at the search-provider layer, so Brave's free-tier burst-429 tripped a permanent per-run cooldown; (2) discovery hard-wired to [brave,tavily,serper] with no fallback to the healthy, search-capable Firecrawl; (3) Tavily 433 misclassified as 'unknown'; (4) manufacturing-centric research-readiness taxonomy that dropped consumer-goods buyers; (5) verbose interpreted org-type phrases used as search seeds → near-zero enumeration recall. All fixed + tested. Direct engine probe after the fix: operating_mode=full_discovery, providers_available=[brave,firecrawl], 34 result pages, 6 grounded names, 2 accepted (Whole Foods, Meyer Natural Foods). End-to-end run then DELIVERED 1 qualified account (Whole Foods, HOLD) where the pre-fix spine delivered 0. Residual gap to 6/12/18 is genuine per-pass supply for a narrow new US vertical (few in-scope buyers per pass) + the event-signal lane surfacing some off-target companies (correctly DISCARDed) — NOT a provider block and NOT a truth-gate relaxation. Exa remains excluded (§12).",
    provider_status: {
      brave: "healthy; paced (≥1.1s spacing) + retry — 0 errors across a 14-call multi-query run after the fix",
      tavily: "rate-limited (HTTP 433) — correctly classified and bypassed; not required",
      serper: "unfunded (no credits) — cannot fund (§6); correctly bypassed; not required",
      firecrawl: "ACTIVE search-capable discovery fallback (450 credits) — 0 errors, contributes grounding when brave degrades (§17/§64)",
      exa: "defined but NOT wired into discovery (excluded per §12)",
      operating_mode: "full_discovery",
    },
    product_fixes: [
      "resilience.ts: per-provider pacing + bounded retry honoring Retry-After (429/433/5xx retry; 401/402/432 immediate) — commit 9038aca",
      "Firecrawl wired as a grounding fallback in all 3 discovery provider arrays (enumeration, company-first, event-first) — removes the 3-provider single point of failure (§18)",
      "classifyProviderError: Tavily 433 → rate_limited (was 'unknown')",
      "research-readiness FAMILY taxonomy: added importer/specialty-retail/food-beverage/gifting/spa channels for consumer-goods buyers (logistics/software still rejected) — commit 863072f",
      "enumeration recall: concise interpreted industries seed search queries instead of verbose org-type sentences (specificity still enforced at the gates)",
    ],
  },
  // Tier artifacts (regenerated through the canonical pipeline + V2.4 renderer — §66). Counts are truthful;
  // a tier below its target is labeled PARTIAL.
  // All four rendered from ONE foundation (nesting verified: preview⊂brief⊂portfolio⊂premium). delivered=1
  // each → every tier is PARTIAL vs target; labeled honestly (§49/§81). Real US account: Whole Foods
  // (HOLD, Fit=Strong, Timing=none, evidence Limited/3 sources, counter-evidence + next-step present).
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
