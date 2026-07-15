// ─── Shadow scoring: score a report's opportunities with the registered model
// and store the comparison WITHOUT touching the customer-facing order.
// Run: npm run ml:shadow -- <jobId> [--model demo|real]

import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { adaptRealSnapshot, sha256, type RealFeatureSnapshot } from "@/lib/ml/snapshot-adapter";

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
  const jobId = process.argv[2];
  const modelKind = process.argv.includes("--model") ? process.argv[process.argv.indexOf("--model") + 1] : "demo";
  if (!jobId) { console.error("usage: npm run ml:shadow -- <jobId> [--model demo|real]"); process.exit(1); }

  const artifactDir = modelKind === "real" ? "ml/runs/real/artifacts" : "ml/artifacts/demo";
  const artifact = `${artifactDir}/logistic_calibrated.joblib`;
  const evalReport = modelKind === "real" ? "ml/runs/real/reports/evaluation_report.json" : "ml/reports/demo/evaluation_report.json";
  if (!existsSync(artifact) || !existsSync(evalReport)) {
    console.log(JSON.stringify({ status: "blocked", reason: `${modelKind} artifact not trained yet (${artifact})` }));
    process.exit(2);
  }
  const features = (JSON.parse(readFileSync(evalReport, "utf8")) as { features: string[] }).features;

  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: snapshot } = await db.from("snapshot_reports").select("job_id, search_id, report_json").eq("job_id", jobId).maybeSingle();
  const json = snapshot?.report_json as { ranked_opportunities?: Array<{ company?: string; rank?: number; feature_snapshot?: RealFeatureSnapshot }> } | null;
  const opps = (json?.ranked_opportunities ?? []).filter((o) => o.feature_snapshot);
  if (opps.length === 0) { console.log(JSON.stringify({ status: "blocked", reason: "report has no feature snapshots (pre-Foundation report?)" })); process.exit(2); }

  mkdirSync("ml/data/shadow", { recursive: true });
  const inPath = `ml/data/shadow/${jobId}.jsonl`;
  const outPath = `ml/data/shadow/${jobId}.predictions.jsonl`;
  const featPath = `ml/data/shadow/${jobId}.features.json`;
  writeFileSync(featPath, JSON.stringify(features));
  writeFileSync(inPath, opps.map((o) => {
    const rec = adaptRealSnapshot(o.feature_snapshot!, { search_id: snapshot!.search_id, job_id: jobId, baseline_rank: o.rank ?? null })!;
    rec.example_key = sha256(`${jobId}|${rec.company_key_hash}`);
    return JSON.stringify(rec);
  }).join("\n") + "\n");

  execFileSync("ml/.venv/bin/python", ["-m", "leadlens_ml.run_infer", inPath, artifact, featPath, outPath], { env: { ...process.env, PYTHONPATH: "ml/src" }, stdio: ["ignore", "inherit", "inherit"] });

  const preds = readFileSync(outPath, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { example_key: string; baseline_rank: number | null; probability: number; predicted_class: string; out_of_distribution: boolean; ood_reasons: string[]; missingness_ratio: number; artifact_checksum: string; model_version: string });

  // Shadow ranking: order by ML probability; compare to baseline order. K = 3.
  const K = 3;
  const byMl = [...preds].sort((a, b) => b.probability - a.probability);
  const shadowRows = preds.map((p) => {
    const shadowRank = byMl.findIndex((x) => x.example_key === p.example_key) + 1;
    const baselineRank = p.baseline_rank ?? 999;
    return {
      example_key: p.example_key,
      job_id: jobId,
      probability: p.probability,
      predicted_class: p.predicted_class === "useful" ? 1 : 0,
      ood: p.out_of_distribution,
      missingness: { ratio: p.missingness_ratio },
      shadow: {
        baseline_rank: p.baseline_rank,
        shadow_rank: shadowRank,
        rank_delta: p.baseline_rank !== null ? p.baseline_rank - shadowRank : null,
        would_enter_topk: baselineRank > K && shadowRank <= K,
        would_leave_topk: baselineRank <= K && shadowRank > K,
        disagreement: p.baseline_rank !== null && Math.abs(baselineRank - shadowRank) >= 2,
        model_kind: modelKind,
        note: modelKind === "demo" ? "TECHNICAL VALIDATION ONLY — demo-trained model, not product performance" : "experimental real-data model",
      },
      top_factors: null,
    };
  });

  // Store (blocked honestly pre-032).
  const { error } = await db.from("ml_predictions").insert(shadowRows.map((r) => ({ ...r, model_id: null })));
  const dbStatus = error ? (/relation|does not exist|schema cache/i.test(error.message) ? "blocked_by_migration_032 (stored locally only)" : error.message.slice(0, 80)) : `stored ${shadowRows.length}`;
  writeFileSync(`ml/data/shadow/${jobId}.shadow.json`, JSON.stringify(shadowRows, null, 2));
  console.log(JSON.stringify({ status: "completed", job_id: jobId, predictions: shadowRows.length, db: dbStatus, customer_impact: "none — shadow only", rows: shadowRows.map((r) => ({ baseline: r.shadow.baseline_rank, shadow: r.shadow.shadow_rank, p: Number(r.probability.toFixed(3)), ood: r.ood })) }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
