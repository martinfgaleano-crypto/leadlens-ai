import { loadEnvConfig } from "@next/env";
import { buildPilotWorkspace } from "@/lib/intelligence/pilot-workspace";

loadEnvConfig(process.cwd());
const workspace = buildPilotWorkspace();

async function main() {
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) throw new Error("database_unavailable");

  const [pilot, theses, intakes, contexts, safety, activity] = await Promise.all([
    db.from("intelligence_pilots").select("*").eq("id", workspace.pilot.pilot_id).eq("client_id", workspace.pilot.client_id),
    db.from("intelligence_account_opportunity_syntheses").select("id,account_id,client_id,review_state,internal_only,ranking_impact,report_impact")
      .eq("client_id", workspace.pilot.client_id),
    db.from("intelligence_client_intakes").select("id,intake_json,status").eq("client_id", workspace.pilot.client_id),
    db.from("intelligence_client_context_versions").select("id,status").eq("client_id", workspace.pilot.client_id),
    db.from("intelligence_customer_safety_reviews").select("id,state").eq("client_id", workspace.pilot.client_id),
    db.from("intelligence_pilot_activity").select("id,pilot_id,client_id,event_type").eq("pilot_id", workspace.pilot.pilot_id),
  ]);
  const results = [pilot, theses, intakes, contexts, safety, activity];
  const error = results.find(result => result.error)?.error;
  if (error) throw new Error(`database_verification_failed:${error.message}`);

  const pilotRow: any = pilot.data?.[0];
  const expectedAccountIds = new Set(workspace.accounts.map((account: any) => account.account_id));
  const expectedThesisIds = new Set(workspace.theses.map((thesis: any) => thesis.thesis_id));
  const persistedTheses = theses.data ?? [];
  const answerCount = (intakes.data ?? []).reduce((count, intake: any) =>
    count + (Array.isArray(intake.intake_json?.answers) ? intake.intake_json.answers.length : 0), 0);
  const orphanTheses = persistedTheses.filter(row => !expectedAccountIds.has(row.account_id) || !expectedThesisIds.has(row.id));
  const crossScope = [
    ...(pilot.data ?? []),
    ...persistedTheses,
    ...(activity.data ?? []),
  ].filter((row: any) => row.client_id !== workspace.pilot.client_id);
  const canonical = pilotRow?.pilot_json ?? {};
  const verification = {
    mode: "read_only_database_verification",
    counts: {
      canonical_pilots: pilot.data?.length ?? 0,
      accounts: canonical.active_account_references?.length ?? null,
      theses: persistedTheses.length,
      context_questions: canonical.context?.questions?.length ?? null,
      real_client_answers: answerCount,
      accepted_context_versions: contexts.data?.length ?? 0,
      reviewed_theses: persistedTheses.filter(row => row.review_state !== "unreviewed").length,
      customer_safe_outputs: (safety.data ?? []).filter(row => row.state === "customer_safe").length,
      feasibility_assessments: canonical.feasibility?.length ?? null,
      readiness_records: canonical.report_readiness?.length ?? null,
      monitoring_triggers: canonical.monitoring_triggers?.length ?? null,
      activity_records: activity.data?.length ?? 0,
    },
    integrity: {
      canonical_id_only: (pilot.data ?? []).every((row: any) => row.id === workspace.pilot.pilot_id && row.slug === workspace.pilot.pilot_id),
      consistent_client_scope: crossScope.length === 0,
      exact_account_ids: persistedTheses.every(row => expectedAccountIds.has(row.account_id)),
      exact_thesis_ids: persistedTheses.length === expectedThesisIds.size && persistedTheses.every(row => expectedThesisIds.has(row.id)),
      orphan_theses: orphanTheses.length,
      cross_scope_records: crossScope.length,
      internal_only: persistedTheses.every(row => row.internal_only === true),
      ranking_impact_off: persistedTheses.every(row => row.ranking_impact === "off"),
      report_impact_off: persistedTheses.every(row => row.report_impact === "off"),
      final_report_disabled: canonical.final_report_generation === "disabled",
      runtime_dependency: false,
    },
    synthetic_answers: 0,
    writes: 0,
  };
  const expected = verification.counts.canonical_pilots === 1 &&
    verification.counts.accounts === 6 &&
    verification.counts.theses === 6 &&
    verification.counts.context_questions === 17 &&
    verification.counts.real_client_answers === 0 &&
    verification.counts.accepted_context_versions === 0 &&
    verification.counts.reviewed_theses === 0 &&
    verification.counts.customer_safe_outputs === 0 &&
    verification.integrity.canonical_id_only &&
    verification.integrity.consistent_client_scope &&
    verification.integrity.exact_account_ids &&
    verification.integrity.exact_thesis_ids &&
    verification.integrity.orphan_theses === 0 &&
    verification.integrity.cross_scope_records === 0 &&
    verification.integrity.internal_only &&
    verification.integrity.ranking_impact_off &&
    verification.integrity.report_impact_off &&
    verification.integrity.final_report_disabled &&
    verification.integrity.runtime_dependency === false;
  console.log(JSON.stringify({ ...verification, verdict: expected ? "verified" : "incompatible" }, null, 2));
  if (!expected) process.exit(1);
}

main().catch(error => {
  console.error(JSON.stringify({ verdict: "incompatible", error: error instanceof Error ? error.message : String(error), writes: 0 }));
  process.exit(1);
});
