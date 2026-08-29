import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { SupabaseConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";
import { SupabaseLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { SupabaseIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { executeIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { SupabaseRunTraceSink } from "@/lib/intelligence/run-trace-sink";

export const maxDuration = 300;
const bodySchema = z.object({ user_id: z.string().uuid() }).strict();

function authorized(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_RUN_SECRET;
  const actual = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function POST(req: NextRequest, { params }: { params: { runId: string } }) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^intel_[a-f0-9]{32}$/.test(params.runId)) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });
  // This is real runtime execution against real providers → LIVE provenance. It is
  // fixed server-side and can never be set by the request body/params (§6). Trace
  // persistence is failure-isolated: a sink error is swallowed and never fails the
  // customer Intelligence run (§5).
  const traceSink = new SupabaseRunTraceSink(db);
  const result = await executeIntelligenceRun(params.runId, parsed.data.user_id, {
    contextStore: new SupabaseConfirmedContextStore(db as never),
    leadHunterStore: new SupabaseLeadHunterRunStore(db as never),
    runStore: new SupabaseIntelligenceRunStore(db),
    discoveryRunner: (await import("@/lib/lead-hunter/discovery-runner")).defaultDiscoveryRunner,
    pipeline: (await import("@/lib/pipeline")).runLeadLensPipeline,
    traceProvenance: "live",
    onAccountTrace: (trace) => { void traceSink.persist(trace).catch(() => { /* telemetry never fails a run */ }); },
  });
  if (!result.ok) return NextResponse.json({ run_id: params.runId, status: "failed", error: result.reason }, { status: 422 });
  if (result.run.status === "completed" && result.run.report) {
    const { initializeProductiveAccountMemory } = await import("@/lib/intelligence/initialize-account-memory");
    await initializeProductiveAccountMemory(db, { report: result.run.report, runId: result.run.runId, userId: parsed.data.user_id, contextRef: result.run.contextRef })
      .catch((error) => console.error("[productive-memory]", error instanceof Error ? error.message : "unavailable"));
  }
  return NextResponse.json({ run_id: result.run.runId, status: result.run.status, stage: result.run.stage });
}
