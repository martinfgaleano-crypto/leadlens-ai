import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getReportByJobId } from "@/lib/storage/saas-store";
import { exportToCSV, exportToMarkdown } from "@/lib/utils/export";

/**
 * GET /api/admin/report/[jobId]
 * Returns a stored report in JSON, CSV, or Markdown format.
 * Admin only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const stored = await getReportByJobId(params.jobId);

  if (!stored) {
    return NextResponse.json(
      { error: `No report found for job_id=${params.jobId}` },
      { status: 404 }
    );
  }

  const report = stored.report_json;

  if (format === "csv") {
    const csv = stored.csv_content ?? exportToCSV(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leadlens-${params.jobId}.csv"`,
      },
    });
  }

  if (format === "md" || format === "markdown") {
    const md = stored.markdown_content ?? exportToMarkdown(report);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="leadlens-${params.jobId}.md"`,
      },
    });
  }

  // Default: full JSON
  return NextResponse.json({
    report_id:        stored.id,
    job_id:           stored.job_id,
    order_id:         stored.order_id,
    plan:             stored.plan,
    lead_count:       stored.lead_count,
    status:           stored.status,
    created_at:       stored.created_at,
    report:           report,
  });
}
