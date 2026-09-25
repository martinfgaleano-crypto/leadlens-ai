import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { REPORT_TEMPLATE_V2 } from "@/lib/delivery-system/report-template";
import { buildTierContractSummary } from "@/lib/products/tier-contract-matrix";

export const dynamic = "force-dynamic";

/** GET /api/admin/deliverables/template — the canonical report-template descriptor + the verified
 *  tier-contract summary (what each tier contracts vs what the deliverable currently renders).
 *  Admin-only, read-only. No customer data, no credit, no research. */
export function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  return NextResponse.json({ template: REPORT_TEMPLATE_V2, tierContract: buildTierContractSummary() });
}
