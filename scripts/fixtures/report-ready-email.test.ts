// Report-ready communication (Phase D): a content-safe, idempotent report-ready email exists and is
// wired at the durable-completion seam. Functional no-op check + source-level content-safety/wiring guards.
import { readFileSync } from "node:fs";
import { sendReportReadyEmail } from "../../lib/email/send-report-email";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

async function main() {
  // Functional: no RESEND_API_KEY → safe no-op, never throws, never sends.
  const prior = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  const r = await sendReportReadyEmail({ to: "buyer@example.com", jobId: "intel_abc", productLabel: "Portfolio" });
  t("no RESEND key → no-op (sent:false), never throws", r.sent === false);
  // Invalid recipient → refused, never sends.
  process.env.RESEND_API_KEY = "test-key-not-used";
  const bad = await sendReportReadyEmail({ to: "not-an-email", jobId: "intel_abc" });
  t("invalid recipient → refused (sent:false)", bad.sent === false && /recipient/.test(bad.error ?? ""));
  if (prior === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = prior;

  const email = read("lib/email/send-report-email.ts");
  // Content-safety (§19): the email must NOT embed research content.
  t("email carries no lead/research content (no processed_leads/fit_score/qualification)", !/processed_leads|fit_score|qualification|hot_count|topLeads/.test(email));
  t("email includes a support contact", /supportEmail|SUPPORT_EMAIL/.test(email));
  t("email links to the authenticated /results page only", /\/results\//.test(email));

  const route = read("app/api/internal/intelligence-runs/[runId]/process/route.ts");
  // Wiring + idempotency (§20): sent at completion, guarded by a durable notifications marker on run_id.
  t("completion seam wires the report-ready email", /sendReportReadyEmail/.test(route));
  t("report-ready is idempotent via a durable notifications marker (run_id)", /search_completed/.test(route) && /run_id/.test(route) && /alreadyNotified/.test(route));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
