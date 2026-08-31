"use server";
// Server Action boundary for the Institutional Brief. Real tenant ownership
// for LINKED reports (search_id → lead_searches.user_id): only the owner (a
// viewer whose verified token matches) may open them. UNLINKED legacy reports
// (no search_id) keep link-access for backward compatibility. Assembly happens
// here — the browser never receives raw report_json. Not an API route.

import { getSnapshot } from "@/lib/storage/snapshot-store";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import type { InstitutionalOpportunityReportV1 } from "@/lib/reports/institutional-report-types";

import type { ReportExperience } from "@/lib/products/report-experience";
import type { ReviewMemory } from "@/lib/deliverable/account-memory-store";

export type BriefResult =
  | { state: "ok"; report: InstitutionalOpportunityReportV1; experience: ReportExperience; memory: ReviewMemory | null; monitorClientKey: string | null }
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

  // Any owner-linked report → real ownership check. Productive Intelligence
  // runs have user_id even when they are not attached to a legacy lead_search.
  if (searchId || snapshot.user_id) {
    const db = await serverDb();
    if (!db) return { state: "unavailable" };
    const { data: search } = searchId
      ? await db.from("lead_searches").select("user_id").eq("id", searchId).maybeSingle()
      : { data: null };
    const ownerId = search?.user_id ?? snapshot.user_id ?? null;
    if (ownerId) {
      if (!accessToken) return { state: "signin_required" };
      const { data: { user }, error } = await db.auth.getUser(accessToken);
      if (error || !user) return { state: "signin_required" };
      if (user.id !== ownerId) return { state: "forbidden" };
    }
    // A linked search without an owner remains legacy link-access; productive
    // owner-linked reports can no longer fall through to anonymous access.
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

  // Tier-resolved report experience: prefer the job's stored product_code
  // (new orders), fall back to the legacy plan mapping (historic orders).
  const { resolveReportExperience } = await import("@/lib/products/report-experience");
  const ob = (snapshot.report_json as { onboarding?: { product_code?: string; output_language?: string } })?.onboarding;
  const experience = resolveReportExperience(ob?.product_code ?? snapshot.plan ?? null, ob?.output_language === "es" ? "es" : "en");

  // ── Account Memory (V1.1): persist this completed review's canonical snapshots
  // (idempotent — re-viewing never duplicates) and load the predecessor review to
  // power the Living Case. Owner/client/context scoped; server-side only; fails
  // closed to first-review behavior. Never blocks the deliverable (§51/§108).
  let memory: ReviewMemory | null = null;
  let monitorClientKey: string | null = null;
  try {
    const db = await serverDb();
    if (db) {
      const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
      const { SupabaseAccountMemoryRepo, persistAndLoadMemory } = await import("@/lib/deliverable/account-memory-store");
      const vm = fromInstitutionalReport(report, experience);
      const intelligenceMeta = (snapshot.report_json as {
        _intelligence_run?: { contextRef?: { contextId?: string; version?: number } };
      })._intelligence_run;
      const contextId = intelligenceMeta?.contextRef?.contextId ?? null;
      const contextVersion = contextId
        ? `${contextId}:v${intelligenceMeta?.contextRef?.version ?? 1}`
        : (ob?.product_code ?? snapshot.plan ?? "default");
      // Productive reviews share the confirmed commercial-context namespace.
      // Legacy search-series reports retain their stable search namespace.
      const clientKey = contextId ? `context:${contextId}` : (searchId ?? vm.meta.client ?? snapshot.job_id);
      monitorClientKey = clientKey;
      const searchOwner = searchId
        ? ((await db.from("lead_searches").select("user_id").eq("id", searchId).maybeSingle()).data?.user_id ?? null)
        : null;
      const scope = { ownerUserId: snapshot.user_id ?? searchOwner, clientKey };
      memory = await persistAndLoadMemory(
        new SupabaseAccountMemoryRepo(db), vm.accounts, scope,
        { reviewId: snapshot.job_id, reviewedAt: snapshot.created_at ?? new Date().toISOString(), contextVersion },
        (e) => console.error("[account-memory] persistence failed:", e instanceof Error ? e.message : e),
        { preferLatestAccepted: true },
      );
    }
  } catch (e) { console.error("[account-memory] unavailable:", e instanceof Error ? e.message : e); }

  return { state: "ok", report, experience, memory, monitorClientKey };
}
