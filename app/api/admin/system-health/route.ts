import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getEnvHealth } from "@/lib/config/env-health";

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
    process.env.LEMONSQUEEZY_VARIANT_STARTER  ||
    process.env.LEMONSQUEEZY_VARIANT_STANDARD ||
    process.env.LEMONSQUEEZY_VARIANT_PRO
  );
  const resendKeySet       = !!process.env.RESEND_API_KEY;
  const resendFromSet      = !!process.env.RESEND_FROM_EMAIL;
  const cronSecretSet      = !!process.env.CRON_SECRET;

  results.apollo_key_set         = apolloKeySet;
  results.supabase_url_set       = supabaseUrlSet;
  results.supabase_service_set   = supabaseServiceSet;
  results.app_url_set            = appUrlSet;
  results.ls_secret_set          = lsSecretSet;
  results.ls_variants_configured = lsVariantsSet;
  results.resend_key_set         = resendKeySet;
  results.resend_from_set        = resendFromSet;
  results.cron_secret_set        = cronSecretSet;

  // Monitor infrastructure env health (presence + derived readiness — never
  // secret values). See lib/config/env-health.ts and the deployment checklist.
  results.env_health = getEnvHealth();
  console.log("[env-health] checked — production_safe:", (results.env_health as { production_safe: boolean }).production_safe);

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

  let logosBucketExists      = false;
  let deliveriesBucketExists = false;
  let storageBuckets: string[] = [];
  let storageError: string | null = null;

  try {
    const { data: buckets, error: bucketsErr } = await client.storage.listBuckets();
    if (!bucketsErr && buckets) {
      storageBuckets         = buckets.map((b: { name: string }) => b.name);
      logosBucketExists      = storageBuckets.includes("logos");
      deliveriesBucketExists = storageBuckets.includes("deliveries");
    } else {
      storageError = bucketsErr?.message ?? "unknown";
    }
  } catch (err) {
    storageError = err instanceof Error ? err.message : "unknown";
  }

  results.logos_bucket_exists      = logosBucketExists;
  results.deliveries_bucket_exists = deliveriesBucketExists;
  results.storage_buckets          = storageBuckets;
  if (storageError) results.storage_error = storageError;

  // ── Queue stats ───────────────────────────────────────────────────────────────

  const [
    pendingRes, processingRes, deliveryReadyRes,
    newOnboardingRes, processingReadyRes,
  ] = await Promise.all([
    client.from("lead_searches").select("id", { count: "exact", head: true }).eq("status", "pending"),
    client.from("lead_searches").select("id", { count: "exact", head: true }).eq("status", "processing"),
    client.from("lead_searches").select("id", { count: "exact", head: true }).eq("delivery_ready", true),
    client.from("onboarding_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    client.from("lead_searches").select("id", { count: "exact", head: true })
      .eq("processing_ready", true).eq("status", "pending"),
  ]);

  results.pending_searches          = pendingRes.count          ?? 0;
  results.processing_searches       = processingRes.count       ?? 0;
  results.delivery_ready_searches   = deliveryReadyRes.count    ?? 0;
  results.new_onboarding_requests   = newOnboardingRes.count    ?? 0;
  results.processing_ready_stuck    = processingReadyRes.count  ?? 0;

  // ── Delivery package stats ────────────────────────────────────────────────────

  const [pkgReadyRes, pkgPendingRes, pkgEmailSentRes] = await Promise.all([
    tableStatus["delivery_packages"]
      ? client.from("delivery_packages").select("id", { count: "exact", head: true }).eq("status", "ready")
      : Promise.resolve({ count: 0 }),
    tableStatus["delivery_packages"]
      ? client.from("delivery_packages").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    tableStatus["delivery_packages"]
      ? client.from("delivery_packages").select("id", { count: "exact", head: true }).eq("email_sent", true)
      : Promise.resolve({ count: 0 }),
  ]);

  results.delivery_packages_ready      = pkgReadyRes.count  ?? 0;
  results.delivery_packages_pending    = pkgPendingRes.count ?? 0;
  results.delivery_emails_sent         = pkgEmailSentRes.count ?? 0;

  // ── Enrichment consistency check ─────────────────────────────────────────────

  const [unenrichedRes, totalLeadsRes] = await Promise.all([
    client.from("lead_results").select("id", { count: "exact", head: true }).is("lead_score", null),
    client.from("lead_results").select("id", { count: "exact", head: true }),
  ]);

  const unenriched  = unenrichedRes.count ?? 0;
  const totalLeads  = totalLeadsRes.count ?? 0;
  const enrichedPct = totalLeads > 0 ? Math.round(((totalLeads - unenriched) / totalLeads) * 100) : 100;

  results.total_leads_in_db       = totalLeads;
  results.unenriched_leads        = unenriched;
  results.enrichment_coverage_pct = enrichedPct;
  results.enrichment_ok           = unenriched === 0 || enrichedPct >= 95;

  // ── Component scores (0–100) ─────────────────────────────────────────────────

  const scoreOnboarding = (
    (supabaseUrlSet                       ? 25 : 0) +
    (supabaseServiceSet                   ? 25 : 0) +
    (appUrlSet                            ? 25 : 0) +
    (tableStatus["onboarding_requests"]   ? 25 : 0)
  );

  const scorePayments = (
    (lsSecretSet    ? 50 : 0) +
    (lsVariantsSet  ? 50 : 0)
  );

  const scoreProcessing = (
    (apolloKeySet                   ? 40 : 0) +
    (tableStatus["lead_searches"]   ? 20 : 0) +
    (tableStatus["lead_results"]    ? 20 : 0) +
    (tableStatus["source_runs"]     ? 20 : 0)
  );

  const scoreApollo = apolloKeySet ? 100 : 0;

  const scoreVault = (
    (tableStatus["vault_leads"]  ? 50 : 0) +
    (tableStatus["lead_results"] ? 50 : 0)
  );

  const scoreCredits = (
    (tableStatus["customer_credits"]    ? 40 : 0) +
    (tableStatus["credit_transactions"] ? 30 : 0) +
    (tableStatus["notifications"]       ? 30 : 0)
  );

  const scoreDelivery = (
    (tableStatus["delivery_packages"]   ? 25 : 0) +
    (deliveriesBucketExists             ? 25 : 0) +
    (resendKeySet                       ? 25 : 0) +
    (resendFromSet                      ? 25 : 0)
  );

  const scoreCustomerAccess = (
    (appUrlSet          ? 25 : 0) +
    (resendKeySet       ? 50 : 0) +
    (resendFromSet      ? 25 : 0)
  );

  const scoreExports = (
    (tableStatus["lead_results"]  ? 40 : 0) +
    (apolloKeySet                 ? 30 : 0) +
    (deliveriesBucketExists       ? 30 : 0)
  );

  const overallScore = Math.round(
    (scoreOnboarding + scorePayments + scoreProcessing + scoreApollo +
     scoreVault + scoreCredits + scoreDelivery + scoreCustomerAccess + scoreExports) / 9
  );

  results.scores = {
    onboarding:     scoreOnboarding,
    payments:       scorePayments,
    processing:     scoreProcessing,
    apollo:         scoreApollo,
    vault:          scoreVault,
    credits:        scoreCredits,
    delivery:       scoreDelivery,
    customer_access: scoreCustomerAccess,
    exports:        scoreExports,
    overall:        overallScore,
  };

  results.all_tables_ok  = allTablesOk;
  results.delivery_score = overallScore;

  return NextResponse.json(results);
}
