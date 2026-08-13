import type { LeadLensReport } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function hasUsableOpportunity(report: LeadLensReport): boolean {
  if (report.delivery_readiness?.status === "blocked") return false;
  const actions = report.actionability_summary;
  if (actions) return actions.act_now + actions.validate_first + actions.monitor > 0;
  return report.processed_leads.some(lead => lead.qualification.fit_score >= 4);
}

export async function recordFirstUsableOpportunity(input: {
  db: SupabaseClient; userId: string; report: LeadLensReport; productCode?: string | null; locale?: string | null;
}): Promise<"recorded" | "already_recorded" | "not_usable" | "failed"> {
  if (!hasUsableOpportunity(input.report)) return "not_usable";
  const row = {
    user_id: input.userId, event_name: "first_usable_opportunity_delivered",
    object_type: "job", object_id: input.report.job_id,
    product_code: input.productCode ?? null, locale: input.locale ?? null,
    metadata: { opportunity_count: input.report.processed_leads.length },
  };
  const { data, error } = await input.db.from("customer_lifecycle_events")
    .upsert(row, { onConflict: "user_id,event_name,object_type,object_id", ignoreDuplicates: true })
    .select("id");
  if (error) return "failed";
  return data?.length ? "recorded" : "already_recorded";
}
