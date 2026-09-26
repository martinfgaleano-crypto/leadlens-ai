// ─── Canonical tier-contract matrix (derived from lib/products/catalog.ts) ──────────────────────────
// A single, truthful description of what each one-time tier contracts, mapped to the delivery surface
// (REPORT = in the PDF/web deliverable · WORKSPACE = ongoing app capability included with the purchase ·
// ELIGIBLE = available on a separate plan, not included) and the implementation status. This is the
// audit artifact (§4/§6) — it never advertises a capability the catalog does not grant, and it flags
// contracted-but-not-yet-rendered capabilities so gaps surface to HQ rather than to customers.
import { PRODUCTS, type TierCode } from "@/lib/products/catalog";

export type DeliverySurface = "report" | "workspace" | "eligible" | "none";
export type ImplStatus = "rendered" | "app_live" | "contracted_not_rendered";

export interface CapabilityRow {
  key: string;
  label: string;
  surface: DeliverySurface;
  status: ImplStatus;
  levelByTier: Record<TierCode, string>;   // the catalog level per tier ("none" = not included)
}

const TIERS: TierCode[] = ["preview", "brief", "intelligence", "premium"];
const lvl = (t: TierCode, pick: (e: (typeof PRODUCTS)[keyof typeof PRODUCTS]["entitlements"]) => unknown): string =>
  String(pick(PRODUCTS[`${t}_launch_v0` as keyof typeof PRODUCTS].entitlements));

function row(key: string, label: string, surface: DeliverySurface, status: ImplStatus, pick: (e: (typeof PRODUCTS)[keyof typeof PRODUCTS]["entitlements"]) => unknown): CapabilityRow {
  return { key, label, surface, status, levelByTier: Object.fromEntries(TIERS.map((t) => [t, lvl(t, pick)])) as Record<TierCode, string> };
}

/** The verified capability matrix. `status`:
 *  - rendered: shown in the current V2.2 deliverable/report.
 *  - app_live: a live application capability (Account Memory) — workspace, not PDF content.
 *  - contracted_not_rendered: catalog-contracted but NOT yet represented in the deliverable → HQ gap. */
export const TIER_CONTRACT_MATRIX: CapabilityRow[] = [
  row("opportunity_target", "Companies evaluated (operating limit)", "report", "rendered", (e) => e.opportunity_target),
  row("fit_timing", "Fit × Timing", "report", "rendered", (e) => e.fit_timing),
  row("what_changed", "What Changed (dated)", "report", "rendered", (e) => e.what_changed),
  row("sources_and_freshness", "Sources & freshness", "report", "rendered", (e) => e.sources_and_freshness),
  row("evidence_quality", "Evidence quality", "report", "rendered", (e) => e.evidence_quality),
  row("counterevidence", "Counterevidence", "report", "rendered", (e) => e.counterevidence),
  row("portfolio_allocation", "Portfolio allocation", "report", "rendered", (e) => e.portfolio_allocation),
  row("opportunity_clusters", "Opportunity clusters / patterns", "report", "rendered", (e) => e.opportunity_clusters),
  row("evidence_center", "Evidence coverage", "report", "rendered", (e) => e.evidence_center),
  row("executive_report", "Executive report", "report", "rendered", (e) => e.executive_report),
  row("strategic_sequence", "Decision context / strategy layer", "report", "rendered", (e) => e.strategic_sequence),
  row("coverage_gaps", "Coverage gaps (evidence gaps summary)", "report", "rendered", (e) => e.coverage_gaps),
  row("portfolio_risk", "Portfolio risk (thin-evidence / concentration)", "report", "rendered", (e) => e.portfolio_risk),
  row("playbooks", "Commercial playbooks", "report", "rendered", (e) => e.playbooks),
  row("discovery_questions", "Discovery questions (decision-critical validations)", "report", "rendered", (e) => e.discovery_questions),
  row("deep_dossiers", "Deep dossiers — per-source provenance + what-would-change (composed)", "report", "rendered", (e) => e.deep_dossiers),
  row("stakeholder_hypotheses", "Stakeholder functions — inferred functional roles (no names)", "report", "rendered", (e) => e.stakeholder_hypotheses),
  // Conditional / require observation history — honestly NOT a static one-time-report guarantee.
  row("momentum", "Momentum — freshness now; full history via Monitor", "report", "contracted_not_rendered", (e) => e.momentum),
  row("decay", "Decay — via Monitor as history accumulates", "report", "contracted_not_rendered", (e) => e.decay),
  row("market_patterns", "Market patterns — observed portfolio patterns (rendered when clusters exist)", "report", "contracted_not_rendered", (e) => e.market_patterns),
  row("account_memory", "Account Memory", "workspace", "app_live", (e) => e.account_memory),
  row("monitoring_eligible", "Monitor-eligible (recurring updates on a Monitor plan)", "eligible", "app_live", (e) => e.monitoring_eligible),
  row("watchlist", "Watchlist", "workspace", "contracted_not_rendered", (e) => e.watchlist),
];

export interface TierContractSummary {
  tier: TierCode;
  displayName: string;
  price: number;
  opportunityTarget: number;
  valueVerb: string;                 // validate / select / prioritize / strategize
  productPromise: string;
  reportRendered: string[];          // rendered report capabilities included at this tier
  workspace: string[];               // workspace/ongoing capabilities included at this tier
  contractedNotRendered: string[];   // catalog-included but not yet in the deliverable (HQ gap)
}

const VALUE_VERB: Record<TierCode, string> = { preview: "validate", brief: "select", intelligence: "prioritize", premium: "strategize" };
const included = (v: string) => v !== "none" && v !== "false";

/** Per-tier summary for the Admin review surface: what is actually delivered vs contracted-not-rendered. */
export function buildTierContractSummary(): TierContractSummary[] {
  return TIERS.map((t) => {
    const p = PRODUCTS[`${t}_launch_v0` as keyof typeof PRODUCTS];
    const rendered: string[] = [], workspace: string[] = [], gaps: string[] = [];
    for (const r of TIER_CONTRACT_MATRIX) {
      if (!included(r.levelByTier[t])) continue;
      if (r.status === "rendered") rendered.push(`${r.label} (${r.levelByTier[t]})`);
      else if (r.status === "app_live") workspace.push(r.label);
      else gaps.push(`${r.label} (${r.levelByTier[t]})`);
    }
    return {
      tier: t, displayName: p.display_name, price: p.price_amount, opportunityTarget: p.entitlements.opportunity_target,
      valueVerb: VALUE_VERB[t], productPromise: p.product_promise,
      reportRendered: rendered, workspace, contractedNotRendered: gaps,
    };
  });
}
