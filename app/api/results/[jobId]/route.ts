import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/storage/snapshot-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const { jobId } = params;

  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const snapshot = await getSnapshot(jobId);

  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    job_id:     snapshot.job_id,
    plan:       snapshot.plan,
    status:     snapshot.status,
    lead_count: snapshot.lead_count,
    hot_count:  snapshot.hot_count,
    warm_count: snapshot.warm_count,
    avg_score:  snapshot.avg_score,
    created_at: snapshot.created_at,
    report:     snapshot.report_json,
    // user_id intentionally omitted from public response
  });
}
