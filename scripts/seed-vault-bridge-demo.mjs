#!/usr/bin/env node
// End-to-end [DEMO] seed for the full chain:
//   Lead Hunter brief → run → permitted sources → candidates → approve →
//   promote to Vault → Bridge preview → Bridge dry-run.
// API-driven so every policy gate applies. Company-level only: no contacts,
// no emails, no network fetches, no Apollo, no LinkedIn.
//
// Usage: BASE_URL=http://localhost:3000 ADMIN_TOKEN=... npm run seed:vault-bridge-demo
// Refuses non-localhost targets unless FORCE=true (never seed production by accident).

import { loadEnv } from "./lib/load-env.mjs";

const env = loadEnv();
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? env.ADMIN_SECRET_TOKEN ?? "";

const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL);
if (!isLocal && process.env.FORCE !== "true") {
  console.error(`Refusing to seed non-local target ${BASE_URL}. Set FORCE=true only if you really mean it.`);
  process.exit(1);
}

async function api(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${data.error ?? "unknown error"}`);
  return data;
}

const today = new Date();
const daysAgo = (n) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);

// Safe, clearly-fake, permitted-category sources. First line format: "Company — evidence".
const SOURCES = [
  { source_url: "https://demo-one.example.com/careers", source_title: "[DEMO] Demo One careers page", source_category: "public_job_post", usage_rights_status: "permitted",
    pasted_context: `Demo Company One — [DEMO] hiring 12 operations roles announced ${daysAgo(10)}. Expansion of the Bogotá logistics hub with new B2B fulfillment services for enterprise clients across the Andean region.` },
  { source_url: "https://demo-two.example.com/news/funding", source_title: "[DEMO] Demo Two funding note", source_category: "public_news", usage_rights_status: "permitted",
    pasted_context: `Demo Company Two — [DEMO] announced Series A funding on ${daysAgo(20)} to expand its SaaS analytics platform for mid-market retailers in LATAM, opening a new office in Medellín.` },
  { source_url: "https://demo-three.example.com/press", source_title: "[DEMO] Demo Three product launch", source_category: "company_website", usage_rights_status: "permitted",
    pasted_context: `Demo Company Three — [DEMO] launched a new enterprise pricing tier on ${daysAgo(45)} targeting logistics operators, with public case studies from two regional carriers.` },
  { source_url: "https://demo-four.example.com/events", source_title: "[DEMO] Demo Four conference page", source_category: "event_conference_page", usage_rights_status: "permitted",
    pasted_context: `Demo Company Four — [DEMO] confirmed as exhibitor at the ${daysAgo(5)} B2B supply-chain expo, presenting its new cross-border freight product line.` },
];

try {
  console.log(`Target: ${BASE_URL}${isLocal ? " (local)" : " (FORCED remote)"}\n`);

  console.log("1/8 Creating [DEMO] brief…");
  const { item: brief } = await api("/api/admin/lead-hunter/briefs", {
    name: "[DEMO] Vault bridge demo brief",
    target_market: "B2B logistics and SaaS in LATAM",
    region: "LATAM", country: "Colombia", industry: "logistics",
    icp_notes: "[DEMO] Mid-market B2B companies with expansion, hiring, or funding signals.",
    signal_types: ["hiring", "funding", "expansion", "product_launch"],
    max_candidates: 10,
  });

  console.log("2/8 Creating run…");
  const { item: run } = await api("/api/admin/lead-hunter/runs", { brief_id: brief.id });

  console.log("3/8 Adding 4 permitted [DEMO] sources…");
  for (const s of SOURCES) await api(`/api/admin/lead-hunter/runs/${run.id}/sources`, s);

  console.log("4/8 Generating candidates…");
  const gen = await api(`/api/admin/lead-hunter/runs/${run.id}/generate`, {});
  console.log(`    created=${gen.summary?.candidates_created ?? "?"} blocked=${gen.summary?.blocked_sources ?? 0}`);

  console.log("5/8 Approving permitted candidates…");
  const { items: candidates } = await api(`/api/admin/lead-hunter/candidates?run_id=${run.id}`);
  const promotable = (candidates ?? []).filter((c) => c.safety_status === "ok" && c.review_status === "pending_review");
  for (const c of promotable) await api(`/api/admin/lead-hunter/candidates/${c.id}/approve`, {});

  console.log(`6/8 Promoting ${promotable.length} candidates to Vault…`);
  let promoted = 0;
  for (const c of promotable) {
    try { await api(`/api/admin/lead-hunter/candidates/${c.id}/promote-to-vault`, {}); promoted++; }
    catch (err) { console.log(`    skip ${c.company_name}: ${err.message}`); }
  }
  console.log(`    promoted=${promoted}`);

  console.log("7/8 Bridge preview…");
  const preview = await api("/api/admin/vault-report-bridge/preview", {
    target_market: "B2B logistics LATAM", icp_notes: "expansion hiring funding logistics",
    region: "LATAM", country: "Colombia", max_candidates: 10, freshness_preference: "any",
  });
  console.log(`    ${preview.result?.message ?? "no message"}`);

  console.log("8/8 Bridge dry-run…");
  const dryRun = await api("/api/admin/vault-report-bridge/dry-run", {
    target_market: "B2B logistics LATAM", icp_notes: "expansion hiring funding logistics",
    region: "LATAM", country: "Colombia", max_candidates: 10, freshness_preference: "any",
  });
  console.log(`    lead_candidates=${dryRun.lead_candidates?.length ?? 0} usage_recorded=${dryRun.usage_recorded}`);

  console.log(`\nDone. Inspect in the admin UI:
  ${BASE_URL}/admin/lead-hunter
  ${BASE_URL}/admin/lead-hunter/candidates?run_id=${run.id}
  ${BASE_URL}/admin/vault-foundation
  ${BASE_URL}/admin/vault-report-bridge`);
} catch (err) {
  console.error(`\nSeed failed: ${err.message}`);
  console.error("Checklist: dev server running? migrations 029+030 applied? ADMIN_TOKEN correct? (npm run check:supabase / probe:supabase)");
  process.exit(1);
}
