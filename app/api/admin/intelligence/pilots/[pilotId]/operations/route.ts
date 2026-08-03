import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  buildPilotWorkspace,
  canonicalPilotId,
  PILOT_WORKSPACE_VERSION,
} from "@/lib/intelligence/pilot-workspace";

const operationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept_context"),
    intake_id: z.string().min(1).max(120),
    accepted_question_ids: z.array(z.string()).min(1).max(17),
    rejected_question_ids: z.array(z.string()).max(17).default([]),
  }),
  z.object({
    action: z.literal("review_thesis"),
    thesis_id: z.string().min(1).max(120),
    decision: z.enum(["approved_internal", "corrected", "rejected", "context_requested", "evidence_requested", "expired"]),
    correction_note: z.string().max(4000).default(""),
  }),
  z.object({
    action: z.literal("review_safety"),
    thesis_id: z.string().min(1).max(120),
    gates: z.array(z.object({
      gate: z.string().min(1).max(80),
      state: z.enum(["pass", "fail", "insufficient", "not_applicable"]),
      note: z.string().max(1000).default(""),
    })).min(1).max(20),
  }),
]);

function stableId(prefix: string, value: unknown) {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24)}`;
}

const AMOR_DE_GEA_AUTHORIZED_ACCEPTANCE_LIMITATIONS = [
  "Exact wholesale economics remain pending validation.",
  "VAT treatment remains pending validation.",
  "Final margin and channel discount structure remain pending validation.",
  "Freight and shipping economics remain pending validation.",
  "Ordinary production capacity remains unconfirmed.",
  "Per-SKU production capacity remains unconfirmed.",
  "Orders above 1,000 units with advance planning are not ordinary capacity.",
  "Private-label feasibility remains unconfirmed and route-blocked.",
  "Existing commercial relationships and channel conflicts are unknown.",
  "National logistics capability is client-stated and not independently verified.",
  "Regulatory documentation is client-stated and not independently verified.",
  "Product-benefit and health claims remain blocked from customer-safe use.",
  "The dosage and bottle-duration inconsistency remains unresolved.",
  "Route priorities are founder-approved decisions, not client-stated facts.",
  "Objectives combine client strategic direction with three founder-approved measurable outcomes.",
] as const;

export async function POST(req: NextRequest, { params }: { params: { pilotId: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const pilotId = canonicalPilotId(params.pilotId);
  if (!pilotId) return NextResponse.json({ error: "pilot_not_found" }, { status: 404 });
  const parsed = operationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_operation", details: parsed.error.flatten() }, { status: 400 });
  const operation = parsed.data;

  const workspace = buildPilotWorkspace();
  const thesisIds = new Set(workspace.theses.map((item: any) => item.thesis_id));
  const questionIds = new Set(workspace.questions.map((item: any) => item.question_id));
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  const now = new Date().toISOString();

  if (operation.action === "accept_context") {
    const accepted = Array.from(new Set(operation.accepted_question_ids));
    const rejected = Array.from(new Set(operation.rejected_question_ids));
    if (accepted.some(id => !questionIds.has(id)) || rejected.some(id => !questionIds.has(id)) || accepted.some(id => rejected.includes(id))) {
      return NextResponse.json({ error: "forged_or_conflicting_question_id" }, { status: 400 });
    }
    const { data: intake, error: intakeError } = await db
      .from("intelligence_client_intakes").select("*")
      .eq("id", operation.intake_id).eq("client_id", pilotId).eq("status", "submitted").maybeSingle();
    if (intakeError || !intake) return NextResponse.json({ error: "submitted_intake_not_found" }, { status: 409 });
    const answers = Array.isArray(intake.intake_json?.answers) ? intake.intake_json.answers : [];
    if (accepted.some(id => !answers.some((answer: any) => answer.question_id === id && answer.status !== "unanswered"))) {
      return NextResponse.json({ error: "accepted_answer_missing" }, { status: 409 });
    }
    const previous = await db.from("intelligence_client_context_versions")
      .select("id,version_number").eq("client_id", pilotId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    if (previous.error) return NextResponse.json({ error: "context_lookup_failed", message: previous.error.message }, { status: 500 });
    const versionNumber = (previous.data?.version_number ?? 0) + 1;
    const versionPayload = {
      pilot_id: pilotId,
      source_candidate_id: intake.id,
      accepted_answers: answers.filter((answer: any) => accepted.includes(answer.question_id)),
      provenance_layers: {
        client_questionnaire: answers.filter((answer: any) => answer.client_source),
        client_marketing_material: intake.intake_json?.marketing_materials ?? [],
        founder_pilot_decision: intake.intake_json?.founder_decisions ?? [],
        system_interpretation: intake.intake_json?.system_interpretations ?? [],
        open_validation: intake.intake_json?.open_validations ?? [],
      },
      candidate_limitations: intake.intake_json?.limitations ?? [],
      explicit_limitations: intake.id === "intake_fb4bc38a8e0af0343c9f8f1e"
        ? AMOR_DE_GEA_AUTHORIZED_ACCEPTANCE_LIMITATIONS
        : (intake.intake_json?.limitations ?? []),
      rejected_question_ids: rejected,
      unresolved_question_ids: workspace.questions.map((q: any) => q.question_id).filter((id: string) => !accepted.includes(id)),
      acceptance: accepted.length === answers.length ? "accepted" : "partially_accepted",
      actor: "active_admin_session",
      founder_authorization: {candidate_id:intake.id,authorized:true,scope:"accept_this_candidate_only",recorded_at:now},
      acceptance_audit: {event_type:"context_accepted",candidate_id:intake.id,actor:"active_admin_session",occurred_at:now,append_only:true},
      deterministic_recalculation: {
        provider_calls: 0,
        affected_thesis_ids: [],
        deferred_to_next_phase: true,
      },
      ranking_impact:"off",
      customer_safe_promoted:false,
    };
    const id = stableId("context", { pilotId, intake: intake.id, accepted, rejected });
    const { error } = await db.from("intelligence_client_context_versions").insert({
      id, tenant_user_id: null, client_id: pilotId, version_number: versionNumber,
      status: versionPayload.acceptance, context_json: versionPayload, changed_fields: accepted,
      previous_version_id: previous.data?.id ?? null, source_intake_id: intake.id,
      effective_at: now, reviewer_id: null, methodology_version: PILOT_WORKSPACE_VERSION,
      idempotency_key: `${pilotId}:accept:${intake.id}:${id}`,
    });
    if (error && error.code !== "23505") return NextResponse.json({ error: "context_acceptance_failed", message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, context_version_id: id, version_number: versionNumber, ...versionPayload, history_preserved: true });
  }

  if (!thesisIds.has(operation.thesis_id)) return NextResponse.json({ error: "forged_thesis_id" }, { status: 400 });
  const original: any = workspace.theses.find((item: any) => item.thesis_id === operation.thesis_id);

  if (operation.action === "review_thesis") {
    const id = stableId("thesis_review", { pilotId, ...operation });
    const reviewedThesis = {
      ...original,
      review: { decision: operation.decision, correction_note: operation.correction_note, actor: "active_admin_session", reviewed_at: now },
      original_thesis_id: original.thesis_id,
      customer_safe: false,
      internal_only: true,
      ranking_impact: "off",
    };
    const { error } = await db.from("intelligence_account_opportunity_syntheses").insert({
      id, tenant_user_id: null, client_id: pilotId, account_id: original.account_id, context_id: null,
      thesis_json: reviewedThesis, review_state: operation.decision, internal_only: true,
      ranking_impact: "off", report_impact: "off", methodology_version: PILOT_WORKSPACE_VERSION,
      generated_at: now, supersedes_id: null, idempotency_key: `${pilotId}:review:${id}`,
    });
    if (error && error.code !== "23505") return NextResponse.json({ error: "thesis_review_failed", message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, thesis_review_id: id, history_preserved: true, customer_safe: false });
  }

  const allRequiredGates = ["client_context", "identity", "evidence", "claim_separation", "client_fit", "feasibility", "timing_honesty", "counterevidence", "limitations", "review", "freshness"];
  const supplied = new Map(operation.gates.map(gate => [gate.gate, gate.state]));
  const allPassed = allRequiredGates.every(gate => supplied.get(gate) === "pass" || supplied.get(gate) === "not_applicable");
  const state = allPassed ? "safe_with_strong_limitations" : "review_required";
  const id = stableId("safety_review", { pilotId, ...operation });
  const { error } = await db.from("intelligence_customer_safety_reviews").insert({
    id, tenant_user_id: null, client_id: pilotId, account_id: original.account_id,
    thesis_id: original.thesis_id, context_version_id: null,
    assessment_json: { gates: operation.gates, actor: "active_admin_session", automatic_customer_safe: false },
    state, reviewer_id: null, reviewed_at: now, internal_only: true, ranking_impact: "off",
    methodology_version: PILOT_WORKSPACE_VERSION, idempotency_key: `${pilotId}:safety:${id}`,
  });
  if (error && error.code !== "23505") return NextResponse.json({ error: "safety_review_failed", message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, safety_review_id: id, state, customer_safe: false, human_review_recorded: true });
}
