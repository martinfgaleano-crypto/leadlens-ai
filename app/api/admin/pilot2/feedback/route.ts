import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { savePilotFeedback, loadPilotFeedback, type PilotFeedbackInput } from "@/lib/pilot/pilot-store";

// Admin-gated Pilot 2 feedback persistence. Save (POST) a feedback record; load (GET) all for a pilot.
// Customer feedback is NEW EVIDENCE requiring review — it never auto-overrides Intelligence (§16).
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req); if (deny) return deny;
  const body = await req.json().catch(() => null) as (PilotFeedbackInput & { pilotId?: string }) | null;
  if (!body?.pilotId) return NextResponse.json({ error: "pilotId required" }, { status: 400 });
  const r = await savePilotFeedback(body);
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason, detail: r.detail }, { status: r.reason === "not_configured" ? 503 : 500 });
  return NextResponse.json({ ok: true, id: r.id });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req); if (deny) return deny;
  const pilotId = new URL(req.url).searchParams.get("pilotId") ?? "amor-de-gea";
  const feedback = await loadPilotFeedback(pilotId);
  return NextResponse.json({ ok: true, feedback });
}
