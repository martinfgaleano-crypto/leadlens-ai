import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  createVaultCompany,
  createVaultContact,
  createVaultSignal,
  createVaultSource,
  findVaultCompanyByDomain,
} from "@/lib/storage/vault-store";
import type { VaultCandidate } from "@/lib/vault/vault-types";

// ── POST /api/admin/vault-foundation/candidates ───────────────────────────────
// Manual candidate intake: one bundle (source + company [+ contact] [+ signal])
// discovered from a permitted/public source. Provenance is mandatory
// (source_url + source_type). No scraping, no external fetches, no Apollo.
// Everything lands as pending_review for the admin review queue.

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as VaultCandidate | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.company_name?.trim()) {
    return NextResponse.json({ error: "company_name is required" }, { status: 400 });
  }
  if (!body.source_url?.trim() || !body.source_type?.trim()) {
    return NextResponse.json({ error: "source_url and source_type are required — provenance is mandatory" }, { status: 400 });
  }

  // 1. Source (provenance record)
  const source = await createVaultSource({
    source_type: body.source_type,
    source_url: body.source_url.trim(),
    confidence_score: body.confidence_score ?? null,
    usage_rights_status: body.usage_rights_status ?? "unverified",
    notes: body.notes ?? null,
  });
  if (!source) {
    return NextResponse.json({ error: "Could not create source — is Supabase configured and migration 029 applied?" }, { status: 503 });
  }

  // 2. Company (find by domain first — dedupe)
  let company = body.domain ? await findVaultCompanyByDomain(body.domain.trim().toLowerCase()) : null;
  let companyExisted = !!company;
  if (!company) {
    company = await createVaultCompany({
      name: body.company_name.trim(),
      domain: body.domain?.trim().toLowerCase() || null,
      website_url: body.website_url ?? null,
      region: body.region ?? null,
      country: body.country ?? null,
      industry: body.industry ?? null,
      source_status: body.source_type,
    });
    companyExisted = false;
  }
  if (!company) {
    return NextResponse.json({ error: "Could not create company." }, { status: 503 });
  }

  // 3. Contact (optional — pending_review by default)
  let contactId: string | null = null;
  if (body.contact_name || body.email) {
    const contact = await createVaultContact({
      company_id: company.id,
      full_name: body.contact_name ?? null,
      title: body.contact_title ?? null,
      email: body.email ?? null,
      region: body.region ?? null,
      country: body.country ?? null,
      source_status: body.source_type,
      usage_rights_status: body.usage_rights_status ?? "unverified",
    });
    contactId = contact?.id ?? null;
  }

  // 4. Signal (optional — pending_review by default)
  let signalId: string | null = null;
  if (body.signal_type || body.signal_summary) {
    const signal = await createVaultSignal({
      company_id: company.id,
      contact_id: contactId,
      source_id: source.id,
      signal_type: body.signal_type ?? "other",
      signal_summary: body.signal_summary ?? null,
      signal_date: body.signal_date ?? null,
      confidence_score: body.confidence_score ?? null,
      // Manual intake requires source_url + source_type provenance → real data.
      data_origin: "production",
      production_eligible: true,
      origin_reason: "manual candidate intake with mandatory provenance",
      origin_version: "origin-v1",
    });
    signalId = signal?.id ?? null;
  }

  console.log(`[vault-intake] candidate created company=${company.id} existed=${companyExisted} contact=${contactId ?? "-"} signal=${signalId ?? "-"} source=${source.id}`);

  return NextResponse.json({
    success: true,
    review_status: "pending_review",
    company_id: company.id,
    company_existed: companyExisted,
    contact_id: contactId,
    signal_id: signalId,
    source_id: source.id,
  }, { status: 201 });
}
