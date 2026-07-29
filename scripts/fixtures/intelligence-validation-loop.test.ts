import {
  addLearningImplication, applyHumanReview, assessClientRelevance, canTransition, createLifecycle,
  currentStatement, deriveReportEligibility, partitionLegacyFeedback, recordCommercialAction,
  recordCommercialOutcome, summarizeValidationLearning, transitionValidation,
  type AttributedCommercialOutcome, type ClientRelevanceAssessment, type CommercialAction,
  type HumanReview, type LearningImplication,
} from "@/lib/intelligence/validation-lifecycle";
import { createValidationRepository, type ValidationPersistence } from "@/lib/intelligence/validation-store";
import { unmeasured, type IntelligenceOutput } from "@/lib/intelligence/os-contracts";
import { buildIntelligenceSnapshot, type SnapshotInput } from "@/lib/intelligence/snapshot-engine";
import { readFileSync } from "fs";

let p = 0, f = 0;
const t = (name: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${name}`); ok ? p++ : f++; };
const throws = (fn: () => unknown, fragment: string) => { try { fn(); return false; } catch (e) { return String(e).includes(fragment); } };
const NOW = "2026-07-29T12:00:00.000Z";
const output: IntelligenceOutput = {
  id: "out-1", scope: { kind: "client", tenant_id: "tenant-1", client_id: "client-1" }, type: "segment_insight",
  claim: { id: "claim-1", kind: "inference", statement: "Original claim", evidence: [], basis: [], confidence: .6 },
  summary: "Summary", affected_market: "Colombia", affected_segments: ["retail"], affected_accounts: [],
  client_id: "client-1", reasoning_summary: "Reasoning", supporting_facts: [], supporting_signals: [],
  supporting_evidence: [], counterevidence: [], alternative_explanations: [], unresolved_questions: [],
  confidence: .6, confidence_method: "fixture", novelty: unmeasured("not_measured", "not assessed"),
  actionability: unmeasured("not_measured", "not assessed"), commercial_relevance: unmeasured("not_measured", "not assessed"),
  validation_state: "unreviewed", human_review_state: "unreviewed", outcome_state: "none",
  ranking_impact: "none", report_eligibility: "not_eligible", capability_versions: [],
  methodology_version: "fixture-v1", created_at: NOW, valid_from: NOW, valid_until: null, last_reviewed: null,
};
const review = (over: Partial<Omit<HumanReview, "output_id" | "original_statement" | "reviewed_statement" | "resulting_state">> = {}) => ({
  id: "review-1", reviewer_id: "reviewer-1", reviewer_role: "analyst", action: "approve" as const,
  corrected_statement: null, correction_reason: null, confidence_adjustment: null,
  evidence_quality: "sufficient" as const, commercial_relevance_judgment: "relevant" as const,
  customer_safety: "safe" as const, notes: null, created_at: NOW, reviewed_at: NOW,
  methodology_version: "review-v1", ...over,
});
const relevance: ClientRelevanceAssessment = {
  client_id: "client-1", state: "relevant", rationale: "Offer and geography fit", offer_fit: "yes",
  geographic_fit: "yes", strategic_fit: "yes", constraints: [], actionability: "actionable", confidence: .8, assessed_at: NOW,
};
const action: CommercialAction = { id: "action-1", output_id: output.id, kind: "contact", description: "Sent outreach", actor_id: "seller-1", occurred_at: NOW, evidence_refs: ["crm:1"] };
const outcome: AttributedCommercialOutcome = {
  id: "outcome-1", output_id: output.id, action_id: action.id, kind: "progressed", observed_at: NOW,
  attribution_confidence: .4, attribution_limitations: ["Multiple factors may have caused progress"], evidence_refs: ["crm:2"], note: null,
};
const implication: LearningImplication = {
  id: "imp-1", output_id: output.id, outcome_id: outcome.id, type: "investigate", statement: "Observe more cases",
  mode: "observation", human_approved: false, ranking_impact: "off",
  affected_capability: "client_specific_opportunity_assessment", affected_pattern: null, created_at: NOW,
};

t("1 unreviewed → approved allowed", canTransition("unreviewed", "human_approved"));
t("2 unreviewed → confirmed forbidden", !canTransition("unreviewed", "confirmed"));
t("3 approved → relevant allowed", canTransition("human_approved", "client_relevant"));
t("4 relevant → acted allowed", canTransition("client_relevant", "acted_upon"));
t("5 acted → confirmed allowed", canTransition("acted_upon", "confirmed"));
t("6 no_outcome is distinct from refuted", !canTransition("no_outcome", "refuted"));
t("7 rejected is terminal", !canTransition("client_rejected", "acted_upon"));
t("8 invalid transition throws centrally", throws(() => transitionValidation("unreviewed", "confirmed"), "invalid_validation_transition"));

let lc = createLifecycle(output, NOW);
t("9 lifecycle preserves immutable output snapshot", lc.original_output !== output && lc.original_output.claim.statement === "Original claim");
t("10 lifecycle defaults internal-only", lc.report_eligibility === "internal_only");
lc = applyHumanReview(lc, review());
t("11 approval records reviewer and state", lc.state === "human_approved" && lc.reviews[0].reviewer_id === "reviewer-1");
t("12 approval alone is not customer-safe", deriveReportEligibility(lc) === "review_required");
lc = assessClientRelevance(lc, relevance);
t("13 correctness and relevance are separate", lc.state === "client_relevant" && lc.relevance?.state === "relevant");
t("14 safe review + relevance may be safe", lc.report_eligibility === "customer_safe");
lc = recordCommercialAction(lc, action);
t("15 action is distinct and changes state", lc.state === "acted_upon" && lc.actions.length === 1 && lc.outcomes.length === 0);
t("16 action idempotency", recordCommercialAction(lc, action) === lc);
lc = recordCommercialOutcome(lc, outcome);
t("17 progressed maps to partial confirmation", lc.state === "partially_confirmed" && lc.outcomes.length === 1);
t("18 outcome idempotency", recordCommercialOutcome(lc, outcome) === lc);
lc = addLearningImplication(lc, implication);
t("19 implication is observation/ranking off", lc.learning_implications[0].mode === "observation" && lc.learning_implications[0].ranking_impact === "off");
t("20 implication idempotency", addLearningImplication(lc, implication) === lc);

const corrected = applyHumanReview(createLifecycle(output, NOW), review({ action: "correct", corrected_statement: "Corrected claim", correction_reason: "Evidence nuance" }));
t("21 correction preserves original", corrected.original_output.claim.statement === "Original claim");
t("22 correction history exposes current statement", currentStatement(corrected) === "Corrected claim" && corrected.reviews[0].original_statement === "Original claim");
t("23 correction requires reason", throws(() => applyHumanReview(createLifecycle(output, NOW), review({ action: "correct", corrected_statement: "x" })), "correction_requires"));
t("24 anonymous review forbidden", throws(() => applyHumanReview(createLifecycle(output, NOW), review({ reviewer_id: "" })), "reviewer_identity"));
t("25 cross-client relevance forbidden", throws(() => assessClientRelevance(applyHumanReview(createLifecycle(output, NOW), review()), { ...relevance, client_id: "other" }), "cross_client"));
t("26 action before relevance forbidden", throws(() => recordCommercialAction(createLifecycle(output, NOW), action), "invalid_validation_transition"));
t("27 outcome requires linked action", throws(() => recordCommercialOutcome({ ...lc, actions: [] }, outcome), "outcome_action_required"));
t("28 outcome requires attribution limitations", throws(() => recordCommercialOutcome({ ...lc, state: "acted_upon", outcomes: [] }, { ...outcome, attribution_limitations: [] }), "attribution_limitations"));
t("29 outcome confidence bounded", throws(() => recordCommercialOutcome({ ...lc, state: "acted_upon", outcomes: [] }, { ...outcome, attribution_confidence: 2 }), "invalid_attribution"));
t("30 reviewed implication needs approval", throws(() => addLearningImplication({ ...lc, learning_implications: [] }, { ...implication, id: "imp-2", mode: "human_reviewed" }), "requires_approval"));
t("31 implication requires outcome", throws(() => addLearningImplication({ ...lc, outcomes: [] }, implication), "implication_outcome"));

const legacy = partitionLegacyFeedback([
  { id: "a", output_id: "out-1", feedback_signal: "meeting_booked" }, { id: "b", feedback_signal: "won" },
  { id: "c", output_id: "unknown", feedback_signal: "lost" },
], new Set(["out-1"]));
t("32 only explicit known legacy links adapt", legacy.linked.length === 1 && legacy.unlinked.length === 2);
const summary = summarizeValidationLearning([output], [lc]);
t("33 summary counts reviewed/relevant/action", summary.reviewed_count === 1 && summary.client_relevant_count === 1 && summary.acted_upon_count === 1);
t("34 summary outcome coverage measured", summary.outcome_coverage.state === "measured");
t("35 one outcome creates implication, not pattern", summary.implications_by_type.investigate === 1);

const rows: Array<{ table: string; row: Record<string, unknown> }> = [];
const store: ValidationPersistence = { async insert(table, row) { rows.push({ table, row }); return { id: `db-${rows.length}` }; } };
const repo = createValidationRepository(store, { tenant_user_id: "tenant-1", actor_id: "admin-1", actor_role: "admin", client_id: "client-1" });
void repo.saveLifecycle(lc, "validation:out-1:v1");
void repo.saveOutcome(outcome, "db-1", "outcome:1");
t("36 repository derives tenant/actor", rows.every((r) => r.row.tenant_user_id === "tenant-1" && r.row.actor_id === "admin-1"));
t("37 repository carries idempotency keys", rows[0].row.idempotency_key === "validation:out-1:v1" && rows[1].row.idempotency_key === "outcome:1");
t("38 repository preserves attribution", rows[1].row.attribution_confidence === .4 && Array.isArray(rows[1].row.attribution_limitations));

const snapshotInput: SnapshotInput = {
  scope: output.scope, now: NOW, source_data_cutoff: NOW, capability_versions: {}, artifact: null, distinct_clients: 1,
  feedback: { total_events: 0, rated_events: 0, useful_events: 0, corrections: 0, outcomes: [] },
  knowledge: { vault_companies: null, verified_signals: null, sources: null, distinct_regions: 0, distinct_industries: 0, account_memory_records: null },
  evidence: null, learner: { preference_count: 0, validated_count: 0, max_sample_size: 0 },
  outputs: [output], patterns: [], validation_lifecycles: [lc], baseline: null, snapshots_persisted: false, ml_tables_available: false, previous: null,
};
const snapshot = buildIntelligenceSnapshot(snapshotInput);
t("39 snapshot exposes validation summary", snapshot.validation_summary.reviewed_count === 1);
t("40 snapshot exposes safe implications", snapshot.learning_implications.length === 1 && snapshot.learning_implications[0].ranking_impact === "off");
t("41 lifecycle never mutates output ranking", snapshot.outputs[0].ranking_impact === "none");
t("42 zero OS outcomes remains not_measured", snapshot.index.dimensions.find((d) => d.id === "outcome_performance")?.measurement.state === "not_measured");
const empty = summarizeValidationLearning([], []);
t("43 empty summary never fabricates score", empty.validation_coverage.state === "no_observations" && !("score" in empty.validation_coverage));
const requested = applyHumanReview(createLifecycle(output, NOW), review({ action: "request_more_evidence", evidence_quality: "insufficient" }));
t("44 evidence request does not validate", requested.state === "unreviewed" && requested.report_eligibility === "internal_only");
const rejected = applyHumanReview(createLifecycle(output, NOW), review({ action: "mark_not_relevant" }));
t("45 not-relevant is not negative outcome", rejected.state === "client_rejected" && rejected.outcomes.length === 0);
const migration = readFileSync("supabase/migrations/041_intelligence_validation_loop.sql", "utf8");
t("46 persistence uses UUID primary keys", (migration.match(/UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/g) ?? []).length === 5);
t("47 persistence is tenant scoped", (migration.match(/tenant_user_id UUID NOT NULL/g) ?? []).length === 5);
t("48 persistence enables RLS on every table", (migration.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length === 5);
t("49 persistence exposes no authenticated policy", !/CREATE POLICY/i.test(migration));
t("50 persistence enforces ranking off", /CHECK \(ranking_impact = 'off'\)/.test(migration));

console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
