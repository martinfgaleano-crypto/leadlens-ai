import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { resolveProduct } from "@/lib/products/catalog";
import { createJob } from "@/lib/storage/job-store";
import type { OnboardingData } from "@/types";

// ─── Managed pilot runs (managed_pilot_v0) ───────────────────────────────────
// Admin-only creation of COMPLIMENTARY tier runs for real-client pilots — no
// checkout, no payment provider, but full commercial traceability: product
// code + version, reference launch price, entitlements, limits, costs and the
// tier's real experience all resolve server-side exactly as a paid run would.
// This is NOT a reusable free tier: creation requires the admin token, runs
// are capped per client (PILOT_MAX_PER_CLIENT, default 6), every pilot is
// audited in the job record, and quality gates stay fully active.
// Rollback: MANAGED_PILOT_V0=off disables creation (existing runs unaffected).

const pilotSchema = z.object({
  client_name: z.string().min(2).max(120),
  client_company: z.string().min(2).max(160),
  client_country: z.string().min(2).max(60).default("Colombia"),
  client_email: z.string().email(),
  product_code: z.enum(["preview_launch_v0", "brief_launch_v0", "intelligence_launch_v0", "premium_launch_v0"]),
  complimentary_reason: z.string().min(5).max(300),
  output_language: z.enum(["es", "en"]).default("es"),
  target_market_region: z.enum(["latin_america", "north_america", "europe", "asia", "global"]).default("latin_america"),
  target_countries: z.array(z.string().min(2).max(60)).min(1).default(["Colombia"]),
  known_accounts: z.array(z.string().min(2).max(160)).max(100).default([]),
  // Regional context (Colombia-aware, not Colombia-limited)
  city_or_department: z.string().max(120).optional(),
  local_context: z.string().max(800).optional(),
  // ICP / commercial context (same analytical floor as paid onboarding)
  company_name: z.string().min(1).max(160),
  company_description: z.string().min(5).max(1200),
  offer_description: z.string().min(5).max(1200),
  value_proposition: z.string().min(5).max(1200),
  target_customer_description: z.string().min(5).max(1500),
  average_ticket: z.string().max(120).optional(),
  commercial_objective: z.string().max(600).optional(),
  restrictions: z.string().max(600).optional(),
  /** Internal QA only: allow the run even when the environment forces MOCK
   *  candidates. A REAL client pilot must never analyze mock companies. */
  allow_mock_candidates: z.boolean().default(false),
});

// Deterministic LIST-PRICE cost estimate per tier (search+extraction base plus
// per-opportunity LLM chain) — an estimate for preflight, never billed truth.
const EST = { base: 0.25, perOpportunity: 0.35 };

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  if (process.env.MANAGED_PILOT_V0 === "off") {
    return NextResponse.json({ error: "Managed pilots are disabled (MANAGED_PILOT_V0=off)." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const parsed = pilotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;

  const { assertGeographyContract } = await import("@/lib/quality/geography-contract");
  try {
    assertGeographyContract(
      { company_name: p.company_name, company_description: p.company_description, offer_description: p.offer_description, value_proposition: p.value_proposition, target_customer_description: p.target_customer_description, tone: "consultative", contact_email: p.client_email, target_market_region: p.target_market_region, target_countries: p.target_countries },
      { target_industries: [], target_company_size: [], target_job_titles: [], target_geography: p.target_countries, excluded_industries: [], buying_signals: [], disqualification_criteria: [], offer_summary: p.offer_description, value_proposition: p.value_proposition, tone: "consultative", plan: "sample", lead_count: 0 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid geography" }, { status: 400 });
  }

  const product = resolveProduct(p.product_code);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });

  // Real pilots FORCE compliant public-web discovery (the pipeline overrides
  // mock env flags for pilot runs). Creation is refused only when no compliant
  // discovery provider is configured at all — a real client must never receive
  // mock companies. allow_mock_candidates marks an internal QA run explicitly.
  const realDiscoveryAvailable = (!!process.env.BRAVE_SEARCH_API_KEY && !!process.env.SERPER_API_KEY) || !!process.env.TAVILY_API_KEY;
  if (!p.allow_mock_candidates && !realDiscoveryAvailable) {
    return NextResponse.json({
      error: "No compliant discovery provider configured (need BRAVE_SEARCH_API_KEY+SERPER_API_KEY or TAVILY_API_KEY). A real client pilot cannot run on mock companies — or pass allow_mock_candidates:true for an internal QA run.",
    }, { status: 409 });
  }
  const mockForced = p.allow_mock_candidates === true;

  // Per-client pilot cap — the complimentary path must never become an
  // unlimited free tier.
  const maxPerClient = parseInt(process.env.PILOT_MAX_PER_CLIENT ?? "6", 10);
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (db) {
    const { data: prior } = await db.from("batch_jobs").select("id, onboarding").eq("customer_email", p.client_email).limit(50);
    const priorPilots = (prior ?? []).filter((j) => (j.onboarding as { pilot?: unknown })?.pilot).length;
    if (priorPilots >= maxPerClient) {
      return NextResponse.json({ error: `Pilot limit reached for this client (${priorPilots}/${maxPerClient}).` }, { status: 429 });
    }
  }

  const pilotId = `pilot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const estimatedCost = Number((EST.base + EST.perOpportunity * product.entitlements.opportunity_target).toFixed(2));

  const onboarding: OnboardingData & { pilot: Record<string, unknown> } = {
    company_name: p.company_name,
    company_description: p.company_description,
    offer_description: p.offer_description,
    value_proposition: p.value_proposition,
    target_customer_description: p.target_customer_description
      + (p.city_or_department ? ` | Regional focus: ${p.city_or_department}, ${p.client_country}` : "")
      + (p.local_context ? ` | Local context: ${p.local_context}` : ""),
    average_ticket: p.average_ticket,
    tone: "consultative",
    contact_email: p.client_email,
    output_language: p.output_language,
    target_market_region: p.target_market_region,
    target_countries: p.target_countries,
    known_accounts: p.known_accounts,
    product_code: product.product_code,
    product_version: "launch_v0",
    campaign_objective: p.commercial_objective,
    restrictions: p.restrictions,
    // Pilot audit block — complimentary run with full commercial traceability.
    pilot: {
      pilot_id: pilotId,
      client_name: p.client_name,
      client_company: p.client_company,
      client_country: p.client_country,
      target_countries: p.target_countries,
      known_accounts: p.known_accounts,
      reference_price: product.price_amount,
      currency: product.currency,
      complimentary: true,
      complimentary_reason: p.complimentary_reason,
      mock_candidates: mockForced,
      created_by: "admin",
      estimated_cost_usd: estimatedCost,
      created_at: new Date().toISOString(),
    },
  };

  const job = await createJob({ plan: product.legacy_plan, onboarding, customer_email: p.client_email });

  // Fire-and-forget processing (pipeline takes minutes). Snapshot lifecycle
  // mirrors /api/process so /results/[jobId] + /brief work unchanged.
  void (async () => {
    const { createProcessingSnapshot, completeSnapshot, failSnapshot } = await import("@/lib/storage/snapshot-store");
    const { runLeadLensPipeline } = await import("@/lib/pipeline");
    const { updateJob } = await import("@/lib/storage/job-store");
    await createProcessingSnapshot(job.id, product.legacy_plan).catch(() => {});
    const startedAt = Date.now();
    try {
      const report = await runLeadLensPipeline({ onboardingData: onboarding, plan: product.legacy_plan, jobId: job.id });
      await completeSnapshot(job.id, product.legacy_plan, report).catch(() => {});
      await updateJob(job.id, { status: "completed", completed_at: new Date().toISOString() }).catch(() => {});
      // Observed run metrics — honest: per-call token counts are not
      // instrumented in the agent layer yet, so API cost stays "unavailable";
      // duration and counts are real.
      const leads = (report as { processed_leads?: unknown[] }).processed_leads?.length ?? 0;
      console.log(`[analytics] ${JSON.stringify({
        event: "run_completed", pilot_id: pilotId, tier: product.tier, product_code: product.product_code,
        duration_ms: Date.now() - startedAt, opportunities_delivered: leads,
        opportunity_target: product.entitlements.opportunity_target,
        estimated_cost_usd: estimatedCost, observed_llm_cost: "unavailable (tokens not instrumented)",
        cost_per_delivered_estimate: leads ? Number((estimatedCost / leads).toFixed(2)) : null,
      })}`);
    } catch (err) {
      console.error(`[pilot] run failed pilot=${pilotId} job=${job.id}:`, err instanceof Error ? err.message : err);
      await failSnapshot(job.id, product.legacy_plan, err instanceof Error ? err.message : String(err)).catch(() => {});
      await updateJob(job.id, { status: "error" }).catch(() => {});
    }
  })();

  console.log(`[analytics] ${JSON.stringify({ event: "pilot_created", pilot_id: pilotId, tier: product.tier, product_code: product.product_code, reference_price: product.price_amount, country: p.client_country, estimated_cost: estimatedCost })}`);
  return NextResponse.json({
    ok: true, pilot_id: pilotId, job_id: job.id, tier: product.tier,
    product_code: product.product_code, reference_price: product.price_amount,
    estimated_cost_usd: estimatedCost, opportunity_target: product.entitlements.opportunity_target,
    report_url: `/results/${job.id}`, brief_url: `/results/${job.id}/brief`,
    status: "processing",
    note: "Complimentary managed pilot — full tier experience, quality gates active, no payment required.",
  }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) return NextResponse.json({ pilots: [], note: "Supabase not configured" });
  const { data } = await db.from("batch_jobs")
    .select("id, plan, status, customer_email, created_at, completed_at, onboarding")
    .order("created_at", { ascending: false }).limit(100);
  const pilots = (data ?? [])
    .filter((j) => (j.onboarding as { pilot?: unknown })?.pilot)
    .map((j) => {
      const ob = j.onboarding as OnboardingData & { pilot: Record<string, unknown> };
      return {
        pilot_id: ob.pilot.pilot_id, job_id: j.id, status: j.status,
        client_name: ob.pilot.client_name, client_company: ob.pilot.client_company,
        client_country: ob.pilot.client_country, client_email: j.customer_email,
        product_code: ob.product_code, reference_price: ob.pilot.reference_price,
        estimated_cost_usd: ob.pilot.estimated_cost_usd,
        complimentary_reason: ob.pilot.complimentary_reason,
        language: ob.output_language, created_at: j.created_at, completed_at: j.completed_at,
        report_url: `/results/${j.id}`, brief_url: `/results/${j.id}/brief`,
      };
    });
  return NextResponse.json({ pilots });
}
