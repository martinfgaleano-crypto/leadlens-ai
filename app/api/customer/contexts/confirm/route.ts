import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyConfirmationToken } from "@/lib/interpretation/confirmation-token";
import { persistConfirmedContext, SupabaseConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";

const schema = z.object({
  confirmation_token: z.string().min(32).max(200_000),
  context_id: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  client_id: z.string().min(1).max(120).optional(),
}).strict();

/** Explicit user action. The signed token carries the server-produced Stage-A
 * draft; the browser supplies no Evidence, Signal, Fit, Timing, Decision or
 * candidate account. Confirmation authorizes context execution only. */
export async function POST(req: NextRequest) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!checkRateLimit(`confirm-context:${user.id}`, 8, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirmation request." }, { status: 400 });
  const interpretation = verifyConfirmationToken(parsed.data.confirmation_token, user.id);
  if (!interpretation) return NextResponse.json({ error: "Invalid or expired confirmation." }, { status: 422 });
  if (interpretation.illustrative) return NextResponse.json({ error: "Illustrative context cannot be confirmed." }, { status: 422 });
  const explicitlyConfirmed = {
    ...interpretation,
    interpretationStatus: "confirmed" as const,
    confirmation: { confirmedAt: new Date().toISOString(), confirmedBy: "user" as const, confirmedFields: ["commercial_context"] },
  };
  const result = await persistConfirmedContext(
    new SupabaseConfirmedContextStore(db as never),
    explicitlyConfirmed,
    { userId: user.id, contextId: parsed.data.context_id, clientId: parsed.data.client_id },
  );
  if (!result.ok) return NextResponse.json({ error: result.reason, missing: result.missing }, { status: 422 });
  return NextResponse.json({
    context: { context_id: result.record.contextId, version: result.record.version, client_id: result.record.clientId ?? null },
    created: result.created,
    provenance: "user_confirmed_context_not_external_evidence",
  }, { status: result.created ? 201 : 200 });
}
