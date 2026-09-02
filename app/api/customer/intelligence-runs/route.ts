import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SupabaseConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";
import { SupabaseIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { enqueueIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { dispatchIntelligenceRun } from "@/lib/intelligence/intelligence-run-dispatch";
import { resolveEntitlements, intelligenceRunGate } from "@/lib/entitlements/entitlements-v1";

export const maxDuration = 300;

const schema = z.object({
  context_id: z.string().min(1).max(120),
  version: z.number().int().positive(),
  plan: z.enum(["sample", "starter", "standard", "pro"]).default("starter"),
  client_id: z.string().min(1).max(120).optional(),
  idempotency_key: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  delivery_limit: z.number().int().min(1).max(18).optional(),
}).strict();

const PLAN_DELIVERY = { sample: 2, starter: 6, standard: 12, pro: 18 } as const;
// Research is the expensive phase. Delivery entitlement never authorizes an
// unbounded research breadth; larger plans get coverage, not provider fan-out.
const PLAN_RESEARCH = { sample: 3, starter: 5, standard: 8, pro: 10 } as const;

export async function POST(req: NextRequest) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error } = await db.auth.getUser(auth);
  if (error || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!checkRateLimit(`intelligence-run:${user.id}`, 3, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid run request." }, { status: 400 });
  // Server-authoritative entitlement gate (Entitlements V1). Resolved from durable state, never
  // the client. Beta customers remain allowed; only an explicitly blocked account is denied. A
  // partial run is never created after denial (this precedes enqueue).
  const entitlement = await resolveEntitlements(db, user.id);
  const denial = intelligenceRunGate(entitlement);
  if (denial) return NextResponse.json({ error: denial.message, code: denial.code }, { status: denial.status });
  const requested = parsed.data.delivery_limit ?? PLAN_DELIVERY[parsed.data.plan];
  const deliveryLimit = Math.min(requested, PLAN_DELIVERY[parsed.data.plan]);
  const result = await enqueueIntelligenceRun({
    userId: user.id,
    context: { contextId: parsed.data.context_id, version: parsed.data.version },
    clientId: parsed.data.client_id,
    idempotencyKey: parsed.data.idempotency_key,
    plan: parsed.data.plan,
    deliveryLimit,
    researchLimit: PLAN_RESEARCH[parsed.data.plan],
  }, {
    contextStore: new SupabaseConfirmedContextStore(db as never),
    runStore: new SupabaseIntelligenceRunStore(db),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason, run_id: result.runId ?? null }, { status: 422 });
  // Commercial usage is PER-ACCOUNT and charged at MATERIALIZATION (matrix §5/§6), not per-run at
  // the route: a run can materialize multiple accounts, and dead/duplicate runs must never charge.
  // The gate above (intelligenceRunGate) is the pre-check that blocks starting a run with no
  // remaining allowance; the executor caps production at the remaining allowance and commits one
  // Account Intelligence Credit per durably-materialized account via lib/billing/account-metering.
  // (No per-run customer_credits deduction here — that would wrongly draw down a subscriber's
  // preserved one-time balance and mis-count multi-account runs.)
  if ((result.run.status === "processing" && result.run.stage === "queued") || result.run.status === "failed") {
    dispatchIntelligenceRun(req.nextUrl.origin, result.run.runId, user.id);
  }
  return NextResponse.json({
    run_id: result.run.runId, status: result.run.status, stage: result.run.stage,
    context: result.run.contextRef, lead_hunter_run_id: result.run.leadHunterRunId,
    report_url: `/results/${result.run.runId}`, client_key: result.run.runId,
    reused: result.reused,
  }, { status: result.reused ? 200 : 202 });
}
