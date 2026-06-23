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

  const apolloKeySet       = !!process.env.APOLLO_API_KEY;
  const supabaseUrlSet     = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceSet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrlSet          = !!process.env.NEXT_PUBLIC_APP_URL;
  const lsSecretSet        = !!process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const lsVariantsSet      = !!(
    process.env.LEMONSQUEEZY_VARIANT_STARTER ||
    process.env.LEMONSQUEEZY_VARIANT_STANDARD ||
    process.env.LEMONSQUEEZY_VARIANT_PRO
  );

  results.apollo_key_set         = apolloKeySet;
  results.supabase_url_set       = supabaseUrlSet;
  results.supabase_service_set   = supabaseServiceSet;
  results.app_url_set            = appUrlSet;
  results.ls_secret_set          = lsSecretSet;
  results.ls_variants_configured = lsVariantsSet;

  if (!client) {
    results.supabase_reachable = false;
    results.delivery_score     = 0;
    return NextResponse.json(results, { status: 200 });
  }

  results.supabase_reachable = true;

  // ── Table accessibility ───────────────────────────────────────────────────────

  const tables = [
    "profiles", "icps", "lead_searches", "lead_results",
    "onboarding_requests", "customer_credits", "credit_transactions",
    "notifications", "vault_leads", "source_runs", "delivery_packages",
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

  const allTablesOk = Object.values(tableStatus).every(Boolean);

  // ── Storage bucket check ──────────────────────────────────────────────────────

  let logosBucketExists = false;
  let storageBuckets: string[] = [];
  let storageError: string | null = null;

  try {
    const { data: buckets, error: bucketsErr } = await client.storage.listBuckets();
    if (!bucketsErr && buckets) {
      storageBuckets   = buckets.map((b: { name: string }) => b.name);
      logosBucketExists = storageBuckets.includes("logos");
    } else {
      storageError = bucketsErr?.message ?? "unknown";
    }
  } catch (err) {
    storageError = err instanceof Error ? err.message : "unknown";
  }

  results.logos_bucket_exists = logosBucketExists;
  results.storage_buckets     = storageBuckets;
  if (storageError) results.storage_error = storageError;

  // ── Queue stats ───────────────────────────────────────────────────────────────

  const [pendingRes, processingRes, deliveryReadyRes, newOnboardingRes] = await Promise.all([
    client.from("lead_searches").select("id", { count: "exact", head: true }).eq("status", "pending"),
    client.from("lead_searches").select("id", { count: "exact", head: true }).eq("status", "processing"),
    client.from("lead_searches").select("id", { count: "exact", head: true }).eq("delivery_ready", true),
    client.from("onboarding_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  results.pending_searches          = pendingRes.count          ?? 0;
  results.processing_searches       = processingRes.count       ?? 0;
  results.delivery_ready_searches   = deliveryReadyRes.count    ?? 0;
  results.new_onboarding_requests   = newOnboardingRes.count    ?? 0;

  // ── Enrichment consistency check ─────────────────────────────────────────────
  // Count completed searches that have lead_results missing enrichment columns.
  // A result row is "unenriched" if lead_score IS NULL (quality layer not applied).

  const { count: unenrichedCount } = await client
    .from("lead_results")
    .select("id", { count: "exact", head: true })
    .is("lead_score", null);

  const { count: totalLeadsCount } = await client
    .from("lead_results")
    .select("id", { count: "exact", head: true });

  const unenriched   = unenrichedCount ?? 0;
  const totalLeads   = totalLeadsCount ?? 0;
  const enrichedPct  = totalLeads > 0 ? Math.round(((totalLeads - unenriched) / totalLeads) * 100) : 100;

  results.total_leads_in_db     = totalLeads;
  results.unenriched_leads      = unenriched;
  results.enrichment_coverage_pct = enrichedPct;
  results.enrichment_ok         = unenriched === 0 || enrichedPct >= 95;

  // ── Component scores (0–100) ─────────────────────────────────────────────────

  const scoreOnboarding = (
    (supabaseUrlSet    ? 25 : 0) +
    (supabaseServiceSet ? 25 : 0) +
    (appUrlSet          ? 25 : 0) +
    (tableStatus["onboarding_requests"] ? 25 : 0)
  );

  const scoreProcessing = (
    (apolloKeySet           ? 40 : 0) +
    (tableStatus["lead_searches"] ? 20 : 0) +
    (tableStatus["lead_results"]  ? 20 : 0) +
    (tableStatus["source_runs"]   ? 20 : 0)
  );

  const scoreEnrichment = (
    (tableStatus["vault_leads"]  ? 30 : 0) +
    (enrichedPct >= 95           ? 40 : Math.round(enrichedPct * 0.4)) +
    (tableStatus["lead_results"] ? 30 : 0)
  );

  const scoreCredits = (
    (tableStatus["customer_credits"]    ? 40 : 0) +
    (tableStatus["credit_transactions"] ? 30 : 0) +
    (tableStatus["notifications"]        ? 30 : 0)
  );

  const scoreDelivery = (
    (tableStatus["delivery_packages"] ? 30 : 0) +
    (logosBucketExists                ? 30 : 0) +
    ((results.delivery_ready_searches as number) >= 0 ? 20 : 0) +
    (appUrlSet                        ? 20 : 0)
  );

  const scoreExport = (
    (tableStatus["lead_results"] ? 50 : 0) +
    (apolloKeySet                ? 30 : 0) +
    (supabaseServiceSet          ? 20 : 0)
  );

  const scorePayments = (
    (lsSecretSet    ? 50 : 0) +
    (lsVariantsSet  ? 50 : 0)
  );

  const overallScore = Math.round(
    (scoreOnboarding + scoreProcessing + scoreEnrichment +
     scoreCredits + scoreDelivery + scoreExport + scorePayments) / 7
  );

  results.scores = {
    onboarding: scoreOnboarding,
    processing: scoreProcessing,
    enrichment: scoreEnrichment,
    credits:    scoreCredits,
    delivery:   scoreDelivery,
    export:     scoreExport,
    payments:   scorePayments,
    overall:    overallScore,
  };

  results.all_tables_ok  = allTablesOk;
  results.delivery_score = overallScore;

  return NextResponse.json(results);
}
