// Pilot 2 durable store for Customer Context + feedback (migration 065). Server-only (service role).
// GRACEFUL DEGRADATION: until 065 is applied the tables are absent → reads return null and writes report
// { ok:false, reason:"not_configured" } instead of throwing, so the Admin/intake fall back to the static
// modules and nothing crashes. Mirrors the saas-store no-op-when-unconfigured pattern.
import { createServerClient } from "@/lib/supabase/server";
import { buildBoundedContextSummary, type CustomerContextIntake } from "@/lib/pilot/customer-context";

export interface SavedContext {
  id: string; pilot_id: string; pilot_number: number; schema_version: number;
  context: CustomerContextIntake; bounded_summary: string | null;
  source: string; confirmation_state: string; confirmed_at: string | null;
  created_at: string; updated_at: string;
}
export type SaveResult = { ok: true; id: string } | { ok: false; reason: "not_configured" | "error"; detail?: string };

const isMissingTable = (msg?: string) => !!msg && /relation .* does not exist|could not find the table|schema cache/i.test(msg);

/** Persist a Customer Context (draft or confirmed). Derives the bounded summary deterministically. */
export async function savePilotContext(input: { pilotId: string; pilotNumber?: number; context: CustomerContextIntake; confirmed: boolean }): Promise<SaveResult> {
  const db = createServerClient();
  if (!db) return { ok: false, reason: "not_configured" };
  const summary = buildBoundedContextSummary(input.context);
  const row = {
    pilot_id: input.pilotId, pilot_number: input.pilotNumber ?? 2, schema_version: input.context.version ?? 1,
    context: input.context as unknown as Record<string, unknown>, bounded_summary: summary,
    source: input.context.provenance?.source ?? "guided",
    confirmation_state: input.confirmed ? "confirmed" : "draft",
    confirmed_at: input.confirmed ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("pilot_customer_context").insert(row).select("id").maybeSingle();
  if (error) return { ok: false, reason: isMissingTable(error.message) ? "not_configured" : "error", detail: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

/** Latest Customer Context for a pilot, or null (also null when 065 is not yet applied). */
export async function loadLatestPilotContext(pilotId: string, pilotNumber = 2): Promise<SavedContext | null> {
  const db = createServerClient();
  if (!db) return null;
  const { data, error } = await db.from("pilot_customer_context").select("*")
    .eq("pilot_id", pilotId).eq("pilot_number", pilotNumber).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data as SavedContext;
}

export interface PilotFeedbackInput {
  pilotId: string; pilotNumber?: number;
  overall_rating?: number; per_tier?: unknown; route_feedback?: unknown; account_feedback?: unknown;
  buyer_feedback?: string; timing_feedback?: string; dependency_usefulness?: number;
  missing_information?: string; willingness_to_pay?: string; free_text?: string;
  learning_class?: string; status?: string;
}

/** Persist Pilot feedback (draft/received/reviewed/incorporated). */
export async function savePilotFeedback(input: PilotFeedbackInput): Promise<SaveResult> {
  const db = createServerClient();
  if (!db) return { ok: false, reason: "not_configured" };
  const { pilotId, pilotNumber, ...rest } = input;
  const { data, error } = await db.from("pilot_feedback")
    .insert({ pilot_id: pilotId, pilot_number: pilotNumber ?? 2, ...rest, updated_at: new Date().toISOString() })
    .select("id").maybeSingle();
  if (error) return { ok: false, reason: isMissingTable(error.message) ? "not_configured" : "error", detail: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

/** All feedback for a pilot, newest first (empty when 065 not applied). */
export async function loadPilotFeedback(pilotId: string, pilotNumber = 2): Promise<Array<Record<string, unknown>>> {
  const db = createServerClient();
  if (!db) return [];
  const { data, error } = await db.from("pilot_feedback").select("*")
    .eq("pilot_id", pilotId).eq("pilot_number", pilotNumber).order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as Array<Record<string, unknown>>;
}
