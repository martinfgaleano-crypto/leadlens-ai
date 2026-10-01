import type { QualifiedAccount } from "@/lib/intelligence/customer-job";
import type { CanonicalIntelligenceDeliveryV1 } from "@/lib/intelligence/canonical-intelligence-delivery";
import { validateMarketResearchUniverse } from "@/lib/intelligence/market-research-universe";

export type IntelligenceTier = "preview" | "brief" | "portfolio" | "premium";
export type ReadinessState = "ready" | "partial" | "actionability_research_required";

export interface AdvancedTierReadiness {
  tier: IntelligenceTier;
  target: number;
  actual: number;
  capacityReady: boolean;
  actionabilityRequired: boolean;
  evidenceQualifiedPrioritize: number;
  actionabilityReady: boolean;
  deliveryReady: boolean;
  state: ReadinessState;
  reasonCodes: string[];
}

export interface CanonicalTierReadiness extends AdvancedTierReadiness {
  marketIntelligenceReady: boolean;
  benchmarkReady: boolean;
  portfolioIntelligenceReady: boolean;
  visualIntelligenceReady: boolean;
  renderReady: boolean;
  capacityStatus: "FULL" | "PARTIAL";
  actionabilityStatus: "READY" | "RESEARCH_REQUIRED";
  marketIntelligenceStatus: "READY" | "LIMITED" | "INSUFFICIENT";
  commercialDepthStatus: "STRONG" | "ADEQUATE" | "LIMITED" | "INSUFFICIENT";
  corroborationStatus: "STRONG" | "ADEQUATE" | "LIMITED" | "INSUFFICIENT";
  visualIntelligenceStatus: "READY" | "LIMITED";
  evidenceIntegrityStatus: "READY" | "LIMITED";
}
const TARGETS: Record<IntelligenceTier, number> = { preview: 2, brief: 6, portfolio: 12, premium: 18 };

/** A Prioritize label is never enough by itself. This predicate only recognizes
 * a Prioritize whose persisted audit fields demonstrate evidence, timing and a
 * commercial mechanism. Missing legacy fields fail closed. */
export function isEvidenceQualifiedPrioritize(account: QualifiedAccount): boolean {
  if (account.decision !== "prioritize") return false;
  if (account.fit?.toLowerCase() !== "strong") return false;
  if (!account.commercialMechanismVerified) return false;
  if (!account.hasSource || account.evidenceCount < 1) return false;
  if (!account.hasValidatedDate && !account.currentActionabilityBasis) return false;
  if (account.counterevidenceMaterial) return false;
  return true;
}

export function evaluateAdvancedTierReadiness(
  tier: IntelligenceTier,
  accounts: QualifiedAccount[],
): AdvancedTierReadiness {
  const target = TARGETS[tier];
  const actual = Math.min(accounts.length, target);
  const capacityReady = accounts.length >= target;
  const actionabilityRequired = tier === "portfolio" || tier === "premium";
  const evidenceQualifiedPrioritize = accounts.filter(isEvidenceQualifiedPrioritize).length;
  const actionabilityReady = !actionabilityRequired || evidenceQualifiedPrioritize > 0;
  const deliveryReady = capacityReady && actionabilityReady;
  const reasonCodes: string[] = [];
  if (!capacityReady) reasonCodes.push("CAPACITY_INSUFFICIENT");
  if (!actionabilityReady) reasonCodes.push("ACTIONABILITY_RESEARCH_REQUIRED");
  return {
    tier, target, actual, capacityReady, actionabilityRequired,
    evidenceQualifiedPrioritize, actionabilityReady, deliveryReady,
    state: deliveryReady ? "ready" : capacityReady && !actionabilityReady ? "actionability_research_required" : "partial",
    reasonCodes,
  };
}

export function evaluateCanonicalTierReadiness(
  tier: IntelligenceTier,
  accounts: QualifiedAccount[],
  intelligence: CanonicalIntelligenceDeliveryV1 | null | undefined,
  renderReady: boolean,
): CanonicalTierReadiness {
  const base = evaluateAdvancedTierReadiness(tier, accounts);
  const portfolio = tier === "portfolio" || tier === "premium";
  const premium = tier === "premium";
  const marketUniverse = intelligence?.market_research_universe;
  const marketIntelligenceReady = !premium || Boolean(
    intelligence?.market_intelligence.state === "PRESENT"
    && marketUniverse
    && validateMarketResearchUniverse(marketUniverse).length === 0
    && marketUniverse.coverage.routes_researched > 0
    && marketUniverse.provenance.source_data_refs.length > 0,
  );
  const benchmarkReady = !portfolio || Boolean(intelligence?.benchmark.accounts.length && intelligence?.benchmark.dimensions.length);
  const portfolioIntelligenceReady = !portfolio || Boolean(intelligence?.portfolio_intelligence.leadlens_read.text);
  const visualIntelligenceReady = !portfolio || Boolean(intelligence?.charts.length && intelligence?.charts.every((chart) => chart.denominator === intelligence.scope.selected));
  const reasonCodes = [...base.reasonCodes];
  const commercialRows = marketUniverse?.commercial_account_research ?? [];
  const decisionCritical = commercialRows.filter((row) => ["prioritize", "validate", "monitor"].includes(row.decision));
  const researchedCritical = decisionCritical.filter((row) => row.research_status !== "NOT_RESEARCHED").length;
  const verifiedCriticalMechanisms = decisionCritical.filter((row) => row.mechanism_status === "VERIFIED").length;
  const corroboratedCritical = decisionCritical.filter((row) => row.corroboration_status === "ACHIEVED").length;
  const buyerFunctionsCritical = decisionCritical.filter((row) => row.buyer_functions.length > 0).length;
  const commercialDepthStatus: CanonicalTierReadiness["commercialDepthStatus"] = !premium ? "ADEQUATE" : !decisionCritical.length ? "INSUFFICIENT" : researchedCritical < decisionCritical.length ? "LIMITED" : verifiedCriticalMechanisms === decisionCritical.length && buyerFunctionsCritical === decisionCritical.length ? "STRONG" : verifiedCriticalMechanisms > 0 ? "ADEQUATE" : "LIMITED";
  const corroborationStatus: CanonicalTierReadiness["corroborationStatus"] = !premium ? "ADEQUATE" : !decisionCritical.length ? "INSUFFICIENT" : corroboratedCritical >= Math.ceil(decisionCritical.length * 0.75) ? "STRONG" : corroboratedCritical >= Math.ceil(decisionCritical.length * 0.4) ? "ADEQUATE" : "LIMITED";
  const evidenceIntegrityStatus: CanonicalTierReadiness["evidenceIntegrityStatus"] = intelligence && (!marketUniverse || validateMarketResearchUniverse(marketUniverse).length === 0) ? "READY" : "LIMITED";
  if (!marketIntelligenceReady) reasonCodes.push("MARKET_INTELLIGENCE_REQUIRED");
  if (!benchmarkReady) reasonCodes.push("BENCHMARK_REQUIRED");
  if (!portfolioIntelligenceReady) reasonCodes.push("PORTFOLIO_INTELLIGENCE_REQUIRED");
  if (!visualIntelligenceReady) reasonCodes.push("VISUAL_INTELLIGENCE_REQUIRED");
  if (!renderReady) reasonCodes.push("RENDER_NOT_READY");
  if (premium && ["LIMITED", "INSUFFICIENT"].includes(commercialDepthStatus)) reasonCodes.push("COMMERCIAL_DEPTH_LIMITED");
  if (premium && ["LIMITED", "INSUFFICIENT"].includes(corroborationStatus)) reasonCodes.push("CORROBORATION_LIMITED");
  const qualityReady = !premium || (commercialDepthStatus !== "INSUFFICIENT" && corroborationStatus !== "INSUFFICIENT" && evidenceIntegrityStatus === "READY");
  const deliveryReady = base.deliveryReady && marketIntelligenceReady && benchmarkReady && portfolioIntelligenceReady && visualIntelligenceReady && renderReady && qualityReady;
  return { ...base, deliveryReady, reasonCodes: Array.from(new Set(reasonCodes)), state: deliveryReady ? "ready" : base.capacityReady && !base.actionabilityReady ? "actionability_research_required" : "partial", marketIntelligenceReady, benchmarkReady, portfolioIntelligenceReady, visualIntelligenceReady, renderReady,
    capacityStatus: base.capacityReady ? "FULL" : "PARTIAL", actionabilityStatus: base.actionabilityReady ? "READY" : "RESEARCH_REQUIRED", marketIntelligenceStatus: marketIntelligenceReady ? "READY" : marketUniverse ? "LIMITED" : "INSUFFICIENT", commercialDepthStatus, corroborationStatus, visualIntelligenceStatus: visualIntelligenceReady ? "READY" : "LIMITED", evidenceIntegrityStatus };
}
