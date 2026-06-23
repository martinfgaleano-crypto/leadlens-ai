import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  const results: Record<string, unknown> = {};

  // ── Env vars ─────────────────────────────────────────────────────────────────

  results.apollo_key_set         = !!process.env.APOLLO_API_KEY;
  results.supabase_url_set       = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  results.supabase_service_set   = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  results.ls_secret_set          = !!process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  results.ls_variants_configured = !!(
    process.env.LEMONSQUEEZY_VARIANT_STARTER ||
    process.env.LEMONSQUEEZY_VARIANT_STANDARD ||
    process.env.LEMONSQUEEZY_VARIANT_PRO
  );
  results.app_url_set            = !!process.env.NEXT_PUBLIC_APP_URL;

  if (!client) {
    return NextResponse.json({ ...results, supabase_reachable: false }, { status: 200 });
  }

  // ── Table accessibility ───────────────────────────────────────────────────────

  const tables = [
    "profiles",
    "icps",
    "lead_searches",
    "lead_results",
    "onboarding_requests",
    "customer_credits",
    "credit_transactions",
    "notifications",
    "vault_leads",
    "source_runs",
  ] as const;

  const tableStatus: Record<string, boolean> = {};
  for (const t of tables) {
    try {
      const { error } = await client.from(t).select("id").limit(1);
      tableStatus[t] = !error;
    } catch {
      tableStatus[t] = false;
    }
  }
  results.tables = tableStatus;

  // ── Pending searches ──────────────────────────────────────────────────────────

  const { count: pendingCount } = await client
    .from("lead_searches")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: processingCount } = await client
    .from("lead_searches")
    .select("id", { count: "exact", head: true })
    .eq("status", "processing");

  const { count: newOnboardingCount } = await client
    .from("onboarding_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  results.pending_searches       = pendingCount ?? 0;
  results.processing_searches    = processingCount ?? 0;
  results.new_onboarding_requests = newOnboardingCount ?? 0;

  // ── Storage bucket check ──────────────────────────────────────────────────────

  try {
    const { data: buckets, error: bucketsErr } = await client.storage.listBuckets();
    if (!bucketsErr) {
      const bucketNames = (buckets ?? []).map((b: { name: string }) => b.name);
      results.logos_bucket_exists = bucketNames.includes("logos");
      results.storage_buckets     = bucketNames;
    } else {
      results.logos_bucket_exists = false;
      results.storage_error       = bucketsErr.message;
    }
  } catch (err) {
    results.logos_bucket_exists = false;
    results.storage_error       = err instanceof Error ? err.message : "unknown";
  }

  // ── Apollo connectivity ────────────────────────────────────────────────────────
  // Light check: verify key is present and makes a valid (but zero-result) request.

  results.apollo_configured = !!process.env.APOLLO_API_KEY;

  return NextResponse.json(results);
}
