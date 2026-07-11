#!/usr/bin/env node
// E2E shape test for the Vault → Report bridge dry-run payload.
// Calls preview + dry-run and verifies the LeadCandidate[] contract:
// source "vault", confidence 0–1, no invented contact fields, signal_date
// preserved-or-null, vault traceability in raw_context.
//
// Usage: BASE_URL=http://localhost:3000 ADMIN_TOKEN=... npm run test:vault-bridge

import { loadEnv } from "./lib/load-env.mjs";

const env = loadEnv();
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? env.ADMIN_SECRET_TOKEN ?? "";

const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok, detail }); };

async function api(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const criteria = { target_market: "B2B", icp_notes: "expansion hiring funding", max_candidates: 10, freshness_preference: "any" };

const preview = await api("/api/admin/vault-report-bridge/preview", criteria);
check("preview returns 200", preview.status === 200, `status=${preview.status}`);
check("preview returns selection result", !!preview.data?.result && Array.isArray(preview.data.result.selected));

const dryRun = await api("/api/admin/vault-report-bridge/dry-run", criteria);
check("dry-run returns 200", dryRun.status === 200, `status=${dryRun.status}`);
check("dry-run records no usage", dryRun.data?.usage_recorded === false);
check("dry-run creates no reservations", dryRun.data?.reservations_created === false);

const candidates = dryRun.data?.lead_candidates ?? [];
check("dry-run returns lead_candidates array", Array.isArray(candidates), typeof candidates);

if (candidates.length === 0) {
  console.log("ℹ️  Vault selection is empty — shape checks are vacuous. Seed data first: npm run seed:vault-bridge-demo");
} else {
  check("every candidate has source 'vault'", candidates.every((c) => c.source === "vault"));
  check("every candidate has a company name", candidates.every((c) => typeof c.company === "string" && c.company.length > 0));
  check("confidence is 0–1", candidates.every((c) => typeof c.confidence_score === "number" && c.confidence_score >= 0 && c.confidence_score <= 1));
  check("signal_date preserved or null (never fabricated)", candidates.every((c) => c.signal_date === null || c.signal_date === undefined || /^\d{4}-\d{2}-\d{2}/.test(c.signal_date)));
  check("no contact fields invented (name/title/email/linkedin)", candidates.every((c) => c.name == null && c.title == null && c.email == null && c.linkedin_url == null));
  check("raw_context carries Vault traceability", candidates.every((c) => typeof c.raw_context === "string" && c.raw_context.includes("Vault refs:")));
  check("source_url is string when present", candidates.every((c) => c.source_url === undefined || typeof c.source_url === "string"));
}

const passed = checks.filter((c) => c.ok).length;
for (const c of checks) console.log(`${c.ok ? "✅" : "❌"} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ""}`);
console.log(`\nResult: ${passed} passed, ${checks.length - passed} failed${candidates.length === 0 ? " (empty Vault selection)" : ""}.`);
process.exit(passed === checks.length ? 0 : 1);
