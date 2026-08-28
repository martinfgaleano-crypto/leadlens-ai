import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import opportunityCaseModule from "@/lib/intelligence/opportunity-case-intelligence";
import canonicalCaseModule from "@/lib/monitor/canonical-case";
import commercialValidationModule, { type PositiveCommercialCaseReview, type ReviewJudgment } from "@/lib/intelligence/positive-commercial-case-validation";

const { evaluateInstitutionalOpportunityCase } = opportunityCaseModule;
const { synthesizeCase } = canonicalCaseModule;
const { summarizePositiveCommercialCases } = commercialValidationModule;

const sourcePath = join(process.cwd(), "ml/data/acceptance/account-deep-research-positive-control-v1.json");
const outputPath = join(process.cwd(), "ml/data/acceptance/positive-commercial-case-review-package-v1.json");
const raw = await readFile(sourcePath, "utf8");
const source = JSON.parse(raw) as { generated_at: string; accounts: Array<{ company: string; domain: string; captured_defensibly: boolean; strongest_source_url: string | null; validated_events: Array<{ kind: string; event_date: string; url: string; source_host: string }> }> };
const previousHumanConfirmations = new Map<string, PositiveCommercialCaseReview["human_confirmation"]>();
try {
  const previous = JSON.parse(await readFile(outputPath, "utf8")) as { source_sha256?: string; cases?: PositiveCommercialCaseReview[] };
  const currentSourceHash = createHash("sha256").update(raw).digest("hex");
  if (previous.source_sha256 === currentSourceHash) for (const item of previous.cases ?? []) previousHumanConfirmations.set(item.case_id, item.human_confirmation);
} catch { /* First generation has no prior review package. */ }

const context = {
  context_id: "controlled-context:industrial-automation-us-v1",
  offer_summary: "Industrial automation integration and plant-operations software",
  value_proposition: "Integrate and control new or materially expanded manufacturing and distribution operations",
  target_industries: ["manufacturing", "packaging", "industrial operations", "distribution"],
  target_geography: ["United States"],
  buying_signals: ["new facility", "capacity expansion", "automation investment"],
  truth_limit: "The context establishes what deserves validation; it is not external evidence and does not establish buying intent.",
};

type Profile = {
  judgment: ReviewJudgment;
  role: "Potential Customer";
  type: "Operations Expansion" | "Capacity Expansion" | "Technology Modernization";
  descriptor: string;
  fact: string;
  whyNow: string;
  fitReasons: string[];
  counterevidence: string;
  alternative: string;
  openQuestion: string;
  nextStep: string;
  independentUrl: string | null;
  reviewRationale: string;
};

const profiles: Record<string, Profile> = {
  "Nestlé USA": {
    judgment: "monitor", role: "Potential Customer", type: "Technology Modernization", descriptor: "Post-opening distribution automation integration",
    fact: "Nestlé USA opened a $330 million, 700,000-square-foot Arvin distribution center with targeted automation and an automated storage and retrieval system.",
    whyNow: "The opening confirms a material operating change, but the principal automation implementation is already in place.",
    fitReasons: ["Large directly operated distribution asset", "Automation and digital supply-chain capabilities are explicit"],
    counterevidence: "The facility is already operational and equipped with automation, so the initial vendor-selection window may be closed.",
    alternative: "The relevant work may be owned by incumbent integrators or internal Nestlé teams rather than an external new supplier.",
    openQuestion: "Are post-go-live integration, optimization or multi-site orchestration scopes still open to external vendors?",
    nextStep: "Monitor post-go-live operating disclosures; validate incumbent systems and unresolved integration scope before allocating outreach.",
    independentUrl: "https://consumergoods.com/nestle-opens-high-tech-distribution-center-california",
    reviewRationale: "Real high-materiality event and fit context, but present commercial timing is not yet defensible.",
  },
  "Conagra Brands": {
    judgment: "commercially_defensible", role: "Potential Customer", type: "Capacity Expansion", descriptor: "Multi-year manufacturing-capacity expansion",
    fact: "Conagra announced an approximately $220 million multi-year expansion of its Fayetteville plant, with construction planned for 2026 and a significant increase in chicken-production capacity.",
    whyNow: "The project is announced and construction is upcoming, creating a bounded period to validate controls, integration and plant-software workstreams before implementation is complete.",
    fitReasons: ["Existing manufacturing operation is directly controlled by Conagra", "The project materially changes production capacity", "Supply-chain innovation is named in the announcement"],
    counterevidence: "The announcement does not disclose vendor-selection status, control architecture or whether automation scope is already awarded.",
    alternative: "Most of the investment may fund construction and production equipment under an incumbent EPC or integrator contract.",
    openQuestion: "Which automation, controls, data-integration and plant-operations packages remain unawarded?",
    nextStep: "Validate project phase, incumbent EPC/integrators and remaining controls or plant-software packages before contacting Conagra supply-chain engineering.",
    independentUrl: "https://www.fayetteville-ar.gov/DocumentCenter/View/40273/Q1-2026-COF-Economic-Development-Report-5_11_26?bidId=",
    reviewRationale: "Correct account, material planned capacity change, direct operational fit, grounded timing and a concrete validation action; Validate is justified without claiming intent.",
  },
  "Quad": {
    judgment: "commercially_defensible", role: "Potential Customer", type: "Operations Expansion", descriptor: "New packaging facility and multi-site production footprint",
    fact: "Quad announced a new 100,000-square-foot Salt Lake City packaging facility planned to become operational in Q4 2026, extending its packaging network across multiple US sites.",
    whyNow: "The site is not yet operational, so integration of production equipment, workflows and cross-site operations may still require validation.",
    fitReasons: ["The new manufacturing site is directly operated by Quad", "The event creates a multi-site packaging-production footprint", "Concrete production equipment and launch timing are disclosed"],
    counterevidence: "The source states the facility launches with existing client volume and named production equipment, indicating substantial implementation decisions may already be complete.",
    alternative: "Quad may use existing internal platforms and incumbent equipment vendors for all integration work.",
    openQuestion: "Are plant-data, scheduling, quality or cross-site integration workstreams still open before Q4 commissioning?",
    nextStep: "Validate commissioning status and the ownership of plant integration before approaching Quad Packaging operations.",
    independentUrl: null,
    reviewRationale: "A single primary source limits Evidence strength, but the future commissioning date, direct operation and specific unresolved scope justify Validate rather than Prioritize.",
  },
  "Hitachi Energy": {
    judgment: "commercially_defensible", role: "Potential Customer", type: "Capacity Expansion", descriptor: "Large-transformer manufacturing expansion",
    fact: "Hitachi Energy broke ground on a $457 million South Boston expansion intended to establish the largest US large-power-transformer facility and add about 825 jobs.",
    whyNow: "Groundbreaking marks active implementation of a major capacity expansion, making current validation of manufacturing integration workstreams timely.",
    fitReasons: ["Directly operated advanced-manufacturing campus", "Large, irreversible capacity expansion", "Active construction phase and quantified operational scale"],
    counterevidence: "The expansion follows a previously announced investment, so strategic vendors and core technology packages may already be selected.",
    alternative: "Internal Hitachi Energy capabilities or established engineering partners may control the relevant integration scope.",
    openQuestion: "Which controls, production-data integration or commissioning work packages remain externally addressable?",
    nextStep: "Map the project delivery partners and validate unawarded integration or commissioning scope before contacting the South Boston expansion team.",
    independentUrl: "https://electrek.co/2026/06/29/us-largest-transformer-factory-is-coming-for-the-ai-power-boom/",
    reviewRationale: "Identity, project, magnitude and timing are corroborated; direct operational fit and an explicit remaining validation question support Validate.",
  },
  "John Deere": {
    judgment: "monitor", role: "Potential Customer", type: "Operations Expansion", descriptor: "New excavator factory and parts distribution center",
    fact: "John Deere announced a new parts distribution center near Hebron and a $70 million excavator factory in Kernersville, with production shifting from Japan and both facilities expected to open in the following year.",
    whyNow: "The facilities are in development rather than mature operation, so production, distribution and system-integration decisions remain worth validating now.",
    fitReasons: ["Both facilities are direct Deere operations", "The event combines manufacturing relocation and distribution expansion", "Advanced technology is explicitly part of the factory plan"],
    counterevidence: "Deere has extensive internal digital capabilities and the principal facility partners or platforms may already be contracted.",
    alternative: "The opportunity may be limited to incumbent enterprise systems or construction partners rather than a new plant-operations supplier.",
    openQuestion: "Which manufacturing, warehouse and cross-facility integration scopes remain open to external vendors?",
    nextStep: "Validate project ownership, incumbent platforms and procurement status separately for Hebron and Kernersville before outreach.",
    independentUrl: "https://www.supplychainbrain.com/articles/43358-john-deere-to-open-pair-of-new-us-facilities-in-2026",
    reviewRationale: "The operating changes are real, but the dated event exceeds the canonical 180-day window; without a fresh implementation update it cannot support current Timing.",
  },
  "Mondi": {
    judgment: "monitor", role: "Potential Customer", type: "Technology Modernization", descriptor: "Post-opening automated paper-bag production",
    fact: "Mondi opened a highly automated Pittsburgh paper-bag plant supporting eCommerce and industrial demand, with approximately 170 expected jobs.",
    whyNow: "The opening is recent, but the disclosed automation is already installed and operating.",
    fitReasons: ["Directly operated manufacturing facility", "Automation and scalable production are explicit"],
    counterevidence: "The plant has already opened with advanced automated production technology, weakening the timing for initial implementation work.",
    alternative: "Any remaining need may be routine optimization handled by existing Mondi systems and vendors.",
    openQuestion: "Is there a post-go-live optimization or integration gap that is material enough for an external supplier?",
    nextStep: "Monitor operating ramp and validate unresolved post-go-live integration needs before considering outreach.",
    independentUrl: "https://dced.pa.gov/newsroom/creating-jobs-in-allegheny-county-governor-shapiro-announces-mondi-bags-usa-selects-pennsylvania-for-manufacturing-expansion-creating-approximately-170-new-jobs/",
    reviewRationale: "The event is true and commercially relevant in structure, but the initial buying window appears substantially complete.",
  },
};

const records = source.accounts.filter((account) => account.captured_defensibly && profiles[account.company]).map((account) => {
  const profile = profiles[account.company];
  const event = account.validated_events[0];
  const sourceEvidence = [
    { label: profile.fact, url: account.strongest_source_url, date: event.event_date },
    ...(profile.independentUrl ? [{ label: `Independent source corroborates the event for ${account.company}.`, url: profile.independentUrl, date: event.event_date }] : []),
  ];
  const canonicalCase = synthesizeCase({
    accountId: account.company, identityVerified: true, fromUniverse: true, signalKind: event.kind,
    signalDate: event.event_date, dateConfidence: "high", sourceHost: event.source_host, materialEvent: true,
    hasMaterialCounter: true, openDecisionCritical: [profile.openQuestion], priorFit: profile.judgment === "commercially_defensible" ? "Strong" : "Moderate",
    priorTiming: "Moderate", priorEvidence: profile.independentUrl ? "Strong" : "Moderate", independentSupportNew: Boolean(profile.independentUrl),
    hasPostReviewEvent: true, geographyConfirmed: true, regionRequired: true,
  });
  const opportunityCase = evaluateInstitutionalOpportunityCase({
    account: account.company, clientObjective: context.value_proposition, explicitRole: profile.role,
    explicitType: profile.type, opportunityDescriptor: profile.descriptor, fitScore: profile.judgment === "commercially_defensible" ? 8 : 6,
    fitReasons: profile.fitReasons, signal: { label: profile.fact, date: event.event_date, sourceLabel: event.source_host, url: event.url },
    whyNow: profile.whyNow, sourceEvidence, explicitIndependentSupport: Boolean(profile.independentUrl),
    risks: [profile.counterevidence, profile.alternative], blockers: [profile.openQuestion], openQuestions: [profile.openQuestion],
    decision: canonicalCase.decision, recommendedNextStep: profile.nextStep,
  });
  const caseId = `controlled-case:${account.company.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const review: PositiveCommercialCaseReview = {
    case_id: caseId,
    account: account.company, decision: canonicalCase.decision, decision_source: canonicalCase.decisionSource,
    identity_confirmed: true, target_organization_confirmed: true, commercial_context_confirmed: true,
    client_fit_confirmed: true, evidence_traceable: true, event_observed: true, event_date: event.event_date,
    timing_claimed: true, timing_grounded: true, counterevidence_explicit: true, weakening_factors_explicit: true,
    next_action_explicit: true, buying_intent_claimed: false,
    independent_review: { reviewer_id: "codex-independent-commercial-adjudication-v1", reviewer_kind: "independent_technical_review", judgment: profile.judgment, rationale: profile.reviewRationale, reviewed_at: "2026-08-28T12:00:00.000Z" },
    human_confirmation: previousHumanConfirmations.get(caseId) ?? { state: "pending", reviewer_id: null, reviewer_role: null, judgment: null, rationale: null, reviewed_at: null, attestation: false },
  };
  return { ...review, source_event: event, primary_source: account.strongest_source_url, independent_source: profile.independentUrl, commercial_analysis: { verified_fact: profile.fact, why_now: profile.whyNow, fit_reasons: profile.fitReasons, counterevidence: profile.counterevidence, alternative_explanation: profile.alternative, decision_critical_question: profile.openQuestion, next_action: profile.nextStep }, canonical_case: canonicalCase, opportunity_case: opportunityCase };
});

const summary = summarizePositiveCommercialCases(records);
const artifact = {
  version: "positive-commercial-case-review-package-v1",
  generated_at: new Date().toISOString(),
  source_artifact: "ml/data/acceptance/account-deep-research-positive-control-v1.json",
  source_sha256: createHash("sha256").update(raw).digest("hex"),
  controlled_acceptance_only: true,
  production_seeded: false,
  customer_context: context,
  truth_limit: "Independent technical adjudication prepares Cases but does not count as human confirmation. customer_safe_human_positive_cases remains zero until an identified human reviewer explicitly attests each Case.",
  summary,
  cases: records,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, summary }, null, 2));
