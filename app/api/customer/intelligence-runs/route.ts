import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SupabaseConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";
import { SupabaseLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { SupabaseIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { startIntelligenceRun } from "@/lib/intelligence/productive-spine";

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
const PLAN_RESEARCH = { sample: 8, starter: 18, standard: 30, pro: 40 } as const;

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
  const requested = parsed.data.delivery_limit ?? PLAN_DELIVERY[parsed.data.plan];
  const deliveryLimit = Math.min(requested, PLAN_DELIVERY[parsed.data.plan]);
  const result = await startIntelligenceRun({
    userId: user.id,
    context: { contextId: parsed.data.context_id, version: parsed.data.version },
    clientId: parsed.data.client_id,
    idempotencyKey: parsed.data.idempotency_key,
    plan: parsed.data.plan,
    deliveryLimit,
    researchLimit: PLAN_RESEARCH[parsed.data.plan],
  }, {
    contextStore: new SupabaseConfirmedContextStore(db as never),
    leadHunterStore: new SupabaseLeadHunterRunStore(db as never),
    runStore: new SupabaseIntelligenceRunStore(db),
    discoveryRunner: (await import("@/lib/lead-hunter/discovery-runner")).defaultDiscoveryRunner,
    pipeline: (await import("@/lib/pipeline")).runLeadLensPipeline,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason, run_id: result.runId ?? null }, { status: 422 });
  if (result.run.status === "completed" && result.run.report) {
    const { initializeProductiveAccountMemory } = await import("@/lib/intelligence/initialize-account-memory");
    await initializeProductiveAccountMemory(db, {
      report: result.run.report,
      runId: result.run.runId,
      userId: user.id,
      contextRef: result.run.contextRef,
    }).catch((memoryError) => console.error("[productive-memory]", memoryError instanceof Error ? memoryError.message : "unavailable"));
  }
  return NextResponse.json({
    run_id: result.run.runId, status: result.run.status, stage: result.run.stage,
    context: result.run.contextRef, lead_hunter_run_id: result.run.leadHunterRunId,
    report_url: `/results/${result.run.runId}`, client_key: result.run.runId,
    reused: result.reused,
  }, { status: result.reused ? 200 : 201 });
}
