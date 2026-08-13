import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { normalizeCommercialContext } from "@/lib/commercial/commercial-context";
import { resolveProduct } from "@/lib/products/catalog";
import { checkRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  commercial_intent_id: z.string().uuid().optional(),
  company_name: z.string().trim().min(2).max(160),
  offering: z.string().trim().min(5).max(1500),
  target_customer: z.string().trim().min(5).max(1500),
  target_countries: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  commercial_objective: z.string().trim().min(5).max(1000),
  delivery_email: z.string().email().max(254),
  locale: z.enum(["en", "es", "pt", "ja"]).default("en"),
}).strict();

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7)
    : null;
  const db = createServerClient();
  if (!token || !db) return null;
  const { data: { user }, error } = await db.auth.getUser(token);
  return error || !user ? null : { db, user };
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await auth.db.from("onboarding_requests")
    .select("id, company_name, what_you_sell, ideal_customer, target_countries, commercial_objective, delivery_email, product_code, locale, status, commercial_intent_id, created_at, updated_at")
    .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Onboarding context unavailable." }, { status: 503 });
  return NextResponse.json({ onboarding: data ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(`customer-onboarding:${auth.user.id}`, 8, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Complete the six required onboarding fields." }, { status: 400 });

  let productCode: string | null = null;
  let claimedIntent = false;
  if (parsed.data.commercial_intent_id) {
    const { data: intent } = await auth.db.from("commercial_intents")
      .select("id, product_code, status, onboarding_id").eq("id", parsed.data.commercial_intent_id)
      .eq("user_id", auth.user.id).maybeSingle();
    if (!intent || !resolveProduct(intent.product_code)) {
      return NextResponse.json({ error: "Commercial intent not found." }, { status: 404 });
    }
    productCode = intent.product_code;
    if (intent.onboarding_id) {
      const { data: existing } = await auth.db.from("onboarding_requests")
        .select("id, commercial_intent_id, product_code, target_countries, status, created_at")
        .eq("id", intent.onboarding_id).eq("user_id", auth.user.id).maybeSingle();
      if (existing) return NextResponse.json({ onboarding: existing, idempotent: true }, { status: 200 });
    }
    if (intent.status !== "captured") {
      return NextResponse.json({ error: "Onboarding is already in progress." }, { status: 409 });
    }
    const { data: claimed, error: claimError } = await auth.db.from("commercial_intents")
      .update({ status: "onboarding_started" }).eq("id", intent.id)
      .eq("user_id", auth.user.id).eq("status", "captured").select("id");
    if (claimError || claimed?.length !== 1) {
      return NextResponse.json({ error: "Onboarding is already in progress." }, { status: 409 });
    }
    claimedIntent = true;
  }

  const normalized = normalizeCommercialContext({
    company_description: parsed.data.offering,
    offer: parsed.data.offering,
    buyer: parsed.data.target_customer,
    target_countries: parsed.data.target_countries,
    commercial_goal: parsed.data.commercial_objective,
  });
  if (!normalized.target_countries.length) return NextResponse.json({ error: "Select at least one target country." }, { status: 400 });

  const { error: profileBootstrapError } = await auth.db.from("profiles").upsert({
    id: auth.user.id,
    email: auth.user.email ?? parsed.data.delivery_email,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (profileBootstrapError) {
    if (claimedIntent) await auth.db.from("commercial_intents").update({ status: "captured" })
      .eq("id", parsed.data.commercial_intent_id!).eq("user_id", auth.user.id).eq("status", "onboarding_started");
    return NextResponse.json({ error: "Customer profile could not be prepared." }, { status: 503 });
  }

  const { data: row, error } = await auth.db.from("onboarding_requests").insert({
    user_id: auth.user.id,
    full_name: String(auth.user.user_metadata?.full_name || auth.user.email || "Authenticated customer").slice(0, 200),
    email: auth.user.email ?? parsed.data.delivery_email,
    company_name: parsed.data.company_name,
    what_you_sell: normalized.offer,
    ideal_customer: normalized.buyer,
    target_countries: normalized.target_countries,
    commercial_objective: normalized.commercial_goal,
    delivery_email: parsed.data.delivery_email,
    country: normalized.target_countries[0],
    target_industries: [], target_job_titles: [],
    plan: resolveProduct(productCode)?.legacy_plan ?? "starter",
    product_code: productCode,
    locale: parsed.data.locale,
    commercial_intent_id: parsed.data.commercial_intent_id ?? null,
    status: "pending",
  }).select("id, commercial_intent_id, product_code, target_countries, status, created_at").single();
  if (error) {
    if (claimedIntent) await auth.db.from("commercial_intents").update({ status: "captured" })
      .eq("id", parsed.data.commercial_intent_id!).eq("user_id", auth.user.id).eq("status", "onboarding_started");
    return NextResponse.json({ error: "Onboarding context could not be saved." }, { status: 503 });
  }

  if (row.commercial_intent_id) {
    const { error: transitionError } = await auth.db.from("commercial_intents").update({
      onboarding_id: row.id, status: "onboarding_completed",
    }).eq("id", row.commercial_intent_id).eq("user_id", auth.user.id).eq("status", "onboarding_started");
    if (transitionError) return NextResponse.json({ error: "Onboarding saved, but intent transition failed." }, { status: 409 });
  }
  const { error: profileError } = await auth.db.from("profiles").update({ onboarding_completed: true }).eq("id", auth.user.id);
  if (profileError) return NextResponse.json({ error: "Onboarding saved, but profile activation failed." }, { status: 409 });
  const { error: lifecycleError } = await auth.db.from("customer_lifecycle_events").upsert({
    user_id: auth.user.id,
    event_name: "onboarding_completed",
    object_type: "onboarding",
    object_id: row.id,
    product_code: row.product_code,
    locale: parsed.data.locale,
    metadata: {},
  }, { onConflict: "user_id,event_name,object_type,object_id", ignoreDuplicates: true });
  if (lifecycleError) console.error("[analytics] onboarding_completed ledger write failed");
  console.log(`[analytics] ${JSON.stringify({ event: "onboarding_completed", user_id: auth.user.id, onboarding_id: row.id, product_code: row.product_code, ts: new Date().toISOString() })}`);
  return NextResponse.json({ onboarding: row }, { status: 201 });
}
