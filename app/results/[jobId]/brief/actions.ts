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

  // Reproducible persistence (best-effort; requires migration 035). Upsert per
  // (job_id, schema_version) with a checksum over the stable parts — the
  // assembler is pure over an immutable snapshot, so re-assembly is identical.
  try {
    const db = await serverDb();
    if (db) {
      const { createHash } = await import("node:crypto");
      const stable = { ...report, metadata: { ...report.metadata, assembled_at: "-" } };
      const checksum = createHash("sha256").update(JSON.stringify(stable)).digest("hex");
      await db.from("institutional_report_snapshots").upsert({
        job_id: report.metadata.job_id,
        schema_version: report.schema_version,
        report: report as unknown as Record<string, unknown>,
        checksum,
        source_versions: report.metadata.source_versions,
      }, { onConflict: "job_id,schema_version" });
    }
  } catch { /* honest best-effort: 035 pending → assembly still serves */ }

  return { state: "ok", report };
}
