import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createLeadHunterRun, listLeadHunterRuns } from "@/lib/storage/lead-hunter-store";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  return NextResponse.json({ items: await listLeadHunterRuns() });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body?.brief_id || typeof body.brief_id !== "string") {
    return NextResponse.json({ error: "brief_id is required" }, { status: 400 });
  }
  // v0: manual_sources only — automated modes require a reviewed provider.
  const created = await createLeadHunterRun({ brief_id: body.brief_id, provider_mode: "manual_sources" });
  if (!created) return NextResponse.json({ error: "Could not create run — is Supabase configured and migration 030 applied?" }, { status: 503 });
  return NextResponse.json({ item: created }, { status: 201 });
}
