import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerClient } from "@/lib/supabase/server";
import { buildOperationalActivity } from "@/lib/admin/operational-activity";

// LIVE operational activity from canonical persisted tables (admin-only). force-dynamic so the panel
// always reflects current production state without a redeploy. Read-only; bounded projections only.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });

  const [runsRes, chargesRes, vaultRes] = await Promise.all([
    db.from("snapshot_reports").select("job_id,created_at").limit(5000),
    db.from("account_intelligence_charges").select("created_at,analysis_key").limit(20000),
    db.from("vault_companies").select("first_seen_at").limit(5000),
  ]);

  // Fail-visible (§28): never substitute a fabricated zero for an unavailable source.
  const errors = [runsRes.error && `runs:${runsRes.error.message}`, chargesRes.error && `charges:${chargesRes.error.message}`, vaultRes.error && `vault:${vaultRes.error.message}`].filter(Boolean);
  if (errors.length === 3) return NextResponse.json({ error: `Operational activity unavailable: ${errors.join("; ")}` }, { status: 503 });

  const activity = buildOperationalActivity({
    intelRuns: (runsRes.data ?? []) as never[],
    charges: (chargesRes.data ?? []) as never[],
    vault: (vaultRes.data ?? []) as never[],
  });
  return NextResponse.json({
    activity,
    sources: {
      intelligence_runs: runsRes.error ? { available: false, error: runsRes.error.message } : { available: true },
      delivered_evaluations: chargesRes.error ? { available: false, error: chargesRes.error.message } : { available: true },
      vault: vaultRes.error ? { available: false, error: vaultRes.error.message } : { available: true },
    },
    generated_at: activity.generated_at,
  });
}
