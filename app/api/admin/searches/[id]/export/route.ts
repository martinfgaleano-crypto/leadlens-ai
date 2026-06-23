import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// Lead result row shape returned from DB
interface LeadRow {
  company_name:       string;
  contact_name:       string | null;
  title:              string | null;
  email:              string | null;
  linkedin_url:       string | null;
  country:            string | null;
  source:             string | null;
  lead_score:         number | null;
  confidence_score:   number | null;
  opportunity_score:  number | null;
  buyer_fit:          string | null;
  temperature:        string | null;
  ai_reasoning:       string | null;
  strengths:          string[] | null;
  weaknesses:         string[] | null;
  email_quality:      string | null;
  email_type:         string | null;
  seniority:          string | null;
  website:            string | null;
  normalized_company: string | null;
  normalized_title:   string | null;
  created_at:         string | null;
}

const CSV_COLUMNS: Array<{ header: string; key: keyof LeadRow }> = [
  { header: "Company",          key: "company_name" },
  { header: "Contact Name",     key: "contact_name" },
  { header: "Title",            key: "title" },
  { header: "Email",            key: "email" },
  { header: "Email Quality",    key: "email_quality" },
  { header: "Email Type",       key: "email_type" },
  { header: "LinkedIn",         key: "linkedin_url" },
  { header: "Website",          key: "website" },
  { header: "Country",          key: "country" },
  { header: "Seniority",        key: "seniority" },
  { header: "Source",           key: "source" },
  { header: "Lead Score",       key: "lead_score" },
  { header: "Confidence Score", key: "confidence_score" },
  { header: "Opportunity Score",key: "opportunity_score" },
  { header: "Buyer Fit",        key: "buyer_fit" },
  { header: "Temperature",      key: "temperature" },
  { header: "Strengths",        key: "strengths" },
  { header: "Weaknesses",       key: "weaknesses" },
  { header: "AI Reasoning",     key: "ai_reasoning" },
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join(" | ") : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── GET /api/admin/searches/[id]/export ─────────────────────────────────────
// Returns a CSV of all lead_results for this search using the current pipeline
// schema. Replaces the V1 /api/report CSV export which used a different format.

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // Verify search exists and get its name for the filename
  const { data: search, error: searchErr } = await client
    .from("lead_searches")
    .select("id, name, status, process_generated_count")
    .eq("id", params.id)
    .single();

  if (searchErr || !search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  // Fetch all lead results for this search
  const { data: leads, error: leadsErr } = await client
    .from("lead_results")
    .select([
      "company_name", "contact_name", "title", "email", "email_quality",
      "email_type", "linkedin_url", "website", "country", "seniority",
      "source", "lead_score", "confidence_score", "opportunity_score",
      "buyer_fit", "temperature", "ai_reasoning", "strengths", "weaknesses",
      "normalized_company", "normalized_title", "created_at",
    ].join(", "))
    .eq("search_id", params.id)
    .order("lead_score", { ascending: false });

  if (leadsErr) {
    return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No leads found for this search." }, { status: 404 });
  }

  const headerRow = CSV_COLUMNS.map(c => csvCell(c.header)).join(",");
  const dataRows  = (leads as unknown as LeadRow[]).map(row =>
    CSV_COLUMNS.map(c => csvCell(row[c.key])).join(",")
  );

  const csv = [headerRow, ...dataRows].join("\n");

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
