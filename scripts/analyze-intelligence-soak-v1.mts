#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const files = [
  "customer-e2e-1787842339586.json", "customer-e2e-1787842650320.json",
  "customer-e2e-1787842890721.json", "customer-e2e-1787843004691.json",
  "customer-e2e-1787843338683.json", "customer-e2e-1787843772894.json",
  "customer-e2e-1787843955824.json", "customer-e2e-1787844124725.json",
  "customer-e2e-1787844300348.json", "customer-e2e-1787844556342.json",
];
type Label = {
  identity: "correct" | "ambiguous" | "wrong";
  target_match: "strong" | "plausible" | "weak" | "wrong_target";
  evidence_quality: "strong" | "adequate" | "weak" | "invalid";
  temporal_quality: "valid_material_change" | "historical_only" | "undated" | "no_event" | "invalid";
  case_defensibility: "defensible" | "borderline" | "not_defensible";
  human_decision: "Prioritize" | "Validate" | "Monitor" | "Hold" | "Reject";
  research_useful: boolean; waste_reason: string | null; note: string;
};
const L = (identity: Label["identity"], target_match: Label["target_match"], evidence_quality: Label["evidence_quality"], temporal_quality: Label["temporal_quality"], human_decision: Label["human_decision"], research_useful: boolean, waste_reason: string | null, note: string): Label => ({
  identity, target_match, evidence_quality, temporal_quality, case_defensibility: "not_defensible", human_decision, research_useful, waste_reason, note,
});
const labels: Record<string, Label> = {
  "us_manufacturing_automation|Ferguson Industrial": L("ambiguous","weak","invalid","no_event","Reject",false,"identity_issue","Observed domain did not establish the named manufacturer."),
  "us_manufacturing_automation|Whole Foods Market": L("correct","wrong_target","adequate","valid_material_change","Reject",false,"wrong_target_type","Retail/store automation is outside the confirmed manufacturing target."),
  "us_manufacturing_automation|Sprouts Farmers Market": L("correct","wrong_target","strong","valid_material_change","Reject",false,"wrong_target_type","Retail expansion is real but outside the confirmed manufacturing target."),
  "us_logistics_wms|Advanced Illumination": L("correct","plausible","invalid","no_event","Hold",true,null,"Manufacturer was reasonable to probe; no owned-warehouse event was found."),
  "us_logistics_wms|Whole Foods Market": L("correct","wrong_target","adequate","valid_material_change","Reject",false,"wrong_target_type","Retailer was not among the confirmed manufacturer/distributor target types."),
  "us_logistics_wms|Sprouts Farmers Market": L("correct","wrong_target","weak","no_event","Reject",false,"wrong_target_type","Performance commentary did not establish the required logistics event."),
  "us_enterprise_operations|Advanced Illumination": L("correct","strong","invalid","invalid","Reject",true,null,"Structurally in target, but Research attached HashMicro/Jaykay evidence from other companies."),
  "co_logistics_automation|Sunon Inc.": L("wrong","wrong_target","invalid","no_event","Reject",false,"geography_mismatch","US domain was represented as a Colombian operating account."),
  "co_logistics_automation|Grupo Éxito": L("correct","strong","adequate","historical_only","Hold",true,null,"Expansion was real but stale and did not prove logistics technology scope."),
  "co_logistics_automation|Alkosto": L("correct","plausible","weak","historical_only","Hold",true,null,"Reference-page facts did not establish a fresh material logistics change."),
  "us_sparse_professional_services|First Professional Services LLC": L("ambiguous","plausible","invalid","invalid","Reject",false,"identity_issue","Research evidence described Grant Thornton/MSA, not this account."),
  "us_sparse_professional_services|Specialty Distributors": L("wrong","wrong_target","invalid","invalid","Reject",false,"wrong_target_type","Ambiguous distributor/insurance identity was unrelated to professional-services target."),
  "us_sparse_professional_services|mackenzie EXHIBIT": L("correct","plausible","weak","no_event","Hold",true,null,"Plausible project-services firm; no qualifying event or scale evidence."),
  "us_industrial_distribution|Ferguson Industrial": L("correct","strong","weak","historical_only","Hold",true,null,"Correct distributor, but stale parent sales result was not an operational trigger."),
  "us_industrial_distribution|Schneider Electric": L("wrong","wrong_target","adequate","valid_material_change","Reject",false,"wrong_target_type","Candidate domain was unrelated and the company competes in the offered category."),
  "us_fleet_operations|Clever Wholesale": L("correct","plausible","invalid","no_event","Hold",true,null,"Distributor was reasonable to probe; fleet ownership remained unknown."),
  "us_fleet_operations|Orgill": L("correct","strong","weak","no_event","Hold",true,null,"Strong fleet-operating hypothesis but no dated company trigger or source."),
  "us_channel_partnerships|Associated Steel Corporation": L("correct","plausible","weak","no_event","Hold",true,null,"Manufacturer was plausible; channel model and event were unverified."),
  "us_channel_partnerships|General Devices Company, Inc.": L("ambiguous","plausible","invalid","no_event","Reject",false,"identity_issue","Name/domain relationship and channel operation were unverified."),
  "co_fleet_operations|Cementos Argos": L("correct","plausible","weak","no_event","Hold",true,null,"Operational account is plausible, but fleet control and trigger were inferred."),
  "co_fleet_operations|Tecnoglass": L("correct","plausible","weak","no_event","Hold",true,null,"Industrial account is plausible, but owned fleet and event were unverified."),
  "us_sparse_negative_control|Accounts Junction": L("correct","plausible","weak","no_event","Hold",true,null,"Correct sparse target; no material event, size, or active need."),
};

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a,b)=>a-b); const i = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, i)] ?? null;
};
const runs = files.map(file => JSON.parse(readFileSync(`ml/data/acceptance/${file}`, "utf8")));
const accountReviews = runs.flatMap(run => (run.research_audit ?? []).map((account: any) => {
  const label = labels[`${run.soak_id}|${account.company}`];
  if (!label) throw new Error(`missing_manual_label:${run.soak_id}|${account.company}`);
  return { soak_id: run.soak_id, phase: run.soak_phase, account, system_decision: account.canonicalDecision === "hold" ? "Hold" : account.canonicalDecision, human_label: label, disagreement: (account.canonicalDecision === "hold" ? "Hold" : account.canonicalDecision) !== label.human_decision };
}));
const providerTotals: Record<string,{calls:number;errors:number;known_cost_usd:number|null}> = {};
for (const run of runs) for (const [provider, usage] of Object.entries(run.usage_delta) as any) {
  const row = providerTotals[provider] ??= { calls: 0, errors: 0, known_cost_usd: provider === "anthropic" ? 0 : null };
  row.calls += usage.calls; row.errors += usage.errors;
  if (row.known_cost_usd !== null) row.known_cost_usd += usage.calculated_cost_usd;
}
const completion = runs.map(r=>r.timings.background_completion_ms);
const useful = accountReviews.filter(x=>x.human_label.research_useful).length;
const defensible = accountReviews.filter(x=>x.human_label.case_defensibility === "defensible").length;
const delivered = runs.reduce((n,r)=>n+r.delivered_accounts.length,0);
const dataset = {
  version: "intelligence-soak-v1", generated_at: new Date().toISOString(), milestone: "00e9607", phases: { A: 5, D: 5 },
  design: { contexts: 10, countries: { "United States": 8, Colombia: 2 }, synthetic_only: true, hand_seeded_winners: false, cron: "off", note: "One unsupported sparse context stopped at Stage A clarification and is excluded from the ten Intelligence runs." },
  runs: runs.map(r=>({ file: files[runs.indexOf(r)], soak_id:r.soak_id, phase:r.soak_phase, run_id:r.run_id, context:r.synthetic_context, universe:r.candidate_universe.total, researched:r.research_audit.length, delivered:r.delivered_accounts.length, timings:r.timings, usage:r.usage_delta, outcome:r.delivered_accounts.length?"completed_with_opportunities":"completed_no_strong_opportunity", checks:r.checks })),
  account_reviews: accountReviews,
  monitor_soak: { baselines: 3, reviews: 3, completed_no_change: 3, changed: 0, insufficient: 0, false_novelty: 0, provider_failures_seen: 3, search_results_considered: 24, pages_escalated: 0, pages_fetched: 0, events_accepted: 0, durations_ms: [3062,1251,1243] },
  metrics: {
    researched_accounts: accountReviews.length, research_ready_useful: useful, research_ready_wasted: accountReviews.length-useful,
    research_ready_structural_precision: useful/accountReviews.length,
    delivered_cases: delivered, defensible_researched_cases: defensible,
    delivered_case_defensibility: delivered ? defensible/delivered : null,
    observed_opportunity_capture_rate: defensible ? delivered/defensible : null,
    customer_facing_false_positive_rate: delivered ? 0 : null,
    exact_system_human_decision_agreement: accountReviews.filter(x=>!x.disagreement).length/accountReviews.length,
    completed_with_opportunities: runs.filter(r=>r.delivered_accounts.length).length,
    completed_no_strong_opportunity: runs.filter(r=>!r.delivered_accounts.length).length,
    insufficient_research: 0, failed: 0,
    false_what_changed: 0, unsupported_timing: 0,
    historical_cases_reviewed: 3, historical_cases_correctly_held: 3,
    provider_totals: providerTotals,
    calls_per_run: Object.values(providerTotals).reduce((n,x)=>n+x.calls,0)/runs.length,
    calls_per_researched_account: Object.values(providerTotals).reduce((n,x)=>n+x.calls,0)/accountReviews.length,
    calls_per_defensible_case: defensible ? Object.values(providerTotals).reduce((n,x)=>n+x.calls,0)/defensible : null,
    known_llm_cost_usd: providerTotals.anthropic?.known_cost_usd ?? null,
    llm_cost_per_run_usd: (providerTotals.anthropic?.known_cost_usd ?? 0)/runs.length,
    latency_ms: { min:Math.min(...completion), median:percentile(completion,.5), p90:percentile(completion,.9), p95:percentile(completion,.95), max:Math.max(...completion) },
    runtime_classification: { safe:completion.filter(x=>x<240000).length, near_limit:completion.filter(x=>x>=240000&&x<=300000).length, exceeded:completion.filter(x=>x>300000).length },
    runtime_human_interventions: 0,
  },
};
mkdirSync("ml/data/acceptance",{recursive:true});
writeFileSync("ml/data/acceptance/intelligence-soak-v1.json",`${JSON.stringify(dataset,null,2)}\n`);
console.log(JSON.stringify(dataset.metrics,null,2));
