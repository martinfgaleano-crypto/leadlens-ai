import { NextRequest, NextResponse } from "next/server";
import { deliverableForViewer } from "@/lib/delivery-system/server/deliverable-for-viewer";
import { toPresentationModel, renderCsv, deliveryFilename, tierOffersChannel } from "@/lib/delivery-system";

// ── GET /api/results/[jobId]/export/csv ──────────────────────────────────────
// Authenticated, owner-only operational CSV of a completed report's portfolio, produced through the
// canonical Delivery System (DeliveryDocumentV1 → TierComposer → ExportPolicy(csv) → renderCsv). The
// tier is server-resolved (never client-chosen); CSV is offered only for tiers whose channel policy
// permits it (Intelligence / Premium). No Intelligence research, no credit consumption, no raw JSON.
export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const v = await deliverableForViewer(params.jobId, token);
  if (!v.ok) return new NextResponse(null, { status: v.status }); // 401 / 403 / 404 — never confirms existence

  if (!tierOffersChannel(v.tier, "csv")) {
    return NextResponse.json({ error: "Data export isn’t available for this report tier." }, { status: 403 });
  }

  const pm = toPresentationModel(v.document, v.tier, "csv");
  const csv = renderCsv(pm);
  const filename = deliveryFilename(pm, "csv");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
