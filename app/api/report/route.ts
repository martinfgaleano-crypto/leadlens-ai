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
  const jobId = req.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

  // TODO (production): query Supabase for this job's stored report
  return NextResponse.json(
    { error: "Supabase persistence not implemented yet. Run the pipeline via POST /api/process and pass the returned report to POST /api/report for export." },
    { status: 501 }
  );
}
