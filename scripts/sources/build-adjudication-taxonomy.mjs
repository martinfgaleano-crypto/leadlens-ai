#!/usr/bin/env node
// Reproducible error taxonomy over persisted adjudications (AI + human active
// decisions). Derives ONLY from stored rows (reviews, signals, sources,
// companies) — no re-judging, no network. Multi-label; deterministic rules.
// Output: ml/data/adjudication-taxonomy/adjudication-taxonomy-v1.json
// Usage: npm run sources:taxonomy

import { writeFileSync, mkdirSync } from "node:fs";
import { loadEnv } from "../lib/load-env.mjs";

const TAXONOMY_VERSION = "adjudication-taxonomy-v1";
const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error("Supabase env missing"); process.exit(1); }
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: reviews } = await db.from("vault_signal_reviews")
  .select("signal_id, review_status, review_origin, reason_codes, reviewer_note, evidence_tier, rights_status, company_match_verdict, date_verdict, claim_verdict, opportunity_verdict, reviewed_at, review_version")
  .order("reviewed_at", { ascending: false }).order("review_version", { ascending: false });
const active = new Map();
for (const r of reviews ?? []) if (!active.has(r.signal_id)) active.set(r.signal_id, r);

const sigIds = [...active.keys()];
const { data: signals } = await db.from("vault_signals").select("id, company_id, source_id, signal_type, signal_summary, signal_date").in("id", sigIds);
const bySig = new Map((signals ?? []).map((s) => [s.id, s]));
const { data: sources } = await db.from("vault_sources").select("id, source_url, source_type, published_at, freshness_status, raw_metadata").in("id", (signals ?? []).map((s) => s.source_id).filter(Boolean));
const srcById = new Map((sources ?? []).map((s) => [s.id, s]));
const { data: companies } = await db.from("vault_companies").select("id, name, region, country, description").in("id", (signals ?? []).map((s) => s.company_id).filter(Boolean));
const coById = new Map((companies ?? []).map((c) => [c.id, c]));

// Deterministic multi-label classifier over persisted evidence + review text.
function classify(review, signal, source, company) {
  const labels = [];
  const note = (review.reviewer_note ?? "").toLowerCase();
  const rc = review.reason_codes ?? [];
  const qual = source?.raw_metadata?.qualification ?? {};
  const status = review.review_status;

  if (/job posting/.test(note)) labels.push("job_posting_as_company");
  if (/publisher|index page|site\b/.test(note) && rc.includes("wrong_company")) labels.push("publisher_as_company");
  if (/seo|hiring guide|listicle|aggregate|service page|trends article|editorial/.test(note)) labels.push("seo_listicle_or_editorial");
  if (/not an entity|category|'b2b companies'/.test(note)) labels.push("category_like_company");
  if (/facility name|truncated|composite/.test(note)) labels.push("identity_incomplete_or_composite");
  if (/headline|title/.test(company?.description ?? "") && review.company_match_verdict === false) labels.push("headline_derived_identity");
  if (rc.includes("stale_signal") || source?.freshness_status === "stale") labels.push("stale_signal");
  if (/region mismatch|us\/uk|geograph/.test(note)) labels.push("geography_mismatch");
  if (/claim is about|real signal belongs|stored entity/.test(note)) labels.push("source_company_mismatch");
  if (rc.includes("generic_mention") && labels.length === 0) labels.push("generic_mention");
  if (qual.qualified_opportunity === false || review.opportunity_verdict === false) labels.push("no_qualified_opportunity");
  if (labels.length === 0 && status === "approved") labels.push("clean_approved");
  if (labels.length === 0) labels.push("other");
  return labels;
}

const rows = [];
for (const [sigId, review] of active) {
  const signal = bySig.get(sigId);
  const source = signal ? srcById.get(signal.source_id) : null;
  const company = signal ? coById.get(signal.company_id) : null;
  rows.push({
    signal_id: sigId,
    company: company?.name ?? null,
    signal_type: signal?.signal_type ?? null,
    signal_date: signal?.signal_date ?? null,
    source_url: source?.source_url ?? null,
    provider: source?.raw_metadata?.evidence?.provider ?? null,
    region: company?.region ?? null,
    country: company?.country ?? null,
    decision: review.review_status,
    review_origin: review.review_origin ?? "human",
    reason_codes: review.reason_codes ?? [],
    error_labels: classify(review, signal, source, company),
  });
}

const counts = {};
for (const r of rows) for (const l of r.error_labels) counts[l] = (counts[l] ?? 0) + 1;
const byOrigin = { human: rows.filter((r) => r.review_origin === "human").length, ai_assisted: rows.filter((r) => r.review_origin === "ai_assisted").length };
const out = {
  taxonomy_version: TAXONOMY_VERSION,
  generated_from: "persisted vault_signal_reviews (latest active per signal) + signals + sources + companies",
  generated_at: new Date().toISOString(),
  totals: { decisions: rows.length, by_origin: byOrigin, label_counts: counts },
  decisions: rows.sort((a, b) => a.signal_id.localeCompare(b.signal_id)),
};
mkdirSync("ml/data/adjudication-taxonomy", { recursive: true });
writeFileSync(`ml/data/adjudication-taxonomy/${TAXONOMY_VERSION}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ decisions: rows.length, by_origin: byOrigin, label_counts: counts }, null, 2));
console.log(`written: ml/data/adjudication-taxonomy/${TAXONOMY_VERSION}.json`);
