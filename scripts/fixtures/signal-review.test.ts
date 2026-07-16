// Fixture test for the governance blocking rules (pure, no DB).
// Run: npx tsx scripts/fixtures/signal-review.test.ts
import { customerApprovalBlocked } from "@/lib/vault/signal-review";
const checks: [string, boolean][] = [];
const ck = (n: string, ok: boolean) => checks.push([n, ok]);

ck("clean customer approval passes", customerApprovalBlocked({ evidenceTier: "B", rightsStatus: "customer_display_allowed", verdicts: { company_match: true, date_valid: true, claim: true }, reasonCodes: ["grounded_claim"] }) === null);
ck("wrong_company blocks", customerApprovalBlocked({ rightsStatus: "customer_display_allowed", reasonCodes: ["wrong_company"] }) === "company mismatch");
ck("company_match false blocks", customerApprovalBlocked({ rightsStatus: "customer_display_allowed", verdicts: { company_match: false } }) === "company mismatch");
ck("invalid date blocks", customerApprovalBlocked({ rightsStatus: "customer_display_allowed", verdicts: { date_valid: false } }) === "invalid/future date");
ck("unsupported claim blocks", customerApprovalBlocked({ rightsStatus: "customer_display_allowed", reasonCodes: ["unsupported_claim"] }) === "unsupported claim");
ck("contradiction blocks", customerApprovalBlocked({ rightsStatus: "customer_display_allowed", reasonCodes: ["contradiction"] }) === "unresolved contradiction");
ck("tier E blocks", customerApprovalBlocked({ evidenceTier: "E", rightsStatus: "customer_display_allowed" }) === "evidence tier E");
ck("restricted rights block", (customerApprovalBlocked({ rightsStatus: "restricted" }) ?? "").includes("rights"));
ck("internal_only rights block customer", (customerApprovalBlocked({ rightsStatus: "internal_only" }) ?? "").includes("rights"));
ck("metadata_only blocks customer", (customerApprovalBlocked({ rightsStatus: "metadata_only" }) ?? "").includes("rights"));
ck("unknown rights block customer", customerApprovalBlocked({ rightsStatus: "unknown" }) !== null);
ck("link_and_summary allowed passes", customerApprovalBlocked({ evidenceTier: "C", rightsStatus: "link_and_summary_allowed", verdicts: { company_match: true, date_valid: true, claim: true } }) === null);

let pass = 0;
for (const [n, ok] of checks) { console.log(`${ok ? "✅" : "❌"} ${n}`); if (ok) pass++; }
console.log(`\n${pass}/${checks.length} passed`);
process.exit(pass === checks.length ? 0 : 1);
