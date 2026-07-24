import assert from "node:assert/strict";
import { evaluatePilotHealth } from "../../lib/ops/pilot-run-gate";
import type { ProviderStatus } from "../../lib/ops/provider-health";

function status(id: string, state: ProviderStatus["state"]): ProviderStatus {
  return { id, name: id, role: "", configured: true, state, state_kind: "confirmed_by_provider", detail: null, latency_ms: 1, credits: { value: null, kind: "unavailable" }, usage: null, fallback: "", impact: "", probed_at: "now" };
}

const ready = evaluatePilotHealth([
  status("anthropic", "ok"), status("supabase", "ok"), status("serper", "ok"), status("firecrawl", "ok"),
]);
assert.deepEqual(ready, { ready: true, blockers: [], operating_mode: "full_discovery" });

const stopped = evaluatePilotHealth([
  status("anthropic", "exhausted"), status("supabase", "ok"), status("serper", "exhausted"), status("firecrawl", "ok"),
]);
assert.equal(stopped.ready, false);
assert.equal(stopped.operating_mode, "stopped");
assert.ok(stopped.blockers.some((item) => item.includes("Anthropic")));
assert.ok(stopped.blockers.some((item) => item.includes("search")));

console.log("✅ healthy minimum stack opens the full-discovery gate");
console.log("✅ exhausted Anthropic/search stops before benchmark execution");
console.log("\n2/2 passed");
