import { createHash } from "crypto";
import { loadEnvConfig } from "@next/env";
import {
  buildPilotWorkspace,
  PILOT_WORKSPACE_VERSION,
} from "@/lib/intelligence/pilot-workspace";

loadEnvConfig(process.cwd());

const write = process.argv.includes("--write");
const workspace = buildPilotWorkspace();
const activityId = `activity_${createHash("sha256")
  .update(`${workspace.pilot.pilot_id}:${workspace.pilot.updated_at}:backfill`)
  .digest("hex").slice(0, 24)}`;

function canonicalPilotPayload() {
  return {
    identity: workspace.pilot,
    overview: workspace.overview,
    active_account_references: workspace.accounts.map((account: any) => ({
      account_id: account.account_id,
      thesis_id: account.thesis_id,
      domain: account.domain,
      decision: account.decision,
    })),
    context: {
      questions: workspace.questions,
      accepted_answers: [],
      accepted_context_versions: [],
      completeness: workspace.overview.context_completeness,
    },
    feasibility: workspace.feasibility,
    safety: workspace.safety,
    report_readiness: workspace.sections,
    monitoring_triggers: workspace.accounts.map((account: any) => ({
      account_id: account.account_id,
      trigger: account.monitoring_trigger ?? account.next_verification ?? null,
      current_timing: account.why_now?.state ?? "unknown",
    })),
    checklist: workspace.checklist,
    final_report_generation: "disabled",
    internal_only: true,
    ranking_impact: "off",
    provenance: ["Block 10 entity resolution", "Block 11 opportunity synthesis", "Block 12 client context review"],
  };
}

async function main() {
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) throw new Error("database_unavailable");

  const thesisIds = workspace.theses.map((thesis: any) => thesis.thesis_id);
  const [pilotResult, thesisResult, activityResult] = await Promise.all([
    db.from("intelligence_pilots").select("id,idempotency_key,pilot_json")
      .eq("id", workspace.pilot.pilot_id).maybeSingle(),
    db.from("intelligence_account_opportunity_syntheses").select("id,account_id,client_id")
      .eq("client_id", workspace.pilot.client_id).in("id", thesisIds),
    db.from("intelligence_pilot_activity").select("id").eq("id", activityId).maybeSingle(),
  ]);
  for (const result of [pilotResult, thesisResult, activityResult]) {
    if (result.error) throw new Error(`reconciliation_failed:${result.error.message}`);
  }

  const existingThesisIds = new Set((thesisResult.data ?? []).map(row => row.id));
  const invalidReferences = (thesisResult.data ?? []).filter(row =>
    row.client_id !== workspace.pilot.client_id ||
    !workspace.accounts.some((account: any) => account.account_id === row.account_id));
  const pilotConflict = Boolean(
    pilotResult.data &&
    pilotResult.data.idempotency_key !== `pilot-backfill:${workspace.pilot.pilot_id}:${workspace.pilot.updated_at}`,
  );
  const plan = {
    mode: write ? "write" : "dry_run",
    pilot_id: workspace.pilot.pilot_id,
    expected: {
      canonical_pilots: 1,
      client_records: 1,
      account_references: 6,
      theses: 6,
      questions: 17,
      feasibility_assessments: 6,
      readiness_records: 20,
      activity_records: 1,
      real_answers: 0,
      accepted_context_versions: 0,
      customer_safe_outputs: 0,
    },
    existing: {
      canonical_pilots: pilotResult.data ? 1 : 0,
      theses: existingThesisIds.size,
      activity_records: activityResult.data ? 1 : 0,
    },
    planned_new_records: {
      canonical_pilots: pilotResult.data ? 0 : 1,
      theses: thesisIds.filter(id => !existingThesisIds.has(id)).length,
      activity_records: activityResult.data ? 0 : 1,
    },
    embedded_canonical_records: {
      client_records: 1,
      account_references: workspace.accounts.length,
      questions: workspace.questions.length,
      feasibility_assessments: workspace.feasibility.length,
      readiness_records: workspace.sections.length,
      monitoring_triggers: workspace.accounts.length,
    },
    duplicates_detected: existingThesisIds.size + (pilotResult.data ? 1 : 0) + (activityResult.data ? 1 : 0),
    orphaned_records: invalidReferences.length,
    invalid_references: invalidReferences,
    conflicting_ids: pilotConflict ? [workspace.pilot.pilot_id] : [],
    synthetic_answers: 0,
    actual_writes: 0,
    idempotency_key: `pilot-backfill:${workspace.pilot.pilot_id}:${workspace.pilot.updated_at}`,
  };

  if (workspace.accounts.length !== 6 || workspace.theses.length !== 6 ||
      workspace.questions.length !== 17 || workspace.overview.context_completeness !== 0 ||
      workspace.overview.customer_safe !== 0) {
    throw new Error(`baseline_mismatch:${JSON.stringify(plan.expected)}`);
  }
  if (invalidReferences.length || pilotConflict) {
    throw new Error(`unsafe_reconciliation:${JSON.stringify(plan)}`);
  }
  if (!write) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  let actualWrites = 0;
  if (!pilotResult.data) {
    const { error } = await db.from("intelligence_pilots").insert({
      id: workspace.pilot.pilot_id,
      tenant_user_id: null,
      client_id: workspace.pilot.client_id,
      slug: workspace.pilot.slug,
      canonical_name: workspace.pilot.client_name,
      status: workspace.pilot.status,
      pilot_json: canonicalPilotPayload(),
      methodology_version: PILOT_WORKSPACE_VERSION,
      idempotency_key: plan.idempotency_key,
      updated_at: workspace.pilot.updated_at,
    });
    if (error) throw new Error(`pilot_insert_failed:${error.message}`);
    actualWrites += 1;
  }

  for (const thesis of workspace.theses as any[]) {
    if (existingThesisIds.has(thesis.thesis_id)) continue;
    const { error } = await db.from("intelligence_account_opportunity_syntheses").insert({
      id: thesis.thesis_id,
      tenant_user_id: null,
      client_id: workspace.pilot.client_id,
      account_id: thesis.account_id,
      context_id: null,
      thesis_json: thesis,
      review_state: "unreviewed",
      internal_only: true,
      ranking_impact: "off",
      report_impact: "off",
      methodology_version: thesis.methodology_version ?? PILOT_WORKSPACE_VERSION,
      generated_at: thesis.generated_at ?? workspace.pilot.last_intelligence_refresh,
      supersedes_id: null,
      idempotency_key: `${workspace.pilot.pilot_id}:thesis:${thesis.thesis_id}`,
    });
    if (error) throw new Error(`thesis_insert_failed:${thesis.thesis_id}:${error.message}`);
    actualWrites += 1;
  }

  if (!activityResult.data) {
    const { error } = await db.from("intelligence_pilot_activity").insert({
      id: activityId,
      tenant_user_id: null,
      pilot_id: workspace.pilot.pilot_id,
      client_id: workspace.pilot.client_id,
      event_type: "pilot_backfilled",
      actor_id: null,
      object_type: "pilot",
      object_id: workspace.pilot.pilot_id,
      before_summary: { persisted: false },
      after_summary: {
        persisted: true, accounts: 6, theses: 6, questions: 17,
        real_answers: 0, customer_safe_outputs: 0,
      },
      provenance: ["Block 10", "Block 11", "Block 12", "migration 047"],
      methodology_version: PILOT_WORKSPACE_VERSION,
      occurred_at: new Date().toISOString(),
      idempotency_key: `${plan.idempotency_key}:activity`,
    });
    if (error) throw new Error(`activity_insert_failed:${error.message}`);
    actualWrites += 1;
  }

  console.log(JSON.stringify({
    ...plan,
    actual_writes: actualWrites,
    result: actualWrites === 0 ? "idempotent_noop" : "backfill_completed",
    synthetic_answers: 0,
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    actual_writes: 0,
    synthetic_answers: 0,
  }));
  process.exit(1);
});
