// ─── ML dataset builder (real data only) ─────────────────────────────────────
// Extracts training examples from completed reports that carry Intelligence
// Foundation feature snapshots, joins customer feedback labels, applies
// quality gates, exports JSONL for the Python trainer and (when migration 032
// is applied) upserts ml_training_examples / ml_labels / ml_dataset_versions.
// Fixtures can NEVER enter this path: demo_only rows are rejected at export
// AND at training (double gate).
// Run: npm run ml:dataset

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { adaptRealSnapshot, sha256, type LabRecord, type RealFeatureSnapshot } from "@/lib/ml/snapshot-adapter";
import { normalizeSentiment } from "@/lib/intelligence/feedback-taxonomy";
import { companyKey } from "@/lib/intelligence/feature-snapshot";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env as Record<string, string> };
}

async function main() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(JSON.stringify({ status: "blocked", reason: "Supabase env missing" }));
    process.exit(2);
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1. Reports with snapshots (post-Intelligence-Foundation only — historic
  //    reports without snapshots stay excluded; never reconstructed).
  const { data: reports } = await db.from("snapshot_reports")
    .select("job_id, search_id, status, created_at, report_json")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(200);

  // 2. Feedback (customer labels) keyed by job+company.
  const { data: feedback } = await db.from("opportunity_feedback")
    .select("job_id, company, feedback_signal, normalized_sentiment")
    .limit(2000);
  const labelByKey = new Map<string, 0 | 1 | null>();
  for (const f of feedback ?? []) {
    if (!f.job_id) continue;
    const sentiment = (f.normalized_sentiment ?? normalizeSentiment(f.feedback_signal)) as -1 | 0 | 1 | null;
    if (sentiment === null) continue; // operational events never become labels
    // partially_useful (0) is recorded but not used as a binary target in v0
    if (sentiment === 0) continue;
    labelByKey.set(`${f.job_id}|${companyKey(f.company)}`, sentiment === 1 ? 1 : 0);
  }

  const records: LabRecord[] = [];
  const seen = new Set<string>();
  let reportsWithSnapshots = 0, skippedNoSnapshot = 0, duplicates = 0;
  for (const report of reports ?? []) {
    const json = report.report_json as { ranked_opportunities?: Array<{ company?: string; rank?: number; feature_snapshot?: RealFeatureSnapshot }> } | null;
    const opps = json?.ranked_opportunities ?? [];
    const withSnaps = opps.filter((o) => o.feature_snapshot);
    if (withSnaps.length === 0) { skippedNoSnapshot++; continue; }
    reportsWithSnapshots++;
    for (const opp of withSnaps) {
      const record = adaptRealSnapshot(opp.feature_snapshot!, { search_id: report.search_id, job_id: report.job_id, baseline_rank: opp.rank ?? null });
      if (!record) continue;
      record.example_key = sha256(`${report.job_id}|${record.company_key_hash}`);
      if (seen.has(record.example_key)) { duplicates++; continue; }
      seen.add(record.example_key);
      const label = opp.company ? labelByKey.get(`${report.job_id}|${companyKey(opp.company)}`) : undefined;
      record.customer_label = label ?? null;
      record.customer_label_source = label !== undefined ? "customer_feedback" : null;
      records.push(record);
    }
  }

  mkdirSync("ml/data/real", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = `ml/data/real/dataset-${stamp}.jsonl`;
  const body = records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
  writeFileSync(outPath, body);
  const checksum = createHash("sha256").update(body).digest("hex");

  const labeled = records.filter((r) => r.customer_label !== null).length;
  const manifest = {
    dataset_version: `real-extract-${stamp}`,
    feature_schema_version: 1,
    source: "snapshot_reports + opportunity_feedback (real only; fixtures rejected by contract)",
    reports_scanned: (reports ?? []).length,
    reports_with_snapshots: reportsWithSnapshots,
    reports_excluded_no_snapshot: skippedNoSnapshot,
    examples: records.length,
    customer_labeled: labeled,
    duplicates_removed: duplicates,
    demo_only: false,
    checksum,
    output: outPath,
    training_gate: records.length >= 40 ? "eligible" : `blocked_insufficient_data (${records.length} < 40 examples)`,
  };
  writeFileSync(`ml/data/real/manifest-${stamp}.json`, JSON.stringify(manifest, null, 2));

  // 3. Best-effort DB registration (blocked_by_migration_032 until applied).
  const dbRows = records.map((r) => ({
    example_key: r.example_key!,
    company_key_hash: r.company_key_hash,
    search_id: null, // monitor_key is hashed in the export; raw search_id lives on the snapshot row
    job_id: r.job_id ?? null,
    feature_snapshot: r as unknown as Record<string, unknown>,
    feature_schema_version: 1,
    baseline_meta: { baseline_rank: r.baseline_rank, baseline_score: r.baseline_score },
    provenance: r.customer_label !== null ? "customer_feedback" : "real_unlabeled",
    label_status: r.customer_label !== null ? "gold" : "unlabeled",
    aggregated_label: r.customer_label,
    near_duplicate_cluster: r.company_key_hash,
    demo_only: false,
  }));
  let dbStatus = "skipped (no rows)";
  if (dbRows.length > 0) {
    const { error } = await db.from("ml_training_examples").upsert(dbRows, { onConflict: "example_key" });
    dbStatus = error
      ? (/relation|does not exist|schema cache/i.test(error.message) ? "blocked_by_migration_032" : `error: ${error.message.slice(0, 80)}`)
      : `upserted ${dbRows.length}`;
  }

  console.log(JSON.stringify({ ...manifest, db_registration: dbStatus }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
