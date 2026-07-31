import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canonicalPilotId } from "@/lib/intelligence/pilot-workspace";
import { buildClientQuestionnaireXlsx } from "@/lib/reports/client-questionnaire-xlsx";
import { AMOR_QUESTIONNAIRE_BRAND } from "@/lib/intelligence/client-questionnaire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/intelligence/pilots/[pilotId]/questionnaire/xlsx
// Admin-only, provider-free. Editable client questionnaire workbook. Reusable
// per pilot (brand derived from pilot). Answers blank. Forged pilotId → 404.
export async function GET(req: NextRequest, { params }: { params: { pilotId: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const pilotId = canonicalPilotId(params.pilotId);
  if (!pilotId) return NextResponse.json({ error: "Piloto no encontrado." }, { status: 404 });

  const generatedAt = new Date();
  try {
    const brand = AMOR_QUESTIONNAIRE_BRAND; // per-pilot brand config (only amor exists today)
    const buffer = await buildClientQuestionnaireXlsx({ brand });
    const date = generatedAt.toISOString().slice(0, 10);
    const slug = brand.clientName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    console.info(JSON.stringify({ event: "pilot_questionnaire_exported", format: "xlsx", status: "success", pilot_id: pilotId, actor: "active_admin_session", bytes: buffer.length, generated_at: generatedAt.toISOString(), methodology_version: "client-questionnaire-xlsx-v1" }));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="leadlens-${slug}-cuestionario-${date}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-LeadLens-Report-Status": "internal-not-customer-safe",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "pilot_questionnaire_exported", format: "xlsx", status: "failure", pilot_id: pilotId, error: error instanceof Error ? error.message : "unknown_error" }));
    return NextResponse.json({ error: "No fue posible generar el cuestionario." }, { status: 500 });
  }
}
