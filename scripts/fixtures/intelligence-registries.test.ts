// Block 3 — Output + Pattern Registry honesty and integration tests.
import {
  assembleArtifactOutputs, outputRegistryFingerprint, type ArtifactOutputSource,
} from "@/lib/intelligence/output-registry";
import {
  adaptLearnedPreferences, patternRegistryFingerprint, type LearnedPreferenceSource,
} from "@/lib/intelligence/pattern-registry";
import {
  MIN_PATTERN_SAMPLE, validateOutputHonesty, type IntelligenceClaim, type IntelligenceOutput,
} from "@/lib/intelligence/os-contracts";
import {
  buildIntelligenceSnapshot, type SnapshotArtifactSignals, type SnapshotInput,
} from "@/lib/intelligence/snapshot-engine";
import { loadSnapshotInputs } from "@/lib/intelligence/snapshot-loader";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : ` (${d})`}`); ok ? p++ : f++; };
const NOW = "2026-07-29T00:00:00.000Z";

const artifact = (over: Partial<ArtifactOutputSource> = {}): ArtifactOutputSource => ({
  source_id: "artifact:test-run", scope: { kind: "global" }, created_at: NOW,
  market: "Test market", client_id: "test-client",
  segment_distribution: { retail: 10, hospitality: 4 },
  raw_candidates: 50, deduplicated_candidates: 35, verified: 12, probable: 8, excluded: 15,
  shortlist_accounts: ["Account A", "Account B"], timing_count: 0,
  evidence_corroborated: 0, evidence_total: 2, deep_research_complete: 0,
  capability_versions: ["segment-universe-v1", "market-to-account-pipeline-v1"], ...over,
});

const pref = (over: Partial<LearnedPreferenceSource> = {}): LearnedPreferenceSource => ({
  id: "pref-1", tenant_user_id: "tenant-1", monitor_id: null,
  feature_key: "source_type.official_site", direction: "positive", status: "inferred_weak",
  effective_confidence: 0.62, observations: 4, positive_obs: 3, neutral_obs: 0, negative_obs: 1,
  distinct_report_count: 2, first_observed_at: "2026-07-01T00:00:00.000Z",
  last_observed_at: NOW, explanation: null, version: 1, ...over,
});

const outputs = assembleArtifactOutputs(artifact());
t("1 empty input ⇒ zero outputs", assembleArtifactOutputs(null).length === 0 && assembleArtifactOutputs(artifact({ raw_candidates: 0 })).length === 0);
t("2 empty input ⇒ zero patterns", adaptLearnedPreferences([]).length === 0);
t("3 single observation is not credible pattern", adaptLearnedPreferences([pref({ positive_obs: 1, negative_obs: 0, observations: 1 })])[0].state === "insufficient_sample");
t("4 below sample floor ⇒ insufficient_sample", adaptLearnedPreferences([pref()])[0].state === "insufficient_sample");
const observed = adaptLearnedPreferences([pref({ observations: MIN_PATTERN_SAMPLE, positive_obs: MIN_PATTERN_SAMPLE, negative_obs: 0 })])[0];
t("5 sufficient sample stays observation", observed.state === "observation" && observed.mode === "observation");
t("6 observation ranking impact off", observed.ranking_impact === "off");
t("7 learned preference report impact off", observed.report_impact === "off");

const recommendation: IntelligenceClaim = {
  id: "recommendation", kind: "recommendation", statement: "Test account",
  action: "Contact only after validation", rationale: "structural fit", requires_validation: true, evidence: [],
};
const fact = outputs.find((o) => o.claim.kind === "fact")!;
t("8 recommendation remains distinct from fact", recommendation.kind !== fact.claim.kind && recommendation.requires_validation);
const hypothesis: IntelligenceClaim = { id: "hypothesis", kind: "hypothesis", statement: "May convert", testable: true, confidence: 0.3, evidence: [] };
t("9 hypothesis remains explicitly unvalidated", hypothesis.kind === "hypothesis" && !("validation_ref" in hypothesis));
const dishonestValidated: IntelligenceOutput = {
  ...fact, id: "dishonest", claim: { id: "vc", kind: "validated_conclusion", statement: "Validated", validation_ref: "", confidence: 0.8, evidence: fact.supporting_evidence },
};
t("10 validated conclusion requires validation", validateOutputHonesty(dishonestValidated).some((v) => v.code === "validated_conclusion_without_validation"));
t("11 structural fit emits no timing interpretation", !outputs.some((o) => o.type === "timing_interpretation"));
t("12 channel access never becomes buying intent", outputs.some((o) => o.reasoning_summary.includes("channel_fit_not_buying_intent")) && outputs.every((o) => !/buying intent (is|was) (confirmed|proven)/i.test(o.claim.statement)));
t("13 one pilot creates no cross-market pattern", !outputs.some((o) => o.type === "cross_market_pattern") && !adaptLearnedPreferences([pref()]).some((x) => x.type === "cross_market"));
t("14 false-positive avoidance represented", outputs.some((o) => o.type === "false_positive_avoidance"));
t("15 evidence limitation represented honestly", outputs.some((o) => o.type === "risk_finding" && /corroboration/i.test(o.summary)));
t("16 output serialization deterministic", outputRegistryFingerprint(outputs) === outputRegistryFingerprint(assembleArtifactOutputs(artifact())));
t("17 pattern serialization deterministic", patternRegistryFingerprint([observed]) === patternRegistryFingerprint(adaptLearnedPreferences([pref({ observations: 5, positive_obs: 5, negative_obs: 0 })])));

const snapArtifact: SnapshotArtifactSignals = {
  client_id: "test-client", segments: 2, verified: 12, probable: 8, excluded: 15, shortlist: 2,
  dynamic_opportunities: 0, evidence_corroborated: 0, evidence_weak: 2, evidence_total: 2,
  deep_research_complete: 0, replayable: true,
};
const snapshotInput = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  scope: { kind: "global" }, now: NOW, source_data_cutoff: NOW,
  capability_versions: { company_discovery: "segment-universe-v1" }, artifact: snapArtifact, distinct_clients: 1,
  feedback: { total_events: 0, rated_events: 0, useful_events: 0, corrections: 0, outcomes: [] },
  knowledge: { vault_companies: null, verified_signals: null, sources: null, distinct_regions: 0, distinct_industries: 0, account_memory_records: null },
  evidence: null, learner: { preference_count: 1, validated_count: 0, max_sample_size: observed.sample_size },
  outputs, patterns: [observed], baseline: null, snapshots_persisted: false, ml_tables_available: false, previous: null, ...over,
});
const snap = buildIntelligenceSnapshot(snapshotInput());
t("18 snapshot summarizes outputs", snap.registry_summary.output_count === outputs.length && Object.keys(snap.registry_summary.outputs_by_type).length > 0);
t("19 snapshot summarizes patterns", snap.registry_summary.pattern_count === 1 && snap.registry_summary.patterns_by_state.observation === 1);
const emptyRegistrySnap = buildIntelligenceSnapshot(snapshotInput({ outputs: [], patterns: [] }));
t("20 registries do not inflate maturity", snap.index.level === emptyRegistrySnap.index.level && JSON.stringify(snap.index.dimensions) === JSON.stringify(emptyRegistrySnap.index.dimensions));
t("21 report eligibility conservative", outputs.every((o) => o.report_eligibility === "not_eligible") && observed.report_impact === "off");
t("22 no fabricated novelty", outputs.every((o) => o.novelty.state === "not_measured"));
t("23 all outputs are unreviewed/unvalidated", outputs.every((o) => o.validation_state === "unreviewed" && o.human_review_state === "unreviewed"));
t("24 all outputs have zero ranking impact", outputs.every((o) => o.ranking_impact === "none"));
t("25 output claims preserve evidence", outputs.every((o) => o.claim.evidence.length > 0 && o.supporting_evidence.length > 0));
t("26 primary limitation remains explicit", typeof snap.registry_summary.primary_pattern_limitation === "string");

(async () => {
  const live = await loadSnapshotInputs({ now: NOW });
  t("27 real artifact produces supported outputs", (live.outputs?.length ?? 0) > 0);
  t("28 no learned rows supplied ⇒ no patterns fabricated", (live.patterns?.length ?? 0) === 0);
  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
