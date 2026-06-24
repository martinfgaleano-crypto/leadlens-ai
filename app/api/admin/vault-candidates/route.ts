import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createCandidate, bulkInsertCandidates } from "@/lib/vault-candidates/scout";
import { getCandidateStats } from "@/lib/vault-candidates/stats";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ─── GET /api/admin/vault-candidates ─────────────────────────────────────────
// Returns paginated candidates + pipeline stats.
// Query params: page, per_page, status, country, industry, approved

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const perPage  = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const status   = searchParams.get("status")   ?? "";
  const country  = searchParams.get("country")  ?? "";
  const industry = searchParams.get("industry") ?? "";
  const approved = searchParams.get("approved") ?? ""; // "true" | "false" | ""

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = await getCandidateStats(client);

  // ── Paginated list ────────────────────────────────────────────────────────
  let q = client
    .from("vault_candidates")
    .select(
      "id, company_name, website, domain, country, industry, confidence_score, review_status, approved_for_vault, duplicate_of, claude_review_notes, raw_notes, discovered_by, source_type, promoted_at, created_at, reviewed_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status)   q = q.eq("review_status", status);
  if (country)  q = q.ilike("country", `%${country}%`);
  if (industry) q = q.ilike("industry", `%${industry}%`);
  if (approved === "true")  q = q.eq("approved_for_vault", true);
  if (approved === "false") q = q.eq("approved_for_vault", false);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    stats,
    candidates: data ?? [],
    total:    count ?? 0,
    page,
    per_page: perPage,
  });
}

// ─── POST /api/admin/vault-candidates ────────────────────────────────────────
// Create one candidate or bulk-insert an array.
// Body: CandidateInput  OR  { bulk: CandidateInput[] }

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (Array.isArray(body.bulk)) {
    const result = await bulkInsertCandidates(client, body.bulk as Parameters<typeof bulkInsertCandidates>[1]);
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 201 });
  }

  const result = await createCandidate(client, body as unknown as Parameters<typeof createCandidate>[1]);
  if (result.status === "error") {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json(result, { status: 201 });
}
