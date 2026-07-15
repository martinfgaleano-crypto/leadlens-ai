import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";

// GET /api/admin/reports/institutional/[jobId]
// Admin-only. Assembles an institutional report from an existing snapshot.
// Read-only; never touches ranking, ML or customer surfaces.
async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data, error } = await db.from("snapshot_reports")
    .select("job_id, plan, search_id, status, created_at, report_json")
    .eq("job_id", params.jobId)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (data.status !== "completed") return NextResponse.json({ error: `Report is ${data.status}, not completed.` }, { status: 409 });

  // Resolve customer ref via the monitor owner (admin context only).
  let customerRef: string | null = null;
  if (data.search_id) {
    const { data: search } = await db.from("lead_searches").select("user_id").eq("id", data.search_id).maybeSingle();
    if (search?.user_id) {
      const { data: profile } = await db.from("profiles").select("email").eq("id", search.user_id).maybeSingle();
      customerRef = profile?.email ?? null;
    }
  }

  const report = assembleInstitutionalReport(data.report_json, {
    job_id: data.job_id, plan: data.plan, search_id: data.search_id, customer_ref: customerRef, created_at: data.created_at,
  });
  return NextResponse.json({ report });
}
