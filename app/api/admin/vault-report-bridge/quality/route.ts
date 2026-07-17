import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { requireAdmin } from "@/lib/auth/require-admin";

// GET /api/admin/vault-report-bridge/quality — discovery-quality panel data:
// latest high-precision benchmark funnel, top rejection reasons, precision by
// provider/region (benchmark-only labels, never customer performance), and the
// latest clean (production-only) report status. Read-only.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let benchmark: Record<string, unknown> | null = null;
  try {
    const dir = join(process.cwd(), "ml/data/source-benchmark");
    const latest = readdirSync(dir).filter((f) => f.startsWith("precision-")).sort().pop();
    if (latest) {
      const p = JSON.parse(readFileSync(join(dir, latest), "utf8"));
      benchmark = {
        run: p.run, gates_version: p.gates_version, funnel: p.funnel,
        top_rejection_reasons: (p.top_rejection_reasons ?? []).slice(0, 6),
        precision: p.precision, by_provider: p.by_provider, by_region: p.by_region,
        by_signal_type: p.by_signal_type ?? null,
        v2_vs_v3: p.v2_vs_v3 ?? null,
        entity_class_distribution: p.entity_class_distribution ?? null,
        useful_yield: p.useful_yield ?? null,
        labels_note: p.labels_note,
      };
    }
  } catch { /* no benchmark yet */ }

  // Governance funnel: origin vs review status vs eligibility vs selection are
  // FOUR different things — production origin never implies eligibility.
  let eligibility: Record<string, unknown> | null = null;

  // Latest vault-bridge report + whether its signals were all production-eligible.
  let cleanReport: Record<string, unknown> | null = null;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createServerClient } = await import("@/lib/supabase/server");
      const db = createServerClient();
      if (!db) return NextResponse.json({ benchmark, eligibility: null, clean_report: null });
      const { data: sigs } = await db.from("vault_signals").select("data_origin, production_eligible, review_status");
      if (sigs) {
        const prod = sigs.filter((s) => s.data_origin === "production");
        eligibility = {
          total_signals: sigs.length,
          production_origin: prod.length,
          production_eligible: sigs.filter((s) => s.production_eligible === true).length,
          production_approved_coarse: prod.filter((s) => s.review_status === "approved").length,
          pending: prod.filter((s) => s.review_status === "pending_review").length,
          note: "origin ≠ review status ≠ eligibility ≠ selection: eligibility requires ALL governance gates (eligibility-v1)",
        };
      }
      const { data: job } = await db.from("snapshot_reports").select("job_id, status, plan, created_at")
        .like("job_id", "vault-%").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (job) {
        // Usage rows trace back via notes ("job <id>" — pipeline job ids are not UUIDs).
        const { data: usage } = await db.from("vault_usage_history").select("company_id").eq("notes", `job ${job.job_id}`).limit(100);
        const companyIds = Array.from(new Set((usage ?? []).map((u) => u.company_id).filter(Boolean)));
        let contamination: number | null = null;
        if (companyIds.length) {
          const { data: sigs, error } = await db.from("vault_signals").select("company_id, production_eligible").in("company_id", companyIds);
          if (!error) {
            const eligibleCompanies = new Set((sigs ?? []).filter((s) => s.production_eligible === true).map((s) => s.company_id));
            contamination = companyIds.filter((id) => !eligibleCompanies.has(id)).length;
          }
        }
        cleanReport = {
          job_id: job.job_id, status: job.status, created_at: job.created_at,
          companies_used: companyIds.length,
          non_production_companies: contamination,
          clean: contamination === 0 ? true : contamination === null ? null : false,
        };
      }
    }
  } catch { /* Supabase unavailable */ }

  return NextResponse.json({ benchmark, eligibility, clean_report: cleanReport });
}
