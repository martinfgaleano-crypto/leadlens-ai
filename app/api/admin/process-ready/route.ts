import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

// ─── POST /api/admin/process-ready ───────────────────────────────────────────
//
// Reliability endpoint for Vercel serverless environments.
//
// Problem: the Lemon Squeezy webhook triggers processing via fire-and-forget
// fetch(). On Vercel, the function instance is frozen after the 200 response,
// killing any in-flight fetch calls before Apollo can complete (30s timeout).
//
// Solution: the webhook marks processing_trigger_source = "webhook" and
// processing_ready = true reliably (those writes complete before the 200).
// This endpoint is the fallback — it picks up searches that were marked
// processing_ready but never made it to "processing" or "completed".
//
// How to call:
//   POST /api/admin/process-ready  (Admin-Key header required)
//
// Can be wired to a Vercel Cron at "*/5 * * * *" (every 5 minutes) by adding
// to vercel.json:
//   { "crons": [{ "path": "/api/admin/process-ready", "schedule": "*/5 * * * *" }] }
// The cron bypasses requireAdmin if CRON_SECRET header matches CRON_SECRET env.
//
// Returns: { processed: number, results: [...] }

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function POST(req: NextRequest) {
  // Allow both admin key auth and Vercel cron secret
  const cronSecret  = process.env.CRON_SECRET;
  const cronHeader  = req.headers.get("x-vercel-cron-secret") ?? req.headers.get("authorization");
  const isCronCall  = cronSecret && cronHeader === cronSecret;

  if (!isCronCall) {
    const deny = requireAdmin(req);
    if (deny) return deny;
  }

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // Find searches that are: processing_ready=true AND still pending
  // (not already picked up by a previous run)
  const { data: readySearches, error } = await client
    .from("lead_searches")
    .select("id, name, user_id")
    .eq("processing_ready", true)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10); // process at most 10 per invocation to stay within timeout

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!readySearches || readySearches.length === 0) {
    return NextResponse.json({ processed: 0, message: "No processing-ready searches found." });
  }

  const origin  = req.nextUrl.origin;
  const results: Array<{ id: string; status: number; success: boolean; error?: string }> = [];

  for (const search of readySearches) {
    const searchId = search.id as string;
    try {
      const res = await fetch(`${origin}/api/process/search/${searchId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({})) as { success?: boolean };
      results.push({ id: searchId, status: res.status, success: !!body.success });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: searchId, status: 0, success: false, error: msg });
    }
  }

  return NextResponse.json({
    processed: readySearches.length,
    results,
  });
}

// Also support GET for simple health-check use by Vercel Cron (which uses GET)
export async function GET(req: NextRequest) {
  return POST(req);
}
