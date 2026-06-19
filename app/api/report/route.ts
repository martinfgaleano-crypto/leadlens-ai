import { NextRequest, NextResponse } from "next/server";
import { exportToCSV, exportToMarkdown } from "@/lib/utils/export";
import type { LeadLensReport } from "@/types";

/**
 * POST /api/report
 * Accepts a full LeadLensReport in the body and returns CSV or Markdown.
 * This allows the client to request different formats without re-running the pipeline.
 *
 * GET /api/report?job_id=xxx&format=json|csv|md
 * TODO (production): fetch job from Supabase and return the stored report.
 */

export async function POST(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  try {
    const body = await req.json();
    const report = body.report as LeadLensReport;

    if (!report || !report.processed_leads) {
      return NextResponse.json({ error: "Missing report in body" }, { status: 400 });
    }

    if (format === "csv") {
      const csv = exportToCSV(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="leadlens-${report.job_id}.csv"`,
        },
      });
    }

    if (format === "md" || format === "markdown") {
      const md = exportToMarkdown(report);
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="leadlens-${report.job_id}.md"`,
        },
      });
    }

    return NextResponse.json({ success: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const jobId  = req.nextUrl.searchParams.get("job_id") ?? req.nextUrl.searchParams.get("jobId");
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  if (!jobId) {
    return NextResponse.json({ error: "Missing job_id query parameter" }, { status: 400 });
  }

  // Supabase required for report retrieval
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error: "Report retrieval requires Supabase. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use POST /api/report with a report body for on-demand export.",
      },
      { status: 503 }
    );
  }

  const { getReportByJobId } = await import("@/lib/storage/saas-store");
  const stored = await getReportByJobId(jobId);

  if (!stored) {
    return NextResponse.json(
      { error: `No report found for job_id=${jobId}` },
      { status: 404 }
    );
  }

  const report = stored.report_json;

  if (format === "csv") {
    // Use pre-generated CSV if available, otherwise generate on the fly
    const csv = stored.csv_content ?? exportToCSV(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leadlens-${jobId}.csv"`,
      },
    });
  }

  if (format === "md" || format === "markdown") {
    const md = stored.markdown_content ?? exportToMarkdown(report);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="leadlens-${jobId}.md"`,
      },
    });
  }

  return NextResponse.json({ success: true, report, report_id: stored.id });
}
