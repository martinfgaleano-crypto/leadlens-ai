import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getLeadHunterRunById,
  getLeadHunterBriefById,
  listLeadHunterSourceInputs,
  listLeadHunterCandidates,
} from "@/lib/storage/lead-hunter-store";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const run = await getLeadHunterRunById(params.id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const [brief, sources, candidates] = await Promise.all([
    run.brief_id ? getLeadHunterBriefById(run.brief_id) : Promise.resolve(null),
    listLeadHunterSourceInputs(params.id),
    listLeadHunterCandidates({ run_id: params.id }),
  ]);
  return NextResponse.json({ run, brief, sources, candidates });
}
