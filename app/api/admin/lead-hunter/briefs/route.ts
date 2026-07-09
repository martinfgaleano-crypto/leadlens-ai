import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createLeadHunterBrief, listLeadHunterBriefs } from "@/lib/storage/lead-hunter-store";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  return NextResponse.json({ items: await listLeadHunterBriefs() });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const created = await createLeadHunterBrief(body);
  if (!created) return NextResponse.json({ error: "Could not create brief — is Supabase configured and migration 030 applied?" }, { status: 503 });
  return NextResponse.json({ item: created }, { status: 201 });
}
