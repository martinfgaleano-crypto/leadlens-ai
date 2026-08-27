import type { CandidateAccount, DiscoveryPlan } from "./candidate-universe";

export type ResearchReadiness =
  | "research_ready"
  | "needs_identity_validation"
  | "structural_match_uncertain"
  | "hard_excluded"
  | "wrong_target_type";

export interface ResearchReadinessAssessment {
  status: ResearchReadiness;
  reasons: string[];
  priorityBand: 1 | 2 | 3 | 4 | 5;
}

const FAMILY: Record<string, string[]> = {
  manufacturer: ["manufacturer", "manufacturing", "fabricante", "manufactura", "industrial", "producer", "productor"],
  distributor: ["distributor", "distribution", "distribuidor", "distribucion", "wholesale", "mayorista"],
  logistics: ["logistics", "logistica", "3pl", "transport", "freight"],
  retailer: ["retail", "retailer", "minorista", "supermarket", "grocery"],
  software: ["software", "saas", "technology", "tecnologia"],
  financial: ["bank", "financial", "financiero", "fintech", "insurance"],
  hospitality: ["hotel", "hospitality", "tourism", "turismo"],
};

const words = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(x => x.length >= 4);
const families = (value: string) => Object.entries(FAMILY).filter(([, terms]) => terms.some(t => value.includes(t))).map(([k]) => k);

export function assessResearchReadiness(candidate: CandidateAccount, plan: DiscoveryPlan): ResearchReadinessAssessment {
  if (candidate.status === "excluded") return { status: "hard_excluded", reasons: [candidate.statusReason], priorityBand: 5 };
  if (candidate.status === "identity_ambiguous" || candidate.identity.confidence === "ambiguous") {
    return { status: "needs_identity_validation", reasons: ["Canonical organization is ambiguous."], priorityBand: 5 };
  }
  if (candidate.identity.confidence !== "verified" || !candidate.identity.domain) {
    return { status: "needs_identity_validation", reasons: ["Canonical corporate domain is not verified."], priorityBand: 4 };
  }
  const observed = `${candidate.identity.organizationType ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const targets = [...plan.organizationTypes, ...plan.industries].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!observed) return { status: "structural_match_uncertain", reasons: ["Organization type and industry are unconfirmed."], priorityBand: 4 };

  const targetFamilies = families(targets);
  const observedFamilies = families(observed);
  const verticalSeed = candidate.provenance.some(p => p.origin === "vertical_seed");
  const familyMatch = targetFamilies.some(f => observedFamilies.includes(f));
  const lexicalMatch = words(observed).some(w => words(targets).includes(w));
  if (verticalSeed) {
    return { status: "research_ready", reasons: ["Verified company belongs to the matched vertical pack; downstream Research must still prove the event and opportunity."], priorityBand: 2 };
  }
  if (targetFamilies.length && observedFamilies.length && !familyMatch) {
    return { status: "wrong_target_type", reasons: [`Observed type “${candidate.identity.organizationType}” does not match confirmed target types.`], priorityBand: 5 };
  }
  if (!familyMatch && !lexicalMatch) {
    return { status: "structural_match_uncertain", reasons: [`No defensible structural match between “${candidate.identity.organizationType}” and confirmed target semantics.`], priorityBand: 4 };
  }
  return {
    status: "research_ready",
    reasons: [familyMatch ? `Target organization family matched: ${targetFamilies.find(f => observedFamilies.includes(f))}.` : "Confirmed target descriptor matched."],
    priorityBand: candidate.identity.confidence === "verified" ? 1 : 2,
  };
}

export function prioritizeResearch(candidates: CandidateAccount[], plan: DiscoveryPlan): CandidateAccount[] {
  return candidates
    .map((candidate, index) => ({ candidate, index, assessment: assessResearchReadiness(candidate, plan) }))
    .filter(x => x.assessment.status === "research_ready")
    .sort((a, b) => a.assessment.priorityBand - b.assessment.priorityBand || a.index - b.index)
    .map(x => ({ ...x.candidate, researchReadiness: x.assessment }));
}
