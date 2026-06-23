import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { generateLeadsCSV, type LeadResultRow } from "@/lib/delivery/generate-csv";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ─── GET /api/admin/searches/[id]/export ─────────────────────────────────────
// Returns a CSV of all lead_results using the shared delivery CSV generator.
// Fields: company, contact, title, email, quality, linkedin, website, country,
//         seniority, source, lead_score, confidence, opportunity, buyer_fit,
//         temperature, strengths, weaknesses, ai_reasoning.

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: search, error: searchErr } = await client
    .from("lead_searches")
    .select("id, name, status")
    .eq("id", params.id)
    .single();

  if (searchErr || !search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  const { data: leads, error: leadsErr } = await client
    .from("lead_results")
    .select([
      "company_name", "contact_name", "title", "email", "email_quality",
      "email_type", "linkedin_url", "website", "country", "seniority",
      "source", "lead_score", "confidence_score", "opportunity_score",
      "buyer_fit", "temperature", "ai_reasoning", "strengths", "weaknesses",
    ].join(", "))
    .eq("search_id", params.id)
    .order("lead_score", { ascending: false });

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No leads found for this search." }, { status: 404 });
  }

  const csv      = generateLeadsCSV(leads as unknown as LeadResultRow[]);
  const safeName = (search.name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leadlens-${safeName}.csv"`,
    },
  });
}
