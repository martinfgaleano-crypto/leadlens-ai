import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ── POST /api/monitor/[id]/setup ──────────────────────────────────────────────
// Self-serve monitor setup completion. Dashboard-created searches have no
// business context (onboarding_requests linkage), so monitor runs 422 on them.
// This route lets the OWNER provide that context and completes setup by
// creating the onboarding_request linked to the search.
//
// Guards: Bearer JWT → ownership (foreign/unknown = 404) → already-complete = 409.
// No fake data: the customer writes their own business context.

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const uuidSchema = z.string().uuid();

const bodySchema = z.object({
  company_name: z.string().min(1).max(200),
  what_you_sell: z.string().min(10).max(2000),
  ideal_customer: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid monitor ID." }, { status: 400 });
  }
  const searchId = params.id;

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  // Ownership before anything else.
  const { data: search } = await db
    .from("lead_searches")
    .select("id, icp_id")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();

  if (!search) {
    return NextResponse.json({ error: "Monitor not found." }, { status: 404 });
  }

  // Already complete?
  const { count: existing } = await db
    .from("onboarding_requests")
    .select("id", { count: "exact", head: true })
    .eq("search_id", searchId);

  if ((existing ?? 0) > 0) {
    return NextResponse.json({ error: "Setup is already complete for this monitor." }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide your company name and a short description of what you sell (at least 10 characters)." },
      { status: 400 },
    );
  }

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, email, plan")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? profile?.email ?? "";
  if (!email) {
    return NextResponse.json({ error: "Your account has no email — contact support." }, { status: 422 });
  }

  const { error: insertErr } = await db.from("onboarding_requests").insert({
    full_name:     profile?.full_name ?? email,
    email,
    company_name:  parsed.data.company_name.trim(),
    what_you_sell: parsed.data.what_you_sell.trim(),
    ideal_customer: parsed.data.ideal_customer?.trim() || null,
    plan:          profile?.plan ?? "starter",
    status:        "new",
    user_id:       user.id,
    icp_id:        search.icp_id ?? null,
    search_id:     searchId,
  });

  if (insertErr) {
    console.error("[monitor/setup] insert failed:", insertErr.message);
    return NextResponse.json({ error: "Setup could not be saved. Please try again." }, { status: 500 });
  }

  console.log(`[monitor/setup] setup_completed search=${searchId}`);
  return NextResponse.json({ success: true, search_id: searchId, message: "Setup complete — you can now run this monitor." }, { status: 201 });
}
