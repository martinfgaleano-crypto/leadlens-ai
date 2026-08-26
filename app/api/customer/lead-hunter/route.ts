import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SupabaseConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";
import { SupabaseLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { runAndPersistLeadHunter } from "@/lib/lead-hunter/hunt-and-persist";

// Authenticated Lead Hunter run from a durable, user-CONFIRMED commercial context.
// The browser names only {context_id, version}; the SERVER resolves and authorizes
// the context, runs Lead Hunter, and persists an immutable candidate universe.
// Browser can never inject a candidate list. Fails safe on missing/unauthorized
// context and on discovery failure (never fabricates a completed universe).
export const maxDuration = 300;

const bodySchema = z.object({
  context_id: z.string().min(1).max(200),
  version: z.number().int().positive().optional(),
}).strict();

export async function POST(req: NextRequest) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!checkRateLimit(`lead-hunter:${user.id}`, 4, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const contextStore = new SupabaseConfirmedContextStore(db as never);
  const runStore = new SupabaseLeadHunterRunStore(db as never);
  const { defaultDiscoveryRunner } = await import("@/lib/lead-hunter/discovery-runner");

  const result = await runAndPersistLeadHunter(
    contextStore, runStore, user.id,
    { contextId: parsed.data.context_id, version: parsed.data.version },
    defaultDiscoveryRunner,
  );

  if (!result.ok) {
    const status = result.reason === "context_not_found" ? 404 : result.reason === "store_unavailable" ? 503 : 400;
    console.log(`[analytics] ${JSON.stringify({ event: "lead_hunter_blocked", reason: result.reason })}`);
    return NextResponse.json({ error: result.reason }, { status });
  }

  const u = result.universe;
  console.log(`[analytics] ${JSON.stringify({ event: "lead_hunter_run", runId: result.runId, ok: u.ok, reused: result.reused, ...u.coverage, gaps: u.coverage.gaps.map((g) => g.type) })}`);

  // Return the run summary + the owner's own universe. No provider internals.
  return NextResponse.json({
    runId: result.runId,
    contextRef: u.contextRef,
    ok: u.ok,
    reused: result.reused,
    coverage: u.coverage,
    reviewRequired: u.reviewRequired,
    candidates: u.candidates,
  }, { status: result.created ? 201 : 200 });
}
