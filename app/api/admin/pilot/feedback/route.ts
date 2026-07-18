import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

// ─── Tier-level pilot debrief feedback (038) ─────────────────────────────────
// Admin-mediated capture during the client debrief. Account-level feedback
// keeps using /api/feedback/opportunity; this stores the TIER-level answers
// (perceived value, WTP, decision impact). Requires migration 038; fails with
// an honest hint when missing.

const schema = z.object({
  pilot_job_id: z.string().min(3).max(80),
  pilot_id: z.string().max(80).optional(),
  product_code: z.string().min(3).max(60),
  tier: z.string().min(3).max(30),
  reference_price: z.number().nonnegative().optional(),
  usefulness: z.number().int().min(1).max(5).optional(),
  actionability: z.number().int().min(1).max(5).optional(),
  evidence_trust: z.number().int().min(1).max(5).optional(),
  perceived_value_usd: z.number().nonnegative().optional(),
  would_pay: z.boolean().optional(),
  decision_changed: z.boolean().optional(),
  accounts_would_work: z.number().int().min(0).max(50).optional(),
  best_section: z.string().max(200).optional(),
  confusing_section: z.string().max(200).optional(),
  missing_expected: z.string().max(400).optional(),
  upgrade_interest: z.boolean().optional(),
  monitoring_interest: z.boolean().optional(),
  comments: z.string().max(1500).optional(),
});

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { error } = await db.from("tier_feedback").insert(parsed.data);
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message);
    return NextResponse.json({ error: missing ? "Migration 038 not applied — run supabase/migrations/038_pilot_feedback.sql" : error.message.slice(0, 140) }, { status: missing ? 503 : 400 });
  }
  console.log(`[analytics] ${JSON.stringify({ event: "willingness_to_pay_submitted", tier: parsed.data.tier, product_code: parsed.data.product_code, would_pay: parsed.data.would_pay ?? null, pilot_id: parsed.data.pilot_id ?? null })}`);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) return NextResponse.json({ feedback: [] });
  const { data, error } = await db.from("tier_feedback").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ feedback: [], note: /relation|does not exist/i.test(error.message) ? "Migration 038 pending" : error.message.slice(0, 100) });
  return NextResponse.json({ feedback: data ?? [] });
}
