// Unit tests: Intelligence Snapshot Engine (snapshot-methodology-v1).
// Covers the 20 required Block-2 invariants — provider-free deterministic
// assembly, honest missing-data, anti-inflation, gap→action derivation.
import {
  buildIntelligenceSnapshot, snapshotFingerprint, validateSnapshot,
  INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION, type SnapshotInput, type SnapshotArtifactSignals,
} from "@/lib/intelligence/snapshot-engine";
import { isMeasured, type IntelligenceOutcome } from "@/lib/intelligence/os-contracts";
import { loadLatestArtifactSignals } from "@/lib/intelligence/snapshot-loader";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

const NOW = "2026-07-27T00:00:00.000Z", CUT = "2026-07-27T01-35-36-464Z";
const amorArtifact: SnapshotArtifactSignals = {
  client_id: "amor-de-gea", segments: 7, verified: 21, probable: 29, excluded: 114, shortlist: 8,
  dynamic_opportunities: 0, evidence_corroborated: 0, evidence_weak: 8, evidence_total: 8, deep_research_complete: 0, replayable: true,
};
const baseInput = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  scope: { kind: "global" }, now: NOW, source_data_cutoff: CUT,
  capability_versions: { company_discovery: "segment-universe-v1" }, artifact: amorArtifact, distinct_clients: 1,
  feedback: { total_events: 5, rated_events: 5, useful_events: 3, corrections: 0, outcomes: [] },
  knowledge: { vault_companies: 40, verified_signals: 10, sources: 20, distinct_regions: 3, distinct_industries: 5, account_memory_records: 12 },
  evidence: null, learner: { preference_count: 2, validated_count: 0, max_sample_size: 2 },
  baseline: null, snapshots_persisted: false, ml_tables_available: false, previous: null, ...over,
});

const dimOf = (s: ReturnType<typeof buildIntelligenceSnapshot>, id: string) => s.index.dimensions.find((d) => d.id === id)!;
const capOf = (s: ReturnType<typeof buildIntelligenceSnapshot>, id: string) => s.capability_assessments.find((c) => c.capability_id === id)!;

// 1. Provider-free assembly (pure — no I/O, returns a snapshot).
const snap = buildIntelligenceSnapshot(baseInput());
t("1 provider-free assembly", snap.methodology_version === INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION && snap.capability_assessments.length >= 20);

// 2 + 3. Deterministic replay + stable serialization.
t("2 deterministic replay", snapshotFingerprint(buildIntelligenceSnapshot(baseInput())) === snapshotFingerprint(buildIntelligenceSnapshot(baseInput())));
t("3 stable serialization ignores key order", snapshotFingerprint(snap) === snapshotFingerprint(buildIntelligenceSnapshot(baseInput())));

// 4. Missing data does not become zero.
const noArt = buildIntelligenceSnapshot(baseInput({ artifact: null, knowledge: { ...baseInput().knowledge, vault_companies: null, account_memory_records: null } }));
t("4 missing data ⇒ not-measured (not 0)", dimOf(noArt, "evidence_integrity").measurement.state === "not_instrumented" && !isMeasured(dimOf(noArt, "evidence_integrity").measurement));

// 5. Knowledge volume cannot create analytical maturity.
const bigVolume = buildIntelligenceSnapshot(baseInput({ artifact: null, knowledge: { ...baseInput().knowledge, vault_companies: 1_000_000 } }));
t("5 volume ≠ analytical maturity", bigVolume.index.level !== "analytical_intelligence" && dimOf(bigVolume, "analytical_depth").measurement.state !== "measured");

// 6. One pilot cannot create broad client-specific maturity.
t("6 one pilot ⇒ client specificity insufficient", dimOf(snap, "client_specificity").measurement.state === "insufficient_evidence");
t("6b two clients ⇒ measurable", isMeasured(dimOf(buildIntelligenceSnapshot(baseInput({ distinct_clients: 2 })), "client_specificity").measurement));

// 7. Tests/schemas cannot create operational maturity.
t("7 schema-only capability not production", capOf(snap, "what_changed_detection").mode !== "production" && capOf(snap, "portfolio_strategy").mode !== "production");

// 8. Outcome Performance not_measured without outcomes.
t("8 no outcomes ⇒ outcome_performance not_measured", dimOf(snap, "outcome_performance").measurement.state === "not_measured");
const withOutcomes: IntelligenceOutcome[] = [{ id: "o1", kind: "terminal_positive", dimension: "commercial_outcome", observed_at: NOW, evidence: [] }, { id: "o2", kind: "terminal_negative", dimension: "commercial_outcome", observed_at: NOW, evidence: [] }];
t("8b thin outcomes ⇒ insufficient", dimOf(buildIntelligenceSnapshot(baseInput({ feedback: { ...baseInput().feedback, outcomes: withOutcomes } })), "outcome_performance").measurement.state === "insufficient_evidence");
t("8c sufficient outcomes ⇒ measured", isMeasured(dimOf(buildIntelligenceSnapshot(baseInput({ feedback: { ...baseInput().feedback, outcomes: [...withOutcomes, ...withOutcomes, withOutcomes[0]] } })), "outcome_performance").measurement));

// 9. Differentiation not_measured without baseline.
t("9 no baseline ⇒ differentiation not_measured", dimOf(snap, "differentiation").measurement.state === "not_measured");

// 10. Shadow/observation capabilities remain non-production.
t("10 feedback_learning is observation, ranking off", capOf(snap, "feedback_learning").mode === "observation" && capOf(snap, "feedback_learning").ranking_impact === "none");

// 11. Insufficient feedback sample ⇒ insufficient_evidence.
t("11 <20 rated ⇒ commercial relevance insufficient", dimOf(snap, "commercial_relevance").measurement.state === "insufficient_evidence");
t("11b ≥20 rated ⇒ measured", isMeasured(dimOf(buildIntelligenceSnapshot(baseInput({ feedback: { total_events: 30, rated_events: 25, useful_events: 15, corrections: 1, outcomes: [] } })), "commercial_relevance").measurement));

// 12. Evidence Integrity reflects dated + corroborated honestly.
const withEvidence = buildIntelligenceSnapshot(baseInput({ evidence: { total: 40, dated: 30, corroborated: 20, stale: 5, source_classes: 4, counterevidence_instrumented: false } }));
t("12 evidence integrity measured from coverage", isMeasured(dimOf(withEvidence, "evidence_integrity").measurement));

// 13. Critical gaps block premium readiness (never premium here).
t("13 not premium with open critical gaps", snap.readiness.readiness_level !== "premium_report_ready");
t("13b self-validation passes (no honesty violations)", validateSnapshot(snap).length === 0);

// 14. Gap generation deterministic + de-duplicated by root cause.
const gapIds = snap.gaps.map((g) => g.id);
t("14 gaps deterministic + unique roots", JSON.stringify(gapIds) === JSON.stringify(buildIntelligenceSnapshot(baseInput()).gaps.map((g) => g.id)) && new Set(gapIds).size === gapIds.length);

// 15. Next actions derived from gaps.
t("15 actions derived from gaps", snap.actions.length === snap.gaps.length && snap.actions.every((a) => a.affected_gaps.length === 1));
t("15b actions sorted by priority desc", snap.actions.every((a, i, arr) => i === 0 || arr[i - 1].priority >= a.priority));

// 16. Duplicate root-cause gaps consolidated (no_outcomes appears once).
t("16 duplicate root causes consolidated", snap.gaps.filter((g) => g.type === "no_commercial_outcome").length === 1);

// 17. Global maturity is conservative (not analytical without baseline+depth-at-scale).
t("17 conservative global maturity", snap.index.level === "structured_knowledge" || snap.index.level === "retrieval");

// 18. Diagnosis matches snapshot data.
t("18 diagnosis matches data", snap.diagnosis.maturity_level === snap.index.level && snap.diagnosis.highest_leverage_action === snap.actions[0].action_type && snap.diagnosis.generated_from === "rules");

// 19. Snapshot carries cutoff + methodology version.
t("19 cutoff + methodology present", snap.source_data_cutoff === CUT && snap.index.methodology_version === INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION);

// 20. Existing ranking not modified — engine imports nothing from ranking/selector.
import { readFileSync } from "fs";
const engineSrc = readFileSync("lib/intelligence/snapshot-engine.ts", "utf8");
t("20 no ranking/selector import (ranking untouched)", !/vault-opportunity-selector|lib\/ranking|opportunity-decision/.test(engineSrc));

// Bonus: loader contract on the real latest artifact. The pilot run dirs (ml/data/pilot-amor-de-gea)
// are gitignored generated data, so a clean checkout (CI) has none — and the loader correctly returns
// null there. Assert the CONTRACT: when an artifact IS present it parses to valid signals; when none
// is present, null is the correct result. This catches a real parsing regression without depending on
// gitignored local data (which made this fail in CI while passing locally).
(async () => {
  const { signals } = await loadLatestArtifactSignals();
  t("+ loader reads real artifact when present (null when absent)", signals === null || (signals.verified >= 1 && signals.segments >= 1), signals ? `verified=${signals.verified}` : "no artifact (clean checkout) — loader returned null as expected");
  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
