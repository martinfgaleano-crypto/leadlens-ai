// Discovery-needed target semantics (corrective sprint). LeadLens must NEVER
// require the user to supply a research conclusion (target orgs / markets /
// accounts) as a clarification input. Covers the exact production failure +
// the required regression matrix + semantic invariants. No network.
import {
  interpretCompany,
  type ModelCaller,
  type RawModelInterpretation,
} from "@/lib/interpretation/interpret-service";
import { stageAViolations, isResearchConclusionClarification, type CompanyInterpretationV1 } from "@/lib/interpretation/company-interpretation";
import { toPublicInterpretation } from "@/lib/interpretation/public-projection";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const det = (input: string, locale: "en" | "es" | "pt" | "ja" = "en") => interpretCompany(input, { locale }, { modelAvailable: false });
const model = (raw: unknown): ModelCaller => async () => raw;
// The exact clarification the production bug produced — must never be emitted.
const BANNED = /what (kind|type) of (organization|company|account)|which organizations|who should (we|leadlens)|companies (that|to) (sell|find)|target (organization|account)/i;
const asksForTarget = (i: CompanyInterpretationV1) => i.clarification.blockers.some((b) => b.priority === "target_organization" || BANNED.test(b.reason)) || (!!i.clarification.nextQuestion && BANNED.test(i.clarification.nextQuestion.question));
const discovery = (i: CompanyInterpretationV1) => i.targetAccountProfile.definitionStatus === "discovery_required";

// ─── CASE 1 — the EXACT production failure (deterministic path) ────────────────
const jewelry = await det("We sell jewelry in Colombia but planning to move operations internationally.");
t("CASE 1 jewelry expansion → does NOT ask for target organizations", !asksForTarget(jewelry.interpretation));
t("CASE 1 jewelry → discovery_required + ready_for_confirmation (proceeds)", discovery(jewelry.interpretation) && jewelry.interpretation.interpretationStatus === "ready_for_confirmation");
t("CASE 1 jewelry → zero truth violations, no invented country beyond Colombia",
  stageAViolations(jewelry.interpretation).length === 0 &&
  (jewelry.interpretation.targetAccountProfile.geographies ?? []).every((g) => /colombia/i.test(g.label)));

// ─── CASE 2 — unknown route ───────────────────────────────────────────────────
const unknownRoute = await det("We sell jewelry and don't know how we should expand internationally.");
t("CASE 2 'don't know how to expand' → proceeds, no target demand", !asksForTarget(unknownRoute.interpretation) && unknownRoute.interpretation.interpretationStatus === "ready_for_confirmation");

// ─── CASE 3 — compare-for-me (as a resolved expansion) ────────────────────────
const compare = await det("We sell jewelry in Colombia and want to expand internationally. Compare the options for me.");
t("CASE 3 'compare the options for me' → proceeds, no route re-question (loop prevented)",
  compare.interpretation.interpretationStatus === "ready_for_confirmation" && !compare.interpretation.clarification.nonBlockingGaps.some((g) => g.priority === "route_preference"));

// ─── CASE 4 — known route ─────────────────────────────────────────────────────
const knownRoute = await det("We sell jewelry and want to expand through retailers and distributors.");
t("CASE 4 known route → proceeds, no target demand", !asksForTarget(knownRoute.interpretation) && knownRoute.interpretation.interpretationStatus === "ready_for_confirmation");

// ─── CASE 5 — known target stays authoritative ────────────────────────────────
const known = await det("We sell cybersecurity software to regional banks.");
t("CASE 5 known target (banks) → definition defined, NOT discovery",
  known.interpretation.targetAccountProfile.definitionStatus === "defined" &&
  known.interpretation.targetAccountProfile.organizationTypes.join(" ").toLowerCase().includes("bank"));

// ─── CASE 7 — partnership exploration ─────────────────────────────────────────
const partners = await det("We provide enterprise software and want partners in new markets but don't know what kind.");
t("CASE 7 partnership exploration → proceeds, no target demand", !asksForTarget(partners.interpretation));

// ─── CASE 8 — consulting exploration ──────────────────────────────────────────
const consulting = await det("We advise companies expanding abroad and want more clients but don't know which sector to target.");
t("CASE 8 consulting exploration → proceeds, no forced sector/target", !asksForTarget(consulting.interpretation));

// ─── CASE 9 — vague still clarifies (no overcorrection) ───────────────────────
const vague = await det("We want to grow.");
t("CASE 9 vague → still needs_clarification (not falsely ready)", vague.interpretation.interpretationStatus === "needs_clarification");

// ─── CASE 10 — unsupported stays unsupported ──────────────────────────────────
const investors = await det("We want to find investors for our company.");
t("CASE 10 investors → unsupported_objective (not normalized)", investors.interpretation.interpretationStatus === "unsupported_objective" && investors.interpretation.commercialObjective.supported === false);

// ─── CASE 12 — user-supplied country preserved, not verified ──────────────────
const spain = await det("We sell jewelry and want to expand into Spain.");
t("CASE 12 user country (Spain) preserved as user-stated, not externally verified",
  (spain.interpretation.targetAccountProfile.geographies ?? []).some((g) => /spain/i.test(g.label)) && stageAViolations(spain.interpretation).length === 0);

// ─── CASE 15 — fallback (model OFF) obeys same semantics ──────────────────────
t("CASE 15 fallback path (no model) obeys discovery semantics for jewelry", discovery(jewelry.interpretation) && !asksForTarget(jewelry.interpretation));

// ─── LLM path: hostile model cannot reintroduce target-forcing ────────────────
const llmDiscovery = await interpretCompany("We sell jewelry in Colombia and want to expand internationally.", {}, {
  callModel: model({ objectiveSupported: true, objective: "business_development", offer: "Jewelry", targetOrganizationTypes: [], clarificationNeeded: true, clarificationPriority: "target_organization", clarificationQuestion: "What kind of organization should LeadLens look at?" } as unknown as RawModelInterpretation),
});
t("LLM path: model's target_organization clarification is DROPPED (quality gate)",
  !asksForTarget(llmDiscovery.interpretation) && discovery(llmDiscovery.interpretation) && llmDiscovery.interpretation.interpretationStatus === "ready_for_confirmation");

// ─── LLM misread guard: compare/uncertain must not become unsupported ─────────
const compareMisread = await interpretCompany("We sell jewelry in Colombia and want to expand internationally. Compare the options for me.", {}, {
  callModel: model({ objectiveSupported: false, objective: "generic_research", unsupportedReason: "This is a market comparison / research request.", clarificationNeeded: false } as unknown as RawModelInterpretation),
});
t("LLM misread: 'compare for me' with real context does NOT become unsupported (deterministic override)",
  compareMisread.interpretation.interpretationStatus !== "unsupported_objective" && compareMisread.interpretation.commercialObjective.supported === true);

// ─── SEMANTIC INVARIANTS (§28) ────────────────────────────────────────────────
t("INV-A discovery_required ⇒ never a target_organization blocker",
  [jewelry, unknownRoute, compare, knownRoute, partners, consulting].every((r) => !discovery(r.interpretation) || !r.interpretation.clarification.blockers.some((b) => b.priority === "target_organization")));
t("INV quality gate: a target_organization clarification is always a research conclusion",
  isResearchConclusionClarification("target_organization", "anything") === true &&
  isResearchConclusionClarification("other", "which companies should we research?") === true &&
  isResearchConclusionClarification("route_preference", "do you have a preferred route?") === false);
t("INV-C/D no invented country/account across discovery cases",
  [jewelry, unknownRoute, compare, partners].every((r) => stageAViolations(r.interpretation).length === 0 && (r.interpretation.targetAccountProfile.namedAccounts ?? []).length === 0));
t("INV-G known target not overwritten by discovery", known.interpretation.targetAccountProfile.definitionStatus === "defined" && !discovery(known.interpretation));
t("INV-H unsupported not normalized", investors.interpretation.commercialObjective.supported === false);
t("INV-I vague still clarifies", vague.interpretation.interpretationStatus === "needs_clarification");

// ─── Public projection distinguishes known vs discovery-required (§25) ────────
const pubJ = toPublicInterpretation(jewelry);
t("projection: discovery target mode + candidate org types (hypotheses) + discovery needs, no confirmed target",
  pubJ.targetMode === "discovery_required" && pubJ.discovery.candidateOrgTypes.length > 0 && pubJ.discovery.needs.length > 0 && pubJ.told.target.length === 0);
const pubK = toPublicInterpretation(known);
t("projection: known target mode carries the user target", pubK.targetMode === "defined" && pubK.told.target.length > 0);
t("projection: no research/verification claim in discovery brief", /No external account research has run/i.test(pubJ.disclosure));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
};
run();
