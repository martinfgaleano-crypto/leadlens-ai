import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { savePilotContext, loadLatestPilotContext } from "@/lib/pilot/pilot-store";
import type { CustomerContextIntake } from "@/lib/pilot/customer-context";

// Admin-gated Pilot 2 Customer Context persistence. Save (POST) a draft/confirmed context; load (GET) the
// latest. Degrades cleanly to not_configured until migration 065 is applied.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req); if (deny) return deny;
  const body = await req.json().catch(() => null) as { pilotId?: string; context?: CustomerContextIntake; confirmed?: boolean } | null;
  if (!body?.pilotId || !body.context?.company?.name) return NextResponse.json({ error: "pilotId and context.company.name required" }, { status: 400 });
  const r = await savePilotContext({ pilotId: body.pilotId, context: body.context, confirmed: Boolean(body.confirmed) });
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason, detail: r.detail }, { status: r.reason === "not_configured" ? 503 : 500 });
  return NextResponse.json({ ok: true, id: r.id });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req); if (deny) return deny;
  const pilotId = new URL(req.url).searchParams.get("pilotId") ?? "amor-de-gea";
  const ctx = await loadLatestPilotContext(pilotId);
  return NextResponse.json({ ok: true, context: ctx });
}
