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
  try {
    const body = buildInternalPilotPdf(buildPilotWorkspace(), generatedAt);
    const date = generatedAt.toISOString().slice(0, 10);
    console.info(JSON.stringify({ event: "internal_pilot_pdf_exported", status: "success", pilot_id: "amor-de-gea", actor: "active_admin_session", bytes: body.length, generated_at: generatedAt.toISOString(), methodology_version: "leadlens-internal-brief-v2" }));
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="leadlens-amor-de-gea-informe-interno-${date}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-LeadLens-Report-Status": "internal-not-customer-safe",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "internal_pilot_pdf_exported", status: "failure", pilot_id: "amor-de-gea", generated_at: generatedAt.toISOString(), error: error instanceof Error ? error.message : "unknown_error" }));
    return NextResponse.json({ error: "No fue posible generar el informe interno." }, { status: 500 });
  }
}
