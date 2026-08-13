export type CustomerDashboardStage = "setup_required" | "researching" | "brief_ready" | "monitoring";

export interface CustomerDashboardView {
  stage: CustomerDashboardStage;
  primary_action: { label: string; href: string };
  latest_brief: { job_id: string; completed_at: string | null } | null;
  monitoring_count: number;
  message: string;
}

export function buildCustomerDashboardView(input: {
  onboarding_completed: boolean;
  monitors: Array<{ latest_report_job_id: string | null; latest_completed_at: string | null; has_processing_run: boolean; has_comparison: boolean }>;
}): CustomerDashboardView {
  const latest = input.monitors.find(m => m.latest_report_job_id) ?? null;
  const researching = input.monitors.some(m => m.has_processing_run);
  const monitoring = input.monitors.filter(m => m.has_comparison).length;
  if (!input.onboarding_completed) return { stage: "setup_required", primary_action: { label: "Complete your business context", href: "/onboarding" }, latest_brief: null, monitoring_count: monitoring, message: "Tell LeadLens what you sell, who should buy it, and where you want to grow." };
  if (researching) return { stage: "researching", primary_action: { label: "View research status", href: "/dashboard/searches" }, latest_brief: latest ? { job_id: latest.latest_report_job_id!, completed_at: latest.latest_completed_at } : null, monitoring_count: monitoring, message: "LeadLens is researching and validating account opportunities." };
  if (latest) return { stage: monitoring ? "monitoring" : "brief_ready", primary_action: { label: "Open latest Account Brief", href: `/results/${encodeURIComponent(latest.latest_report_job_id!)}/brief` }, latest_brief: { job_id: latest.latest_report_job_id!, completed_at: latest.latest_completed_at }, monitoring_count: monitoring, message: monitoring ? "Your latest brief and monitored account changes are ready." : "Your latest Account Brief is ready to review." };
  return { stage: "setup_required", primary_action: { label: "Start opportunity research", href: "/dashboard/searches" }, latest_brief: null, monitoring_count: monitoring, message: "Your context is ready. Start research when you are ready to build an Account Brief." };
}
