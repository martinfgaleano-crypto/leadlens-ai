import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "ml/data/acceptance");

const selected = [
  ["industrial_automation", "food_beverage", "customer-e2e-1787855505930.json"],
  ["industrial_automation", "packaging", "customer-e2e-1787857700019.json"],
  ["industrial_automation", "industrial_equipment", "customer-e2e-1787856077698.json"],
  ["warehouse_automation", "industrial_distribution", "customer-e2e-1787856666705.json"],
  ["warehouse_automation", "food_beverage", "customer-e2e-1787857423570.json"],
  ["warehouse_automation", "consumer_goods", "customer-e2e-1787857021328.json"],
] as const;

type Structural = "yes" | "borderline" | "no";
type Outcome = "defensible" | "borderline" | "not_defensible";

const labels: Record<string, {
  identity: "correct" | "weak" | "wrong";
  target: "strong" | "plausible" | "weak";
  structural: Structural;
  outcome: Outcome;
  decision: "Hold" | "Monitor" | "Reject";
  rationale: string;
}> = {
  "Tropical Bottling Co.": { identity: "correct", target: "strong", structural: "yes", outcome: "not_defensible", decision: "Hold", rationale: "Owned beverage manufacturing is structurally relevant, but the run did not ground a current material change." },
  "A.I. Foods Corporation": { identity: "correct", target: "plausible", structural: "yes", outcome: "not_defensible", decision: "Reject", rationale: "Co-packer is structurally plausible; retrieved evidence concerned other companies and was not account-associated." },
  "AAA Foods Enterprises Inc.": { identity: "weak", target: "weak", structural: "no", outcome: "not_defensible", decision: "Reject", rationale: "Generic identity and insufficient evidence of the required owned manufacturing operation." },
  "American Packaging Corporation": { identity: "correct", target: "strong", structural: "yes", outcome: "not_defensible", decision: "Reject", rationale: "Correct manufacturer and domain, but the evidence described Sonoco, not APC; association failed before final delivery." },
  "International Paper": { identity: "correct", target: "strong", structural: "yes", outcome: "borderline", decision: "Hold", rationale: "Real manufacturer and corporate separation, but enterprise-size mismatch and no grounded automation purchase need." },
  "Pratt Industries": { identity: "correct", target: "strong", structural: "yes", outcome: "not_defensible", decision: "Hold", rationale: "Strong account fit, but the final fixed run correctly blocked delivery without a source, material event, or valid date." },
  "Koch Enterprises, Inc.": { identity: "correct", target: "plausible", structural: "borderline", outcome: "not_defensible", decision: "Hold", rationale: "Diversified holding/operating group; plant ownership and the buying entity require resolution." },
  "Veeco Instruments Inc.": { identity: "correct", target: "strong", structural: "yes", outcome: "borderline", decision: "Monitor", rationale: "Real equipment manufacturer, but customer equipment orders do not establish a change in Veeco's own plant operations." },
  "Hormel": { identity: "correct", target: "strong", structural: "yes", outcome: "not_defensible", decision: "Hold", rationale: "Strong warehouse/manufacturing fit, but no current material warehouse change was grounded." },
  "United Citrus": { identity: "correct", target: "plausible", structural: "borderline", outcome: "not_defensible", decision: "Hold", rationale: "Relevant distributor, but ownership and scale of warehouse operations remain unverified." },
};

function read(name: string) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

const runs = selected.map(([vertical, context, file]) => {
  const raw = read(file);
  const calls = Object.values(raw.usage_delta ?? {}).reduce((n: number, p: any) => n + (p.calls ?? 0), 0);
  const cost = Object.values(raw.usage_delta ?? {}).reduce((n: number, p: any) => n + (p.calculated_cost_usd ?? 0), 0);
  return {
    vertical,
    context,
    artifact: `ml/data/acceptance/${file}`,
    run_id: raw.run_id,
    context_text: raw.synthetic_context,
    universe: raw.candidate_universe.total,
    researched: raw.research_audit.length,
    delivered: raw.delivered_accounts.length,
    duration_ms: raw.timings.total_ms,
    provider_calls: calls,
    observed_cost_usd: Number(cost.toFixed(6)),
    candidates: raw.candidate_universe.companies,
    researched_accounts: raw.research_audit.map((account: any) => ({
      company: account.company,
      domain: account.domain ?? null,
      system_decision: account.canonicalDecision,
      system_category: account.category,
      research_confidence: account.researchConfidence,
      source_url: account.sourceUrl,
      signal_date: account.signalDate,
      system_reasons: account.reasons,
      human_label: labels[account.company],
    })),
  };
});

const researched = runs.flatMap((run) => run.researched_accounts);
const structuralYes = researched.filter((x) => x.human_label.structural === "yes").length;
const structuralReasonable = researched.filter((x) => x.human_label.structural !== "no").length;
const outcomeDefensible = researched.filter((x) => x.human_label.outcome === "defensible").length;
const wrongTarget = researched.filter((x) => x.human_label.structural === "no").length;
const totalCalls = runs.reduce((n, run) => n + run.provider_calls, 0);
const totalCost = runs.reduce((n, run) => n + run.observed_cost_usd, 0);
const totalDuration = runs.reduce((n, run) => n + run.duration_ms, 0);

const artifact = {
  audit: "dynamic-universe-recall-v1",
  generated_at: new Date().toISOString(),
  status: "PARTIAL",
  verdict: "DYNAMIC UNIVERSE RECALL V1 IMPROVED BUT NOT YET VALIDATED",
  methodology: {
    verticals: 2,
    runs_per_vertical: 3,
    supplied_account_names: 0,
    productive_runs: 6,
    human_label_policy: "Every researched account was labeled independently for identity, target quality, structural research value, and evidence defensibility. Hard blockers were not rescued.",
    recall_proxy: "Bounded positive-control capture against eight public, primary-source US material events identified during audit; this is not a global recall estimate.",
  },
  baseline: {
    source: "ml/data/acceptance/intelligence-soak-v1.json",
    runs: 10,
    researched_accounts: 22,
    structurally_useful: 12,
    structurally_wasteful: 10,
    structural_precision: 12 / 22,
    delivered_cases: 0,
  },
  enumeration_evidence: {
    industrial: "ml/data/acceptance/dynamic-enumeration-industrial-1787855464859.json",
    warehouse: "ml/data/acceptance/dynamic-enumeration-warehouse-1787856642213.json",
    finding: "Independent organization-enumeration routes produced real US companies without seeded account names; source-ecosystem and geo-category routes yielded zero accepted names in these bounded runs.",
  },
  runs,
  metrics: {
    universes_total: runs.reduce((n, run) => n + run.universe, 0),
    researched_accounts: researched.length,
    delivered_cases: runs.reduce((n, run) => n + run.delivered, 0),
    structural_yes: structuralYes,
    structural_yes_rate: structuralYes / researched.length,
    structural_reasonable_including_borderline: structuralReasonable,
    structural_reasonable_rate: structuralReasonable / researched.length,
    wrong_target_accounts: wrongTarget,
    wrong_target_rate: wrongTarget / researched.length,
    human_positive_outcomes: outcomeDefensible,
    outcome_precision: null,
    outcome_precision_reason: "No final Case was human-confirmed; precision is not claimed from n=0 positives.",
    bounded_positive_controls: 8,
    bounded_positive_controls_captured_defensibly: 0,
    bounded_capture_rate: 0,
    provider_calls: totalCalls,
    observed_cost_usd: Number(totalCost.toFixed(6)),
    duration_ms: totalDuration,
    average_calls_per_run: totalCalls / runs.length,
    average_observed_cost_per_run_usd: Number((totalCost / runs.length).toFixed(6)),
  },
  positive_controls: [
    "Nestlé USA — Arvin distribution center",
    "Conagra Brands — Fayetteville plant expansion",
    "Quad — Salt Lake packaging facility",
    "voestalpine — Indiana production facility",
    "Hitachi Energy — South Boston expansion",
    "John Deere — new factory and distribution center",
    "UFP — South Carolina packaging facility",
    "Mondi — Pittsburgh automated packaging plant",
  ],
  false_positive_regression: {
    account: "Pratt Industries",
    pre_fix_artifact: "ml/data/acceptance/customer-e2e-1787857164919.json",
    final_artifact: "ml/data/acceptance/customer-e2e-1787857700019.json",
    defect: "An AI-generated BuiltIn reference profile was treated as event evidence.",
    fix: "AI-generated/unreviewed reference disclaimers classify as reference_information and cannot trigger Timing.",
    final_result: "No delivery; hard blockers no_source, no_material_event, and no_valid_date.",
  },
  limitations: [
    "No human-positive final Case was produced, so productive event recall is not validated.",
    "The acceptance artifacts do not persist complete per-route/full-text extraction telemetry for these completed runs; missing values are not inferred.",
    "The six runs are bounded tests of two US verticals and cannot establish global recall.",
    "Dynamic identity expansion improved manufacturer discovery, but several warehouse distributors remained domainless and could not reach research.",
  ],
};

const out = path.join(DATA, "dynamic-universe-recall-v1.json");
fs.writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(out);
console.log(JSON.stringify(artifact.metrics, null, 2));
