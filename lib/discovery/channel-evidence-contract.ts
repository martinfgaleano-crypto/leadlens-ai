import type { ChannelAccessAssessment } from "./channel-access";

export type ChannelEvidenceGrade = "strong" | "moderate" | "preliminary" | "insufficient";

export interface ChannelEvidenceDecision {
  eligible: boolean;
  grade: ChannelEvidenceGrade;
  score_cap: number;
  proof_type: "supplier_intake" | "external_brand_portfolio" | "category_distribution" | "unknown";
  category_alignment: "confirmed" | "plausible" | "unknown";
  blockers: string[];
  limitations: string[];
}

const INTAKE = /proveedor|supplier|vendor|submission|onboarding|incorporaci[oó]n de marcas|buscamos marcas/i;
const PORTFOLIO = /cat[aá]logo oficial|portafolio multimarca|marcas externas|marcas aliadas|representaci[oó]n multimarca/i;
const DISTRIBUTION = /capacidad declarada de distribuci[oó]n|category distribution|distribuidor|mayorista|wholesaler/i;
const CATEGORY = /bebida|beverage|alimento|food|suplement|natural|org[aá]nic|wellness|bienestar|vitamin|homeop[aá]t|nutrac/i;

/** Converts channel evidence into a bounded commercial hypothesis. General
 * scoring cannot promote weak channel proof above this contract's ceiling. */
export function evaluateChannelEvidence(input: {
  assessment: ChannelAccessAssessment;
  offerContext: string;
  extractedOfficialPage: boolean;
}): ChannelEvidenceDecision {
  const { assessment } = input;
  // Proof type is derived only from positively matched observations. The
  // explanatory reason often contains limitations such as “does not prove
  // supplier openness”; treating that prose as evidence reverses its meaning.
  const evidence = assessment.matched.join(" ");
  const explanatoryContext = `${evidence} ${assessment.reason}`;
  const blockers: string[] = [];
  const limitations: string[] = [];
  if (!assessment.qualifies) blockers.push("channel_access_not_verified");
  if (!input.extractedOfficialPage) blockers.push("no_live_official_page_extracted");

  const proof_type = INTAKE.test(evidence) ? "supplier_intake"
    : PORTFOLIO.test(evidence) ? "external_brand_portfolio"
      : DISTRIBUTION.test(evidence) ? "category_distribution" : "unknown";
  const offerHasCategory = CATEGORY.test(input.offerContext);
  const evidenceHasCategory = CATEGORY.test(explanatoryContext);
  const category_alignment = offerHasCategory && evidenceHasCategory ? "confirmed"
    : offerHasCategory || evidenceHasCategory ? "plausible" : "unknown";

  if (proof_type === "unknown") blockers.push("channel_proof_unclassified");
  if (category_alignment === "unknown") limitations.push("category_alignment_not_evidenced");
  limitations.push("does_not_prove_current_buying_intent_or_budget");

  if (blockers.length) return { eligible: false, grade: "insufficient", score_cap: 0, proof_type, category_alignment, blockers, limitations };
  if (proof_type === "supplier_intake" && category_alignment !== "unknown") {
    return { eligible: true, grade: "strong", score_cap: 90, proof_type, category_alignment, blockers, limitations };
  }
  if (proof_type === "external_brand_portfolio" && (assessment.evidence_urls?.length ?? 0) >= 2) {
    limitations.push("portfolio_proves_channel_operation_not_supplier_openness");
    return { eligible: true, grade: "moderate", score_cap: 82, proof_type, category_alignment, blockers, limitations };
  }
  limitations.push("distribution_capability_requires_supplier_path_validation");
  return { eligible: true, grade: "preliminary", score_cap: 72, proof_type, category_alignment, blockers, limitations };
}

/** Company-level direction memory: generic distribution capability cannot
 * override an earlier official page recruiting resellers for the company's own
 * offer. Explicit supplier intake or a verified external-brand portfolio may
 * still survive because they provide stronger opposite-direction evidence. */
export function applyObservedChannelDirection(decision: ChannelEvidenceDecision, sellerDirectionObserved: boolean): ChannelEvidenceDecision {
  if (!sellerDirectionObserved || !decision.eligible || decision.grade !== "preliminary") return decision;
  return {
    ...decision,
    eligible: false,
    grade: "insufficient",
    score_cap: 0,
    blockers: [...decision.blockers, "seller_direction_conflicts_with_generic_distribution_capability"],
    limitations: [...decision.limitations, "official_site_previously_recruited_resellers_for_own_offer"],
  };
}
