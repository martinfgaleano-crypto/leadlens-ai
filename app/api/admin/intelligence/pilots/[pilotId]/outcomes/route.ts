import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canonicalPilotId } from "@/lib/intelligence/pilot-workspace";
import { validateOutcome, type OutcomeInput } from "@/lib/intelligence/recurring/engine";
import { RECURRING_CYCLE_MODEL_VERSION } from "@/lib/intelligence/recurring/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual outcome capture for the Recurring Opportunity Cycle. No provider calls,
// no fabrication: the reviewer records what actually happened. Append-only; the
// deterministic engine validates the taxonomy before persistence. Fails closed
// (503) when the durable store (migration 048) is not yet applied.
export async function POST(req: NextRequest, { params }: { params: { pilotId: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const pilotId = canonicalPilotId(params.pilotId);
  if (!pilotId) return NextResponse.json({ error: "pilot_not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as OutcomeInput | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const result = validateOutcome({ ...body, client_id: pilotId, actor: "active_admin_session" });
  if (!result.ok) return NextResponse.json({ error: "invalid_outcome", details: result.errors }, { status: 400 });

  const outcome = result.outcome;
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) {
    return NextResponse.json(
      { error: "database_unavailable", message: "Outcome validated but not persisted; apply migration 048 to enable durable capture.", validated: true, outcome_id: outcome.outcome_id },
      { status: 503 },
    );
  }
  const idempotency_key = `${pilotId}:${outcome.outcome_id}`;
  const row = {
    id: outcome.outcome_id, tenant_user_id: null, client_id: pilotId, cycle_id: outcome.cycle_id,
    account_id: outcome.account_id, kind: "outcome", event_type: outcome.primary_status,
    status_group: outcome.status_group, reason_code: outcome.reason_code, actor: outcome.actor,
    source: "active_admin_session", previous_state: null, new_state: outcome.primary_status,
    reason: outcome.reason_code, payload: outcome, occurred_at: outcome.outcome_date, idempotency_key,
  };
  const { error } = await db
    .from("intelligence_account_events")
    .upsert(row, { onConflict: "tenant_user_id,client_id,idempotency_key", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "outcome_persistence_failed", message: error.message }, { status: 500 });

  return NextResponse.json(
    { ok: true, outcome_id: outcome.outcome_id, status: outcome.primary_status, methodology_version: RECURRING_CYCLE_MODEL_VERSION },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}

// List captured outcomes for the pilot. Returns an empty "awaiting real outcomes"
// set when the durable store is not present — never a misleading zero-performance metric.
export async function GET(req: NextRequest, { params }: { params: { pilotId: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const pilotId = canonicalPilotId(params.pilotId);
  if (!pilotId) return NextResponse.json({ error: "pilot_not_found" }, { status: 404 });
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) return NextResponse.json({ pilot_id: pilotId, status: "awaiting_real_outcomes", outcomes: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const { data, error } = await db
    .from("intelligence_account_events")
    .select("payload")
    .eq("client_id", pilotId)
    .eq("kind", "outcome")
    .order("occurred_at", { ascending: false });
  if (error) return NextResponse.json({ error: "outcome_read_failed", message: error.message }, { status: 500 });
  const outcomes = (data ?? []).map((r) => r.payload);
  return NextResponse.json(
    { pilot_id: pilotId, status: outcomes.length ? "measured" : "awaiting_real_outcomes", outcomes },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
