import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SupabaseConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";
import { runDiscoveryFromConfirmedContext } from "@/lib/interpretation/confirmed-context-execution";

// Self-serve discovery execution from a durable, user-CONFIRMED commercial
// context. The browser names only {context_id, version}; the SERVER resolves and
// authorizes the canonical confirmed context, adapts it to LeadSearchCriteria,
// and runs the existing discovery pipeline with structured overrides (no prose
// ICP inference). Fails safe: missing / unauthorized / unexecutable / store
// unavailable never fall back to raw prose.
export const maxDuration = 300;

const bodySchema = z.object({
  context_id: z.string().min(1).max(200),
  version: z.number().int().positive().optional(),
  plan: z.enum(["sample", "starter", "standard", "pro"]).optional(),
});

export async function POST(req: NextRequest) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });

  // Authenticate the customer from the bearer token (same pattern as onboarding).
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!checkRateLimit(`customer-discovery:${user.id}`, 6, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const store = new SupabaseConfirmedContextStore(db as never);
  const jobId = `job_${Date.now()}`;

  // Lazy import so the heavy pipeline graph is not pulled into module scope.
  const { runLeadLensPipeline } = await import("@/lib/pipeline");

  const result = await runDiscoveryFromConfirmedContext(
    store,
    user.id, // server-resolved owner — never a client-provided id
    { contextId: parsed.data.context_id, version: parsed.data.version },
    { plan: parsed.data.plan ?? "standard", contactEmail: user.email ?? undefined },
    runLeadLensPipeline,
    jobId,
  );

  if (!result.ok) {
    const status =
      result.reason === "context_not_found" ? 404 :
      result.reason === "not_executable" ? 422 :
      result.reason === "store_unavailable" ? 503 : 400;
    // No context/prose is echoed back; the reason is a stable machine code.
    console.log(`[analytics] ${JSON.stringify({ event: "discovery_from_context_blocked", reason: result.reason })}`);
    return NextResponse.json({ error: result.reason }, { status });
  }

  console.log(`[analytics] ${JSON.stringify({ event: "discovery_from_context_started", jobId, context: result.contextRef })}`);
  return NextResponse.json({ jobId, context: result.contextRef, report: result.report }, { status: 201 });
}
