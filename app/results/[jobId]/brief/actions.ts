"use server";
// Server Action boundary for the Institutional Brief. Real tenant ownership
// for LINKED reports (search_id → lead_searches.user_id): only the owner (a
// viewer whose verified token matches) may open them. UNLINKED legacy reports
// (no search_id) keep link-access for backward compatibility. Assembly happens
// here — the browser never receives raw report_json. Not an API route.

import { getSnapshot } from "@/lib/storage/snapshot-store";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import type { InstitutionalOpportunityReportV1 } from "@/lib/reports/institutional-report-types";

export type BriefResult =
  | { state: "ok"; report: InstitutionalOpportunityReportV1 }
  | { state: "unavailable" }        // missing / non-completed — never confirms existence
  | { state: "processing" }
  | { state: "forbidden" }          // linked report, viewer is not the owner
  | { state: "signin_required" };   // linked report, no valid session

async function serverDb() {
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function getBriefForViewer(jobId: string, accessToken: string | null): Promise<BriefResult> {
  if (!jobId || typeof jobId !== "string") return { state: "unavailable" };

  const snapshot = await getSnapshot(jobId);
  if (!snapshot) return { state: "unavailable" };
  if (snapshot.status === "processing") return { state: "processing" };
  if (snapshot.status !== "completed") return { state: "unavailable" };

  const searchId = (snapshot as { search_id?: string | null }).search_id ?? null;

  // Linked report → real ownership check.
  if (searchId) {
    const db = await serverDb();
    if (!db) return { state: "unavailable" };
    const { data: search } = await db.from("lead_searches").select("user_id").eq("id", searchId).maybeSingle();
    const ownerId = search?.user_id ?? null;
    if (ownerId) {
      if (!accessToken) return { state: "signin_required" };
      const { data: { user }, error } = await db.auth.getUser(accessToken);
      if (error || !user) return { state: "signin_required" };
      if (user.id !== ownerId) return { state: "forbidden" };
    }
    // ownerId null (orphaned search) → fall through to link-access
  }
  // Unlinked (legacy) → link-access, unchanged.

  const report = assembleInstitutionalReport(snapshot.report_json as Record<string, unknown>, {
    job_id: snapshot.job_id,
    plan: snapshot.plan ?? null,
    search_id: searchId,
    customer_ref: null,
    created_at: snapshot.created_at,
  });
  return { state: "ok", report };
}
