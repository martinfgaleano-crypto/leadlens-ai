import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { addLeadHunterSourceInput, getLeadHunterRunById } from "@/lib/storage/lead-hunter-store";
import { classifySourceCategory, validateLeadHunterSource } from "@/lib/lead-hunter/lead-hunter-policy";

// Add a manual source input to a run. The policy engine classifies and
// validates it — restricted sources are stored as blocked (visible, never
// processed into promotable candidates). No fetching happens here.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const run = await getLeadHunterRunById(params.id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (run.status === "completed" || run.status === "failed") {
    return NextResponse.json({ error: "Run already finished — create a new run to add sources." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.source_url || typeof body.source_url !== "string") {
    return NextResponse.json({ error: "source_url is required — provenance is mandatory." }, { status: 400 });
  }

  const category = (body.source_category as string) || classifySourceCategory(body.source_url);
  const validation = validateLeadHunterSource({
    source_url: body.source_url,
    source_category: category,
    usage_rights_status: body.usage_rights_status,
  });

  const created = await addLeadHunterSourceInput({
    run_id: params.id,
    source_url: body.source_url.trim(),
    source_title: body.source_title,
    source_category: category,
    pasted_context: body.pasted_context,
    usage_rights_status: body.usage_rights_status ?? "unverified",
    safety_status: validation.safety_status,
  });
  if (!created) return NextResponse.json({ error: "Could not save source input." }, { status: 503 });

  return NextResponse.json({
    item: created,
    safety_status: validation.safety_status,
    warning: validation.reason,
  }, { status: 201 });
}
