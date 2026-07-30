// ─── Intelligence Output Registry (Block 3) ──────────────────────────────────
// Pure, provider-free projection from an already-produced Market-to-Account
// artifact into defensible analytical conclusions. It never changes ranking,
// never invents timing/buying intent, and never marks generated outputs as
// validated or report-eligible.

import {
  measured, unmeasured, serializeIntelligence,
  type IntelligenceClaim, type IntelligenceEvidenceReference,
  type IntelligenceOutput, type IntelligenceScope,
} from "./os-contracts";

export const OUTPUT_REGISTRY_VERSION = "output-registry-v1";
export const COMMERCIAL_STRATEGY_OUTPUT_TYPES = [
  "client_account_fit_assessment","account_opportunity_thesis","commercial_use_case",
  "buying_path_hypothesis","commercial_access_path","entry_strategy","portfolio_role",
  "why_now_assessment","why_not_now_assessment","client_context_gap","account_strategy_risk",
  "monitor_trigger_strategy","no_current_commercial_window","commercial_research_question",
] as const;
export const CLIENT_CONTEXT_REVIEW_OUTPUT_TYPES=[
  "client_context_gap","client_context_question","client_context_conflict","client_context_update",
  "thesis_revision","thesis_strengthening","thesis_weakening","commercial_feasibility_assessment",
  "account_disqualification","customer_safety_assessment","report_section_readiness",
  "validation_ready_account","context_blocked_account",
] as const;
const TARGET_VERIFIED = 40;

export interface ArtifactOutputSource {
  source_id: string;
  scope: IntelligenceScope;
  created_at: string;
  market: string | null;
  client_id: string | null;
  segment_distribution: Record<string, number>;
  raw_candidates: number;
  deduplicated_candidates: number;
  verified: number;
  probable: number;
  excluded: number;
  shortlist_accounts: string[];
  timing_count: number;
  evidence_corroborated: number;
  evidence_total: number;
  deep_research_complete: number;
  capability_versions: string[];
}

const ev = (s: ArtifactOutputSource, suffix: string, kind: IntelligenceEvidenceReference["kind"] = "artifact"): IntelligenceEvidenceReference =>
  ({ id: `${s.source_id}:${suffix}`, kind, ref: `${s.source_id}:${suffix}`, dated: true, date: s.created_at, corroborated: kind === "fact" });

const fact = (id: string, statement: string, evidence: IntelligenceEvidenceReference[], corroborated = false): IntelligenceClaim =>
  ({ id, kind: "fact", statement, evidence, corroborated });

const inference = (id: string, statement: string, evidence: IntelligenceEvidenceReference[], confidence: number): IntelligenceClaim =>
  ({ id, kind: "inference", statement, evidence, basis: evidence, confidence });

function base(
  s: ArtifactOutputSource,
  id: string,
  type: IntelligenceOutput["type"],
  claim: IntelligenceClaim,
  summary: string,
  reasoning: string,
  evidence: IntelligenceEvidenceReference[],
  confidence: number,
  segments: string[] = [],
  accounts: string[] = [],
): IntelligenceOutput {
  return {
    id: `output:${s.source_id}:${id}`,
    scope: s.scope,
    type,
    claim,
    summary,
    affected_market: s.market,
    affected_segments: [...segments].sort(),
    affected_accounts: [...accounts].sort(),
    client_id: s.client_id,
    reasoning_summary: reasoning,
    supporting_facts: claim.kind === "fact" ? [claim] : [],
    supporting_signals: [],
    supporting_evidence: evidence,
    counterevidence: [],
    alternative_explanations: [],
    unresolved_questions: [],
    confidence,
    confidence_method: "deterministic artifact heuristic; conservative caps; no baseline",
    novelty: unmeasured("not_measured", "no baseline comparison"),
    actionability: unmeasured("insufficient_evidence", "requires human review and commercial validation"),
    commercial_relevance: unmeasured("insufficient_evidence", "no commercial outcomes"),
    validation_state: "unreviewed",
    human_review_state: "unreviewed",
    outcome_state: "none",
    ranking_impact: "none",
    report_eligibility: "not_eligible",
    capability_versions: [...s.capability_versions].sort(),
    rule_version: OUTPUT_REGISTRY_VERSION,
    methodology_version: OUTPUT_REGISTRY_VERSION,
    created_at: s.created_at,
    valid_from: s.created_at,
    valid_until: null,
    last_reviewed: null,
  };
}

/** Empty source (or an artifact with no observations) produces no outputs. */
export function assembleArtifactOutputs(source: ArtifactOutputSource | null): IntelligenceOutput[] {
  if (!source || source.raw_candidates <= 0) return [];
  const out: IntelligenceOutput[] = [];
  const segments = Object.keys(source.segment_distribution).sort();

  if (segments.length > 0) {
    const evidence = [ev(source, "segment_distribution")];
    const claim = inference(
      "claim:segment-coverage",
      `The artifact represents ${segments.length} buyer segments, but one run cannot prove market completeness.`,
      evidence,
      0.55,
    );
    const o = base(source, "segment-coverage", "segment_insight", claim,
      `${segments.length} buyer segments are represented; completeness remains unproven.`,
      "Representation is measured from the artifact distribution. Scope is deliberately limited to this artifact.",
      evidence, 0.55, segments);
    o.alternative_explanations = ["Search-query design may over- or under-represent individual segments."];
    o.unresolved_questions = ["Which buyer segments remain undiscovered or under-verified?"];
    out.push(o);
  }

  if (source.excluded > 0) {
    const evidence = [ev(source, "excluded_candidates")];
    const claim = fact(
      "claim:false-positive-filtering",
      `${source.excluded} candidate pages were excluded before the verified/probable universe was formed.`,
      evidence,
    );
    const o = base(source, "false-positive-filtering", "false_positive_avoidance", claim,
      `The discovery layer excluded ${source.excluded} non-eligible candidate pages.`,
      "The exclusion count is directly recorded by the segment-universe artifact; it demonstrates filtering, not universal source-quality performance.",
      evidence, 0.65);
    o.actionability = measured(70, 0.55, source.excluded);
    o.unresolved_questions = ["Which exclusion classes still leak into probable identities?"];
    out.push(o);
  }

  if (source.verified + source.probable > 0 && source.verified < TARGET_VERIFIED) {
    const evidence = [ev(source, "identity_distribution")];
    const claim = inference(
      "claim:verified-universe-limitation",
      `Only ${source.verified} accounts are verified while ${source.probable} remain probable; probable identities must not be treated as verified accounts.`,
      evidence,
      0.7,
    );
    const o = base(source, "verified-universe-limitation", "risk_finding", claim,
      `Verified coverage (${source.verified}) remains below the ${TARGET_VERIFIED}-account quality target.`,
      "Identity states are explicit in the artifact. The output limits confidence rather than upgrading probable identities.",
      evidence, 0.7, segments);
    o.counterevidence = source.verified > 0 ? [ev(source, "verified_accounts", "fact")] : [];
    o.alternative_explanations = ["The target is a quality gate, not an estimate of total market size."];
    o.unresolved_questions = ["Can probable identities be resolved to official domains without increasing false positives?"];
    out.push(o);
  }

  if (source.shortlist_accounts.length > 0) {
    const evidence = [ev(source, "structural_shortlist")];
    const claim = inference(
      "claim:structural-not-timing",
      `The shortlist supports structural fit/attractiveness prioritization, not a claim that the accounts are ready to buy now.`,
      evidence,
      0.75,
    );
    const o = base(source, "structural-not-timing", "account_prioritization_insight", claim,
      `${source.shortlist_accounts.length} accounts are structurally prioritized; timing and buying intent remain unproven.`,
      "Market-to-Account scores structural dimensions separately. Channel access is preserved as channel_fit_not_buying_intent.",
      evidence, 0.75, segments, source.shortlist_accounts);
    o.alternative_explanations = ["A structurally attractive account may have no current buying window."];
    o.unresolved_questions = ["What dated evidence or buying-process signal exists for each shortlisted account?"];
    out.push(o);
  }

  if (source.evidence_total > 0 && source.evidence_corroborated < source.evidence_total) {
    const evidence = [ev(source, "evidence_coverage")];
    const claim = fact(
      "claim:corroboration-limitation",
      `${source.evidence_corroborated} of ${source.evidence_total} shortlisted accounts have corroborated evidence in this artifact.`,
      evidence,
    );
    const o = base(source, "corroboration-limitation", "risk_finding", claim,
      `Low corroboration blocks premium recommendations (${source.evidence_corroborated}/${source.evidence_total}).`,
      "Evidence coverage is directly recorded. Absence of corroboration is a limitation, not proof that an account is irrelevant.",
      evidence, 0.8, segments, source.shortlist_accounts);
    o.unresolved_questions = ["Which priority accounts can be corroborated with an independent dated source?"];
    out.push(o);
  }

  if (source.shortlist_accounts.length > 0 && source.timing_count === 0) {
    const evidence = [ev(source, "signal_coverage")];
    const claim = fact(
      "claim:no-timing-evidence",
      `No shortlisted account has a supported timing signal in this artifact.`,
      evidence,
    );
    const o = base(source, "no-timing-evidence", "risk_finding", claim,
      "The artifact cannot support act-now or buying-intent conclusions.",
      "Timing coverage is zero. The registry emits a limitation and deliberately emits no timing_interpretation.",
      evidence, 0.9, segments, source.shortlist_accounts);
    o.unresolved_questions = ["What changed recently at each account, if anything?"];
    out.push(o);
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function outputRegistryFingerprint(outputs: IntelligenceOutput[]): string {
  return serializeIntelligence(outputs);
}
