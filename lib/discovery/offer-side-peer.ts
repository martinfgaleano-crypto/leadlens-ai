// SELF-SERVE ADVANCEMENT V2 (§5) — bounded offer-side peer exclusion.
//
// Even when interpretation targets a buyer correctly, Discovery can occasionally surface
// the seller's OWN category (e.g. an operations consultancy's run surfacing other
// consultancies). This is a deterministic, BUYER-PROFILE-AWARE safety net: a candidate
// that is clearly a professional-services / consulting / agency firm is excluded ONLY
// when the buyer profile does NOT target such firms and the objective is not partnerships.
//
// It never rejects on identity strength, never over-excludes: if the buyer target
// legitimately includes consultancies/agencies/services, or the objective is partnerships,
// nothing is excluded. It is a narrow name/type classifier, not a competitor graph.

/** A clear professional-services / consulting / agency signal in a company's identity. */
const SERVICE_FIRM = /\b(consult(?:ing|ants?|ancy)|advisor(?:y|s)?|advisories|agency|agencies|\bllp\b|professional services|management consult|strategy consult|systems integrator|staffing firm|law firm|accounting firm|marketing agency|creative agency|digital agency|ad agency)\b/i;

/** Buyer descriptors that legitimately WANT service firms as targets — then nothing is
 *  excluded (the buyer is looking for consultancies/agencies/partners on purpose). */
const BUYER_WANTS_SERVICES = /\b(consult|advisor|agenc|professional service|systems? integrator|partner|reseller|channel|alliance)/i;

export interface PeerJudgeCandidate { name: string; organizationType?: string | null; industry?: string | null }
export interface PeerJudgeProfile {
  organizationTypes: string[];
  industries: string[];
  objectiveType?: string;
  targetRelationship?: string;
}

/** True when the buyer profile itself targets service/consulting firms (or the objective
 *  is partnerships / channel), in which case service-firm candidates are legitimate. */
export function buyerTargetsServiceFirms(profile: PeerJudgeProfile): boolean {
  const obj = `${profile.objectiveType ?? ""} ${profile.targetRelationship ?? ""}`.toLowerCase();
  if (/partner|partnership|channel|distribut|reseller|alliance/.test(obj)) return true;
  const descriptors = [...(profile.organizationTypes ?? []), ...(profile.industries ?? [])].join(" ");
  return BUYER_WANTS_SERVICES.test(descriptors);
}

/** A candidate clearly reads as a professional-services / consulting / agency firm. */
export function candidateLooksLikeServiceFirm(c: PeerJudgeCandidate): boolean {
  return SERVICE_FIRM.test(`${c.name} ${c.organizationType ?? ""} ${c.industry ?? ""}`);
}

/**
 * Is this candidate an OFFER-SIDE PEER that should be excluded? Only when it clearly looks
 * like a service firm AND the buyer profile does not target service firms / partners.
 * Conservative by construction — errs toward keeping (never excludes a non-service firm).
 */
export function isOfferSidePeer(c: PeerJudgeCandidate, profile: PeerJudgeProfile): boolean {
  if (!candidateLooksLikeServiceFirm(c)) return false;
  if (buyerTargetsServiceFirms(profile)) return false;
  // Only exclude when the buyer profile actually specifies a target family (so an
  // unresolved/empty profile never triggers silent exclusion — it should clarify instead).
  const hasTarget = (profile.organizationTypes?.length ?? 0) > 0 || (profile.industries?.length ?? 0) > 0;
  return hasTarget;
}
