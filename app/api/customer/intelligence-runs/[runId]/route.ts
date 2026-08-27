import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { SupabaseIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";

export async function GET(req: NextRequest, { params }: { params: { runId: string } }) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error } = await db.auth.getUser(auth);
  if (error || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!/^intel_[a-f0-9]{32}$/.test(params.runId)) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const run = await new SupabaseIntelligenceRunStore(db).load(params.runId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (run.status === "completed") return NextResponse.json({ status: run.status, stage: run.stage, context: run.contextRef, report: run.report });
  return NextResponse.json({ status: run.status, stage: run.stage, context: run.contextRef, failure: run.failureCode });
}
