import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import validationModule, { type PositiveCommercialCaseReview } from "@/lib/intelligence/positive-commercial-case-validation";
import evidenceModule from "@/lib/intelligence/control-plane-validation-evidence";

const { summarizePositiveCommercialCases } = validationModule;
const { createControlPlaneValidationEvidence, validateControlPlaneValidationEvidence } = evidenceModule;
const packagePath = join(process.cwd(), "ml/data/acceptance/positive-commercial-case-review-package-v1.json");
const baselinePath = join(process.cwd(), "ml/data/acceptance/control-plane-validation-evidence-v1.json");
const outputPath = join(process.cwd(), "ml/data/acceptance/control-plane-validation-evidence-positive-commercial-case-v1.json");
const packageBody = await readFile(packagePath, "utf8");
const baselineBody = await readFile(baselinePath, "utf8");
const reviewPackage = JSON.parse(packageBody) as { version: string; cases: PositiveCommercialCaseReview[] };
const baseline = JSON.parse(baselineBody);
const summary = summarizePositiveCommercialCases(reviewPackage.cases);
if (summary.customer_safe_human_positive_cases === 0) throw new Error("no_human_confirmed_customer_safe_cases");
const confirmed = reviewPackage.cases.filter((item) => validationModule.validatePositiveCommercialCase(item).customer_safe_human_positive);
const observedAt = confirmed.map((item) => item.human_confirmation.reviewed_at).filter((value): value is string => Boolean(value)).sort().at(-1);
if (!observedAt) throw new Error("human_review_timestamp_required");

const { source_fingerprint: baselineFingerprint, ...baselineWithoutFingerprint } = baseline;
const evidence = createControlPlaneValidationEvidence({
  ...baselineWithoutFingerprint,
  evidence_id: "positive-commercial-case-validation-2026-08-28",
  supersedes_source_fingerprint: baselineFingerprint,
  observed_at: observedAt,
  artifact_version: "positive-commercial-case-validation-v1",
  provenance: [
    ...baseline.provenance,
    { ref: "ml/data/acceptance/positive-commercial-case-review-package-v1.json", kind: "human_review", sha256: createHash("sha256").update(packageBody).digest("hex") },
  ],
  metrics: {
    ...baseline.metrics,
    human_validation: { ...baseline.metrics.human_validation, customer_safe_cases: summary.customer_safe_human_positive_cases },
  },
});
const validation = validateControlPlaneValidationEvidence(evidence);
if (!validation.ok) throw new Error(`invalid_control_plane_evidence:${validation.errors.join(",")}`);
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, customer_safe_human_positive_cases: summary.customer_safe_human_positive_cases, supersedes_source_fingerprint: baselineFingerprint }, null, 2));
