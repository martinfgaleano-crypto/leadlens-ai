// EVIDENCE QUALITY + CORROBORATION VALIDATION V1
//
// Two layers of proof:
//  A. A 16-case behavioral matrix over reviewEvidenceRelationship — the
//     deterministic reviewer must accept correct Evidence relationships and
//     reject wrong-entity, ungrounded, single-origin-corroboration,
//     retrieval-date-as-event, immaterial, dishonest-counterevidence-absence,
//     and injection-unsafe ones.
//  B. Control-plane movement — a real reviewed sample, ingested through the
//     EXISTING ControlPlaneValidationEvidenceV1 mechanism, moves the Evidence
//     capabilities NOT_MEASURED -> measured; a degraded sample scores lower; a
//     larger sample carries more confidence; an empty sample stays NOT_MEASURED;
//     and an Evidence-only artifact never moves unrelated (infra) capabilities.

import assert from "node:assert/strict";
import {
  reviewEvidenceRelationship, summarizeEvidenceQuality, evidenceQualityMetricsBlock,
  type EvidenceRelationshipInput, type CorporateIdentity,
} from "@/lib/intelligence/evidence-quality";
import { buildCapabilityControlPlane, type CapabilityControlPlaneInput } from "@/lib/intelligence/capability-control-plane";
import { createControlPlaneValidationEvidence, type ControlPlaneValidationEvidenceV1 } from "@/lib/intelligence/control-plane-validation-evidence";
import { isMeasured } from "@/lib/intelligence/os-contracts";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${passed} ${name}`); };
const now = "2026-08-28T00:00:00.000Z";

function identity(name: string, domain: string): CorporateIdentity {
  return { name, domain, country: "US", confidence: 85, aliases: [], resolved_from: `https://${domain}`, reasons: [] };
}

// A well-formed, correct Evidence relationship the reviewer should accept.
function good(over: Partial<EvidenceRelationshipInput> = {}): EvidenceRelationshipInput {
  const domain = "conagrabrands.com";
  const phrase = "opened a new production facility";
  return {
    relationship_id: over.relationship_id ?? "rel",
    account: { name: "Conagra Brands", identity: identity("Conagra Brands", domain) },
    source: {
      url: `https://${domain}/news`, origin_id: "conagrabrands.com", tier: "primary_corporate",
      content_lower: `conagra brands ${phrase} in ohio, expanding its production capacity. see ${domain}.`,
      spanish: false, injection_neutralized: true,
    },
    claim: { summary: `Conagra ${phrase} expanding production`, kind: "event", requires_independent_support: true, direct: true },
    event: { event_phrase_date: "2026-07-15", retrieved_at: "2026-08-20", publication_date: "2026-07-16", as_of: now },
    corroborating_origin_ids: ["reuters.com"],
    ...over,
  };
}

// ── A. 16-case behavioral matrix ─────────────────────────────────────────────

t("01 Conagra expansion — own domain, corroborated: fully accepted", () => {
  const r = reviewEvidenceRelationship(good({ relationship_id: "conagra" }));
  assert.equal(r.association_ok, true);
  assert.equal(r.grounded, true);
  assert.equal(r.source_adequate, true);
  assert.equal(r.temporal_valid, true);
  assert.equal(r.material, true);
  assert.equal(r.independent_ok, true);
  assert.equal(r.counterevidence_handled, true);
  assert.equal(r.customer_safe, true);
});

t("02 Quad single-source Validate — independence NOT required, single origin is fine", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "quad",
    claim: { summary: "Quad operates a commercial print facility", kind: "state", requires_independent_support: false, direct: true },
    corroborating_origin_ids: [],
    event: undefined,
  }));
  assert.equal(r.independence_required, false);
  assert.equal(r.independent_ok, true);
  assert.equal(r.temporal_applicable, false);
  assert.equal(r.customer_safe, true);
});

t("03 Hitachi corroboration — event with two distinct origins is independent", () => {
  const r = reviewEvidenceRelationship(good({ relationship_id: "hitachi", corroborating_origin_ids: ["bloomberg.com"] }));
  assert.equal(r.independence_required, true);
  assert.equal(r.independent_ok, true);
  assert.equal(r.duplicate_origin_detected, false);
});

t("04 wrong-entity homonym — association rejected, not customer-safe", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "wrong-entity",
    source: { url: "https://conagra-realty-llc.example/listing", origin_id: "example", tier: "aggregator", content_lower: "conagra realty llc lists a warehouse for lease in texas.", spanish: false, injection_neutralized: true },
  }));
  assert.equal(r.association_ok, false);
  assert.equal(r.customer_safe, false);
});

t("05 two URLs, one origin — duplicate origin detected and rejected as independent", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "dup-origin",
    source: { url: "https://conagrabrands.com/news", origin_id: "conagrabrands.com", tier: "primary_corporate", content_lower: good().source.content_lower, spanish: false, injection_neutralized: true },
    corroborating_origin_ids: ["conagrabrands.com"],
  }));
  assert.equal(r.duplicate_origin_detected, true);
  assert.equal(r.independent_ok, false);
  assert.equal(r.duplicate_origin_rejected, true);
});

t("06 retrieval date is not the event date", () => {
  const r = reviewEvidenceRelationship(good({ relationship_id: "retrieval-date", event: { event_phrase_date: "2026-08-20", retrieved_at: "2026-08-20", publication_date: "2026-07-16", as_of: now } }));
  assert.equal(r.temporal_valid, false);
});

t("07 publication date is not the event date", () => {
  const r = reviewEvidenceRelationship(good({ relationship_id: "pub-date", event: { event_phrase_date: "2026-07-16", retrieved_at: "2026-08-20", publication_date: "2026-07-16", as_of: now } }));
  assert.equal(r.temporal_valid, false);
});

t("08 event claim with no observed event date cannot assert Timing", () => {
  const r = reviewEvidenceRelationship(good({ relationship_id: "no-date", event: { event_phrase_date: null, retrieved_at: "2026-08-20", publication_date: "2026-07-16", as_of: now } }));
  assert.equal(r.temporal_applicable, true);
  assert.equal(r.temporal_valid, false);
});

t("09 materiality veto — a postponed plant is not a commercial event", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "postponed",
    claim: { summary: "Conagra postponed its new plant opening", kind: "event", requires_independent_support: true, direct: true },
    source: { url: "https://conagrabrands.com/news", origin_id: "conagrabrands.com", tier: "primary_corporate", content_lower: "conagra postponed its new plant opening indefinitely. conagrabrands.com", spanish: false, injection_neutralized: true },
  }));
  assert.equal(r.material_applicable, true);
  assert.equal(r.material, false);
});

t("10 durable state fact — temporal and materiality not applicable", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "state",
    claim: { summary: "Conagra is headquartered in Chicago", kind: "state", requires_independent_support: false, direct: true },
    event: undefined,
  }));
  assert.equal(r.temporal_applicable, false);
  assert.equal(r.material_applicable, false);
  assert.equal(r.material, true);
});

t("11 aggregator source for a material event is inadequate", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "aggregator",
    source: { url: "https://directory.example/conagra", origin_id: "directory.example", tier: "aggregator", content_lower: good().source.content_lower, spanish: false, injection_neutralized: true },
  }));
  assert.equal(r.source_adequate, false);
});

t("12 regulatory claim needs a regulatory/primary source, not trade media", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "regulatory",
    claim: { summary: "Conagra filing with the SEC discloses earnings", kind: "state", requires_independent_support: false, direct: true },
    source: { url: "https://trade.example/conagra", origin_id: "trade.example", tier: "trade_media", content_lower: "conagra filing with the sec discloses earnings. conagrabrands.com", spanish: false, injection_neutralized: true },
    event: undefined,
  }));
  assert.equal(r.source_adequate, false);
});

t("13 dishonest counterevidence absence — asserted with no search: rejected", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "dishonest-absence",
    claim: { summary: `Conagra ${"opened a new production facility"} expanding production`, kind: "event", requires_independent_support: true, direct: true, asserts_counterevidence_absent: true, counterevidence_search_performed: false },
  }));
  assert.equal(r.counterevidence_handled, false);
  assert.equal(r.customer_safe, false);
});

t("14 honest counterevidence absence — asserted after a bounded search: handled", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "honest-absence",
    claim: { summary: `Conagra ${"opened a new production facility"} expanding production`, kind: "event", requires_independent_support: true, direct: true, asserts_counterevidence_absent: true, counterevidence_search_performed: true },
  }));
  assert.equal(r.counterevidence_handled, true);
});

t("15 grounding — claim terms absent from source content is not grounded", () => {
  const r = reviewEvidenceRelationship(good({
    relationship_id: "ungrounded",
    source: { url: "https://conagrabrands.com/news", origin_id: "conagrabrands.com", tier: "primary_corporate", content_lower: "conagrabrands.com published a routine quarterly newsletter about employee wellness.", spanish: false, injection_neutralized: true },
  }));
  assert.equal(r.grounded, false);
});

t("16 injection not neutralized — not customer-safe", () => {
  const r = reviewEvidenceRelationship(good({ relationship_id: "injection", source: { ...good().source, injection_neutralized: false } }));
  assert.equal(r.customer_safe, false);
});

// ── Summary: 0/0 is NOT measured; confidence scales with sample size ─────────

t("17 empty sample — rates null (NOT measured), confidence none", () => {
  const s = summarizeEvidenceQuality([]);
  assert.equal(s.rates.association, null);
  assert.equal(s.rates.corroboration, null);
  assert.equal(s.sample_confidence, "none");
  assert.equal(s.reviewed_relationships, 0);
});

t("18 small sample low-confidence, larger sample medium-confidence", () => {
  const three = summarizeEvidenceQuality([good(), good(), good()].map(reviewEvidenceRelationship));
  const many = summarizeEvidenceQuality(Array.from({ length: 14 }, () => good()).map(reviewEvidenceRelationship));
  assert.equal(three.sample_confidence, "low");
  assert.equal(many.sample_confidence, "medium");
  // Duplicate-origin control only counts relationships where a duplicate was detected.
  assert.equal(three.duplicate_origin_rejected.controls, 0);
  assert.equal(three.rates.duplicate_origin_rejected, null);
});

// ── B. Control-plane movement through the existing mechanism ─────────────────

const EVIDENCE_CAPS = ["source_association", "source_quality", "corroboration", "counterevidence", "evidence"];

function artifact(reviews: ReturnType<typeof reviewEvidenceRelationship>[], id: string): ControlPlaneValidationEvidenceV1 {
  return createControlPlaneValidationEvidence({
    version: "control-plane-validation-evidence-v1", evidence_id: id,
    source_type: "controlled_acceptance", observed_at: now, artifact_version: "evidence-quality-v1",
    evaluator_compatibility: ["capability-control-plane-v1", "launch-readiness-v1"],
    capability_ids: EVIDENCE_CAPS,
    provenance: [{ ref: "ml/data/acceptance/evidence-quality-review-v1.json", kind: "human_review" }],
    metrics: { evidence_quality: evidenceQualityMetricsBlock(summarizeEvidenceQuality(reviews)) },
  });
}

function plane(evidence: ControlPlaneValidationEvidenceV1[]) {
  const input: CapabilityControlPlaneInput = {
    now, snapshot_capabilities: [], dynamic_recall: null, soak: null,
    monitor_sample: 0, monitor_false_novelty: null, account_memory_records: null,
    controlled_validation_evidence: evidence,
  };
  return buildCapabilityControlPlane(input);
}
const cap = (p: ReturnType<typeof plane>, id: string) => p.capabilities.find((c) => c.capability.id === id)!;
const dimScore = (p: ReturnType<typeof plane>, id: string, dim: string) => {
  const d = (cap(p, id).dimensions as Record<string, { state: string; score?: number }>)[dim];
  return d.state === "measured" ? d.score! : null;
};

// A strong, fully-correct reviewed sample (association all right, event grounded, corroborated).
const strongReviews = Array.from({ length: 16 }, (_, i) => reviewEvidenceRelationship(good({ relationship_id: `strong-${i}` })));
// A degraded sample: a third are wrong-entity homonyms (association wrong).
const degradedReviews = Array.from({ length: 16 }, (_, i) => reviewEvidenceRelationship(
  i % 3 === 0
    ? good({ relationship_id: `deg-${i}`, source: { url: "https://conagra-realty-llc.example/listing", origin_id: "example", tier: "aggregator", content_lower: "conagra realty llc lists a warehouse.", spanish: false, injection_neutralized: true } })
    : good({ relationship_id: `deg-${i}` }),
));

t("19 BEFORE — with no Evidence-quality artifact, Evidence capabilities are NOT_MEASURED", () => {
  const before = plane([]);
  for (const id of EVIDENCE_CAPS) assert.equal(isMeasured(cap(before, id).score), false, `${id} should start NOT_MEASURED`);
});

t("20 AFTER — a real reviewed sample moves every Evidence capability to measured (auto-movement)", () => {
  const after = plane([artifact(strongReviews, "strong")]);
  for (const id of EVIDENCE_CAPS) assert.equal(isMeasured(cap(after, id).score), true, `${id} should be measured after ingestion`);
});

t("21 NEGATIVE movement — a degraded (wrong-entity) sample scores association lower than a clean one", () => {
  const strong = plane([artifact(strongReviews, "strong")]);
  const degraded = plane([artifact(degradedReviews, "degraded")]);
  const s = dimScore(strong, "source_association", "correctness");
  const d = dimScore(degraded, "source_association", "correctness");
  assert.ok(s !== null && d !== null);
  assert.ok(d! < s!, `degraded association correctness ${d} should be below clean ${s}`);
});

t("22 CONFIDENCE movement — a larger reviewed sample carries higher confidence than a tiny one", () => {
  const tiny = plane([artifact(strongReviews.slice(0, 3), "tiny")]);
  const large = plane([artifact(Array.from({ length: 30 }, (_, i) => reviewEvidenceRelationship(good({ relationship_id: `L-${i}` }))), "large")]);
  const tinyConf = (cap(tiny, "source_association").dimensions.correctness as { state: string; confidence?: number });
  const largeConf = (cap(large, "source_association").dimensions.correctness as { state: string; confidence?: number });
  assert.ok(tinyConf.confidence! < largeConf.confidence!, `tiny ${tinyConf.confidence} should be below large ${largeConf.confidence}`);
});

t("23 empty reviewed sample stays NOT_MEASURED (no fabricated success)", () => {
  const empty = plane([artifact([], "empty")]);
  for (const id of EVIDENCE_CAPS) assert.equal(isMeasured(cap(empty, id).score), false, `${id} must stay NOT_MEASURED on a 0-relationship review`);
});

t("24 no double-counting — an Evidence-only artifact never moves unrelated infra capabilities", () => {
  const after = plane([artifact(strongReviews, "strong")]);
  // These are driven by other metric blocks the Evidence artifact does not carry.
  for (const id of ["tenant_isolation", "human_calibration", "runtime_latency", "provider_cooldown"]) {
    assert.equal(isMeasured(cap(after, id).score), false, `${id} must not be moved by an Evidence-only artifact`);
  }
});

t("25 wrong-entity blocker surfaced when a reviewed relationship is mis-associated", () => {
  const after = plane([artifact(degradedReviews, "degraded")]);
  const c = cap(after, "source_association");
  assert.ok(c.blockers.some((b) => /wrong entity/i.test(b)), "a wrong-entity blocker should be reported");
});

console.log(`\n${passed} passed, 0 failed`);
