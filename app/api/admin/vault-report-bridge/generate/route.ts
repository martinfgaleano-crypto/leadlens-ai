import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { internalProcessorConfigured, queueVaultGeneration, type QueueVaultGenerationInput } from "@/lib/vault/vault-generation";

// POST /api/admin/vault-report-bridge/generate — async since ops v0.
// Queues the generation: select → reserve → durable processing snapshot →
// fire-and-forget internal processor → 202 with the report URL. The report
// URL shows "processing" until the processor completes; failed/stuck runs are
// visible and retryable from the admin runs view. Usage is recorded by the
// processor only after successful persistence; preview/dry-run never touch
// reservations or usage.

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as QueueVaultGenerationInput | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON criteria body required" }, { status: 400 });
  }

  const result = await queueVaultGeneration(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ...(result.details ?? {}) }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    status: "processing",
    job_id: result.job_id,
    report_url: result.report_url,
    selected_count: result.selected_count,
    reservation_count: result.reservation_count,
    selection_summary: result.selection_summary,
    anthropic_key_present: !!process.env.ANTHROPIC_API_KEY,
    internal_processor_configured: internalProcessorConfigured(),
    workspace_visible: !!body.search_id,
    delivery_note: body.search_id
      ? "Linked to the customer's monitor — the report will appear in their workspace and monitor history automatically."
      : "No search_id provided — the report is link-only. The customer opens it via the copied /results link; it will not appear in their workspace lists.",
    note: "Report is processing. Open the report URL to watch status; failed or stuck runs are retryable from the runs view.",
  }, { status: 202 });
}
