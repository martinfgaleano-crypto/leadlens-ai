import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { generateCandidatesForRun } from "@/lib/lead-hunter/lead-hunter-engine";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const result = await generateCandidatesForRun(params.id);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
  return NextResponse.json({ success: true, summary: result.summary });
}
