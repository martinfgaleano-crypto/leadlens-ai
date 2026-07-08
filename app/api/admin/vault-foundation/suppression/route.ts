import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listSuppressionEntries, addSuppressionEntry } from "@/lib/storage/vault-store";

// Admin-only Vault Foundation API — no public/customer access, no scraping,
// no external fetches. See LEADLENS_DATA_SOURCING_COMPLIANCE.md.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const items = await listSuppressionEntries();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.suppression_type || !body.value || !body.reason) {
    return NextResponse.json({ error: "suppression_type, value, and reason are required" }, { status: 400 });
  }
  const created = await addSuppressionEntry(body);
  if (!created) return NextResponse.json({ error: "Could not create — is Supabase configured and migration 029 applied?" }, { status: 503 });
  return NextResponse.json({ item: created }, { status: 201 });
}
