#!/usr/bin/env node
// Supabase + env readiness check. Prints PASS/WARN/FAIL per item with impact
// and remediation. NEVER prints secret values — presence only.
// Usage: npm run check:supabase   (STRICT=true to exit 1 on WARN too)

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
const results = [];
const add = (level, name, impact, action) => results.push({ level, name, impact, action });

// ── Env presence (values never shown) ──
const presence = [
  ["NEXT_PUBLIC_SUPABASE_URL", "FAIL", "All Vault/Lead Hunter/Bridge storage is a no-op without it.", "Set it in .env.local (Supabase project settings → API)."],
  ["SUPABASE_SERVICE_ROLE_KEY", "FAIL", "Server-side stores cannot read/write.", "Set it in .env.local. Never expose it as NEXT_PUBLIC_*."],
  ["ADMIN_SECRET_TOKEN", "FAIL", "All /api/admin/* routes reject in production; admin UI unusable.", "Set a strong random token in .env.local and Vercel."],
  ["INTERNAL_RUN_SECRET", "WARN", "Async run processor falls back to ADMIN_SECRET_TOKEN.", "Set a dedicated secret for the internal processor (recommended)."],
  ["CRON_SECRET", "WARN", "Vercel cron (job drainer) cannot authenticate.", "Set CRON_SECRET in Vercel if the daily drainer cron is enabled."],
  ["NEXT_PUBLIC_APP_URL", "WARN", "Absolute links/emails may point to the wrong host.", "Set to the deployed URL in production env."],
];
for (const [key, level, impact, action] of presence) {
  const present = has(env, key);
  add(present ? "PASS" : level, `${key} ${present ? "present" : "MISSING"}`, impact, action);
}

// ── Apollo must be off by default ──
const apollo = (env.APOLLO_LICENSED_PROVIDER_ENABLED ?? "").toLowerCase();
if (apollo === "" || apollo === "false") {
  add("PASS", "APOLLO_LICENSED_PROVIDER_ENABLED is false/missing (licensed-only default)", "", "");
} else {
  add("WARN", "APOLLO_LICENSED_PROVIDER_ENABLED is enabled", "Apollo becomes usable — customer-facing use stays blocked by code, but confirm this is intentional.", "Set to false unless a license is in place.");
}

// ── Secret safety (static) ──
try {
  const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n");
  const badTracked = tracked.filter((f) => /^\.env(\.local|\.production|\.development)?$/.test(f));
  add(badTracked.length === 0 ? "PASS" : "FAIL", ".env/.env.local not tracked by git",
    "Tracked env files leak secrets to anyone with repo access.", `Run: git rm --cached ${badTracked.join(" ")} and rotate the keys.`);
} catch { add("WARN", ".env tracking check skipped (not a git repo?)", "", ""); }

const leakKeys = Object.keys(env).filter((k) => k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE/i.test(k));
add(leakKeys.length === 0 ? "PASS" : "FAIL", "No NEXT_PUBLIC_*SERVICE_ROLE* env var",
  "A NEXT_PUBLIC service role key ships the master key to every browser.", "Delete the variable and rotate the service role key immediately.");

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}
const clientLeaks = [];
const clientDirs = ["app", "components"].map((d) => join(process.cwd(), d)).filter((d) => existsSync(d));
for (const file of clientDirs.flatMap((d) => walk(d))) {
  const src = readFileSync(file, "utf8");
  // Only the actual env read is a leak — the key NAME appears legitimately in
  // admin setup instructions and env-health labels.
  if (src.includes('"use client"') && /process\.env(\.SUPABASE_SERVICE_ROLE_KEY|\[["']SUPABASE_SERVICE_ROLE_KEY)/.test(src)) clientLeaks.push(file);
}
add(clientLeaks.length === 0 ? "PASS" : "FAIL", "SUPABASE_SERVICE_ROLE_KEY never read in client components",
  "Client components are bundled for the browser.", `Remove the reference from: ${clientLeaks.join(", ")}`);

const scriptsWithSecretPrints = [];
for (const f of readdirSync(join(process.cwd(), "scripts")).filter((f) => f.endsWith(".mjs"))) {
  const src = readFileSync(join(process.cwd(), "scripts", f), "utf8");
  if (/console\.log\([^)]*(SERVICE_ROLE_KEY|ADMIN_SECRET_TOKEN|ADMIN_TOKEN)\b(?![^)]*present)/i.test(src) && /console\.log\([^)]*env(\.|\[)/.test(src)) {
    scriptsWithSecretPrints.push(f);
  }
}
add(scriptsWithSecretPrints.length === 0 ? "PASS" : "FAIL", "No script prints raw secret values",
  "Terminal output ends up in logs and screenshots.", `Review: ${scriptsWithSecretPrints.join(", ")}`);

// ── Report ──
const icon = { PASS: "✅", WARN: "⚠️ ", FAIL: "❌" };
let fails = 0, warns = 0;
for (const r of results) {
  if (r.level === "FAIL") fails++;
  if (r.level === "WARN") warns++;
  console.log(`${icon[r.level]} [${r.level}] ${r.name}`);
  if (r.level !== "PASS" && r.impact) console.log(`     impact: ${r.impact}\n     action: ${r.action}`);
}
console.log(`\nResult: ${results.length - fails - warns} pass, ${warns} warn, ${fails} fail.`);
if (fails > 0) console.log("Supabase readiness: NOT READY — fix FAIL items above.");
else if (warns > 0) console.log("Supabase readiness: USABLE with warnings.");
else console.log("Supabase readiness: READY.");
process.exit(fails > 0 || (process.env.STRICT === "true" && warns > 0) ? 1 : 0);
