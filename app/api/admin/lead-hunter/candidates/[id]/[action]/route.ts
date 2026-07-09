import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  approveLeadHunterCandidate,
  getLeadHunterCandidateById,
  promoteLeadHunterCandidateToVault,
  rejectLeadHunterCandidate,
  reserveLeadHunterCandidate,
} from "@/lib/storage/lead-hunter-store";
import { validateCandidateSafety } from "@/lib/lead-hunter/lead-hunter-policy";

// POST /api/admin/lead-hunter/candidates/[id]/[action]
// action ∈ approve | reject | reserve | promote-to-vault
// (single dynamic route instead of four files — same contract, documented)

const ACTIONS = ["approve", "reject", "reserve", "promote-to-vault"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } },
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { id, action } = params;
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: `Unknown action — use one of: ${ACTIONS.join(", ")}` }, { status: 400 });
  }

  const candidate = await getLeadHunterCandidateById(id);
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const notes = typeof body?.notes === "string" ? body.notes.slice(0, 500) : undefined;

  console.log(`[lead-hunter] candidate_action id=${id} action=${action}`);

  if (action === "reject") {
    const ok = await rejectLeadHunterCandidate(id, notes);
    return ok ? NextResponse.json({ success: true, review_status: "rejected" })
              : NextResponse.json({ error: "Update failed." }, { status: 503 });
  }

  if (action === "reserve") {
    const ok = await reserveLeadHunterCandidate(id, notes);
    return ok ? NextResponse.json({ success: true, review_status: "reserved" })
              : NextResponse.json({ error: "Update failed." }, { status: 503 });
  }

  // approve and promote share the safety gates: blocked never passes;
  // unresolved usage rights never pass.
  const safety = validateCandidateSafety(candidate);
  if (safety.safety_status === "blocked") {
    return NextResponse.json({ error: safety.reason ?? "Candidate is blocked by sourcing policy." }, { status: 422 });
  }
  if (candidate.usage_rights_status === "unverified" || candidate.usage_rights_status === "unknown") {
    return NextResponse.json(
      { error: "Usage rights are unverified — resolve usage_rights_status (permitted/licensed) or reject this candidate." },
      { status: 422 },
    );
  }

  if (action === "approve") {
    const ok = await approveLeadHunterCandidate(id, notes);
    return ok ? NextResponse.json({ success: true, review_status: "approved" })
              : NextResponse.json({ error: "Update failed." }, { status: 503 });
  }

  // promote-to-vault
  const result = await promoteLeadHunterCandidateToVault(id);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
  return NextResponse.json({ success: true, ...result });
}
