import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { selectVaultOpportunities } from "@/lib/vault/vault-opportunity-selector";
import { convertVaultOpportunitiesToLeadCandidates } from "@/lib/vault/vault-to-lead-candidate";
import type { VaultOpportunitySelectionCriteria } from "@/lib/vault/vault-opportunity-types";

// Dry-run: selection + adapter → report-compatible LeadCandidate[] payload.
// Creates NO customer report, records NO usage, makes NO reservations —
// output is for admin inspection of exactly what the pipeline would receive.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as VaultOpportunitySelectionCriteria | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON criteria body required" }, { status: 400 });
  }
  const selection = await selectVaultOpportunities({ ...body });
  selection.mode = "dry_run";
  const adapted = convertVaultOpportunitiesToLeadCandidates(selection.selected, {
    customer_email: body.customer_email ?? null,
    monitor_id: body.monitor_id ?? null,
    order_id: body.order_id ?? null,
  });
  return NextResponse.json({
    result: selection,
    lead_candidates: adapted.candidates,
    adapter_notes: adapted.notes,
    skipped: adapted.skipped,
    usage_recorded: false,
    reservations_created: false,
  });
}
