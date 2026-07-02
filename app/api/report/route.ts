import { NextRequest, NextResponse } from "next/server";
import { exportToCSV, exportToMarkdown } from "@/lib/utils/export";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { LeadLensReport } from "@/types";

/**
 * POST /api/report
 * Accepts a full LeadLensReport in the body and returns CSV or Markdown.
 * No auth: the caller already possesses the report data it sends.
 *
 * GET /api/report?job_id=xxx&format=json|csv|md
 * Access model (see docs/strategy/REPORT_ACCESS_MODEL.md):
 *   - DEMO_MODE=true            → open (demo data only, no real customers).
 *   - x-admin-token valid       → any report (monitor snapshots + legacy).
 *   - Bearer <supabase JWT>     → only snapshots whose search_id belongs to
 *                                 the authenticated user (lead_searches.user_id).
 *   - Legacy `reports` rows and snapshots without search_id → admin-only
 *     (no verifiable customer ownership; never guessed from job_id).
 *   - Everything unauthorized/unknown → 404 (do not confirm existence).
 *
 * Lookup order: snapshot_reports first (monitor runs), then legacy `reports`.
 * Snapshot statuses: processing/failed return { status } so the results page
 * can keep polling or show a failure state.
 */

const IS_DEMO = process.env.DEMO_MODE === "true";

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

// ─── GET ──────────────────────────────────────────────────────────────────────

function formatResponse(report: LeadLensReport, jobId: string, format: string) {
  if (format === "csv") {
    return new NextResponse(exportToCSV(report), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leadlens-${jobId}.csv"`,
      },
    });
  }
  if (format === "md" || format === "markdown") {
    return new NextResponse(exportToMarkdown(report), {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="leadlens-${jobId}.md"`,
      },
    });
  }
  return NextResponse.json({ success: true, status: "completed", report });
}

const NOT_FOUND = () => NextResponse.json({ error: "Report not found." }, { status: 404 });

export async function GET(req: NextRequest) {
  const jobId  = req.nextUrl.searchParams.get("job_id") ?? req.nextUrl.searchParams.get("jobId");
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  if (!jobId) {
    return NextResponse.json({ error: "Missing job_id query parameter" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Report retrieval requires Supabase. Use POST /api/report with a report body for on-demand export." },
      { status: 503 },
    );
  }

  // ── Identify the caller ─────────────────────────────────────────────────────
  const isAdmin = requireAdmin(req) === null && !!req.headers.get("x-admin-token");
  let userId: string | null = null;

  if (!isAdmin && !IS_DEMO) {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const { createServerClient } = await import("@/lib/supabase/server");
      const db = createServerClient();
      if (db) {
        const { data: { user } } = await db.auth.getUser(token);
        userId = user?.id ?? null;
      }
    }
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── 1. Monitor snapshots (snapshot_reports) — primary source ────────────────
  const { getSnapshot } = await import("@/lib/storage/snapshot-store");
  const snapshot = await getSnapshot(jobId);

  if (snapshot) {
    // Ownership: customers need snapshot.search_id → lead_searches.user_id match.
    if (!isAdmin && !IS_DEMO) {
      if (!snapshot.search_id) return NOT_FOUND(); // unscoped → admin-only
      const { createServerClient } = await import("@/lib/supabase/server");
      const db = createServerClient();
      if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
      const { data: owned } = await db
        .from("lead_searches")
        .select("id")
        .eq("id", snapshot.search_id)
        .eq("user_id", userId)
        .single();
      if (!owned) return NOT_FOUND();
    }

    if (snapshot.status === "processing") {
      return NextResponse.json({ status: "processing", job_id: jobId });
    }
    if (snapshot.status === "failed") {
      return NextResponse.json({ status: "failed", job_id: jobId });
    }
    const report = snapshot.report_json as LeadLensReport;
    if (!report || !("processed_leads" in report)) return NOT_FOUND();
    // Consistency check: report.search_id is context-only; the snapshot row is
    // authoritative. A mismatch indicates a bug worth logging — never served
    // to a customer whose ownership was verified against a different series.
    if (report.search_id && snapshot.search_id && report.search_id !== snapshot.search_id) {
      console.error(`[/api/report] search_id mismatch for job ${jobId}: report=${report.search_id} snapshot=${snapshot.search_id}`);
      if (!isAdmin) return NOT_FOUND();
    }
    return formatResponse(report, jobId, format);
  }

  // ── 2. Legacy `reports` table — admin-only (order-linked, no user ownership) ─
  if (!isAdmin && !IS_DEMO) return NOT_FOUND();

  const { getReportByJobId } = await import("@/lib/storage/saas-store");
  const stored = await getReportByJobId(jobId);
  if (!stored) return NOT_FOUND();

  const report = stored.report_json;
  if (format === "csv") {
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
  return NextResponse.json({ success: true, status: "completed", report, report_id: stored.id });
}
