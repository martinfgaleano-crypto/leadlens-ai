#!/usr/bin/env node
/**
 * Lead Hunter demo seed (dev/admin-only). Creates 1 brief, 1 run, 4 sample
 * source inputs, and generates candidates via the API — clearly-sample data,
 * marked pending_review. Refuses to run against production unless FORCE=true.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 ADMIN_TOKEN=<x-admin-token> node scripts/seed-lead-hunter-demo.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) { console.error("ADMIN_TOKEN is required."); process.exit(1); }
if (BASE.includes("vercel.app") && process.env.FORCE !== "true") {
  console.error("Refusing to seed a deployed environment without FORCE=true.");
  process.exit(1);
}

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": TOKEN },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${d.error ?? "error"}`);
  return d;
};

console.log(`Seeding Lead Hunter demo against ${BASE}…`);

const brief = await post("/api/admin/lead-hunter/briefs", {
  name: "[DEMO] LATAM logistics expansion watch",
  target_market: "Mid-size logistics companies expanding operations",
  region: "LATAM", country: "Colombia", industry: "Logistics",
  icp_notes: "Sample brief created by seed script — safe demo data.",
  signal_types: ["expansion", "hiring", "funding"],
  max_candidates: 10,
});
console.log("brief:", brief.item.id);

const run = await post("/api/admin/lead-hunter/runs", { brief_id: brief.item.id });
console.log("run:", run.item.id);

const SOURCES = [
  { source_url: "https://example.com/news/demo-logistics-expansion", source_category: "public_news", usage_rights_status: "permitted",
    pasted_context: "DemoLogistics S.A.S — announced a second distribution center in Barranquilla and plans to add 60 staff (published 2026-06-25)." },
  { source_url: "https://example.com/jobs/demo-carrier-sales", source_category: "public_job_post", usage_rights_status: "permitted",
    pasted_context: "Sample Carrier Co — posted 12 open sales and operations roles for its new Bogotá hub." },
  { source_url: "https://example.com/registry/demo-freight", source_category: "public_registry", usage_rights_status: "permitted",
    pasted_context: "Demo Freight Ltda — registered a new import license for refrigerated cargo (registry update 2026-07-01)." },
  { source_url: "https://example.com/events/demo-expo", source_category: "event_conference_page", usage_rights_status: "unverified",
    pasted_context: "Sample 3PL Group — listed as exhibitor at Expo Logística 2026." },
];
for (const src of SOURCES) {
  const r = await post(`/api/admin/lead-hunter/runs/${run.item.id}/sources`, src);
  console.log("source:", src.source_url, "->", r.safety_status ?? "ok");
}

const gen = await post(`/api/admin/lead-hunter/runs/${run.item.id}/generate`, {});
console.log("generated:", JSON.stringify(gen.summary));
console.log(`\nDone. Review at ${BASE}/admin/lead-hunter/candidates?run_id=${run.item.id}`);
