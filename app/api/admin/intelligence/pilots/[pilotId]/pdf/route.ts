import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { buildPilotWorkspace, canonicalPilotId } from "@/lib/intelligence/pilot-workspace";
import { buildInternalPilotPdf } from "@/lib/reports/internal-pilot-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { pilotId: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (canonicalPilotId(params.pilotId) !== "amor-de-gea") return NextResponse.json({ error: "Piloto no encontrado." }, { status: 404 });
  const generatedAt = new Date();
  const body = buildInternalPilotPdf(buildPilotWorkspace(), generatedAt);
  const date = generatedAt.toISOString().slice(0, 10);
  console.info(JSON.stringify({ event: "internal_pilot_pdf_exported", pilot_id: "amor-de-gea", actor: "active_admin_session", generated_at: generatedAt.toISOString(), methodology_version: "amor-recommendation-contract-v1" }));
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="leadlens-amor-de-gea-pilot-internal-${date}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-LeadLens-Report-Status": "internal-not-customer-safe",
    },
  });
}
