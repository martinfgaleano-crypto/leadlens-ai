import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { buildReviewSample, resultKey } from "@/lib/sources/review-sample";

// GET  → balanced ~20-row review sample + existing verdicts + agreement stats
// POST → persist one admin verdict (upsert by result_key)
async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const AXES = ["company_match", "relevant", "date_valid", "grounded_claim", "valid_signal", "qualified_opportunity", "insufficient_evidence"] as const;

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const sample = buildReviewSample(20);

  const db = await getDb();
  let verdicts: Record<string, unknown>[] = [];
  let migrationMissing = false;
  if (db && sample.items.length > 0) {
    const { data, error } = await db.from("source_benchmark_reviews")
      .select("result_key, company_match, relevant, date_valid, grounded_claim, valid_signal, qualified_opportunity, insufficient_evidence, reason_codes, note, auto_flags")
      .in("result_key", sample.items.map((i) => i.result_key));
    if (error && /relation|does not exist|schema cache/i.test(error.message)) migrationMissing = true;
    else verdicts = data ?? [];
  }

  // Agreement: only over reviewed rows, per axis where a human verdict exists.
  const byKey = new Map(verdicts.map((v) => [v.result_key as string, v]));
  let agreementTotal = 0, agreementMatch = 0;
  for (const item of sample.items) {
    const v = byKey.get(item.result_key);
    if (!v) continue;
    const autoQualified = (item.auto_flags as Record<string, boolean>).qualified_opportunity;
    if (typeof v.qualified_opportunity === "boolean") {
      agreementTotal++;
      if (v.qualified_opportunity === autoQualified) agreementMatch++;
    }
  }
  const reviewedCount = sample.items.filter((i) => byKey.has(i.result_key)).length;

  return NextResponse.json({
    sample: sample.items,
    verdicts,
    total_available: sample.total_available,
    migration_missing: migrationMissing,
    calibration: {
      reviewed: reviewedCount,
      of: sample.items.length,
      qualified_agreement: agreementTotal >= 5 ? Number((agreementMatch / agreementTotal).toFixed(2)) : null,
      note: agreementTotal < 5 ? "insufficient reviews for calibrated accuracy (need ≥5)" : "auto vs human agreement on qualified flag",
    },
    banner: "Auto-flags are heuristics pending human review — not calibrated accuracy until enough verdicts exist.",
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.canonical_url || !body?.query_id) {
    return NextResponse.json({ error: "canonical_url and query_id required" }, { status: 400 });
  }
  const key = resultKey({ canonical_url: body.canonical_url, query_id: body.query_id });
  const row: Record<string, unknown> = {
    result_key: key, query_id: body.query_id, region: body.region ?? null,
    provider: body.provider ?? null, canonical_url: body.canonical_url,
    auto_flags: body.auto_flags ?? null,
    reason_codes: Array.isArray(body.reason_codes) ? body.reason_codes.slice(0, 8).map(String) : [],
    note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    updated_at: new Date().toISOString(),
  };
  for (const axis of AXES) if (typeof body[axis] === "boolean") row[axis] = body[axis];

  const { error } = await db.from("source_benchmark_reviews").upsert(row, { onConflict: "result_key" });
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ migration_missing: true, message: "Migration 033 not applied." }, { status: 503 });
    }
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result_key: key });
}
