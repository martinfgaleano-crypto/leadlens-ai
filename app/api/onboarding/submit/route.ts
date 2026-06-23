import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      full_name, email, company_name, website, country, linkedin_url,
      what_you_sell, value_proposition, ideal_customer,
      target_countries, target_industries, target_company_sizes, target_job_titles,
      buyer_persona, exclusions,
      logo_url, brand_color, sender_name, sender_title, sender_email,
      credibility_statement, proof_point,
      delivery_email, notes,
      plan, lead_count,
    } = body;

    if (!full_name || !email || !company_name || !what_you_sell) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const emailNorm       = (email as string).trim().toLowerCase();
    const resolvedPlan    = (plan as string)   || "standard";
    const resolvedLeads   = Number(lead_count) || 50;
    const resolvedDelivery = ((delivery_email as string) || emailNorm).trim().toLowerCase();

    const client = createServerClient();
    if (!client) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

    // ── 1. Auth user: create new, or find existing on duplicate ───────────────
    let userId: string;
    let isNewUser = false;

    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: emailNorm,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name, company_name },
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("duplicate") || msg.includes("exists")) {
        // Find existing profile by email
        const { data: existing, error: lookupErr } = await client
          .from("profiles")
          .select("id")
          .eq("email", emailNorm)
          .maybeSingle();

        if (lookupErr || !existing) {
          return NextResponse.json(
            { error: "An account with this email already exists. Please contact us if you need help." },
            { status: 409 }
          );
        }
        userId = existing.id;
      } else {
        throw authError;
      }
    } else {
      userId    = authData.user.id;
      isNewUser = true;
    }

    // ── 2. Profile (new users only) ───────────────────────────────────────────
    if (isNewUser) {
      const { error: profileError } = await client.from("profiles").insert({
        id:                   userId,
        email:                emailNorm,
        full_name:            (full_name as string),
        role:                 "customer",
        plan:                 resolvedPlan,
        onboarding_completed: false,
      });
      if (profileError) throw profileError;
    }

    // ── 3. ICP ────────────────────────────────────────────────────────────────
    const icpNotes = [
      ideal_customer ? `Target customer: ${ideal_customer}` : "",
      buyer_persona  ? `Buyer persona: ${buyer_persona}`    : "",
      exclusions     ? `Exclusions: ${exclusions}`          : "",
    ].filter(Boolean).join("\n\n");

    const { data: icp, error: icpError } = await client
      .from("icps")
      .insert({
        user_id:           userId,
        name:              `${company_name} — Main ICP`,
        target_countries:  target_countries      || [],
        target_regions:    [],
        industries:        target_industries     || [],
        company_sizes:     target_company_sizes  || [],
        target_job_titles: target_job_titles     || [],
        keywords:          [],
        exclusions:        exclusions ? [exclusions as string] : [],
        priority:          1,
        notes:             icpNotes || null,
      })
      .select("id")
      .single();
    if (icpError) throw icpError;

    // ── 4. Lead search ────────────────────────────────────────────────────────
    const searchNotes = [
      what_you_sell       ? `Product/service: ${what_you_sell}`            : "",
      value_proposition   ? `Value proposition: ${value_proposition}`      : "",
      credibility_statement ? `Credibility: ${credibility_statement}`      : "",
      notes               ? `Customer notes: ${notes}`                     : "",
    ].filter(Boolean).join("\n\n");

    const { data: search, error: searchError } = await client
      .from("lead_searches")
      .insert({
        user_id:              userId,
        icp_id:               icp.id,
        name:                 `${company_name} — Initial Batch (${resolvedPlan})`,
        status:               "pending",
        requested_lead_count: resolvedLeads,
        countries:            target_countries  || [],
        industries:           target_industries || [],
        notes:                searchNotes || null,
        admin_notes:          null,
      })
      .select("id")
      .single();
    if (searchError) throw searchError;

    // ── 5. Onboarding request record ──────────────────────────────────────────
    const { data: onboarding, error: onboardingError } = await client
      .from("onboarding_requests")
      .insert({
        // Contact
        full_name:              (full_name    as string),
        email:                  emailNorm,
        company_name:           (company_name as string),
        website:                (website      as string) || null,
        country:                (country      as string) || null,
        linkedin_url:           (linkedin_url as string) || null,
        // Business
        what_you_sell:          (what_you_sell       as string),
        value_proposition:      (value_proposition   as string) || null,
        ideal_customer:         (ideal_customer      as string) || null,
        // Targeting
        target_countries:       target_countries      || [],
        target_industries:      target_industries     || [],
        target_company_sizes:   target_company_sizes  || [],
        target_job_titles:      target_job_titles     || [],
        buyer_persona:          (buyer_persona  as string) || null,
        exclusions:             (exclusions     as string) || null,
        // Brand
        logo_url:               (logo_url       as string) || null,
        brand_color:            (brand_color    as string) || null,
        sender_name:            (sender_name    as string) || null,
        sender_title:           (sender_title   as string) || null,
        sender_email:           (sender_email   as string) || null,
        credibility_statement:  (credibility_statement as string) || null,
        proof_point:            (proof_point    as string) || null,
        // Delivery
        delivery_email:         resolvedDelivery,
        notes:                  (notes as string) || null,
        // Plan
        plan:                   resolvedPlan,
        lead_count:             resolvedLeads,
        // Status
        status:                 "new",
        // Links
        user_id:                userId,
        icp_id:                 icp.id,
        search_id:              search.id,
      })
      .select("id")
      .single();
    if (onboardingError) throw onboardingError;

    return NextResponse.json({
      success:        true,
      request_id:     onboarding.id,
      search_id:      search.id,
      plan:           resolvedPlan,
      lead_count:     resolvedLeads,
      delivery_email: resolvedDelivery,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[onboarding/submit]", msg);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }
}
