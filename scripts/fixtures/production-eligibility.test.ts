// Unit tests for computeProductionEligibility (eligibility-v1) — pure, no DB.
// Run: npm run test:production-eligibility

import { computeProductionEligibility, type EligibilityInput } from "@/lib/vault/production-eligibility";

let passed = 0, failed = 0;
const t = (name: string, input: EligibilityInput, expectEligible: boolean, expectReason?: string) => {
  const v = computeProductionEligibility(input);
  const ok = v.eligible === expectEligible && (!expectReason || v.reasons.includes(expectReason));
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : `  got eligible=${v.eligible} reasons=${v.reasons.join(",")}`}`);
  ok ? passed++ : failed++;
};

const base: EligibilityInput = {
  data_origin: "production",
  signal_date: "2026-06-11",
  active_review: { review_status: "approved", rights_status: "link_and_summary_allowed", evidence_tier: "C", reason_codes: [], company_match_verdict: true },
  source: { source_url: "https://example-news.com/article", usage_rights_status: "permitted" },
  company: { name: "NAWAH" },
};
const withReview = (over: Partial<NonNullable<EligibilityInput["active_review"]>>): EligibilityInput =>
  ({ ...base, active_review: { ...base.active_review!, ...over } });

t("production approved completa → true", base, true);
t("production pending (sin review) → false", { ...base, active_review: null }, false, "no_active_review");
t("production monitor-only → false", withReview({ review_status: "approved_monitor_only" }), false, "active_review_approved_monitor_only");
t("production rejected → false", withReview({ review_status: "rejected" }), false, "active_review_rejected");
t("production revoked → false", withReview({ review_status: "revoked" }), false, "active_review_revoked");
t("approved con rights unknown → false", { ...withReview({ rights_status: "unknown" }), source: { source_url: "https://x.com/a", usage_rights_status: "unverified" } }, false, "rights_not_customer_safe");
t("approved Tier D → false", withReview({ evidence_tier: "D" }), false, "evidence_tier_below_C");
t("approved Tier E → false", withReview({ evidence_tier: "E" }), false, "evidence_tier_below_C");
t("approved identity suspect → false", { ...base, company: { name: "NAWAH opens first US VACNT manufacturing facility in Ohio" } }, false, "identity_suspect");
t("approved category-like → false", { ...base, company: { name: "B2B Companies" } }, false, "identity_suspect");
t("demo approved → false", { ...base, data_origin: "demo" }, false, "not_production_origin");
t("sin fecha ni continuing → false", { ...base, signal_date: null }, false, "no_valid_date");
t("sin fecha con continuing_signal → true", { ...withReview({ reason_codes: ["continuing_signal"] }), signal_date: null }, true);
t("sin provenance → false", { ...base, source: null }, false, "no_provenance");
t("contradiction → false", withReview({ reason_codes: ["contradiction"] }), false, "contradiction");
t("duplicate → false", withReview({ reason_codes: ["duplicate_event"] }), false, "duplicate");
t("company mismatch verdict → false", withReview({ company_match_verdict: false }), false, "company_mismatch");

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
