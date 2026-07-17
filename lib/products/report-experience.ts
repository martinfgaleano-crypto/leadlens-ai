// ─── Tier-resolved report experience (new_tier_reports_v0) ───────────────────
// Maps a job's product (or legacy plan) to WHICH report sections render and at
// what depth. Server-side resolution; the browser never decides entitlements.
// Honest by construction: sections only render when the underlying pipeline
// data exists — Premium strategic capabilities that are not yet automated stay
// behind flags (premium_strategy_v0) and are simply absent, never simulated.

import { resolveProduct, type ProductDefinition } from "./catalog";

export interface ReportExperience {
  tier: string;
  product_code: string;
  display_name: string;
  header_label: string;            // Mini / Brief / Complete / Strategic
  show_portfolio: boolean;         // portfolio statuses + distribution
  show_funnel: boolean;
  show_mini_verdict: boolean;      // Preview: proceed / refine / stop
  portfolio_depth: "none" | "basic" | "complete" | "advanced";
  opportunity_target: number;
  upgrade_hint: string | null;     // one contextual line, never a wall of upsells
}

const HEADER: Record<string, string> = { mini: "Preview Verdict", brief: "Executive Opportunity Brief", complete: "Executive Intelligence Brief", strategic: "Strategic Executive Brief" };

export function resolveReportExperience(planOrCode: string | null | undefined): ReportExperience {
  const p: ProductDefinition = resolveProduct(planOrCode) ?? resolveProduct("intelligence_launch_v0")!;
  const e = p.entitlements;
  const upgrade: Record<string, string | null> = {
    preview: "You validated the quality. Brief gives you a focused, compared set of 6 accounts.",
    brief: "You have accounts worth investigating. Intelligence prioritizes the full portfolio and where to put your effort.",
    intelligence: "You know where to focus. Premium turns the portfolio into a deeper commercial strategy.",
    premium: null,
  };
  return {
    tier: p.tier,
    product_code: p.product_code,
    display_name: p.display_name,
    header_label: HEADER[e.executive_report] ?? HEADER.complete,
    show_portfolio: e.portfolio_statuses !== "none",
    show_funnel: e.portfolio_allocation !== "none",
    show_mini_verdict: e.mini_verdict,
    portfolio_depth: e.portfolio_allocation === "none" ? "none" : e.portfolio_allocation === "summary" ? "basic" : e.portfolio_allocation,
    opportunity_target: e.opportunity_target,
    upgrade_hint: upgrade[p.tier] ?? null,
  };
}

/** Deterministic Preview verdict — derived from REAL portfolio results, never
 *  invented: proceed (actionable accounts found), refine (real but weak fit),
 *  stop (nothing defensible for this ICP). Labeled as a recommendation. */
export function deriveMiniVerdict(summary: { hot: number; warm: number; cold: number; discard: number; total: number }): { verdict: "proceed" | "refine" | "stop"; reason: string } {
  if (summary.hot + summary.warm > 0) return { verdict: "proceed", reason: "LeadLens found accounts with active, defensible signals for this ICP." };
  if (summary.cold > 0) return { verdict: "refine", reason: "Real signals were found but fit is weak — refine the ICP (industry, region or signal types) and re-validate." };
  return { verdict: "stop", reason: "No defensible opportunities surfaced for this ICP in this region right now — do not invest outreach effort yet." };
}
