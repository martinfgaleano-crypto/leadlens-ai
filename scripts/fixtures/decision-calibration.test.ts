// Decision calibration (§44-55): a strong-fit account with a VERIFIED multi-brand
// channel (a clear purchase mechanism) and a validatable unknown must reach VALIDATE,
// not collapse to HOLD purely for lack of a dated event (§51/§52) — while an account
// with NO current evidence at all still honestly resolves to HOLD (no forced positives).
import { synthesizeCase, caseDecision, type CanonicalCaseInput } from "../../lib/monitor/canonical-case";
import { canonicalCaseForLead } from "../../lib/intelligence/productive-spine";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

const base = (o: Partial<CanonicalCaseInput>): CanonicalCaseInput => ({
  accountId: "Acme", identityVerified: true, fromUniverse: true,
  signalKind: null, signalDate: null, dateConfidence: "none", sourceHost: "acme.com",
  materialEvent: false, hasMaterialCounter: false, openDecisionCritical: [],
  priorFit: "Strong", priorTiming: "Limited", priorEvidence: "Moderate",
  independentSupportNew: false, hasPostReviewEvent: false,
  geographyConfirmed: true, regionRequired: false, channelAccessVerified: false, ...o,
});
const decideOf = (o: Partial<CanonicalCaseInput>) => synthesizeCase(base(o)).decision;

// CASE A — strong fit + VERIFIED channel + no dated event + a validatable unknown → VALIDATE.
t("A: strong fit + verified channel + no trigger + open unknown → validate", decideOf({ channelAccessVerified: true, openDecisionCritical: ["Confirm category fit and onboarding path"] }) === "validate");
t("A': strong fit + verified channel + no trigger (no explicit unknown) → validate (not hold)", decideOf({ channelAccessVerified: true }) === "validate");

// CASE B — verified recent material event + clear identity → PRIORITIZE.
const recent = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
t("B: verified recent material event → prioritize", decideOf({ signalKind: "expansion", signalDate: recent, dateConfidence: "high", materialEvent: true }) === "prioritize");

// CASE C — moderate fit, NO channel, NO event → HOLD (honest; not forced up).
t("C: no channel + no event → hold (unchanged, honest)", decideOf({ priorFit: "Moderate", channelAccessVerified: false }) === "hold");

// CASE D — verified event but an open decision-critical unknown caps at VALIDATE.
t("D: material event + open decision-critical → validate (capped)", decideOf({ signalKind: "expansion", signalDate: recent, dateConfidence: "high", materialEvent: true, openDecisionCritical: ["Verify the reported plant is the buying entity"] }) === "validate");

// CASE E — verified event + material counterevidence → VALIDATE (revalidation required).
t("E: material event + material counter → validate", decideOf({ signalKind: "expansion", signalDate: recent, dateConfidence: "high", materialEvent: true, hasMaterialCounter: true }) === "validate");

// The verified-channel path yields the 'investigate' verdict (channel-fit, not intent).
{
  const c = synthesizeCase(base({ channelAccessVerified: true }));
  t("verified channel → verdictStatus 'investigate' (channel-fit, not buying intent)", c.verdictStatus === "investigate");
  t("verified channel keeps timing Limited (channel-fit is not a timing signal)", c.timing === "Limited");
  t("verified channel reason is channel-fit (verified access)", c.reasons.some((r) => r.includes("channel_fit_not_buying_intent")));
}

// §8.1 — strategic ROUTE validation is DISTINCT from verified channel access.
{
  const sr = synthesizeCase(base({ strategicRouteValidatable: true, channelAccessVerified: false, openDecisionCritical: ["Validate the route: category + onboarding"] }));
  t("strategic-route-validatable → validate (no event, no verified access)", sr.decision === "validate" && sr.verdictStatus === "investigate");
  t("strategic route is labeled route-validation, NOT verified channel access", sr.reasons.some((r) => r.includes("strategic_route_validation")) && sr.reasons.some((r) => r.includes("channel_access_not_verified")) && !sr.reasons.some((r) => r.includes("channel_fit_not_buying_intent")));
  const neither = synthesizeCase(base({ strategicRouteValidatable: false, channelAccessVerified: false }));
  t("neither access nor route basis + no event → hold", neither.decision === "hold");
}

// caseDecision mapping stays canonical.
t("caseDecision investigate → validate", caseDecision("investigate").decision === "validate");
t("caseDecision reject → hold", caseDecision("reject").decision === "hold");
t("caseDecision opportunity → prioritize", caseDecision("opportunity").decision === "prioritize");
t("caseDecision monitor → monitor", caseDecision("monitor").decision === "monitor");

// ── canonicalCaseForLead reseller-channel lift (§51): a verified STRONG-fit reseller
//    with a concrete decision-critical unknown → VALIDATE, not HOLD; non-resellers,
//    weak fit, or no open question are NOT lifted (no forced positives). ──
{
  const lead = (o: { industry: string; fit: number; q: string | null }) => ({
    id: "L", outreach: { qc_status: "PASSED" },
    candidate: { company: "Acme", domain: "acme.com", industry: o.industry, signal_date: null, signal_type: null, source_url: null, country: "United States" },
    enrichment: { next_best_question: o.q, research_confidence: 0.5, evidence_discipline: [], opportunity_risks: [], account_research: null },
    qualification: { fit_score: o.fit },
  }) as never;
  const cc = (o: { industry: string; fit: number; q: string | null }) => canonicalCaseForLead(lead(o));
  const dec = (o: { industry: string; fit: number; q: string | null }) => cc(o)?.decision;
  t("reseller: strong-fit natural grocery + open question → validate (strategic ROUTE)", dec({ industry: "Natural and organic grocery chain", fit: 8, q: "Confirm category fit and vendor onboarding" }) === "validate");
  t("reseller VALIDATE is strategic-route, NOT verified channel access (§8.1)", (cc({ industry: "Natural and organic grocery chain", fit: 8, q: "Confirm category fit" })?.reasons ?? []).some((r) => r.includes("strategic_route_validation")) && !(cc({ industry: "Natural and organic grocery chain", fit: 8, q: "Confirm category fit" })?.reasons ?? []).some((r) => r.includes("channel_fit_not_buying_intent")));
  t("reseller: strong-fit distributor + open question → validate", dec({ industry: "Natural products distributor", fit: 8, q: "Confirm portfolio fit" }) === "validate");
  t("no lift: strong-fit SOFTWARE company (non-reseller) → hold", dec({ industry: "enterprise software", fit: 8, q: "Anything" }) === "hold");
  t("no lift: LIMITED-fit reseller → hold (not forced up)", dec({ industry: "grocery chain", fit: 3, q: "Anything" }) === "hold");
  t("no lift: strong reseller but NO open question → hold", dec({ industry: "grocery chain", fit: 8, q: null }) === "hold");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
