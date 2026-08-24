// Company Interpretation V1 — Stage A ingestion truth-boundary guards (Commit 1).
// Establishes invariants that make it hard for future LLM code to violate
// LeadLens truth BEFORE any model or provider exists.
import { readFileSync } from "node:fs";
import {
  stageAViolations,
  collectContextClaims,
  isValidSignalFamily,
  isStageAVerificationStatus,
  COMPANY_INTERPRETATION_SCHEMA_VERSION,
  SUPPORTED_OBJECTIVE_TYPES,
  type CompanyInterpretationV1,
  type SignalHypothesis,
} from "@/lib/interpretation/company-interpretation";
import {
  executionReadiness,
  confirmInterpretation,
  CONFIRMED_COMMERCIAL_CONTEXT_SCHEMA_VERSION,
} from "@/lib/interpretation/confirmed-commercial-context";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { ADVERSARIAL_FIXTURES, MALFORMED_FIXTURES } from "@/lib/interpretation/fixtures/adversarial";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

const interpSrc = readFileSync("lib/interpretation/company-interpretation.ts", "utf8");
const confSrc = readFileSync("lib/interpretation/confirmed-commercial-context.ts", "utf8");

const golden = Object.values(GOLDEN_FIXTURES);
const adv = ADVERSARIAL_FIXTURES;
const mal = MALFORMED_FIXTURES;
const confirmGolden = (i: CompanyInterpretationV1) => confirmInterpretation(i, { contextId: "ctx_test" });

// ─── Schema + reuse ───────────────────────────────────────────────────────────
t("schema version is explicit ('1') on every fixture", COMPANY_INTERPRETATION_SCHEMA_VERSION === "1" &&
  [...golden, ...Object.values(adv), ...Object.values(mal)].every((f) => f.schemaVersion === "1"));
t("reuse: Stage A imports canonical SignalFamily from needs-map (no duplicate ontology)",
  /import\s+type\s+\{\s*SignalFamily\s*\}\s+from\s+"@\/lib\/discovery\/needs-map"/.test(interpSrc) &&
  /import\s+\{\s*SIGNAL_FAMILIES\s*\}\s+from\s+"@\/lib\/discovery\/needs-map"/.test(interpSrc));
t("boundary: Stage A ingestion does NOT import execution ontology (DecisionState/Strength/Fit/Timing)",
  !/DecisionState|Strength|deliverable-view-model/.test(interpSrc));
t("isolation: no provider/LLM/research import in Stage A contracts", (() => {
  // Only inspect import statements — the files legitimately mention "providers"
  // in their boundary documentation, which is not a dependency.
  const importsOf = (src: string) => src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
  const bad = /anthropic|tavily|serper|firecrawl|\bexa\b|\/providers|lib\/sources\/access/i;
  return !bad.test(importsOf(interpSrc)) && !bad.test(importsOf(confSrc));
})());

// ─── Golden fixtures: clean, canonical, execution-ready ───────────────────────
t("golden fixtures have zero truth-boundary violations", golden.every((f) => stageAViolations(f).length === 0));
t("golden signal hypotheses use canonical families only", golden.every((f) => f.signalHypotheses.every((h) => isValidSignalFamily(h.family))));
t("golden fixtures are execution-ready", golden.every((f) => executionReadiness(f).ready));
t("golden fixtures confirm into a stable execution context", golden.every((f) => confirmGolden(f).ok));

t("golden #1 software/manufacturing → identify_high_value_accounts / customer / new_facility+acquisition+expansion",
  GOLDEN_FIXTURES.software_manufacturing.commercialObjective.supported &&
  (GOLDEN_FIXTURES.software_manufacturing.commercialObjective as { type: string }).type === "identify_high_value_accounts" &&
  (GOLDEN_FIXTURES.software_manufacturing.commercialObjective as { targetRelationship: string }).targetRelationship === "customer" &&
  ["new_facility", "acquisition", "expansion"].every((fam) => GOLDEN_FIXTURES.software_manufacturing.signalHypotheses.some((h) => h.family === fam)));
t("golden #1 keeps ICP and Timing separate (a structural condition AND change_triggers)",
  GOLDEN_FIXTURES.software_manufacturing.opportunityConditions.some((c) => c.type === "structural") &&
  GOLDEN_FIXTURES.software_manufacturing.opportunityConditions.some((c) => c.type === "change_trigger"));
t("golden #2 consulting → advisory_opportunities / advisory_client",
  GOLDEN_FIXTURES.consulting.commercialObjective.supported &&
  (GOLDEN_FIXTURES.consulting.commercialObjective as { type: string }).type === "advisory_opportunities" &&
  (GOLDEN_FIXTURES.consulting.commercialObjective as { targetRelationship: string }).targetRelationship === "advisory_client");
t("golden #3 partnerships → partnerships / partner (not hardcoded to customer)",
  GOLDEN_FIXTURES.partnerships.commercialObjective.supported &&
  (GOLDEN_FIXTURES.partnerships.commercialObjective as { type: string }).type === "partnerships" &&
  (GOLDEN_FIXTURES.partnerships.commercialObjective as { targetRelationship: string }).targetRelationship === "partner");
t("golden fixtures are internationally neutral (no country hardcoded in geographies)",
  golden.every((f) => (f.targetAccountProfile.geographies ?? []).length === 0));
t("golden fixtures never invent account names (descriptors only)",
  golden.every((f) => (f.targetAccountProfile.namedAccounts ?? []).length === 0));

// ─── Truth boundaries (§36) ───────────────────────────────────────────────────
t("USER CONTEXT ≠ EVIDENCE: no wellformed fixture claims externally_verified in Stage A",
  [...golden, ...Object.values(adv)].every((f) => collectContextClaims(f).every((c) => isStageAVerificationStatus(c.claim.verificationStatus))));
t("SIGNAL HYPOTHESIS ≠ SIGNAL: every hypothesis status is 'hypothesis'",
  [...golden, ...Object.values(adv)].every((f) => f.signalHypotheses.every((h) => h.status === "hypothesis")));
t("SIGNAL HYPOTHESIS type carries no observation field (no observed_at/evidence/source)",
  /interface SignalHypothesis \{[^}]*\}/.test(interpSrc) &&
  !/interface SignalHypothesis \{[^}]*(observed_at|evidence|sourceRef|observedAt)[^}]*\}/.test(interpSrc));
t("USER CONFIRMATION ≠ EXTERNAL VERIFICATION: confirmed context asserts no external verification + holds no externally_verified claim",
  (() => {
    const r = confirmGolden(GOLDEN_FIXTURES.software_manufacturing);
    if (!r.ok) return false;
    const claims = collectContextClaims({ ...GOLDEN_FIXTURES.software_manufacturing, companyContext: r.context.companyProfile });
    return /no externally verified/i.test(r.context.provenanceSummary) && claims.every((c) => isStageAVerificationStatus(c.claim.verificationStatus));
  })());

// ─── Adversarial: honest limitation, no confident fabrication ─────────────────
t("A 'We help companies grow' → needs_clarification, not execution-ready, confirm refuses",
  adv.help_companies_grow.interpretationStatus === "needs_clarification" &&
  !executionReadiness(adv.help_companies_grow).ready &&
  !confirmGolden(adv.help_companies_grow).ok);
t("B 'Jewelry in Colombia…' → context extracted, objective blocked, not ready",
  !!adv.jewelry_colombia.companyContext.companyDescription &&
  adv.jewelry_colombia.clarification.blockers.some((b) => b.priority === "commercial_objective") &&
  !executionReadiness(adv.jewelry_colombia).ready);
t("C 'I want investors' → UNSUPPORTED, not normalized to sales",
  adv.investors.interpretationStatus === "unsupported_objective" &&
  adv.investors.commercialObjective.supported === false &&
  (adv.investors.commercialObjective as { requestedType: string }).requestedType === "investors" &&
  (() => { const r = confirmGolden(adv.investors); return !r.ok && r.reason === "unsupported_objective"; })());
t("D 'Find companies' → insufficient context, not ready",
  adv.find_companies.interpretationStatus === "needs_clarification" && !executionReadiness(adv.find_companies).ready);
t("E 'cybersecurity to banks but not fintechs' → offer + target + exclusion, no facts, clean",
  adv.cyber_banks_not_fintech.targetAccountProfile.organizationTypes.includes("Banks") &&
  (adv.cyber_banks_not_fintech.targetAccountProfile.exclusions ?? []).includes("fintech") &&
  adv.cyber_banks_not_fintech.disqualifiers.some((d) => d.rule === "fintech" && d.severity === "exclude") &&
  stageAViolations(adv.cyber_banks_not_fintech).length === 0);
t("F 'consulting, no market yet' → target blocker, not open-ended market research, not ready",
  adv.consulting_no_market.clarification.blockers.some((b) => b.priority === "target_organization") &&
  !executionReadiness(adv.consulting_no_market).ready);

// ─── Malformed: validator must reject ─────────────────────────────────────────
t("MALFORMED externally_verified is rejected + never execution-ready", stageAViolations(mal.externally_verified).length > 0 && !executionReadiness(mal.externally_verified).ready && !confirmGolden(mal.externally_verified).ok);
t("MALFORMED invented (non-user) named accounts is rejected", stageAViolations(mal.invented_accounts).length > 0);
t("MALFORMED include/exclude contradiction is rejected", stageAViolations(mal.contradiction).length > 0);
t("MALFORMED unsupported-objective-normalized-to-ready is rejected", stageAViolations(mal.normalized_unsupported).length > 0);

// invalid enum + fabricated-signal attempts (via cast — the type forbids them at compile time)
t("invalid signal family rejected at runtime", !isValidSignalFamily("funding") /* not canonical */ && (() => {
  const bad: CompanyInterpretationV1 = { ...GOLDEN_FIXTURES.software_manufacturing, signalHypotheses: [{ family: "funding", relevanceToObjective: "x", linkedConditionIds: [], status: "hypothesis" } as unknown as SignalHypothesis] };
  return stageAViolations(bad).length > 0;
})());
t("attempt to fabricate a SIGNAL (status ≠ hypothesis) rejected", (() => {
  const bad: CompanyInterpretationV1 = { ...GOLDEN_FIXTURES.software_manufacturing, signalHypotheses: [{ family: "expansion", relevanceToObjective: "x", linkedConditionIds: [], status: "signal" } as unknown as SignalHypothesis] };
  return stageAViolations(bad).length > 0;
})());

// ─── Execution gate + versioning ──────────────────────────────────────────────
t("confirm gate refuses when blockers remain", !confirmGolden(adv.help_companies_grow).ok);
t("confirmed context carries schema version + versioning fields (version, effectiveFrom)", (() => {
  const r = confirmGolden(GOLDEN_FIXTURES.consulting);
  return r.ok && r.context.schemaVersion === CONFIRMED_COMMERCIAL_CONTEXT_SCHEMA_VERSION && typeof r.context.version === "number" && typeof r.context.effectiveFrom === "string";
})());
t("supported objective scope is controlled (exactly the 5 launch objectives)",
  SUPPORTED_OBJECTIVE_TYPES.length === 5 &&
  ["win_customers", "business_development", "identify_high_value_accounts", "partnerships", "advisory_opportunities"].every((o) => (SUPPORTED_OBJECTIVE_TYPES as readonly string[]).includes(o)));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
