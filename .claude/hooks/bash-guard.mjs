#!/usr/bin/env node
// LeadLens PreToolUse Bash guard — DETERMINISTIC SAFETY (deny-only).
// Blocks a small set of standing-rule violations before a Bash command runs. It
// NEVER acts, mutates, deploys, or bypasses anything — it only refuses. Exit 2 =
// block (stderr shown to Claude); exit 0 = allow. Unknown/unparseable input allows
// (fail-open) so the guard can never wedge the workflow.
import { readFileSync } from "node:fs";

let input;
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }
if (input?.tool_name !== "Bash") process.exit(0);
const cmd = String(input?.tool_input?.command ?? "");

const DENY = [
  // Standing rule: never push automatically (git push ≠ deployed).
  { re: /\bgit\s+push\b/, why: "Pushing is a founder action — this workflow never pushes automatically. Commit locally and hand off the commit." },
  // Never auto-apply / reset production migrations.
  { re: /\bsupabase\s+db\s+(push|reset)\b/, why: "Applying/resetting migrations to production is a founder action. Prepare the forward-only migration and report FOUNDER ACTION REQUIRED (/leadlens-migration-safe)." },
  { re: /\bprisma\s+(migrate\s+(deploy|reset)|db\s+push)\b/, why: "Auto-applying schema to production is a founder action." },
  // Catastrophic filesystem deletes.
  { re: /\brm\s+-rf?\s+(\/(?:\s|$)|~|\$HOME|\/\*|\.\.(\/|\s|$))/, why: "Refusing a catastrophic recursive delete of a root/home path." },
  // Destructive SQL executed directly via a client (migrations use guarded SQL files, not this).
  { re: /\b(psql|mysql)\b[^\n]*\b(drop\s+table|truncate|delete\s+from)\b/i, why: "Refusing a direct destructive SQL command. Destructive schema changes go through a guarded, founder-applied migration." },
  // Deploy triggers.
  { re: /\b(vercel\s+(deploy|--prod|--prebuilt)|npm\s+publish)\b/, why: "Deploying/publishing is a founder action, not an automatic step." },
];

for (const { re, why } of DENY) {
  if (re.test(cmd)) { process.stderr.write(`[leadlens-guard] Blocked: ${why}\n`); process.exit(2); }
}
process.exit(0);
