import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listVaultSources, createVaultSource } from "@/lib/storage/vault-store";

// Admin-only Vault Foundation API — no public/customer access, no scraping,
// no external fetches. See LEADLENS_DATA_SOURCING_COMPLIANCE.md.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const items = await listVaultSources();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.source_type || typeof body.source_type !== "string") {
    return NextResponse.json({ error: "source_type is required" }, { status: 400 });
  }
  if (!body.source_url || typeof body.source_url !== "string") {
    return NextResponse.json({ error: "source_url is required (provenance is mandatory)" }, { status: 400 });
  }
  const created = await createVaultSource(body);
  if (!created) return NextResponse.json({ error: "Could not create — is Supabase configured and migration 029 applied?" }, { status: 503 });
  return NextResponse.json({ item: created }, { status: 201 });
}
