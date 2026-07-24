import { evaluatePilotPreflight } from "../../lib/ops/pilot-preflight";
import { loadEnvConfig } from "@next/env";
import { execFileSync } from "node:child_process";

loadEnvConfig(process.cwd());

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const commit = git(["rev-parse", "--short", "HEAD"]);
const dirty = (git(["status", "--porcelain"]) ?? "unknown") !== "";

const result = evaluatePilotPreflight();
console.log(JSON.stringify({
  check: "leadlens_pilot_e2e_preflight",
  checked_at: new Date().toISOString(),
  git_commit: commit ?? "unavailable",
  working_tree_dirty: dirty,
  ...result,
}, null, 2));

if (!result.ready) {
  console.error("\nSTOPPED: no provider calls were made. Resolve blockers before the real E2E.");
  process.exit(2);
}

console.log("\nREADY: configuration checks passed. Run provider health before consuming the E2E budget.");
