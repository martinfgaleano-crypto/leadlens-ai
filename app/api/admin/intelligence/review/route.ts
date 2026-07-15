import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

// GET  /api/admin/intelligence/review                → prioritized review queue
// POST /api/admin/intelligence/review                → submit a human gold label
// Blocked honestly until migration 032 is applied.

const HUMAN_LABELS = ["strong", "viable", "weak", "discard", "insufficient_information", "abstain"] as const;

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  const { data, error } = await db.from("ml_training_examples")
    .select("id, example_key, company_key_hash, job_id, feature_snapshot, baseline_meta, label_status, aggregated_label, provenance, review_priority_score, review_priority_reason, demo_only, created_at")
    .eq("demo_only", false)
    .in("label_status", ["unlabeled", "weak", "conflict"])
    .order("review_priority_score", { ascending: false, nullsFirst: false })
    .limit(30);
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ migration_missing: true, message: "Migration 032 not applied — ML tables unavailable." });
    }
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const exampleId = typeof body?.example_id === "string" ? body.example_id : null;
  const humanLabel = HUMAN_LABELS.includes(body?.label) ? body.label as (typeof HUMAN_LABELS)[number] : null;
  const reasons = Array.isArray(body?.reason_codes) ? body.reason_codes.slice(0, 6).map(String) : [];
  if (!exampleId || !humanLabel) return NextResponse.json({ error: "example_id and label (strong|viable|weak|discard|insufficient_information|abstain) required" }, { status: 400 });
  if (humanLabel !== "abstain" && humanLabel !== "insufficient_information" && reasons.length === 0) {
    return NextResponse.json({ error: "reason_codes required for a gold label" }, { status: 400 });
  }

  const binary = humanLabel === "strong" || humanLabel === "viable" ? 1 : humanLabel === "weak" || humanLabel === "discard" ? 0 : null;
  const { error: labelErr } = await db.from("ml_labels").insert({
    training_example_id: exampleId,
    source_type: "human_reviewer",
    label: binary,
    confidence: humanLabel === "strong" || humanLabel === "discard" ? 0.95 : 0.75,
    reason_codes: reasons,
    labeler_id: "human:admin",
    labeler_version: "1",
    abstained: binary === null,
    metadata: { quality_label: humanLabel },
  });
  if (labelErr) {
    if (/relation|does not exist|schema cache/i.test(labelErr.message)) {
      return NextResponse.json({ migration_missing: true, message: "Migration 032 not applied." }, { status: 503 });
    }
    return NextResponse.json({ error: "Label insert failed." }, { status: 500 });
  }
  await db.from("ml_training_examples").update({
    label_status: binary === null ? "abstain" : "gold",
    aggregated_label: binary,
    provenance: binary === null ? undefined : "human_gold",
    updated_at: new Date().toISOString(),
  }).eq("id", exampleId);
  return NextResponse.json({ ok: true, example_id: exampleId, label: humanLabel, gold: binary !== null });
}
