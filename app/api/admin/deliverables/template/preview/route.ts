import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { fromDeliverableViewModel } from "@/lib/delivery-system/delivery-document";
import { toPresentationModel } from "@/lib/delivery-system/presentation-model";
import type { DeliveryTier } from "@/lib/delivery-system/tier-composer";
import { isDeliveryTier } from "@/lib/delivery-system/channel-availability";
import { renderPdfBuffer } from "@/lib/delivery-system/renderers/pdf";
import { buildSampleDeliverable, REPORT_TEMPLATE_V2 } from "@/lib/delivery-system/report-template";
import { buildRealAcceptanceDeliverable } from "@/lib/delivery-system/real-acceptance-sample";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/deliverables/template/preview?tier=…&lang=es|en&mode=preview|download&data=synthetic|real
 *
 * Renders a DETERMINISTIC sample PDF of the requested tier, for Admin template review. Admin-only.
 * Consumes NO research, NO customer credit, and touches NO paid-customer data.
 *  - data=synthetic (default): the in-repo differentiated SYNTHETIC design fixture (ES/EN).
 *  - data=real: a MODE-A preview from the committed CONTROLLED-ACCEPTANCE review package (6 real US
 *    companies, real public source events, canonical decisions) — English; not a paid customer report.
 */
export function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const tierParam = url.searchParams.get("tier") ?? "premium";
  if (!isDeliveryTier(tierParam)) {
    return NextResponse.json({ error: `Unknown tier "${tierParam}". Use preview|brief|intelligence|premium.` }, { status: 400 });
  }
  const tier = tierParam as DeliveryTier;
  const lang = url.searchParams.get("lang") === "en" ? "en" : "es";
  const mode = url.searchParams.get("mode") === "download" ? "download" : "preview";
  const dataMode = url.searchParams.get("data") === "real" ? "real" : "synthetic";

  try {
    const vm = dataMode === "real" ? buildRealAcceptanceDeliverable() : buildSampleDeliverable(lang);
    const doc = fromDeliverableViewModel(vm);
    const pm = toPresentationModel(doc, tier, "pdf");
    const buf = renderPdfBuffer(pm);
    const filename = `LeadLens_${tier}_${REPORT_TEMPLATE_V2.version}_${dataMode}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${mode === "download" ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to render sample", detail: String(e) }, { status: 500 });
  }
}
