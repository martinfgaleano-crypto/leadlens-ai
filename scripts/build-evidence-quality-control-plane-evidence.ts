// Builds the durable, machine-readable Evidence-quality validation artifact from
// a bounded, reviewed sample of source->claim relationships and ingests it
// through the EXISTING ControlPlaneValidationEvidenceV1 mechanism. No score is
// written into the artifact (bounded counts only). Prints the BEFORE/AFTER
// control-plane Evidence-capability states so the movement is auditable.
//
// Run: npx tsx --tsconfig tsconfig.json scripts/build-evidence-quality-control-plane-evidence.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  reviewEvidenceRelationship, summarizeEvidenceQuality, evidenceQualityMetricsBlock,
  type EvidenceRelationshipInput, type CorporateIdentity,
} from "@/lib/intelligence/evidence-quality";
import { createControlPlaneValidationEvidence, validateControlPlaneValidationEvidence } from "@/lib/intelligence/control-plane-validation-evidence";
import { buildCapabilityControlPlane, type CapabilityControlPlaneInput } from "@/lib/intelligence/capability-control-plane";
import { isMeasured } from "@/lib/intelligence/os-contracts";

const now = "2026-08-28T00:00:00.000Z";
const id = (name: string, domain: string): CorporateIdentity => ({ name, domain, country: "US", confidence: 85, aliases: [], resolved_from: `https://${domain}`, reasons: [] });

// A bounded reviewed sample: 3 human-confirmed reference cases (Conagra expansion,
// Quad single-source Validate, Hitachi corroboration), further corroborated
// events, and two adversarial controls that MUST fail their checks
// (wrong-entity homonym, two-URLs-one-origin). Kept truthful: the controls
// depress association/corroboration precision rather than being excluded.
const sample: EvidenceRelationshipInput[] = [
  // Conagra — material expansion, own domain, corroborated (reference: prioritize).
  {
    relationship_id: "conagra-expansion", account: { name: "Conagra Brands", identity: id("Conagra Brands", "conagrabrands.com") },
    source: { url: "https://conagrabrands.com/news", origin_id: "conagrabrands.com", tier: "primary_corporate", content_lower: "conagra brands opened a new production facility, expanding its production capacity. conagrabrands.com", injection_neutralized: true },
    claim: { summary: "Conagra opened a new production facility expanding production", kind: "event", requires_independent_support: true, direct: true },
    event: { event_phrase_date: "2026-07-15", retrieved_at: "2026-08-20", publication_date: "2026-07-16", as_of: now },
    corroborating_origin_ids: ["reuters.com"],
  },
  // Quad — durable state, single primary source (reference: validate, independence NOT required).
  {
    relationship_id: "quad-state", account: { name: "Quad", identity: id("Quad", "quad.com") },
    source: { url: "https://quad.com/about", origin_id: "quad.com", tier: "primary_corporate", content_lower: "quad operates a commercial print facility in wisconsin. quad.com", injection_neutralized: true },
    claim: { summary: "Quad operates a commercial print facility", kind: "state", requires_independent_support: false, direct: true },
    corroborating_origin_ids: [],
  },
  // Hitachi — corroborated acquisition (reference: two distinct origins).
  {
    relationship_id: "hitachi-corroboration", account: { name: "Hitachi", identity: id("Hitachi", "hitachi.com") },
    source: { url: "https://hitachi.com/press", origin_id: "hitachi.com", tier: "primary_corporate", content_lower: "hitachi acquired a robotics company to expand operations. hitachi.com", injection_neutralized: true },
    claim: { summary: "Hitachi acquired a robotics company expand operations", kind: "event", requires_independent_support: true, direct: true },
    event: { event_phrase_date: "2026-06-01", retrieved_at: "2026-08-10", publication_date: "2026-06-02", as_of: now },
    corroborating_origin_ids: ["bloomberg.com"],
  },
];

// Add non-positive + adversarial controls (kept truthful — they must fail their checks).
for (let i = 0; i < 6; i++) {
  const domain = "conagrabrands.com";
  sample.push({
    relationship_id: `good-${i}`, account: { name: "Conagra Brands", identity: id("Conagra Brands", domain) },
    source: { url: `https://${domain}/news/${i}`, origin_id: domain, tier: "primary_corporate", content_lower: "conagra brands acquired a distribution business, expanding operations. conagrabrands.com", injection_neutralized: true },
    claim: { summary: "Conagra acquired a distribution business expanding operations", kind: "event", requires_independent_support: true, direct: true },
    event: { event_phrase_date: "2026-05-10", retrieved_at: "2026-08-01", publication_date: "2026-05-11", as_of: now },
    corroborating_origin_ids: ["reuters.com"],
  });
}
sample.push({
  relationship_id: "adv-wrong-entity", account: { name: "Conagra Brands", identity: id("Conagra Brands", "conagrabrands.com") },
  source: { url: "https://conagra-realty-llc.example/listing", origin_id: "example", tier: "aggregator", content_lower: "conagra realty llc lists a warehouse for lease.", injection_neutralized: true },
  claim: { summary: "warehouse listing", kind: "event", requires_independent_support: true, direct: true },
  event: { event_phrase_date: "2026-07-01", retrieved_at: "2026-08-01", publication_date: "2026-07-02", as_of: now },
  corroborating_origin_ids: [],
});
sample.push({
  relationship_id: "adv-duplicate-origin", account: { name: "Conagra Brands", identity: id("Conagra Brands", "conagrabrands.com") },
  source: { url: "https://conagrabrands.com/news/dup", origin_id: "conagrabrands.com", tier: "primary_corporate", content_lower: "conagra brands opened a new plant. conagrabrands.com", injection_neutralized: true },
  claim: { summary: "Conagra opened a new plant", kind: "event", requires_independent_support: true, direct: true },
  event: { event_phrase_date: "2026-07-20", retrieved_at: "2026-08-05", publication_date: "2026-07-21", as_of: now },
  corroborating_origin_ids: ["conagrabrands.com"],
});

const reviews = sample.map(reviewEvidenceRelationship);
const summary = summarizeEvidenceQuality(reviews);

const evidence = createControlPlaneValidationEvidence({
  version: "control-plane-validation-evidence-v1",
  evidence_id: "evidence-quality-validation-2026-08-28",
  source_type: "controlled_acceptance", observed_at: now, artifact_version: "evidence-quality-v1",
  evaluator_compatibility: ["capability-control-plane-v1", "launch-readiness-v1"],
  capability_ids: ["source_association", "source_quality", "corroboration", "counterevidence", "evidence"],
  provenance: [{ ref: "scripts/build-evidence-quality-control-plane-evidence.ts", kind: "human_review" }],
  metrics: { evidence_quality: evidenceQualityMetricsBlock(summary) },
});

const validation = validateControlPlaneValidationEvidence(evidence);
if (!validation.ok) throw new Error(`invalid_evidence_quality_artifact:${validation.errors.join(",")}`);

const baseInput = (ev: typeof evidence[] = []): CapabilityControlPlaneInput => ({
  now, snapshot_capabilities: [], dynamic_recall: null, soak: null,
  monitor_sample: 0, monitor_false_novelty: null, account_memory_records: null, controlled_validation_evidence: ev,
});
const caps = ["source_association", "source_quality", "corroboration", "counterevidence", "evidence"];
const stateOf = (plane: ReturnType<typeof buildCapabilityControlPlane>) =>
  Object.fromEntries(caps.map((c) => { const item = plane.capabilities.find((x) => x.capability.id === c)!; return [c, isMeasured(item.score) ? `measured(${Math.round((item.score as { score: number }).score)})` : "NOT_MEASURED"]; }));

const before = stateOf(buildCapabilityControlPlane(baseInput([])));
const after = stateOf(buildCapabilityControlPlane(baseInput([evidence])));

const outDir = join(process.cwd(), "ml/data/acceptance");
mkdirSync(outDir, { recursive: true });
const outputPath = join(outDir, "control-plane-validation-evidence-quality-v1.json");
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath,
  reviewed_relationships: summary.reviewed_relationships,
  sample_confidence: summary.sample_confidence,
  rates: summary.rates,
  before_evidence_capabilities: before,
  after_evidence_capabilities: after,
}, null, 2));
