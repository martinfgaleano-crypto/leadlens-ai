import assert from "node:assert/strict";
import { resolveExecutiveSummary } from "@/lib/agents/report-agent";

async function main() {
  const generated = await resolveExecutiveSummary(async () => "model summary", () => "fallback");
  assert.equal(generated, "model summary");

  const exhausted = await resolveExecutiveSummary(
    async () => { throw new Error("Your credit balance is too low"); },
    () => "No account reached the delivery threshold.",
  );
  assert.equal(exhausted, "No account reached the delivery threshold.");

  let fallbackCalls = 0;
  await resolveExecutiveSummary(async () => { throw new Error("provider unavailable"); }, () => { fallbackCalls++; return "bounded"; });
  assert.equal(fallbackCalls, 1);

  console.log("report-agent resilience: 3/3 passed");
}

main().catch((error) => { console.error(error); process.exit(1); });
