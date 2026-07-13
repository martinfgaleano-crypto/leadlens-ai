import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listVaultGenerationRuns } from "@/lib/storage/vault-generation-store";

// GET /api/admin/vault-report-bridge/runs — recent Vault generation jobs
// (status, customer, counts, errors, stale-processing flag). Admin ops view.
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  return NextResponse.json({ items: await listVaultGenerationRuns(20) });
}
