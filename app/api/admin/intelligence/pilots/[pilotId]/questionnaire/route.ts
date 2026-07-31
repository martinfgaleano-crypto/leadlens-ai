import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { buildPilotWorkspace, canonicalPilotId } from "@/lib/intelligence/pilot-workspace";
import { buildPilotQuestionnaireCsv, questionnaireFilename } from "@/lib/intelligence/pilot-questionnaire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/intelligence/pilots/[pilotId]/questionnaire
// Admin-only, provider-free. Exports the pilot's client-context questions as a
// client-fillable CSV to send to the client. Reusable across pilots (driven by
// the pilot's own questions). Never emits answers. Forged pilotId → 404.
export async function GET(req: NextRequest, { params }: { params: { pilotId: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const pilotId = canonicalPilotId(params.pilotId);
  if (!pilotId) return NextResponse.json({ error: "Piloto no encontrado." }, { status: 404 });

  const generatedAt = new Date();
  try {
    const workspace = buildPilotWorkspace();
    const clientName = workspace.pilot?.client_name ?? pilotId;
    const csv = buildPilotQuestionnaireCsv({ clientName, questions: workspace.questions ?? [] });
    const date = generatedAt.toISOString().slice(0, 10);
    console.info(JSON.stringify({ event: "pilot_questionnaire_exported", status: "success", pilot_id: pilotId, actor: "active_admin_session", questions: (workspace.questions ?? []).length, generated_at: generatedAt.toISOString(), methodology_version: "pilot-questionnaire-v1" }));
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${questionnaireFilename(clientName, date)}"`,
        "Cache-Control": "private, no-store",
        "X-LeadLens-Report-Status": "internal-not-customer-safe",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "pilot_questionnaire_exported", status: "failure", pilot_id: pilotId, generated_at: generatedAt.toISOString(), error: error instanceof Error ? error.message : "unknown_error" }));
    return NextResponse.json({ error: "No fue posible generar el cuestionario." }, { status: 500 });
  }
}
