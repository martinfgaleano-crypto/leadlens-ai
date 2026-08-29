// REAL-RUN DEMO FALLBACK — fail-closed (§29/§46).
// A real (non-demo) run with a missing Anthropic key must FAIL CLOSED, never silently
// return deterministic demo enrichment (which would contaminate a real customer or
// validation run with fabricated coverage). Explicit DEMO_MODE=true is unaffected.

import assert from "node:assert/strict";

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

const candidate = { id: "c1", company: "Acme", domain: "acme.com", source: "public_signal", confidence_score: 0.8 } as never;
const criteria = { offer_summary: "x", target_industries: [], buying_signals: [] } as never;

const run = async () => {
  await t("real run (not demo) with missing Anthropic key FAILS CLOSED (no silent demo)", async () => {
    delete process.env.DEMO_MODE;
    delete process.env.ANTHROPIC_API_KEY;
    const { runResearchAgent } = await import("@/lib/agents/research-agent");
    await assert.rejects(() => runResearchAgent(candidate, criteria), /anthropic_key_missing|fail-closed/i);
  });
  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
