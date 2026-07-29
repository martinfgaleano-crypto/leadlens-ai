import type {
  AttributedCommercialOutcome,
  CommercialAction,
  HumanReview,
  LearningImplication,
  OutputValidationLifecycle,
} from "./validation-lifecycle";

export interface ValidationActorContext {
  tenant_user_id: string;
  actor_id: string;
  actor_role: string;
  client_id: string | null;
}

export interface ValidationPersistence {
  insert(table: string, row: Record<string, unknown>): Promise<{ id: string; already_exists?: boolean }>;
}

function requireContext(context: ValidationActorContext): void {
  if (!context.tenant_user_id || !context.actor_id || !context.actor_role) throw new Error("server_actor_context_required");
}

export function createValidationRepository(store: ValidationPersistence, context: ValidationActorContext) {
  requireContext(context);
  const common = (outputId: string, idempotencyKey: string) => ({
    tenant_user_id: context.tenant_user_id,
    client_id: context.client_id,
    actor_id: context.actor_id,
    actor_role: context.actor_role,
    output_id: outputId,
    idempotency_key: idempotencyKey,
  });
  return {
    saveLifecycle(lifecycle: OutputValidationLifecycle, idempotencyKey: string) {
      return store.insert("intelligence_validations", {
        ...common(lifecycle.output_id, idempotencyKey),
        validation_state: lifecycle.state,
        output_snapshot: lifecycle.original_output,
        report_eligibility: lifecycle.report_eligibility,
        lifecycle_snapshot: lifecycle,
        methodology_version: lifecycle.original_output.methodology_version,
      });
    },
    saveReview(review: HumanReview, validationId: string, idempotencyKey: string) {
      return store.insert("intelligence_validation_reviews", {
        ...common(review.output_id, idempotencyKey), validation_id: validationId,
        reviewer_id: context.actor_id, review: review,
      });
    },
    saveAction(action: CommercialAction, validationId: string, idempotencyKey: string) {
      return store.insert("intelligence_commercial_actions", {
        ...common(action.output_id, idempotencyKey), validation_id: validationId,
        action_id: action.id, action_kind: action.kind, action_snapshot: action,
      });
    },
    saveOutcome(outcome: AttributedCommercialOutcome, validationId: string, idempotencyKey: string) {
      return store.insert("intelligence_commercial_outcomes", {
        ...common(outcome.output_id, idempotencyKey), validation_id: validationId,
        outcome_id: outcome.id, action_id: outcome.action_id, outcome_kind: outcome.kind,
        attribution_confidence: outcome.attribution_confidence,
        attribution_limitations: outcome.attribution_limitations, outcome_snapshot: outcome,
      });
    },
    saveLearningImplication(implication: LearningImplication, validationId: string, idempotencyKey: string) {
      return store.insert("intelligence_learning_implications", {
        ...common(implication.output_id, idempotencyKey), validation_id: validationId,
        implication_id: implication.id, outcome_id: implication.outcome_id,
        implication_type: implication.type, mode: implication.mode,
        human_approved: implication.human_approved, ranking_impact: "off",
        implication_snapshot: implication,
      });
    },
  };
}

/** Production adapter. The service-role client is created only on the server. */
export async function createSupabaseValidationPersistence(): Promise<ValidationPersistence | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) return null;
  return {
    async insert(table, row) {
      const { data, error } = await db.from(table).insert(row).select("id").single();
      if (error && (error as { code?: string }).code === "23505") return { id: "", already_exists: true };
      if (error) throw new Error(`validation_persistence_failed:${error.message}`);
      return { id: String((data as { id: string }).id) };
    },
  };
}
