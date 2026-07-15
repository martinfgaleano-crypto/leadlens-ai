import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { computeGrowthIndex } from "@/lib/intelligence/growth-index";

// GET /api/admin/intelligence/growth — Intelligence Growth Index + maturity +
// ML registry summary. Real counts only; insufficient evidence stays labeled.
async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const growth = await computeGrowthIndex();
  const db = await getDb();
  let models: unknown[] = [], datasets: unknown[] = [], predictions = 0, mlStatus = "blocked_by_migration_032";
  if (db) {
    const { data: m, error } = await db.from("ml_models").select("model_name, model_version, algorithm, status, dataset_version, artifact_checksum, metrics, demo_only, created_at").order("created_at", { ascending: false }).limit(20);
    if (!error) {
      mlStatus = "available";
      models = m ?? [];
      const { data: d } = await db.from("ml_dataset_versions").select("dataset_version, status, counts, demo_only, created_at").order("created_at", { ascending: false }).limit(10);
      datasets = d ?? [];
      const { count } = await db.from("ml_predictions").select("id", { count: "exact" }).limit(1);
      predictions = count ?? 0;
    }
  }
  // Source validation benchmark (local artifact — honest absence in prod).
  let sourceValidation: unknown = { status: "insufficient_sample", note: "Benchmark not run in this environment." };
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    if (existsSync("ml/data/source-benchmark/latest.json")) {
      const s = JSON.parse(readFileSync("ml/data/source-benchmark/latest.json", "utf8")).summary;
      sourceValidation = {
        ran_at: s.ran_at, queries: s.queries,
        regional_coverage: Object.keys(s.by_region ?? {}),
        resolved_date_rate: s.overall?.resolved_date_rate ?? null,
        extraction_success_rate: s.overall?.extraction_success_rate ?? null,
        valid_signal_yield: s.overall?.valid_signal_yield ?? null,
        qualified_opportunity_yield: s.overall?.qualified_opportunity_yield ?? null,
        estimated_cost_usd: s.cost_estimates_usd?.total ?? null,
        note: "auto-assessed sample — no customer performance evidence",
      };
    }
  } catch { /* honest default */ }

  return NextResponse.json({ growth, ml: { status: mlStatus, models, datasets, shadow_predictions: predictions }, source_validation: sourceValidation });
}
