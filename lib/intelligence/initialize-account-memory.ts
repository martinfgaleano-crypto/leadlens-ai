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
}): Promise<{ persisted: number }> {
  const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
  const { resolveReportExperience } = await import("@/lib/products/report-experience");
  const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
  const { SupabaseAccountMemoryRepo, rowsForReview } = await import("@/lib/deliverable/account-memory-store");

  const institutional = assembleInstitutionalReport(input.report as unknown as Record<string, unknown>, {
    job_id: input.runId,
    plan: input.report.plan,
    search_id: null,
    customer_ref: null,
    created_at: input.report.created_at,
  });
  const outputLanguage = (input.report as LeadLensReport & { onboarding?: { output_language?: string } }).onboarding?.output_language;
  const experience = resolveReportExperience(input.report.plan, outputLanguage === "es" ? "es" : "en");
  const vm = fromInstitutionalReport(institutional, experience);
  const rows = rowsForReview(
    vm.accounts,
    { ownerUserId: input.userId, clientKey: input.runId },
    {
      reviewId: input.runId,
      reviewedAt: input.report.created_at ?? new Date().toISOString(),
      contextVersion: `${input.contextRef.contextId}:v${input.contextRef.version}`,
    },
  );
  await new SupabaseAccountMemoryRepo(db).persist(rows);
  return { persisted: rows.length };
}
