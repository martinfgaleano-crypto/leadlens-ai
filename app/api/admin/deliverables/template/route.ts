import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { REPORT_TEMPLATE_V2 } from "@/lib/delivery-system/report-template";

export const dynamic = "force-dynamic";

/** GET /api/admin/deliverables/template — the canonical report-template version descriptor.
 *  Admin-only, read-only. No customer data, no credit, no research. */
export function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  return NextResponse.json({ template: REPORT_TEMPLATE_V2 });
}
