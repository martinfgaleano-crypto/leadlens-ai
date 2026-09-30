import type { QualifiedAccount } from "@/lib/intelligence/customer-job";

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
