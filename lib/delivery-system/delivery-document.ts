// ─── Customer Delivery System V1 — canonical DeliveryDocumentV1 DTO ─────────────────────────────
//
//   COMPLETED INTELLIGENCE SNAPSHOT → DeliveryDocumentV1 (this file) → TierComposer + ExportPolicy
//   → PresentationModel → Web / PDF / CSV.
//
// DeliveryDocumentV1 is the ONE canonical, tier-agnostic, channel-agnostic representation of a
// completed snapshot's customer deliverable. It deliberately carries NO tier capability flags and NO
// per-channel download flags — those belong to the TierComposer and ExportPolicy stages, not the
// document. It reuses the proven deliverable ontology (AccountBriefVM etc., whose decisions come from
// the single `caseDecision` authority) rather than re-deriving Intelligence — this layer never makes
// a Decision, never invents Evidence, never changes a date; it only reorganizes for delivery.

import type {
  DeliverableViewModel, AccountBriefVM, CommercialContextVM, ValidationQueueItemVM, DecisionState, Strength,
} from "@/lib/deliverable/deliverable-view-model";
import {
  buildPremiumExecutivePortfolio, selectDecisionCriticalBriefs,
  type PremiumExecutivePortfolioV1, type DecisionCriticalBriefV1,
} from "@/lib/intelligence/premium/premium-decision-architecture";
import type { PremiumContextV1 } from "@/lib/intelligence/premium/premium-context";

export type { AccountBriefVM, CommercialContextVM, ValidationQueueItemVM, DecisionState, Strength };
export type { PremiumExecutivePortfolioV1, DecisionCriticalBriefV1, PremiumContextV1 };

/** Premium-only delivery layer: the deterministic decision-architecture (Advanced Synthesis, Decision
 *  Pathways, Decision-Critical Briefs, Executive Portfolio) computed from the tier-composed accounts,
 *  PLUS any gated research context. Computed at compose time for the premium tier only — additive, so
 *  every other tier (Portfolio included) is byte-for-byte unchanged. */
export interface PremiumDeliverySection {
  executivePortfolio: PremiumExecutivePortfolioV1;   // includes synthesis + (optional) context
  decisionCriticalBriefs: DecisionCriticalBriefV1[];  // full briefs (each carries its conditional pathway)
}

/** Build the Premium delivery section from a set of accounts (already tier-capped) + optional research
 *  context. Pure and deterministic; fail-closed (empty accounts → empty portfolio, no briefs). */
export function buildPremiumDeliverySection(accounts: AccountBriefVM[], context: PremiumContextV1 | null = null): PremiumDeliverySection {
  return {
    executivePortfolio: buildPremiumExecutivePortfolio(accounts, context),
    decisionCriticalBriefs: selectDecisionCriticalBriefs(accounts),
  };
}

export const DELIVERY_DOCUMENT_SCHEMA = "delivery_document_v1" as const;

export interface DeliveryDocumentMeta {
  client: string | null;
  market: string | null;
  generatedAt: string | null;   // ISO — never invented
  generatedLabel: string | null;
  language: "en" | "es";
}

export interface DeliveryPortfolioSynthesis {
  total: number;
  counts: Record<DecisionState, number>;
  allocation: { line: string; detail: string } | null;
  funnel: { considered: number; rejected: number; selected: number } | null;
  note: string | null;
}

export interface DeliveryCoverage {
  withDatedEvidence: number;
  withSources: number;
  corroborated: number;
  grade: Strength | null;
  note: string | null;
}

/** The canonical delivery document. Full-depth, tier/channel-agnostic. */
export interface DeliveryDocumentV1 {
  schema: typeof DELIVERY_DOCUMENT_SCHEMA;
  meta: DeliveryDocumentMeta;
  headline: string | null;
  summary: string | null;
  portfolioSynthesis: DeliveryPortfolioSynthesis;
  accounts: AccountBriefVM[];                 // full-depth, ordered by attention upstream
  commercialContext: CommercialContextVM | null;
  validationQueue: ValidationQueueItemVM[];
  coverage: DeliveryCoverage | null;
  methodology: string[];
  limitations: string[];
  /** Optional research context produced during a premium run (persisted with the snapshot). null until
   *  premium-run production + persistence is wired — fail-closed: absent context is a valid result. */
  premiumContext?: PremiumContextV1 | null;
  /** Composed premium decision-architecture section — set by the TierComposer for the premium tier
   *  only; null/absent for every other tier. Additive: never affects non-premium composition. */
  premium?: PremiumDeliverySection | null;
}

/** Build the canonical document from the proven DeliverableViewModel. Pure; drops tier `capabilities`
 *  and channel `downloads` (those move to the composer / policy stages). No content is invented. */
export function fromDeliverableViewModel(vm: DeliverableViewModel): DeliveryDocumentV1 {
  return {
    schema: DELIVERY_DOCUMENT_SCHEMA,
    meta: {
      client: vm.meta.client,
      market: vm.meta.market,
      generatedAt: vm.meta.generatedAt,
      generatedLabel: vm.meta.generatedLabel,
      language: vm.meta.language,
    },
    headline: vm.headline,
    summary: vm.summary,
    portfolioSynthesis: {
      total: vm.portfolio.total,
      counts: vm.portfolio.counts,
      allocation: vm.portfolio.allocation,
      funnel: vm.portfolio.funnel,
      note: vm.portfolio.note,
    },
    accounts: vm.accounts,
    commercialContext: vm.commercialContext,
    validationQueue: vm.validationQueue,
    coverage: vm.coverage,
    methodology: vm.methodology,
    limitations: vm.limitations,
    premiumContext: null,   // attached upstream when a premium run produces + persists it
    premium: null,          // composed by the TierComposer for the premium tier only
  };
}

/** Recompute portfolio synthesis counts from a (possibly tier-limited) account set. Keeps the
 *  synthesis honest after the TierComposer trims accounts. */
export function recountPortfolio(accounts: AccountBriefVM[]): Record<DecisionState, number> {
  const counts: Record<DecisionState, number> = { prioritize: 0, validate: 0, monitor: 0, hold: 0 };
  for (const a of accounts) counts[a.decision] += 1;
  return counts;
}
