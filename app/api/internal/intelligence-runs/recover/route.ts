import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServerClient } from "@/lib/supabase/server";
import { dispatchIntelligenceRun } from "@/lib/intelligence/intelligence-run-dispatch";

// Recovery hook only. Cron is intentionally not configured by this sprint.
function authorized(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_RUN_SECRET;
  const actual = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(expected && actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected)));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });
  const { data, error } = await db.from("snapshot_reports")
    .select("job_id,user_id,status,report_json,created_at")
    .eq("status", "processing").like("job_id", "intel_%")
    .order("created_at", { ascending: true }).limit(5);
  if (error) return NextResponse.json({ error: "Recovery scan failed" }, { status: 500 });
  const now = Date.now();
  const eligible = (data ?? []).filter(row => {
    if (row.report_json?._intelligence_run?.stage === "queued") return true;
    const updated = row.report_json?._intelligence_run?.updatedAt ?? row.created_at;
    return now - new Date(updated).getTime() > 15 * 60_000;
  });
  const dispatched = eligible.filter(row => dispatchIntelligenceRun(req.nextUrl.origin, row.job_id, row.user_id)).map(row => row.job_id);
  return NextResponse.json({ scanned: data?.length ?? 0, dispatched, cron_active: false });
}
