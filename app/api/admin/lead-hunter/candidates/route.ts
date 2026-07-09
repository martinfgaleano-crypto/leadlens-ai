import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listLeadHunterCandidates } from "@/lib/storage/lead-hunter-store";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { searchParams } = new URL(req.url);
  const items = await listLeadHunterCandidates({
    run_id: searchParams.get("run_id") ?? undefined,
    review_status: searchParams.get("review_status") ?? undefined,
    safety_status: searchParams.get("safety_status") ?? undefined,
    source_category: searchParams.get("source_category") ?? undefined,
    signal_type: searchParams.get("signal_type") ?? undefined,
  });
  return NextResponse.json({ items });
}
