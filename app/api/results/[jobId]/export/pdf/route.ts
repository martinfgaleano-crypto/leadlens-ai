import { NextRequest, NextResponse } from "next/server";
import { deliverableForViewer } from "@/lib/delivery-system/server/deliverable-for-viewer";
import { toPresentationModel, renderPdfBuffer, deliveryFilename, tierOffersChannel } from "@/lib/delivery-system";

// Node runtime — jsPDF needs Node APIs (Buffer/ArrayBuffer), not the Edge runtime.
export const runtime = "nodejs";

// ── GET /api/results/[jobId]/export/pdf ──────────────────────────────────────
// Authenticated, owner-only REAL PDF (application/pdf, selectable text) of a completed report,
// produced through the canonical Delivery System (DeliveryDocumentV1 → TierComposer → ExportPolicy(pdf)
// → renderPdfBuffer/jsPDF). Tier is server-resolved (never client-chosen). PDF is offered for every
// tier. No Intelligence research, no credit consumption, no raw JSON.
export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const v = await deliverableForViewer(params.jobId, token);
  if (!v.ok) return new NextResponse(null, { status: v.status }); // 401 / 403 / 404 — never confirms existence

  if (!tierOffersChannel(v.tier, "pdf")) {
    return NextResponse.json({ error: "PDF export isn’t available for this report." }, { status: 403 });
  }

  const pm = toPresentationModel(v.document, v.tier, "pdf");
  const bytes = new Uint8Array(renderPdfBuffer(pm));
  const filename = deliveryFilename(pm, "pdf");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
