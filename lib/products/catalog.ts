// ─── LeadLens versioned product catalog (launch_tier_architecture_v0) ─────────
// Single server-side source of truth for tiers, launch prices and entitlements.
// Prices resolve ONLY from here — never trust amounts, plans or entitlements
// sent from the browser. Codes are versioned (…_launch_v0); future price
// revisions become NEW versions, they never mutate a sold version.
//
// Value progression (approved architecture):
//   Preview validates · Brief selects · Intelligence prioritizes · Premium strategizes
// Opportunity counts are OPERATING LIMITS, not the commercial promise. Every
// paid opportunity meets the same complete analytical standard; higher tiers
// add breadth, comparison, prioritization, depth and strategy — never a better
// basic quality. "Dossiers" are no longer a commercial unit (legacy fields are
// read-compatible; see MIGRATION notes at the bottom).

import type { PlanType } from "@/types";

export const CATALOG_VERSION = "launch_tier_architecture_v0";

export type ProductCode =
  | "preview_launch_v0"
  | "brief_launch_v0"
  | "intelligence_launch_v0"
  | "premium_launch_v0";

export type TierCode = "preview" | "brief" | "intelligence" | "premium";
export type CapabilityLevel = "none" | "when_found" | "basic" | "summary" | "initial" | "standard" | "complete" | "full" | "advanced" | "deep" | "reinforced" | "systematic";

export interface TierEntitlements {
  icps: { min: 1; max: 1 | 2 };
  regions: { min: 1; max: 1 | 2 | 3 };
  opportunity_target: number;          // operating limit, not the promise
  /** Accounts receiving deeper corroboration/dossier depth (0 = standard depth only). */
  deep_dossiers: number;
  what_changed: true;
  sources_and_freshness: true;
  evidence_quality: "standard" | "full" | "reinforced";
  why_now: true;
  fit_timing: "per_account" | "basic" | "complete" | "advanced";
  portfolio_statuses: "none" | "basic" | "complete";
  portfolio_allocation: "none" | "summary" | "complete" | "advanced";
  opportunity_clusters: "none" | "summary" | "complete" | "deep";
  coverage_gaps: "none" | "complete" | "advanced";
  portfolio_risk: "none" | "basic" | "complete" | "advanced";
  momentum: "none" | "initial" | "detailed";
  decay: "none" | "initial" | "detailed";
  evidence_center: "none" | "basic" | "complete" | "reinforced";
  counterevidence: "when_found" | "included" | "systematic";
  market_patterns: "none" | "summary" | "basic" | "deep";
  playbooks: boolean;
  stakeholder_hypotheses: boolean;
  discovery_questions: boolean;
  strategic_sequence: "none" | "basic" | "complete" | "advanced";
  account_memory: "none" | "snapshot" | "expanded_snapshot";
  watchlist: "none" | "initial";
  human_review: "basic_qa" | "exceptions" | "priority_exceptions";
  executive_report: "mini" | "brief" | "complete" | "strategic";
  monitoring_eligible: boolean;
  mini_verdict: boolean;               // proceed / refine / stop (Preview)
}

export interface ProductDefinition {
  product_code: ProductCode;
  tier: TierCode;
  display_name: string;
  one_liner: string;
  product_promise: string;
  positioning: string;
  price_amount: number;                // USD, launch price
  currency: "USD";
  billing_type: "one_time";
  status: "active";
  launch_price: true;                  // founding/launch pricing — NOT permanent
  effective_date: string;
  cta: string;
  /** Existing pipeline compatibility: the legacy PlanType this product runs as. */
  legacy_plan: PlanType;
  entitlements: TierEntitlements;
  feature_flags: string[];
  metadata: { recommended?: boolean; anchor?: boolean; badge?: string };
}

const COMMON = {
  currency: "USD" as const, billing_type: "one_time" as const, status: "active" as const,
  launch_price: true as const, effective_date: "2026-07-17",
};

export const PRODUCTS: Record<ProductCode, ProductDefinition> = {
  preview_launch_v0: {
    ...COMMON,
    product_code: "preview_launch_v0", tier: "preview",
    display_name: "Preview",
    one_liner: "See whether LeadLens can find defensible opportunities for your business.",
    product_promise: "Validate the quality before committing.",
    positioning: "Low-risk starting point",
    price_amount: 7, cta: "Preview my opportunities",
    legacy_plan: "sample",
    entitlements: {
      icps: { min: 1, max: 1 }, regions: { min: 1, max: 1 }, opportunity_target: 2, deep_dossiers: 0,
      what_changed: true, sources_and_freshness: true, evidence_quality: "standard",
      why_now: true, fit_timing: "per_account", portfolio_statuses: "none",
      portfolio_allocation: "none", opportunity_clusters: "none", coverage_gaps: "none",
      portfolio_risk: "none", momentum: "none", decay: "none", evidence_center: "none",
      counterevidence: "when_found", market_patterns: "none", playbooks: false,
      stakeholder_hypotheses: false, discovery_questions: false, strategic_sequence: "none",
      account_memory: "none", watchlist: "none", human_review: "basic_qa",
      executive_report: "mini", monitoring_eligible: false, mini_verdict: true,
    },
    feature_flags: ["preview_launch_v0"],
    metadata: { badge: "Low-risk starting point" },
  },
  brief_launch_v0: {
    ...COMMON,
    product_code: "brief_launch_v0", tier: "brief",
    display_name: "Brief",
    one_liner: "Get a focused set of accounts worth investigating now.",
    product_promise: "A compact, comparable opportunity set.",
    positioning: "Focused opportunity set",
    price_amount: 25, cta: "Build my opportunity brief",
    legacy_plan: "starter",
    entitlements: {
      icps: { min: 1, max: 1 }, regions: { min: 1, max: 1 }, opportunity_target: 6, deep_dossiers: 0,
      what_changed: true, sources_and_freshness: true, evidence_quality: "standard",
      why_now: true, fit_timing: "basic", portfolio_statuses: "basic",
      portfolio_allocation: "summary", opportunity_clusters: "summary", coverage_gaps: "none",
      portfolio_risk: "basic", momentum: "none", decay: "none", evidence_center: "basic",
      counterevidence: "when_found", market_patterns: "summary", playbooks: false,
      stakeholder_hypotheses: false, discovery_questions: false, strategic_sequence: "basic",
      account_memory: "none", watchlist: "none", human_review: "basic_qa",
      executive_report: "brief", monitoring_eligible: false, mini_verdict: false,
    },
    feature_flags: ["brief_launch_v0"],
    metadata: { badge: "Focused opportunity set" },
  },
  intelligence_launch_v0: {
    ...COMMON,
    product_code: "intelligence_launch_v0", tier: "intelligence",
    display_name: "Intelligence",
    one_liner: "Know which accounts deserve priority and how to allocate your commercial effort.",
    product_promise: "A prioritized portfolio, not just a list.",
    positioning: "Best for focused B2B growth",
    price_amount: 59, cta: "Build my intelligence portfolio",
    legacy_plan: "standard",
    entitlements: {
      icps: { min: 1, max: 1 }, regions: { min: 1, max: 2 }, opportunity_target: 12, deep_dossiers: 4,
      what_changed: true, sources_and_freshness: true, evidence_quality: "full",
      why_now: true, fit_timing: "complete", portfolio_statuses: "complete",
      portfolio_allocation: "complete", opportunity_clusters: "complete", coverage_gaps: "complete",
      portfolio_risk: "complete", momentum: "initial", decay: "initial", evidence_center: "complete",
      counterevidence: "included", market_patterns: "basic", playbooks: false,
      stakeholder_hypotheses: false, discovery_questions: false, strategic_sequence: "complete",
      account_memory: "snapshot", watchlist: "none", human_review: "exceptions",
      executive_report: "complete", monitoring_eligible: true, mini_verdict: false,
    },
    feature_flags: ["intelligence_launch_v0", "portfolio_intelligence_v0"],
    metadata: { recommended: true, badge: "Recommended" },
  },
  premium_launch_v0: {
    ...COMMON,
    product_code: "premium_launch_v0", tier: "premium",
    display_name: "Premium",
    one_liner: "Turn opportunity intelligence into a focused commercial strategy.",
    product_promise: "From prioritized portfolio to defensible strategy.",
    positioning: "Deepest strategy",
    price_amount: 129, cta: "Build my opportunity strategy",
    legacy_plan: "pro",
    entitlements: {
      icps: { min: 1, max: 2 }, regions: { min: 1, max: 3 }, opportunity_target: 18, deep_dossiers: 6,
      what_changed: true, sources_and_freshness: true, evidence_quality: "reinforced",
      why_now: true, fit_timing: "advanced", portfolio_statuses: "complete",
      portfolio_allocation: "advanced", opportunity_clusters: "deep", coverage_gaps: "advanced",
      portfolio_risk: "advanced", momentum: "detailed", decay: "detailed", evidence_center: "reinforced",
      counterevidence: "systematic", market_patterns: "deep", playbooks: true,
      stakeholder_hypotheses: true, discovery_questions: true, strategic_sequence: "advanced",
      account_memory: "expanded_snapshot", watchlist: "initial", human_review: "priority_exceptions",
      executive_report: "strategic", monitoring_eligible: true, mini_verdict: false,
    },
    feature_flags: ["premium_launch_v0", "premium_strategy_v0", "reinforced_evidence_v0", "opportunity_playbooks_v0", "account_memory_snapshot_v0", "initial_watchlist_v0"],
    metadata: { anchor: true, badge: "Deepest strategy" },
  },
};

// ─── Server-side resolution ───────────────────────────────────────────────────

const LEGACY_TO_PRODUCT: Record<string, ProductCode> = {
  sample: "preview_launch_v0", starter: "brief_launch_v0",
  standard: "intelligence_launch_v0", pro: "premium_launch_v0",
};

/** Resolve a product from a client-sent code — accepts new product codes AND
 *  legacy plan names (backward compatibility). Returns null for unknown input;
 *  the caller must fail closed. Prices/entitlements come ONLY from the result. */
export function resolveProduct(code: string | null | undefined): ProductDefinition | null {
  if (!code) return null;
  if (code in PRODUCTS) return PRODUCTS[code as ProductCode];
  const mapped = LEGACY_TO_PRODUCT[code];
  return mapped ? PRODUCTS[mapped] : null;
}

/** Resolve entitlements for a stored job: prefers the persisted product_code
 *  (new orders), falls back to the legacy plan mapping (historic orders). */
export function resolveEntitlementsForJob(job: { plan?: string | null; onboarding?: { product_code?: string } | null }): ProductDefinition | null {
  return resolveProduct(job.onboarding?.product_code ?? job.plan ?? null);
}

/** Launch prices are versioned, not permanent. Future revision (NOT active):
 *  preview $12 · brief $39 · intelligence $99 · premium $249 — would ship as
 *  …_v1 products; never mutate a version customers already bought. */
export const FUTURE_PRICING_NOTE = "future prices live in a new catalog version; do not activate here";

// ─── Feature flags (launch_tier_architecture_v0) ─────────────────────────────
// Env-based, safe defaults. Rollback = set LAUNCH_TIERS_V0=off → checkout and
// pricing fall back to legacy plans; catalog stays inert. Per-capability flags
// gate honest exposure of not-yet-automated capabilities.
export function launchTiersEnabled(): boolean {
  return process.env.LAUNCH_TIERS_V0 !== "off"; // default ON
}
export const CAPABILITY_FLAGS: Record<string, { default: "active" | "partial" | "flagged_off"; note: string }> = {
  launch_tier_architecture_v0: { default: "active", note: "catalog + entitlements + pricing" },
  launch_pricing_v0: { default: "active", note: "$7/$25/$59/$129 founding prices" },
  new_pricing_page_v0: { default: "active", note: "tier cards + comparison" },
  new_tier_reports_v0: { default: "partial", note: "report sections resolve by entitlements; Premium strategic sections honest-gated" },
  portfolio_intelligence_v0: { default: "partial", note: "ranking/statuses/allocation exist in pipeline output; clusters/momentum/decay partial" },
  premium_strategy_v0: { default: "flagged_off", note: "playbooks/stakeholders/scenarios NOT automated yet — never simulated" },
  reinforced_evidence_v0: { default: "flagged_off", note: "extra corroboration pass not automated yet" },
  opportunity_playbooks_v0: { default: "flagged_off", note: "depends on premium_strategy_v0" },
  account_memory_snapshot_v0: { default: "partial", note: "institutional snapshots (035) exist; customer-facing memory later" },
  initial_watchlist_v0: { default: "flagged_off", note: "interest capture only" },
  tier_upgrade_credit_v0: { default: "flagged_off", note: "requires payment provider integration (Lemon Squeezy pending)" },
};

// ─── MIGRATION (dossiers → capability depth) ─────────────────────────────────
// "Dossier" never existed as a DB field in this repo (audit 2026-07-17): the
// legacy fence was PLAN_LEAD_COUNT (10/50/100 leads). Migration here means:
// 1. lead counts stop being the sales promise → opportunity_target is an
//    operating limit resolved from this catalog;
// 2. depth is expressed as evidence_quality / clusters / strategy levels;
// 3. legacy plans (sample/starter/standard/pro) stay readable forever via
//    LEGACY_TO_PRODUCT; PLAN_LEAD_COUNT remains for historic jobs only and is
//    deprecated for new orders (see lib/pipeline.ts resolution order).
