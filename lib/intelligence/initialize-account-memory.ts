import type { LeadLensReport } from "@/types";

/** Persist the accepted baseline Case set immediately after a productive run.
 * This makes the first customer Monitor action possible without requiring the
 * institutional brief to be opened as a hidden write side effect. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeProductiveAccountMemory(db: any, input: {
  report: LeadLensReport;
  runId: string;
  userId: string;
  contextRef: { contextId: string; version: number };
  /** Durable customer search scope (stable across runs), when the run is search-linked.
   *  Aligns this seed with the brief's Monitor scope so predecessors resolve cross-run. */
  searchId?: string | null;
}): Promise<{ persisted: number }> {
  const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
  const { resolveReportExperience } = await import("@/lib/products/report-experience");
  const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
  const { SupabaseAccountMemoryRepo, rowsForReview } = await import("@/lib/deliverable/account-memory-store");
  const { canonicalClientKey } = await import("@/lib/deliverable/account-memory");

  const institutional = assembleInstitutionalReport(input.report as unknown as Record<string, unknown>, {
    job_id: input.runId,
    plan: input.report.plan,
    search_id: input.searchId ?? null,
    customer_ref: null,
    created_at: input.report.created_at,
  });
  const onboarding = (input.report as LeadLensReport & { onboarding?: { output_language?: string; product_code?: string } }).onboarding;
  const experience = resolveReportExperience(onboarding?.product_code ?? input.report.plan, onboarding?.output_language === "es" ? "es" : "en");
  const vm = fromInstitutionalReport(institutional, experience);
  // Persist under the SAME canonical scope + contextVersion convention the customer
  // brief uses (persistAndLoadMemory), so this run-completion seed and a later brief
  // view converge on ONE logical review scope — a run-derived clientKey collapses to
  // the logical context (§A3/§A4), rather than orphaning the seed under a per-run key.
  const contextVersion = onboarding?.product_code ?? input.report.plan ?? "default";
  const clientKey = input.searchId ?? vm.meta.client ?? input.runId;
  const rows = rowsForReview(
    vm.accounts,
    { ownerUserId: input.userId, clientKey: canonicalClientKey(clientKey, contextVersion) },
    {
      reviewId: input.runId,
      reviewedAt: input.report.created_at ?? new Date().toISOString(),
      contextVersion,
    },
  );
  await new SupabaseAccountMemoryRepo(db).persist(rows);
  return { persisted: rows.length };
}
