import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listDeliverables } from "@/lib/deliverable/portable/deliverable-store";

export const dynamic = "force-dynamic";

/** GET /api/admin/deliverables — internal index of generated portable artifacts. */
export function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json({ deliverables: listDeliverables() });
  } catch (e) {
    return NextResponse.json({ error: "Failed to list deliverables", detail: String(e) }, { status: 500 });
  }
}
