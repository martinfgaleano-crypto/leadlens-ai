import { NextResponse } from "next/server";

/**
 * GET /api/provider-status
 * Returns a JSON diagnostic of which providers are configured.
 * Safe to call publicly — only exposes booleans, never actual key values.
 */
export async function GET() {
  const demo_mode = process.env.DEMO_MODE === "true";

  const anthropic_configured = !!process.env.ANTHROPIC_API_KEY;
  const apollo_configured = !!process.env.APOLLO_API_KEY;
  const people_data_labs_configured = !!process.env.PEOPLE_DATA_LABS_API_KEY;
  const tavily_configured = !!process.env.TAVILY_API_KEY;
  const hunter_configured = !!process.env.HUNTER_API_KEY;
  const stripe_key_configured = !!process.env.STRIPE_SECRET_KEY;
  const stripe_webhook_configured = !!process.env.STRIPE_WEBHOOK_SECRET;
  const stripe_prices_configured =
    !!process.env.STRIPE_PRICE_STARTER ||
    !!process.env.STRIPE_PRICE_STANDARD ||
    !!process.env.STRIPE_PRICE_PRO;
  const stripe_configured =
    stripe_key_configured && stripe_webhook_configured && !!process.env.STRIPE_PRICE_STARTER;
  // Checkout sessions can be created with inline price_data — only needs secret key
  const ready_for_checkout = stripe_key_configured;
  const supabase_configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const resend_configured = !!process.env.RESEND_API_KEY;
  const multilingual_supported = true;
  const supported_languages = ["en", "es", "pt", "ja"];
  const supported_regions = ["north_america", "latin_america", "europe", "asia", "global"];

  const allow_mock_leads_with_real_ai =
    process.env.ALLOW_MOCK_LEADS_WITH_REAL_AI === "true";

  const has_lead_provider =
    apollo_configured || people_data_labs_configured || tavily_configured;

  // ready_for_mock_demo: full pipeline with zero external APIs
  const ready_for_mock_demo = demo_mode;

  // ready_for_ai_test: Claude agents + mock leads (no real lead provider needed)
  const ready_for_ai_test =
    !demo_mode && anthropic_configured && allow_mock_leads_with_real_ai;

  // ready_for_real_lead_search: Claude + at least one real lead provider
  const ready_for_real_lead_search =
    !demo_mode && anthropic_configured && has_lead_provider;

  const ready_for_payment = stripe_configured;
  const ready_for_storage = supabase_configured;
  const ready_for_delivery = resend_configured;
  const ready_for_paid_beta =
    anthropic_configured &&
    allow_mock_leads_with_real_ai &&
    stripe_key_configured &&
    stripe_webhook_configured;

  // What's blocking a real production run
  const missing_required_for_real_run: string[] = [];
  if (!anthropic_configured)
    missing_required_for_real_run.push(
      "ANTHROPIC_API_KEY — required for ICP analysis and outreach generation"
    );
  if (!has_lead_provider)
    missing_required_for_real_run.push(
      "Lead provider key — add APOLLO_API_KEY, PEOPLE_DATA_LABS_API_KEY, or TAVILY_API_KEY"
    );
  if (!stripe_key_configured)
    missing_required_for_real_run.push(
      "STRIPE_SECRET_KEY — required to create checkout sessions"
    );
  else if (!stripe_webhook_configured)
    missing_required_for_real_run.push(
      "STRIPE_WEBHOOK_SECRET — required to confirm payments via webhook"
    );
  if (!supabase_configured)
    missing_required_for_real_run.push(
      "Supabase keys — required for job persistence and async delivery"
    );

  const missing_required_for_paid_beta: string[] = [];
  if (!anthropic_configured)
    missing_required_for_paid_beta.push("ANTHROPIC_API_KEY");
  if (!stripe_key_configured)
    missing_required_for_paid_beta.push("STRIPE_SECRET_KEY — required to create checkout sessions");
  else if (!stripe_webhook_configured)
    missing_required_for_paid_beta.push("STRIPE_WEBHOOK_SECRET — required to confirm payments");
  if (!allow_mock_leads_with_real_ai && !has_lead_provider)
    missing_required_for_paid_beta.push("Set ALLOW_MOCK_LEADS_WITH_REAL_AI=true or add a lead provider key");

  const next_steps: string[] = [];
  if (demo_mode) {
    next_steps.push(
      "DEMO_MODE is active — the full pipeline runs with mock data. No external APIs needed."
    );
    if (!anthropic_configured)
      next_steps.push(
        "Step 1: Add ANTHROPIC_API_KEY and set ALLOW_MOCK_LEADS_WITH_REAL_AI=true to test Claude agents with mock leads"
      );
    else if (allow_mock_leads_with_real_ai)
      next_steps.push(
        "ANTHROPIC_API_KEY is set. Set DEMO_MODE=false to activate hybrid test mode (Claude agents + mock leads)"
      );
    if (!has_lead_provider)
      next_steps.push(
        "Step 2: Add APOLLO_API_KEY (recommended) or PEOPLE_DATA_LABS_API_KEY to switch to real lead search"
      );
    if (!hunter_configured)
      next_steps.push(
        "Step 3 (optional): Add HUNTER_API_KEY to improve email verification coverage"
      );
  } else if (ready_for_ai_test) {
    next_steps.push(
      "Hybrid mode active — using Claude agents with mock leads. Run POST /api/demo to test AI output quality."
    );
    next_steps.push(
      "When satisfied, add APOLLO_API_KEY (or similar) and remove ALLOW_MOCK_LEADS_WITH_REAL_AI to go fully real."
    );
  } else if (ready_for_real_lead_search) {
    next_steps.push(
      "System is configured for real lead search. Run POST /api/demo or /api/process to test end-to-end."
    );
  } else {
    next_steps.push(
      "Set DEMO_MODE=true to run with mock data, or add ANTHROPIC_API_KEY + a lead provider key for real searches"
    );
  }

  return NextResponse.json({
    demo_mode,
    anthropic_configured,
    apollo_configured,
    people_data_labs_configured,
    tavily_configured,
    hunter_configured,
    stripe_key_configured,
    stripe_webhook_configured,
    stripe_prices_configured,
    stripe_configured,
    supabase_configured,
    resend_configured,
    allow_mock_leads_with_real_ai,
    multilingual_supported,
    supported_languages,
    supported_regions,
    ready_for_mock_demo,
    ready_for_ai_test,
    ready_for_real_lead_search,
    ready_for_checkout,
    ready_for_payment,
    ready_for_storage,
    ready_for_delivery,
    ready_for_paid_beta,
    missing_required_for_real_run,
    missing_required_for_paid_beta,
    next_steps,
    timestamp: new Date().toISOString(),
  });
}
