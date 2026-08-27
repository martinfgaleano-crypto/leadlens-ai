import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { executeCanonicalMonitor } from "@/lib/monitor/canonical-monitor-service";

// Authenticated MANUAL trigger for a bounded recurring intelligence review.
// Recurring re-evaluation of KNOWN accounts — NOT real-time monitoring. The
// browser sends only references (client_key); the SERVER resolves the owner's
// accepted snapshots and runs trusted Monitor logic. The browser can never inject
// Evidence, a Decision, a review result, or a snapshot.
export const maxDuration = 300;

const bodySchema = z.object({ client_key: z.string().min(1).max(200) }).strict();

export async function POST(req: NextRequest) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!checkRateLimit(`monitor:${user.id}`, 3, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const scope = { ownerUserId: user.id, clientKey: parsed.data.client_key };
  const result = await executeCanonicalMonitor(db, { scope, cycleKey: new Date().toISOString().slice(0, 10), origin: "customer" });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 404 });
  const run = result.run;

  console.log(`[analytics] ${JSON.stringify({ event: "monitor_run", runId: run.runId, ...run.observability })}`);
  // Return only curated observability + alert contracts — never raw snapshots.
  return NextResponse.json({ runId: run.runId, status: run.status, observability: run.observability, alerts: run.alerts }, { status: 201 });
}
