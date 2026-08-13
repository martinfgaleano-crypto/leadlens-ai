import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { resolveProduct } from "@/lib/products/catalog";
import { safeCustomerReturnPath } from "@/lib/commercial/customer-flow";
import { checkRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  product_code: z.string().max(60),
  source_cta: z.string().max(80).nullable().optional(),
  locale: z.enum(["en", "es", "pt", "ja"]).default("en"),
  return_to: z.string().max(300).optional(),
}).strict();

async function authenticated(req: NextRequest) {
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7)
    : null;
  const db = createServerClient();
  if (!token || !db) return null;
  const { data: { user }, error } = await db.auth.getUser(token);
  return error || !user ? null : { db, user };
}

export async function POST(req: NextRequest) {
  const auth = await authenticated(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(`commercial-intent:${auth.user.id}`, 12, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commercial intent." }, { status: 400 });
  const product = resolveProduct(parsed.data.product_code);
  if (!product) return NextResponse.json({ error: "Unknown product." }, { status: 400 });

  const { data, error } = await auth.db.from("commercial_intents").insert({
    user_id: auth.user.id,
    product_code: product.product_code,
    catalog_version: "launch_tier_architecture_v0",
    source_cta: parsed.data.source_cta ?? null,
    locale: parsed.data.locale,
    return_to: safeCustomerReturnPath(parsed.data.return_to),
    status: "captured",
  }).select("id, product_code, status, created_at").single();
  if (error) return NextResponse.json({ error: "Commercial intent could not be saved." }, { status: 503 });
  return NextResponse.json({ intent: data }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await authenticated(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await auth.db.from("commercial_intents")
    .select("id, product_code, source_cta, locale, return_to, status, created_at, updated_at")
    .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: "Commercial intents unavailable." }, { status: 503 });
  return NextResponse.json({ intents: data ?? [] });
}
