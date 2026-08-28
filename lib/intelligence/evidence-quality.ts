// Evidence Quality + Corroboration measurement.
//
// This module makes the *Evidence* produced by Account Deepening empirically
// measurable WITHOUT rebuilding Account Deepening and WITHOUT gaming the
// control-plane evaluator. It reviews already-collected source->claim
// relationships against the LeadLens truth boundaries (right company, grounded
// in the source, claim-relative source quality, event-date != retrieval date,
// materiality, independence needs >=2 distinct origins, counterevidence handled,
// customer-safe) and turns a *bounded, reviewed* sample into bounded counts.
//
// Doctrine enforced here (see CLAUDE.md · leadlens-intel-guard):
//  - Deterministic gates are the authority; a human QA label is telemetry only
//    and NEVER mutates a Case/Decision (see HumanEvidenceQaLabel).
//  - A count with denominator 0 is NOT measured (never coerced to 0% success).
//  - Two URLs from one origin are not independent support.
//  - Absence of a bounded counterevidence search is not proof of no counterevidence.
//  - Retrieval/publication date is never the event date.

import { signalMatchesIdentity, type CorporateIdentity } from "../discovery/corporate-identity";
export type { CorporateIdentity } from "../discovery/corporate-identity";
import { assessCounterevidence } from "../discovery/counterevidence";
import { classifyMateriality } from "../discovery/materiality";

// ── Source tiers (claim-relative adequacy, not an absolute ranking) ──────────
export type EvidenceSourceTier =
  | "primary_corporate"   // the company's own domain / filing / press room
  | "regulatory"          // regulator, exchange, official registry
  | "major_media"         // established national/international outlet
  | "trade_media"         // industry/vertical trade press
  | "aggregator"          // syndication / directory / listing
  | "unknown";

// ── Human QA label contract (VALIDATION TELEMETRY ONLY — never mutates a Case) ─
export type EvidenceQaVerdict = "confirm" | "reject" | "uncertain";
export interface HumanEvidenceQaLabel {
  reviewer: string;
  reviewed_at: string;
  // Per-link human judgement of the deterministic chain. Telemetry only.
  association: EvidenceQaVerdict;        // is this the right company?
  grounding: EvidenceQaVerdict;          // is the claim actually in the source?
  source_trust: EvidenceQaVerdict;       // is the source adequate for THIS claim?
  temporal: EvidenceQaVerdict;           // is the event date real (not retrieval)?
  independence: EvidenceQaVerdict;       // is required corroboration truly independent?
  counterevidence: EvidenceQaVerdict;    // was counterevidence honestly handled?
  customer_safe: EvidenceQaVerdict;      // safe & relevant to the customer context?
  note?: string;
}

export type EvidenceClaimKind = "event" | "state";

export interface EvidenceRelationshipInput {
  relationship_id: string;
  account: { name: string; identity: CorporateIdentity };
  source: {
    url: string | null;
    origin_id: string | null;         // registrable-origin id for independence
    tier: EvidenceSourceTier;
    content_lower: string;            // lower-cased source text actually retrieved
    spanish?: boolean;
    injection_neutralized?: boolean;  // true if untrusted markup was stripped
  };
  claim: {
    summary: string;
    kind: EvidenceClaimKind;
    // A material commercial event (expansion, new plant) requires independent
    // support; a durable state fact does not. Caller declares the requirement.
    requires_independent_support: boolean;
    // Direct evidence (stated in the source) vs an inference across sources.
    direct: boolean;
    // If the claim asserts "no counterevidence exists", that is only honest when
    // it came from an actual bounded search — absence of a search is not proof.
    asserts_counterevidence_absent?: boolean;
    counterevidence_search_performed?: boolean;
  };
  event?: {
    event_phrase_date: string | null; // date parsed FROM the event phrase
    retrieved_at: string | null;
    publication_date: string | null;
    as_of: string | null;             // review "now" for staleness
  };
  // Other sources offered as corroboration (their origin ids). Independence is
  // distinct-origin count including the primary source.
  corroborating_origin_ids?: Array<string | null>;
  human_label?: HumanEvidenceQaLabel;
}

export interface EvidenceRelationshipReview {
  relationship_id: string;
  association_ok: boolean;
  association_reason: string;
  grounded: boolean;
  source_adequate: boolean;
  temporal_valid: boolean;
  temporal_applicable: boolean;
  material: boolean;
  material_applicable: boolean;
  independence_required: boolean;
  independent_ok: boolean;
  duplicate_origin_detected: boolean;   // >=2 corroborating urls but <2 origins
  duplicate_origin_rejected: boolean;   // detected AND correctly not counted independent
  counterevidence_handled: boolean;
  customer_safe: boolean;
  // Human vs deterministic agreement (telemetry only).
  human_association_agrees: boolean | null;
}

const REGULATORY_CLAIM = /(sec |filing|prospect|regulator|antitrust|superintendencia|regist(ro|ry)|bolsa|exchange|10-k|8-k|earnings|resultado financiero|estado financiero)/i;

function distinctOrigins(ids: Array<string | null>): number {
  const set = new Set(ids.filter((id): id is string => Boolean(id && id.trim())));
  return set.size;
}

function sourceAdequateFor(tier: EvidenceSourceTier, claim: EvidenceRelationshipInput["claim"]): boolean {
  const regulatory = REGULATORY_CLAIM.test(claim.summary);
  if (regulatory) return tier === "regulatory" || tier === "primary_corporate";
  // A material event needs at least trade-grade provenance; an aggregator alone
  // is never adequate on its own.
  if (claim.kind === "event") return tier === "primary_corporate" || tier === "regulatory" || tier === "major_media" || tier === "trade_media";
  // Durable state facts tolerate primary/major/trade; aggregator/unknown do not.
  return tier === "primary_corporate" || tier === "regulatory" || tier === "major_media" || tier === "trade_media";
}

function claimGrounded(input: EvidenceRelationshipInput): boolean {
  // Provenance, not chain-of-thought: the material terms of the claim must
  // actually appear in the retrieved source content.
  const content = input.source.content_lower;
  if (!content) return false;
  const terms = input.claim.summary
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
  if (!terms.length) return false;
  const hit = terms.filter((t) => content.normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t)).length;
  return hit / terms.length >= 0.5;
}

function temporalValid(input: EvidenceRelationshipInput): { applicable: boolean; valid: boolean } {
  if (input.claim.kind !== "event") return { applicable: false, valid: true };
  const ev = input.event;
  // An event claim with no observed event date cannot assert Timing.
  if (!ev || !ev.event_phrase_date) return { applicable: true, valid: false };
  // The event date must not be merely the retrieval or publication date.
  if (ev.event_phrase_date === ev.retrieved_at) return { applicable: true, valid: false };
  if (ev.event_phrase_date === ev.publication_date) return { applicable: true, valid: false };
  return { applicable: true, valid: true };
}

export function reviewEvidenceRelationship(input: EvidenceRelationshipInput): EvidenceRelationshipReview {
  const assoc = signalMatchesIdentity(
    input.account.identity,
    input.source.url,
    input.source.content_lower,
    input.source.spanish ?? false,
  );

  const grounded = claimGrounded(input);
  const source_adequate = sourceAdequateFor(input.source.tier, input.claim);

  const temporal = temporalValid(input);

  const material_applicable = input.claim.kind === "event";
  const mat = classifyMateriality(input.claim.summary + " " + input.source.content_lower);
  const material = material_applicable ? mat.level !== "low" : true;

  const corroboratingIds = input.corroborating_origin_ids ?? [];
  const allOrigins = [input.source.origin_id, ...corroboratingIds];
  const distinct = distinctOrigins(allOrigins);
  const independence_required = input.claim.requires_independent_support;
  const independent_ok = independence_required ? distinct >= 2 : true;
  // Two-or-more corroborating URLs that collapse to a single origin: this is the
  // adversarial "two URLs != independent" case.
  const duplicate_origin_detected = corroboratingIds.length >= 1 && distinct < 2;
  const duplicate_origin_rejected = duplicate_origin_detected ? !independent_ok || !independence_required : false;

  // Counterevidence handled = a bounded assessment was run AND (if it asserts
  // "no counterevidence") that assertion is backed by an actual search.
  const ce = assessCounterevidence({
    content: input.source.content_lower,
    event_summary: input.claim.summary,
    days_old: null,
    operational_fit: true,
    corroboration: independent_ok ? "high" : "low",
  });
  const dishonestAbsence = input.claim.asserts_counterevidence_absent === true
    && input.claim.counterevidence_search_performed !== true;
  const counterevidence_handled = !dishonestAbsence && ce.unresolved_questions.length > 0;

  const customer_safe =
    assoc.ok
    && (input.source.injection_neutralized !== false)
    && !dishonestAbsence
    && (temporal.applicable ? temporal.valid : true);

  const hl = input.human_label;
  const human_association_agrees = hl
    ? (hl.association === "confirm") === assoc.ok
    : null;

  return {
    relationship_id: input.relationship_id,
    association_ok: assoc.ok,
    association_reason: assoc.reason,
    grounded,
    source_adequate,
    temporal_valid: temporal.valid,
    temporal_applicable: temporal.applicable,
    material,
    material_applicable,
    independence_required,
    independent_ok,
    duplicate_origin_detected,
    duplicate_origin_rejected,
    counterevidence_handled,
    customer_safe,
    human_association_agrees,
  };
}

// ── Bounded summary (0/0 -> not measured; never coerced to success) ──────────
export interface EvidenceQualityMetricsBlock {
  association: { correct: number; controls: number };
  grounding: { grounded: number; controls: number };
  source_quality: { adequate: number; controls: number };
  temporal_validity: { valid: number; controls: number };
  materiality: { material: number; controls: number };
  corroboration: { independent_correct: number; controls: number };
  duplicate_origin_rejected: { rejected: number; controls: number };
  counterevidence_handled: { handled: number; controls: number };
  customer_safe: { safe: number; controls: number };
  reviewed_relationships: number;
}

export interface EvidenceQualitySummary extends EvidenceQualityMetricsBlock {
  // Rates are null when the denominator is 0 (NOT measured), never 0%.
  rates: Record<
    "association" | "grounding" | "source_quality" | "temporal_validity" | "materiality" | "corroboration" | "duplicate_origin_rejected" | "counterevidence_handled" | "customer_safe",
    number | null
  >;
  sample_confidence: "none" | "low" | "medium";
}

function rate(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

export function summarizeEvidenceQuality(reviews: EvidenceRelationshipReview[]): EvidenceQualitySummary {
  const count = (pred: (r: EvidenceRelationshipReview) => boolean) => reviews.filter(pred).length;

  const associationControls = reviews.length;
  const groundingControls = reviews.length;
  const sourceControls = reviews.length;
  const temporalControls = count((r) => r.temporal_applicable);
  const materialityControls = count((r) => r.material_applicable);
  const corroborationControls = count((r) => r.independence_required);
  const duplicateControls = count((r) => r.duplicate_origin_detected);
  const counterevidenceControls = reviews.length;
  const customerSafeControls = reviews.length;

  const block: EvidenceQualityMetricsBlock = {
    association: { correct: count((r) => r.association_ok), controls: associationControls },
    grounding: { grounded: count((r) => r.grounded), controls: groundingControls },
    source_quality: { adequate: count((r) => r.source_adequate), controls: sourceControls },
    temporal_validity: { valid: count((r) => r.temporal_applicable && r.temporal_valid), controls: temporalControls },
    materiality: { material: count((r) => r.material_applicable && r.material), controls: materialityControls },
    corroboration: { independent_correct: count((r) => r.independence_required && r.independent_ok), controls: corroborationControls },
    duplicate_origin_rejected: { rejected: count((r) => r.duplicate_origin_rejected), controls: duplicateControls },
    counterevidence_handled: { handled: count((r) => r.counterevidence_handled), controls: counterevidenceControls },
    customer_safe: { safe: count((r) => r.customer_safe), controls: customerSafeControls },
    reviewed_relationships: reviews.length,
  };

  const sample_confidence: EvidenceQualitySummary["sample_confidence"] =
    reviews.length === 0 ? "none" : reviews.length < 12 ? "low" : "medium";

  return {
    ...block,
    rates: {
      association: rate(block.association.correct, block.association.controls),
      grounding: rate(block.grounding.grounded, block.grounding.controls),
      source_quality: rate(block.source_quality.adequate, block.source_quality.controls),
      temporal_validity: rate(block.temporal_validity.valid, block.temporal_validity.controls),
      materiality: rate(block.materiality.material, block.materiality.controls),
      corroboration: rate(block.corroboration.independent_correct, block.corroboration.controls),
      duplicate_origin_rejected: rate(block.duplicate_origin_rejected.rejected, block.duplicate_origin_rejected.controls),
      counterevidence_handled: rate(block.counterevidence_handled.handled, block.counterevidence_handled.controls),
      customer_safe: rate(block.customer_safe.safe, block.customer_safe.controls),
    },
    sample_confidence,
  };
}

export function evidenceQualityMetricsBlock(summary: EvidenceQualitySummary): EvidenceQualityMetricsBlock {
  return {
    association: summary.association,
    grounding: summary.grounding,
    source_quality: summary.source_quality,
    temporal_validity: summary.temporal_validity,
    materiality: summary.materiality,
    corroboration: summary.corroboration,
    duplicate_origin_rejected: summary.duplicate_origin_rejected,
    counterevidence_handled: summary.counterevidence_handled,
    customer_safe: summary.customer_safe,
    reviewed_relationships: summary.reviewed_relationships,
  };
}
