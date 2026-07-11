import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { selectVaultOpportunities } from "@/lib/vault/vault-opportunity-selector";
import type { VaultOpportunitySelectionCriteria } from "@/lib/vault/vault-opportunity-types";

// Read-only: selects + scores approved Vault opportunities for an ICP.
// Never records usage, never creates reservations, never touches customer data.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as VaultOpportunitySelectionCriteria | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON criteria body required" }, { status: 400 });
  }
  const result = await selectVaultOpportunities(body);
  return NextResponse.json({ result }, { status: result.ok || result.selected.length > 0 ? 200 : 200 });
}
