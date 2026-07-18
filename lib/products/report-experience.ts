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

// ─── Deterministic portfolio depth (Intelligence/Premium) ────────────────────
// Everything below derives ONLY from real report data (pipeline tiers,
// evidence grounding, real event dates). No scores are invented; every state
// names its factors. One-signal accounts get honest "insufficient data"
// momentum instead of a fabricated trend.

export type PortfolioStatus = "act_now" | "investigate" | "monitor" | "reserve" | "reject";
export interface StatusVerdict { status: PortfolioStatus; label: string; because: string }

export function derivePortfolioStatus(d: { tier: string; evidence_grounded?: boolean | null; latest_date?: string | null }): StatusVerdict {
  const days = daysAgo(d.latest_date);
  if (d.tier === "DISCARD") return { status: "reject", label: "Reject", because: "The pipeline found no defensible commercial thesis for this account." };
  if (d.tier === "HOT" && d.evidence_grounded) return { status: "act_now", label: "Act now", because: "Strong fit with grounded, dated evidence — the window is open." };
  if (d.tier === "HOT") return { status: "investigate", label: "Investigate", because: "Strong fit but evidence needs validation before outreach." };
  if (d.tier === "WARM") return { status: "investigate", label: "Investigate", because: "Real signal with moderate fit — validate the thesis before committing effort." };
  if (d.tier === "COLD" && d.evidence_grounded && days !== null && days <= 60) {
    return { status: "monitor", label: "Monitor", because: "Grounded and recent, but fit or timing is weak today — track for a better window." };
  }
  if (d.tier === "COLD" && d.evidence_grounded) return { status: "reserve", label: "Reserve", because: "Real account with grounded evidence but aging timing — hold for revalidation." };
  return { status: "monitor", label: "Monitor", because: "Signal exists but grounding is partial — not actionable yet." };
}

export type DecayState = "fresh" | "active" | "aging" | "stale" | "revalidation_required";
export function deriveDecay(latestDate: string | null | undefined): { state: DecayState; label: string; revalidate_by: string } {
  const days = daysAgo(latestDate);
  const plus = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  if (days === null) return { state: "revalidation_required", label: "Revalidation required", revalidate_by: plus(0) };
  if (days <= 30) return { state: "fresh", label: "Fresh", revalidate_by: plus(30) };
  if (days <= 60) return { state: "active", label: "Active", revalidate_by: plus(21) };
  if (days <= 90) return { state: "aging", label: "Aging", revalidate_by: plus(14) };
  if (days <= 120) return { state: "stale", label: "Stale", revalidate_by: plus(7) };
  return { state: "revalidation_required", label: "Revalidation required", revalidate_by: plus(0) };
}

export type MomentumState = "accelerating" | "positive" | "stable" | "weakening" | "insufficient_data";
export function deriveMomentum(evidenceDates: (string | null | undefined)[]): { state: MomentumState; label: string; factors: string } {
  const days = evidenceDates.map(daysAgo).filter((d): d is number => d !== null).sort((a, b) => a - b);
  if (days.length < 2) return { state: "insufficient_data", label: "Insufficient data", factors: "Only one dated event — a trend cannot be claimed from a single point." };
  const newest = days[0], oldest = days[days.length - 1];
  if (newest <= 30 && days.filter((d) => d <= 45).length >= 2) return { state: "accelerating", label: "Accelerating", factors: `${days.length} dated events, ${days.filter((d) => d <= 45).length} within 45 days — activity is compounding.` };
  if (newest <= 45) return { state: "positive", label: "Positive", factors: `Latest event ${newest}d ago with prior activity ${oldest}d ago — the account is moving.` };
  if (newest <= 90) return { state: "stable", label: "Stable", factors: `Activity exists but the latest event is ${newest}d old — no fresh acceleration.` };
  return { state: "weakening", label: "Weakening", factors: `Newest dated event is ${newest}d old — the window is closing without new activity.` };
}

/** Factor-based allocation guidance — counts + reasons, never arbitrary
 *  percentages. Derived from the real status distribution. */
export function deriveAllocation(statuses: StatusVerdict[]): { line: string; detail: string } {
  const n = (s: PortfolioStatus) => statuses.filter((x) => x.status === s).length;
  const act = n("act_now"), inv = n("investigate"), mon = n("monitor"), res = n("reserve"), rej = n("reject");
  return {
    line: `${act} act now · ${inv} investigate · ${mon} monitor · ${res} reserve · ${rej} reject`,
    detail: act > 0
      ? `Concentrate immediate effort on the ${act} account${act > 1 ? "s" : ""} with grounded, open windows; run validation on the ${inv} investigate account${inv === 1 ? "" : "s"} before spending outreach; the rest waits on timing.`
      : inv > 0
        ? `No account has an open, grounded window today — the highest-return use of effort is validating the ${inv} investigate account${inv === 1 ? "" : "s"} rather than premature outreach.`
        : "No account merits active effort right now — revisit after the monitor/reserve revalidation dates.",
  };
}

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null;
}

/** Deterministic Preview verdict — derived from REAL portfolio results, never
 *  invented: proceed (actionable accounts found), refine (real but weak fit),
 *  stop (nothing defensible for this ICP). Labeled as a recommendation. */
export function deriveMiniVerdict(summary: { hot: number; warm: number; cold: number; discard: number; total: number }): { verdict: "proceed" | "refine" | "stop"; reason: string } {
  if (summary.hot + summary.warm > 0) return { verdict: "proceed", reason: "LeadLens found accounts with active, defensible signals for this ICP." };
  if (summary.cold > 0) return { verdict: "refine", reason: "Real signals were found but fit is weak — refine the ICP (industry, region or signal types) and re-validate." };
  return { verdict: "stop", reason: "No defensible opportunities surfaced for this ICP in this region right now — do not invest outreach effort yet." };
}
