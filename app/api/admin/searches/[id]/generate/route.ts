import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ─── POST /api/admin/searches/[id]/generate ───────────────────────────────────
//
// Admin-triggered lead generation. Delegates to the canonical pipeline at
// POST /api/process/search/[id] to guarantee vault → source orchestrator →
// quality → enrichment → credits → notifications are all applied.
//
// Pre-flight: resets search to "pending" so the canonical route's duplicate-
// run guard lets it through. Marks processing_trigger_source = "admin".

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const searchId = params.id;

  const client = await db();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  // ── 1. Fetch search ──────────────────────────────────────────────────────────

  const { data: search, error: fetchErr } = await client
    .from("lead_searches")
    .select("id, status, user_id")
    .eq("id", searchId)
    .single();

  if (fetchErr || !search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  // ── 2. Reset to pending so canonical pipeline will process it ────────────────
  // Canonical route skips anything that isn't "pending". Admin retrigger resets
  // completed/failed searches so they can be re-run.

  const { error: resetErr } = await client
    .from("lead_searches")
    .update({
      status:                     "pending",
      processing_trigger_source:  "admin",
      // Clear stale processing artifacts from previous runs
      process_started_at:         null,
      process_finished_at:        null,
      processing_started_at:      null,
      processing_completed_at:    null,
      process_duration_ms:        null,
      process_generated_count:    null,
      process_duplicates_skipped: null,
      process_error_message:      null,
      error_message:              null,
      delivery_ready:             false,
      delivery_ready_at:          null,
    })
    .eq("id", searchId);

  if (resetErr) {
    return NextResponse.json(
      { error: `Failed to reset search: ${resetErr.message}` },
      { status: 500 }
    );
  }

  // ── 3. Delegate to canonical pipeline ────────────────────────────────────────
  // Uses request origin so this works in both local dev and production.

  const origin = req.nextUrl.origin;

  let pipelineRes: Response;
  try {
    pipelineRes = await fetch(`${origin}/api/process/search/${searchId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Pipeline request failed: ${msg}` },
      { status: 502 }
    );
  }

  // ── 4. Forward canonical response ────────────────────────────────────────────

  let body: unknown;
  try {
    body = await pipelineRes.json();
  } catch {
    body = { error: "Pipeline returned non-JSON response" };
  }

  return NextResponse.json(body, { status: pipelineRes.status });
}
